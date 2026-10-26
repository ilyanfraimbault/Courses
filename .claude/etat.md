# Où en est le projet

Dernière mise à jour : 19 octobre 2026.

## En ligne

**https://srv1355415.hstgr.cloud** — certificat Let's Encrypt, redirection
HTTP→HTTPS, deux conteneurs (`courses-app`, `courses-caddy`) sur le VPS
Hostinger `1355415`.

Pousser sur `master` construit l'image, la publie sur GHCR, la déploie et
vérifie que le serveur la fait tourner. Secrets et amorçage : `docs/deploiement.md`.

## Ce qui fonctionne

- 15 fiches et 353 questions, rangées par **année, matière et chapitre** — KaTeX,
  cercle trigonométrique, tableaux de variations — aux URLs du portfolio. Le 13
  septembre, les QCM 1 à 6 (120 questions) et le plan de révision de l'examen du
  11 septembre ont été retirés : seule la réplique du sujet initial reste en
  contenu, et les textes des fiches ont été harmonisés.
- **La matière partout.** La hiérarchie se lit dans le chemin
  (`shared/utils/niveaux.ts`). La barre latérale ne montre que la matière de la
  page ; le quiz, les QCM composés, « Mes domaines », le tableau de bord et la
  to-do rangent par matière. Une seule existe aujourd'hui : en ajouter une est un
  dossier de plus, rien à déclarer.
- **Une seule présentation des questions** (`QuestionCadre`) : exercice, cours,
  QCM de contenu et QCM composé ont les mêmes propositions et les mêmes boutons
  Indice, Solution, Cours, dépliés sous la question. Plus de fenêtre modale.
- **Mes QCM** (`/mes-qcm`) : des QCM composés depuis le site, par tirage à la
  manière du quiz ou question par question, rangés sur le compte. Page fixe,
  correction au serveur, report sur les fiches et dans la dette. Voir
  `docs/mes-qcm.md`.
- Une 29ᵉ fiche, propre à ce site : le **formulaire de trigonométrie**
  (`/cours/a1/remise-a-niveau-maths/trigonometrie/formulaire`), toutes les
  formules avec un exemple chacune. Type `formulaire`, aucune question — il ne
  change ni le compte des questions, ni le quiz, ni les domaines.
- Comptes multiples (pseudo + mot de passe haché en scrypt), inscription par
  code, isolation des données vérifiée entre deux comptes.
- Progression et historique de QCM en base, synchronisés entre appareils.
- **Mode quiz** : une question à la fois — avec l'énoncé commun de son bloc —
  tirée dans les 312 questions à choix d'une matière, filtrable par chapitre ou par
  **section du cours** (34 cases, qui couvrent chaque chapitre sans reste). Une
  question gagnée est cochée sur sa fiche.
  Une faute renvoie la place à la fin de la file avec une *autre* question du
  même point de cours ; la séance ne finit que lorsque tout est acquis.
  « Je ne sais pas » (touche `0`) fait exactement la même chose, en ouvrant en
  plus la correction *et* l'indice : ne pas savoir se dit, au lieu de se jouer à
  une chance sur quatre. Séances
  reprises d'un appareil à l'autre, historique et panneau « ce qui résiste ».
  L'ordre des propositions est brassé à chaque place, et le tirage préfère ce
  qui est en dette, puis ce qui n'a jamais été posé. Voir `docs/quiz.md`.
- **Mémoire des fautes** : une question ratée sur une fiche, dans un QCM ou au
  quiz entre en dette, et n'en sort qu'en étant retrouvée — où que ce soit. Elle
  alimente la sélection « seulement ce que j'ai raté », les compteurs du
  catalogue et le panneau « ce qui résiste ».
- **Progression par domaine** (`/mes-domaines`) : les 353 questions rangées par
  point de cours — 68 domaines sous quatre chapitres, matière par matière — avec, sur une même
  barre, ce qui est tombé juste du premier coup et ce qu'il a fallu reprendre.
  Le moins acquis en tête, et un bouton par domaine qui ouvre le quiz sur ce
  point de cours. La sélection du quiz, elle, se fait par plan du chapitre : le
  point de cours n'y a plus de case, il arrive par ce lien et s'y affiche nommé.
  Voir `docs/domaines.md`.

- **Contrôles** (`/mes-controles`) : une date, une matière, un programme coché sur
  le plan du cours, et une feuille de route recalculée à chaque lecture — ce qu'il
  reste à apprendre découpé en journées d'environ dix questions, l'examen blanc
  (un QCM composé de vingt questions) l'avant-veille, la dette la veille. La
  séance du jour ne pose que ce qui n'est pas su. Voir `docs/controles.md`.
- **Révision espacée** : une question sue revient à 1, 3, 7, 16, 35 et 90 jours,
  déduite de l'histoire sans table à elle. L'accueil s'appelle « Aujourd'hui » et
  commence par ce qu'il y a à faire : la consigne de chaque contrôle, et une
  seule séance par matière non close — la dette, puis les révisions, puis du
  neuf, vingt questions au plus, un seul bouton, et « Choisir » pour la restreindre à quelques
  chapitres. Voir `docs/revisions.md`.
- **Clôtures** : une matière, un chapitre ou une fiche se clôt ; ce qui est clos
  sort de la progression, des révisions et des séances sur toute la matière, et
  reste grisé dans le sommaire. Voir `docs/clotures.md`.
- **Mathématiques pour l'ingénieur** : deux chapitres qui calquent les dossiers
  du professeur — *Logique propositionnelle* (cours, feuille d'exercices, et le
  travail en autonomie) et *Raisonnements mathématiques* (cours et feuille) ;
  les diapos ne sont pas reprises. 141 questions dont 118 au quiz ; les tables
  de vérité se remplissent case par case (`table-verite`). Les feuilles n'ont pas
  de corrigé : les solutions sont les nôtres. Le site compte 494 questions, 430
  au quiz.
- **Virtualisation et conteneurisation** : la formation *Docker par la
  pratique* de Microlinux, un chapitre par atelier — quinze, des commandes de
  base à Docker Compose ; les ateliers d'installation sont laissés de côté.
  355 questions, dont **322 commandes à taper** dans un terminal (`commande`)
  et 33 vrai ou faux au quiz. Le correcteur (`shared/utils/commandes.ts`)
  ramène chaque commande à une forme canonique — ordre des options, formes
  longues, synonymes, `alpine` = `alpine:latest`, `--mount`, et en modes
  `dockerfile` et `yaml` des instructions et des arbres. `pnpm verif:commandes`
  l'éprouve sur 105 cas. Le site compte 849 questions, 463 au quiz.
- **Importer un cours** : le skill `importer-cours` (`.claude/skills/`) mène d'un
  PDF aux fiches, et `pnpm verif:contenu` garde le contenu contre ses pannes
  silencieuses.
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

**Les commandes à taper ne vont pas au quiz.** Les 322 questions `commande`
de Docker se corrigent sur leur fiche, en base et dans la dette, mais le quiz,
les révisions et les contrôles ne posent que des questions à lettre : pour la
matière Docker, ils n'ont que 33 vrai ou faux. Il faudrait que le relevé les
marque interrogeables, que le serveur corrige une saisie avec
`corrigerCommande` (il est sans import, prêt à servir) et que `QuizQuestion`
dessine un terminal au lieu des propositions.

**Les traces des QCM 1 à 6 restent en base.** Leurs lignes de `fiche`,
`reussite`, `qcm_tentative` et `faute` n'ont pas été effacées : elles ne visent
plus aucune question du contenu, et tout ce qui compte passe par le relevé — le
tableau de bord, le catalogue, « ce qui résiste » et les domaines les ignorent
donc. Elles ressortent seulement dans l'export JSON. Les purger demanderait une
migration qui connaisse la liste des chemins retirés ; rien ne presse.

**Un QCM composé ne se modifie pas** : il se renomme ou se supprime. Retoucher la
liste d'un QCM déjà passé rendrait ses notes incomparables ; si le besoin se
présente, ce serait « composer une copie modifiable », pas éditer en place.

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

**Le quiz et les QCM composés n'entrent pas dans l'export JSON.** `resultats-cours` transporte les
fiches, les QCM et la to-do, pas les séances de quiz. Le format est partagé avec
le portfolio d'origine ; l'y ajouter serait un champ facultatif de plus, à faire
le jour où une sauvegarde des séances aura de la valeur.

**Deux rappels de la réplique du QCM visent un cours sans ancre**
(`qcm-r-usuelles`, `qcm-r-equations`) : leurs huit questions tombent dans « Le
reste du chapitre » des fonctions usuelles. Ils couvrent chacun plusieurs
sections ; leur choisir une ancre est une décision de contenu.

**La reprise d'une révision ratée se compte sur la journée du site**, pas sur
celle de l'élève : la réponse au quiz ne porte pas de fuseau. Au pire, le bord
du tas des questions dues se décale d'une heure ou deux.

**Le classement des entêtes est à tenir à jour.** Un bloc dont l'entête est une
introduction pédagogique porte `entete="introduction"` ; sans attribut, le quiz
la traite comme un énoncé et la rappelle au-dessus de chaque question. Dix-huit
blocs sont marqués aujourd'hui, tous des paliers d'entraînement. Un nouveau bloc
de ce genre est à marquer à la main — le défaut est volontairement le sens sûr,
pas le plus fréquent.

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
