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
NUXT_COURS_MOT_DE_PASSE=…
NUXT_SESSION_PASSWORD=…          # openssl rand -base64 32
COURS_ADRESSE=srv1355415.hstgr.cloud
ACME_EMAIL=…
```

**Ce secret ne doit jamais être vide.** L'action Hostinger réécrit
`/docker/courses/.env` à chaque exécution : un secret vide effacerait la
configuration du site. C'est pour ça que le job `preflight` échoue bruyamment
plutôt que de sauter.

## Amorçage, à faire une fois

Le dépôt est **privé**, ce qui ajoute deux étapes qu'un dépôt public n'a pas.

**1. Laisser Docker Manager cloner le dépôt.** L'action ne téléverse pas le
fichier compose : elle donne une URL à Docker Manager, qui clone depuis le VPS.
Il faut donc une clé de déploiement :

```bash
ssh root@72.62.29.225
ssh-keygen -t ed25519 -f /root/.ssh/courses_deploy -N ''
cat >> /root/.ssh/config <<'EOF'
Host github.com
  IdentityFile /root/.ssh/courses_deploy
  IdentitiesOnly yes
EOF
cat /root/.ssh/courses_deploy.pub
```

Coller la clé publique dans **Settings → Deploy keys** du dépôt, en lecture
seule.

**2. Autoriser le VPS à tirer l'image.** Le paquet GHCR hérite de la visibilité
privée du dépôt. Avec un jeton personnel de portée `read:packages` seulement :

```bash
echo "$PAT" | docker login ghcr.io -u ilyanfraimbault --password-stdin
```

L'identifiant persiste dans `/root/.docker/config.json`. **Ne pas rendre le
paquet public** : l'image contient le contenu des cours.

**3. Créer le projet.** Le plus sûr est de le monter à la main une première
fois, de vérifier que Caddy obtient son certificat, puis de laisser la CI
reprendre :

```bash
mkdir -p /docker/courses && cd /docker/courses
curl -fsSL https://raw.githubusercontent.com/ilyanfraimbault/Courses/master/compose.yaml -o docker-compose.yml
vim .env          # le même contenu que COURSES_ENV_FILE
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
jusqu'à dix minutes, et exige que chaque conteneur bâti sur une image `ghcr.io`
du compose tourne le tag attendu, soit `running` et soit `healthy`. Il est repris
tel quel du dépôt TrueMain : c'est ce qui empêche un déploiement vert de mentir.

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
