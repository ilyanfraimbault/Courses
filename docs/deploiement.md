# Déploiement

Le site tourne dans deux conteneurs sur le VPS Hostinger : l'application Nuxt,
et Caddy qui termine TLS devant elle. Pousser sur `master` construit l'image,
la publie sur GHCR, la déploie, puis **vérifie** que le serveur la fait
effectivement tourner.

| | |
|---|---|
| VPS | id `1355415`, `srv1355415.hstgr.cloud`, `72.62.29.225` |
| Projet Docker Manager | `courses`, dans `/docker/courses/` |
| Image | `ghcr.io/ilyanfraimbault/courses` |
| Ports occupés par ailleurs | 3001, 3002, 8081, 5051, 3100 (truemain-preprod) |

## Secrets et variables GitHub

| Type | Nom | Contenu |
|---|---|---|
| secret | `HOSTINGER_API_KEY` | jeton hPanel → Compte → API, du compte propriétaire du VPS |
| secret | `COURSES_ENV_FILE` | le contenu de `.env`, une paire `CLÉ=valeur` par ligne |
| variable | `HOSTINGER_VM_ID` | `1355415` |

`COURSES_ENV_FILE` doit contenir au minimum :

```
NUXT_CODE_INSCRIPTION=…          # le code à donner pour créer un compte
NUXT_SESSION_PASSWORD=…          # openssl rand -base64 32
COURS_ADRESSE=srv1355415.hstgr.cloud
ACME_EMAIL=…
```

Laisser `NUXT_CODE_INSCRIPTION` vide **ferme les inscriptions** : c'est le
défaut voulu, le site vivant sur un domaine public.

**Ce secret ne doit jamais être vide.** L'action Hostinger réécrit
`/docker/courses/.env` à chaque exécution : un secret vide effacerait la
configuration du site. C'est pour ça que le job `preflight` échoue bruyamment
plutôt que de sauter.

## Pourquoi le compose est envoyé et non pointé

L'action `hostinger/deploy-on-vps` ne téléverse pas le fichier compose : elle
transmet à l'API une **URL** `github.com/<dépôt>/blob/<sha>/compose.yaml`, que
l'API Hostinger va chercher elle-même, sans authentification. Sur un dépôt privé
cette URL ne rend pas le fichier mais une page de connexion, et le déploiement
échoue.

Une clé de déploiement SSH sur le VPS n'y changerait rien : ce n'est pas le VPS
qui télécharge, c'est l'infrastructure de Hostinger, en HTTPS anonyme.

Le champ `content` de l'API accepte aussi bien le **YAML brut**. Le workflow le
lui donne donc directement, depuis la copie que le runner a déjà extraite. Ça
règle le cas du dépôt privé, et ça retire au passage une dépendance à une action
tierce.

## Amorçage, à faire une fois

**Autoriser le VPS à tirer l'image.** Le paquet GHCR hérite de la visibilité
privée du dépôt. Avec un jeton personnel de portée `read:packages` seulement :

```bash
echo "$PAT" | docker login ghcr.io -u ilyanfraimbault --password-stdin
```

L'identifiant persiste dans `/root/.docker/config.json`. **Ne pas rendre le
paquet public** : l'image contient le contenu des cours.

**Créer le projet.** Facultatif : le premier déploiement le crée. Le monter à la
main permet toutefois de voir Caddy obtenir son certificat avant de confier la
suite à la CI :

```bash
mkdir -p /docker/courses && cd /docker/courses
# le dépôt est privé : copier le compose depuis un poste qui y a accès
vim docker-compose.yml
vim .env          # le même contenu que COURSES_ENV_FILE, plus IMAGE_TAG=latest
docker compose up -d
docker compose logs -f caddy
```

Le fichier doit s'appeler `docker-compose.yml` sur l'hôte : c'est ce que Docker
Manager et un `docker compose` sans `-f` vont chercher.

**Pare-feu** : rien à faire, le groupe `262013` ouvre déjà 80 et 443 en TCP.

## Le domaine

Le déploiement commence sur `srv1355415.hstgr.cloud`, qui a déjà un
enregistrement A public vers le VPS : Let's Encrypt délivre donc un vrai
certificat dès le premier démarrage, sans rien préparer.

Pour passer à un domaine à soi, deux gestes et aucun redéploiement de code :

1. un enregistrement `A` du sous-domaine vers `72.62.29.225` ;
2. `COURS_ADRESSE=…` dans `COURSES_ENV_FILE`, puis relancer le workflow.

Caddy demande le nouveau certificat au chargement. L'ancien reste dans le volume
`courses_caddy_data`, donc faire l'aller-retour ne coûte aucune limite ACME.

## Pourquoi le tag est le SHA du commit

`compose.yaml` référence `${IMAGE_TAG:-latest}` et le workflow passe
`IMAGE_TAG=${{ github.sha }}`. Redéployer un tag **mutable** inchangé ne
déclenche ni pull ni recréation : Docker Manager voit une spécification
identique et ne fait rien, pendant que le déploiement passe au vert. Le tag
immuable est aussi ce qui rend la vérification possible — on peut demander à
l'API si le conteneur tourne bien *ce* commit.

`.github/scripts/verify-rollout.sh` interroge l'API toutes les 15 secondes
jusqu'à dix minutes, et vérifie deux choses distinctes :

1. chaque image `ghcr.io` nommée par le compose tourne le tag attendu — c'est ce
   qui prouve que le déploiement a bien remplacé le code ;
2. **tous** les conteneurs du projet sont en marche et sains, y compris ceux
   bâtis sur des images tierces.

Le second point vaut d'être expliqué. Il n'y était pas au départ, et un
déploiement est passé au vert pendant que Caddy — la seule porte d'entrée
publique — redémarrait en boucle : l'application était saine, injoignable, et
rien ne le disait.

## Deux interpolations, pas une

Le bloc `configs.caddyfile.content` du compose traverse **deux** substitutions :
celle de Docker Compose, puis celle de Caddy. Écrite `{$COURS_ADRESSE}`,
l'adresse est reconnue par Compose, qui remplace la variable et laisse les
accolades : Caddy reçoit alors `{srv1355415.hstgr.cloud}`, une adresse qui ne
qualifie pour aucun certificat, et redémarre indéfiniment.

D'où les `$$` du fichier : Compose les rend sous la forme d'un `$` simple sans
rien interpréter, et Caddy fait sa propre substitution au chargement.

Attention en vérifiant : `docker compose config` réaffiche `$$` tel quel, il ne
permet donc pas de trancher. Pour voir ce qui atterrit vraiment :

```bash
docker compose up -d caddy
docker exec courses-caddy cat /etc/caddy/Caddyfile
docker exec courses-caddy caddy validate --config /etc/caddy/Caddyfile
```

## Sauvegarde

`GET /api/resultats/export` **est** la sauvegarde : un JSON complet, réimportable
par la page « mes résultats », de quelques dizaines de kilo-octets. Le
télécharger de temps en temps suffit.

Sauvegarde binaire, à froid :

```bash
cd /docker/courses
docker compose stop app
docker run --rm -v courses_data:/data -v "$PWD":/sortie alpine \
  tar czf /sortie/cours-db.tgz -C /data .
docker compose start app
```

## Retour arrière

Il n'y a pas de retour arrière automatique. Manuellement, en remettant un tag
connu dans `/docker/courses/.env` :

```bash
cd /docker/courses
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<sha précédent>/' .env
docker compose pull && docker compose up -d
```

## Diagnostic

- `docker compose ps` et `docker compose logs app` sur le VPS ;
- côté API : la liste des projets d'une VM donne l'image, l'état et la santé de
  chaque conteneur — c'est la source du script de vérification ;
- `SQLITE_CANTOPEN` au démarrage signifie que le volume n'est pas inscriptible
  par l'utilisateur `node` ; voir les deux `mkdir`/`chown` du Dockerfile ;
- une sonde qui échoue sur un conteneur qui répond pourtant : vérifier que la
  requête vise `127.0.0.1` et non `localhost`, que Nitro n'écoute pas en IPv6.
