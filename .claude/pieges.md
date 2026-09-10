# Les pièges rencontrés

Chacun a coûté du temps, et aucun ne lève d'erreur. Ils sont rangés par domaine,
avec ce qui les a démasqués — c'est souvent le plus réutilisable.

## Contenu et Markdown

### `remark-mdc` avale le `::` fermant à partir de 3.11.1

Le `::` qui suit le contenu d'un slot cesse d'être reconnu comme une fermeture :
il part dans le texte du slot, et les questions suivantes se retrouvent
imbriquées dans le slot de la précédente au lieu d'être ses sœurs. **Seule la
première question de chaque bloc s'affiche.** Aucune erreur, aucun
avertissement.

Épinglé à 3.9.0 par `pnpm.overrides`. Détail et procédure de contrôle dans
`docs/contenu.md`.

**Ce qui l'a démasqué** : comparer le nombre de questions rendues au nombre
compté au build. Le compte du build vient de l'arbre parsé, il reste donc juste
même quand le rendu, lui, perd des nœuds.

### Un préfixe numérique de fichier ne change pas l'URL

`1.cours.md` sert `/cours`. C'est ce qui permet d'ordonner les fiches dans la
barre latérale sans toucher aux chemins. Vérifié sur les 27 fiches après
renommage : mêmes URLs, mêmes comptes de questions, aucun préfixe dans un
chemin.

### La forme de l'arbre de navigation

Un dossier porte **deux** enfants : sa propre page d'index — de même chemin que
lui — et le niveau suivant. Conséquences :

- compter les enfants sans écarter cet auto-lien fait croire à un embranchement
  là où il n'y en a pas (c'est ce qui a fait échouer le premier aplatissement de
  la barre latérale) ;
- l'entête d'un dossier et le lien vers sa page d'index **partagent un seul
  titre**, d'où le doublon « Fonctions usuelles / Fonctions usuelles ».

Trois pistes essayées pour lever ce doublon, aucune ne marche : renommer
l'index le renomme *aussi* comme entête ; un `.navigation.yml` est ignoré au
profit de l'`index.md` ; retirer le chemin du nœud parent ne supprime pas le
lien engendré, il en ajoute un second. Le slot `link-title` de
`UContentNavigation` s'applique à l'entête d'accordéon, **pas** au lien d'index.

### Un fragment d'arbre se rend avec `ContentRenderer`, mais pas d'un seul coup

Le mode quiz découpe des morceaux du corps d'une fiche — un énoncé, une
proposition, une solution — et les fait rendre par `ContentRenderer`, à qui on
passe `{ body: { type: 'minimark', value: fragment } }`. Ça marche, formules
KaTeX comprises, puisqu'elles sont déjà mises en forme au build.

Mais **le contenu n'apparaît pas au même tick que le composant** : les
composants de prose sont résolus en asynchrone. Un contrôle qui lit le texte dès
que les boutons de réponse existent le trouve vide, et conclut à tort que le
rendu est cassé. Attendre le contenu lui-même (`.cours-enonce p`,
`.cours-enonce .katex`), pas son conteneur.

### `navigation.title` sert deux fois

Il nomme l'entrée dans la barre latérale **et** l'entête d'accordéon du dossier.
Utile pour les fiches (`Cours`, `Exercices`, `Révisions`, `Entraînement`, mêmes
intitulés dans tous les chapitres) ; à manier avec précaution sur un `index.md`.

## Glisser-déposer (`useSortable` de VueUse)

Deux défauts qui se cachaient l'un l'autre, et qui ont donné un glisser
totalement inopérant sans le moindre signe.

### `useSortable` ne s'attache qu'au montage

Sauf si on lui passe **`watchElement: true`**. Un conteneur rendu sous `v-if` /
`v-else` n'existe pas au montage : le tri n'est alors jamais installé. C'est le
cas de la liste des chapitres, absente tant que la to-do est vide.

### `onUpdate` réordonne déjà le tableau

`useSortable` fournit un `onUpdate` par défaut qui appelle `moveArrayElement`,
et il s'exécute **avant** `onEnd`. Refaire le déplacement dans `onEnd` en fait
deux : au sein d'une même liste ils s'annulent exactement, et rien ne bouge.
Dans `onEnd`, se contenter de **lire** l'ordre obtenu.

### On ne simule pas un glisser avec des événements synthétiques

Sortable utilise le glisser natif du navigateur : `dispatchEvent` de
`pointerdown`/`pointermove`/`pointerup` ne déclenche rien. Il faut une vraie
entrée (`left_click_drag` de l'outil navigateur), et la fenêtre doit être
**visible** — masquée, le rendu est suspendu et `window.innerWidth` vaut 0.

**Comment savoir si un glisser démarre**, sans deviner : poser des rappels sur
l'instance déjà attachée et lire la trace.

```js
const cle = Object.keys(el).find(k => /^Sortable/.test(k))  // l'instance vit sur l'élément
const tri = el[cle]
tri.option('onStart', () => trace.push('start'))
tri.option('onMove',  () => { trace.push('move'); return true })
tri.option('onUpdate', e => trace.push(`update ${e.oldIndex}→${e.newIndex}`))
```

`choose` + `start` + `end 0→0` sans `move` : le glisser démarre mais ne trouve
aucune cible. Un `update 0→1` unique : c'est bon.

⚠️ Ces rappels **remplacent** ceux de l'application, dont celui qui enregistre.
Un test ainsi instrumenté réordonne à l'écran sans rien persister — ne pas en
conclure que la persistance est cassée.

### Attention aux coordonnées qui dérivent

Chaque glisser réussi change la mise en page. Mesurer juste avant de tirer, dans
le même appel, et convertir : les coordonnées de l'outil sont dans le repère de
la capture, pas en pixels CSS — facteur `800 / window.innerWidth` quand la
capture fait 800 de large.

## Hydratation

### Ne pas brancher l'affichage sur `pending`

Sur la page de préparation du quiz, un `v-if="pending && !donnees"` autour d'un
indicateur de chargement suffisait à faire dire à Vue « Hydration completed but
contains mismatches » à chaque visite : avec `useLazyFetch(…, { server: false })`,
`pending` ne vaut pas la même chose au rendu serveur et à l'hydratation.

Brancher l'affichage sur **les données** (`v-if="donnees" … v-else`), qui sont
nulles des deux côtés, et le problème disparaît.

**Ce qui l'a démasqué** : lire les erreurs de console page par page, connecté,
et comparer avec les pages déjà en place. Le message n'apparaissait que sur la
nouvelle.

## Conteneur et déploiement

### Le compose traverse deux interpolations

Le bloc `configs.caddyfile.content` est substitué par **Compose**, puis par
**Caddy**. Écrit `{$COURS_ADRESSE}`, Compose reconnaît la variable et remplace
en laissant les accolades : Caddy reçoit `{srv1355415.hstgr.cloud}`, qui ne
qualifie pour aucun certificat, et redémarre en boucle. D'où les `$$`.

`docker compose config` réaffiche `$$` tel quel : **il ne permet pas de
trancher**. Le seul contrôle qui vaut :

```bash
docker exec courses-caddy cat /etc/caddy/Caddyfile
docker exec courses-caddy caddy validate --config /etc/caddy/Caddyfile
```

### Un déploiement vert peut mentir

L'API Hostinger rend la main dès qu'elle **accepte** la requête, avant que quoi
que ce soit ait bougé sur l'hôte. `.github/scripts/verify-rollout.sh` interroge
l'API jusqu'à ce que chaque conteneur tourne le tag attendu et soit sain.

Il a d'abord vérifié **seulement** les images `ghcr.io`, et un déploiement est
passé au vert pendant que Caddy — la seule porte d'entrée publique —
redémarrait en boucle. Il couvre désormais tous les conteneurs du projet.

### `hostinger/deploy-on-vps` ne téléverse pas le compose

L'action transmet une **URL** `github.com/<dépôt>/blob/<sha>/compose.yaml`, que
l'infrastructure de Hostinger va chercher en HTTPS anonyme. Sur un dépôt privé,
cette URL rend une page de connexion. Une clé de déploiement SSH sur le VPS n'y
change rien : ce n'est pas le VPS qui télécharge.

Le champ `content` de l'API accepte le **YAML brut** : le workflow l'envoie donc
directement, sans l'action tierce.

### Le tag d'image doit être immuable

Redéployer un tag mutable inchangé ne déclenche ni pull ni recréation : Docker
Manager voit une spécification identique et ne fait rien, pendant que le
déploiement passe au vert. D'où `IMAGE_TAG=${{ github.sha }}`.

## Développement local

- **Le serveur de développement manque de mémoire** après une série de
  modifications de contenu (rechargement à chaud sur 27 fiches lourdes en
  KaTeX). Contournement : `NODE_OPTIONS=--max-old-space-size=4096 pnpm dev`, ou
  travailler sur le build de production, plus léger et plus représentatif :

  ```bash
  pnpm build && NUXT_BASE_FICHIER=/tmp/essai.sqlite node .output/server/index.mjs
  ```

- **Le démarrage prend ~50 s** en développement. En tenir compte avant de
  conclure qu'une page ne répond pas.

- **Le garde-fou anti-force-brute mord pendant les tests** : 8 tentatives de
  connexion par minute et par IP. Attendre la fenêtre, ou redémarrer le serveur
  — le compteur est en mémoire.

- **zsh ne découpe pas les variables non protégées.** `for p in $PAIRES` boucle
  une seule fois sur la chaîne entière. Ça a produit des préfixes de fichiers
  faux, silencieusement. Pour toute manipulation en masse de fichiers, préférer
  un script Python explicite.
