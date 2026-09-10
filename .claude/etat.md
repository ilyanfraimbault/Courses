# Où en est le projet

Dernière mise à jour : 10 septembre 2026.

## En ligne

**https://srv1355415.hstgr.cloud** — certificat Let's Encrypt, redirection
HTTP→HTTPS, deux conteneurs (`courses-app`, `courses-caddy`) sur le VPS
Hostinger `1355415`.

Pousser sur `master` construit l'image, la publie sur GHCR, la déploie et
vérifie que le serveur la fait tourner. Secrets et amorçage : `docs/deploiement.md`.

## Ce qui fonctionne

- Les 28 fiches, 473 questions, KaTeX, cercle trigonométrique, tableaux de
  variations — tout le contenu du portfolio, aux mêmes URLs.
- Comptes multiples (pseudo + mot de passe haché en scrypt), inscription par
  code, isolation des données vérifiée entre deux comptes.
- Progression et historique de QCM en base, synchronisés entre appareils.
- **Mode quiz** : une question à la fois — avec l'énoncé commun de son bloc —
  tirée dans les 432 questions à choix du site, filtrable par chapitre ou par
  point de cours (94 notions nommées). Une question gagnée est cochée sur sa
  fiche.
  Une faute renvoie la place à la fin de la file avec une *autre* question du
  même point de cours ; la séance ne finit que lorsque tout est acquis. Séances
  reprises d'un appareil à l'autre, historique et panneau « ce qui résiste ».
  Voir `docs/quiz.md`.
- To-do manuelle à trois niveaux — chapitre, fiche, bloc — réordonnable par
  glisser ou par flèches, aux deux niveaux.
- Tableau de bord « où j'en suis », page « mes résultats », export et import
  JSON (par fichier ou par collage).

## Ce qui reste à faire

### Le nettoyage du portfolio

`ilyanfraimbault/ilyanfraimbault.github.io` contient **toujours** les cours :
`content/cours/`, les 12 composants MDC, `ChoixReponses.vue`,
`FractionRadian.vue`, les 6 composables, `app/utils/cours.ts`, la collection
`cours` de `content.config.ts`, la configuration KaTeX et le hook de comptage de
`nuxt.config.ts`, et ~815 lignes de `app/assets/css/main.css`.

À faire dans une PR à part, **une fois le domaine définitif choisi** — la
redirection en dépend.

⚠️ **Ne pas supprimer `app/utils/clipboard.ts`** du portfolio : il est utilisé
par `app/pages/blog/[...slug].vue`. Il a été **copié** ici, pas déplacé. Même
prudence pour `@iconify-json/lucide` (les composants `landing/*` en dépendent)
et `better-sqlite3` (utilisé par `@nuxt/content` au build).

La redirection sur GitHub Pages ne peut pas être une règle serveur : il faut
des `routeRules` sur les chemins d'entrée prérendus, plus un plugin client
depuis `404.html`, que GitHub Pages sert pour tout chemin inconnu.

### Le domaine

`ilyanfraimbault.com` et `.fr` ont été vérifiés **libres**. Le `.fr` demande une
résidence UE. Rien n'est réservé : c'est à Ilyan de le faire dans hPanel.

Une fois le domaine en main : un enregistrement `A` vers `72.62.29.225`, puis
`COURS_ADRESSE=` dans le secret `COURSES_ENV_FILE`, et redéployer. Aucun
changement de code.

## Dette et points ouverts

**Un compte de diagnostic traîne en production** : `diagnostic-eesm1`, créé
pour éprouver le parcours d'import sans toucher au compte d'Ilyan. Il n'existe
pas de suppression de compte — à ajouter si on veut le retirer.

**L'import par dépôt de fichier a échoué chez Ilyan, sans cause identifiée.**
Le serveur accepte le même contenu sans broncher, vérifié deux fois en
production, et le bouton atteint bien le sélecteur de fichier. Le collage du
JSON a été ajouté comme second chemin, mais le défaut d'origine n'est pas
compris.

**Le doublon entête / lien d'index dans la barre latérale** n'a pas pu être
levé — voir `.claude/pieges.md`. Le supprimer rendrait la page de sommaire d'un
chapitre inatteignable depuis la barre.

**Zones mortes possibles au glisser d'un chapitre** : avec un glisser
synthétique qui saute d'un point à l'autre, un lâcher au milieu des *lignes*
d'un autre chapitre ne s'enregistrait pas, alors qu'un lâcher sur son *entête*
fonctionnait. Un glisser humain, continu, traverse forcément les entêtes — pas
reproduit à la main, donc pas confirmé comme un vrai défaut.

**`node:sqlite` est en stabilité 1.1.** D'où Node épinglé à la majeure 24, dans
le Dockerfile comme en CI. Ne pas la faire bouger sans relire les notes de
version. Tout passe par `server/utils/db.ts` : revenir à `better-sqlite3`
tiendrait dans ce seul fichier.

**Le build a besoin de 4 Go de tas**, donnés explicitement à l'étape `build` de
la CI et à l'étage `build` du Dockerfile. Ce n'est pas une dette du quiz seul :
mesuré, `master` échouait déjà à 1536 Mo. L'assemblage Nitro vivait entre 1536
et 2048 Mo, sous un plafond de runner à 2048. Si le build regrossit, c'est ce
chiffre qu'il faudra relever — et le vérifier en bridant le tas, jamais en
local où il vaut 8 Go par défaut.

**Pas de tests automatisés**, par décision. La CI fait lint, typecheck, build et
un `docker build` sans publication. Les quatre scripts de vérification
(`verif:comptes`, `verif:api`, `verif:quiz`, `verif:quiz:rendu`) se lancent à la
main. Le dernier a besoin de Playwright, qui n'est pas une dépendance du
projet : `PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs` désigne une
installation globale, `import()` ne suivant pas `NODE_PATH`.

**Le quiz n'entre pas dans l'export JSON.** `resultats-cours` transporte les
fiches, les QCM et la to-do, pas les séances de quiz. Le format est partagé avec
le portfolio d'origine ; l'y ajouter serait un champ facultatif de plus, à faire
le jour où une sauvegarde des séances aura de la valeur.

**Le quiz emprunte le contexte d'une question, pas seulement son énoncé.** Un
bloc dont l'entête est pédagogique plutôt qu'un énoncé — les paliers
d'entraînement s'ouvrent souvent sur la méthode — voit ce texte s'afficher
au-dessus de chacune de ses questions. C'est assumé : les distinguer demanderait
une heuristique, et une heuristique qui se trompe rend une question insoluble
sans le dire. Si ça gêne à l'usage, la sortie est un attribut explicite sur le
bloc, pas une devinette.

## Choix qu'il vaut mieux ne pas rejouer

Ils ont été tranchés, avec leurs raisons :

- **`node:sqlite` plutôt que `better-sqlite3`** — le second charge son binaire
  natif par sondage de chemins à l'exécution, ce que le traçage de Nitro rate en
  silence ; et il compile depuis les sources sur Alpine.
- **Le Caddyfile voyage dans le compose** (`configs: content:`) plutôt qu'en
  montage depuis l'hôte : ça supprime la classe de pannes « le fichier n'est pas
  là où il faut sur le serveur ».
- **Les inscriptions sont fermées quand le code est vide** — le site vit sur un
  domaine public.
- **La to-do est manuelle**, pas déduite de la progression. C'est un choix
  d'Ilyan : la liste dit ce qu'il a décidé de reprendre.
- **Le quiz corrige au serveur, pas au client.** La bonne réponse ne part pas
  avec la question : c'est ce qui empêche de la lire dans la charge utile, et ça
  met la file, les reprises et la fin de séance au même endroit que le reste des
  règles. Le coût est un aller-retour par réponse ; le préchargement de la
  question suivante le rend invisible.
- **Le thème d'une question de quiz vient du rappel de cours qu'elle vise**, pas
  de son dossier. Une table de correspondance écrite à la main vieillirait en
  silence ; la `source` d'un `extrait-cours`, non.
- **Le réordonnancement se fait à l'intérieur d'un chapitre**, et les chapitres
  se déplacent entre eux. Le groupe est déduit du contenu, pas choisi : déplacer
  une ligne d'un chapitre à l'autre n'aurait pas de sens.
