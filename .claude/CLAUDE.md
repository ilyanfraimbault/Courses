# Le projet, en bref

Cahier de révisions personnel, rangé par année puis par matière : fiches de
cours, exercices corrigés et QCM, un mode quiz qui pioche dans leurs questions,
des QCM qu'on compose soi-même à partir d'elles, des contrôles avec leur
feuille de route, la révision espacée de ce qui est su, avec suivi de
progression, to-do et tableau de bord. Nuxt 4, Nuxt UI, Nuxt Content, SQLite, déployé en
conteneur sur un VPS Hostinger.

Le contenu est en **français**, l'interface est en français, et **le code aussi**
— noms de variables, de fonctions, de composants, messages d'erreur. Suivre cet
usage plutôt que d'introduire de l'anglais.

## D'où ça vient

Ce dépôt est né d'une migration : la section « cours » vivait dans le portfolio
`ilyanfraimbault/ilyanfraimbault.github.io`, où elle représentait ~95 % du
contenu pour zéro lien depuis les pages publiques. Elle en a été extraite pour
devenir un site à part entière, avec un serveur — donc une mémoire qui suit d'un
appareil à l'autre, ce que le stockage local ne permettait pas.

Les chemins d'URL sont **identiques** à ceux du portfolio (`/cours/a1/…`), et ce
n'est pas un hasard : c'est ce qui rend la redirection triviale et l'import des
anciens résultats possible sans conversion.

## Les invariants à ne pas casser

Ils ont chacun coûté quelque chose. Les comprendre avant de les contourner.

**Aucune donnée d'utilisateur au rendu serveur.** Progression, QCM et to-do ne
sont lus qu'au montage, côté client. Le HTML d'une fiche reste ainsi identique
pour tout le monde — cacheable, prérendable, sans risque de fuite par le cache.
Vérifiable : avec des questions trouvées en base, le HTML servi n'en porte
aucune trace.

**On n'écrit jamais ce qu'on n'a pas pu lire.** `provideProgression` ne persiste
que si `chargee` vaut vrai, et `chargee` ne passe à vrai que sur une lecture
réussie. Un 401, un délai dépassé, une coupure : on ne touche pas à la base.
Sans cette garde, une session expirée écraserait la progression par un
instantané vide. C'est la première ligne du `watch` d'écriture, elle y reste.

**La progression s'écrit par instantané, pas par delta.** Le corps de
`PUT /api/fiche` décrit l'état complet des questions trouvées. C'est idempotent,
sans ordre à préserver, et ça reconduit l'élagage des questions disparues du
contenu — sans quoi le décompte gonflerait sans fin.

**Une seule requête par fiche.** `GET /api/fiche` rend progression *et*
historique de QCM. La page de trigonométrie porte douze blocs de QCM : un appel
par bloc ferait douze allers-retours au montage.

**L'identité d'une question est `chemin#bloc#label`.** Le `bloc` est
`slugifier(titre du bloc)`, le `label` est celui écrit dans le frontmatter
(`a)`, `1.`). Elle doit survivre à un rebuild, d'où le refus d'un `useId()`.
`nuxt.config.ts` **importe** `slugifier` depuis `app/utils/cours.ts` pour son
relevé au build : il n'en existe qu'une implémentation, et c'est ce qui garantit
que le bloc relevé et l'identité écrite en base désignent la même chose. En
contrepartie, `app/utils/cours.ts` doit rester **libre de tout import Nuxt** :
il est chargé au moment de lire la configuration, hors de toute application.

**La hiérarchie se lit dans le chemin.** `/cours/<année>/<matière>/<chapitre>/<fiche>` :
c'est `niveauxDuChemin` (`shared/utils/niveaux.ts`) qui le dit, et personne
d'autre — pas un champ de frontmatter, qui finirait par diverger d'une fiche à
l'autre. Un chapitre et une matière se désignent par **leur chemin**, jamais par
leur slug : deux matières peuvent avoir chacune un chapitre « introduction ».
Comme `app/utils/cours.ts`, ce fichier est importé par `nuxt.config.ts` et reste
libre de tout import Nuxt.

**On ne mélange pas deux matières.** Une séance de quiz, un QCM composé, une
barre de « Mes domaines » restent dans leur matière. Dans un filtre, la matière
se **croise** avec la sélection au lieu de s'y ajouter : « rien de coché » veut
dire toute la matière, pas tout le site.

**Une question n'a qu'un habillage.** `QuestionCadre` dessine toutes les
questions — exercice, cours, QCM de contenu, QCM composé : l'énoncé, les
propositions, puis Indice, Solution et Cours, dépliés sous la question. Chaque
contexte garde sa règle de correction ; aucun ne redessine la question. Sa racine
porte la seule classe `cours-question` de la question, celle que le contrôle de
rendu compte.

**Un QCM composé ne retient que des identités.** Il vit en base, sur le compte
qui l'a composé, et relit énoncés et corrections dans les fiches à chaque
ouverture. La copie se corrige au serveur ; une question juste y est cochée sur
sa fiche et une ratée entre dans la dette, dans la même transaction que la copie.
Voir `docs/mes-qcm.md`.

**Un seul relevé de questions, pas deux.** Le hook du build écrit un champ
`releve` par page : **toutes** les questions identifiables, et un booléen
`interrogeable` qui dit lesquelles le quiz sait poser. Le quiz lit la part vraie
de ce booléen, la progression par domaine lit tout. Deux relevés côte à côte se
contrediraient le jour où l'un changerait.

**Le quiz emprunte les questions, il n'en écrit aucune.** Ses 652 questions
sont celles des fiches, découpées dans l'arbre de la page au moment de les
poser — énoncé, propositions, indice, solution et rappel de cours compris.
Corriger un cours corrige le quiz. Le thème d'une question vient du rappel de
cours qu'elle vise, pas de la page où elle vit : un QCM mélange les chapitres
exprès. Voir `docs/quiz.md`.

**Une question ne se pose jamais sans l'énoncé commun de son bloc.** « Donner
l'affixe du vecteur M₂M₄ » est insoluble sans les coordonnées, écrites une fois
en tête de l'exercice. Le quiz rappelle donc cet énoncé au-dessus de chaque
question, en entier et sans repli. Un bloc dont l'entête est une introduction
pédagogique plutôt qu'un énoncé le déclare — `entete="introduction"` — et
**l'absence d'attribut vaut « énoncé »** : c'est le sens sûr, l'oubli ne coûte
alors qu'un peu de bruit. Jamais de déduction automatique là-dessus.

**Une question gagnée au quiz est cochée sur sa fiche**, dans la même
transaction. Le report n'emprunte pas `PUT /api/fiche`, dont l'instantané
effacerait le reste de la fiche que le quiz ne connaît pas : il écrit la seule
ligne concernée, et crée au besoin la fiche avec le compte de questions relevé
au build — jamais avec zéro. Une faute, elle, n'efface jamais rien, et le quiz
ne relit pas la progression : il repose volontiers une question déjà trouvée.

**Une faute est un événement, la seule écriture du site qui le soit.** Tout le
reste s'écrit par instantané ; la table `faute` s'incrémente. C'est pour cela
qu'elle a sa propre route (`POST /api/fautes`) au lieu de voyager dans le corps
de `PUT /api/fiche` : une page ne connaît que les fautes commises sous ses yeux,
et son instantané effacerait toutes les autres. Une bonne réponse **éteint** la
dette au lieu de supprimer la ligne — le compte des fautes distingue
l'étourderie de la notion qui ne passe pas. Voir `docs/quiz.md`.

**Le second niveau de la sélection du quiz est le plan du chapitre**, pas
l'intitulé du rappel de cours visé. Les rappels ne formaient pas une
nomenclature : le même titre apparaissait deux fois, et les questions qui n'en
visent aucun n'apparaissaient nulle part — 48 des 77 questions de trigonométrie.
La règle qui garde l'écran honnête : **la somme des cases fait le compte du
chapitre**, une case « le reste » servant au besoin de solde. Le point de cours
survit sous la section, invisible dans la liste : c'est lui que « Mes domaines »
désigne par lien, et il s'affiche alors nommé.

**Un contrôle ne stocke ni questions ni feuille de route.** Une date, une
matière, un programme dans la nomenclature du quiz — et c'est tout. Ce qui est
su, ce qui reste et comment l'étaler d'ici au jour J se recalculent à chaque
lecture depuis `reussite` et `faute`, dans le fuseau de l'élève. La journée se
découpe sur ce qu'il restait **ce matin**, pour que la finir ne fasse pas
glisser demain dedans. Voir `docs/controles.md`.

**La révision espacée ne s'écrit pas, elle se déduit.** Palier et échéance
d'une question se rejouent à chaque lecture depuis `reussite`, `faute`,
`quiz_reponse` et les copies de QCM. Une table de révision demanderait un
événement de plus à chaque bonne réponse, sur chaque écran — la première route
qui l'oublierait la désaccorderait en silence. Voir `docs/revisions.md`.

**Une clôture retire du « tout », jamais du « coché ».** Ce qu'on a clos sort
des révisions, de la progression et des séances lancées sur toute la matière ;
un chapitre clos coché à la main est pris en entier, et un contrôle ignore les
clôtures. Rien n'est effacé : rouvrir rend tout. Voir `docs/clotures.md`.

**Le serveur est maître des règles.** Le plafond de 24 tentatives par QCM,
l'agrégation d'un chapitre sur ses fiches, l'unicité d'une cible de to-do : tout
est appliqué en base, pas au client. Une règle vit à un seul endroit.

**Les données sont cadrées par utilisateur.** Toute requête passe par
`idUtilisateur(event)`, qui lit la session scellée — jamais le corps de la
requête. Voir `docs/comptes.md`.

## Comment travailler ici

**Vérifier la chose, pas un substitut.** J'ai déjà écrit « vérifié : le glisser
fonctionne » après avoir testé les **flèches**. C'était faux et ça s'est vu. Si
la fonctionnalité est un glisser, il faut un vrai glisser ; si c'est un
déploiement, il faut interroger le serveur ; si c'est un rendu, il faut compter
dans le HTML produit.

**Se méfier des pannes silencieuses.** Les défauts de ce projet ne lèvent
presque jamais : un parseur qui avale les trois quarts d'une fiche, un tri qui
ne s'installe pas, un proxy mort derrière un déploiement vert. Chercher le
témoin chiffré — un compte attendu, un tag d'image, un état de conteneur — et le
comparer.

**Écrire les commits en expliquant le pourquoi**, en français, en prose. Ce
qu'on a changé se lit dans le diff ; ce qui mérite d'être écrit, c'est ce qui a
motivé le changement et ce qu'on a mesuré.

**Un cours suit la logique de son professeur, pas un gabarit.** Chaque prof
range sa matière à sa façon : un dossier par chapitre avec cours, feuille et
diapos, un TD unique, des annales… L'arborescence du site **calque celle des
documents reçus** — un chapitre par dossier, une fiche par document, nommés
comme le prof les nomme — au lieu de plaquer le découpage d'une autre matière.
Deux matières peuvent donc avoir des chapitres de formes très différentes, et
c'est voulu. Exception : les **diapos** projetées en amphi ne deviennent pas une
fiche — elles doublent le cours, et des slides n'ont rien à faire en page web ;
on s'en sert pour vérifier le cours, pas pour les réafficher. Fondre deux
documents en une fiche, ou en inventer une que le prof n'a pas faite, se
demande d'abord.

**La réponse prend la forme que la question appelle.** Le choix à quatre
propositions est un format parmi d'autres, pas le moule de toute question : un
vrai ou faux se tranche entre « Vraie » et « Fausse », sans justification
accolée qui soufflerait la réponse ; si le sujet demande aussi la négation ou
le contre-exemple, c'est une seconde question. Une
table de vérité se **remplit** case par case (`table-verite`), une adresse de
réseau **s'écrit** au lieu de se choisir (`champs-reponse`), une commande se
**tape** dans un terminal (`commande`), un angle se lit sur un cercle
(`cercle-trigo`), un tableau de variations se dresse : quand un
cours demande un geste que les composants existants ne savent pas corriger, on
écrit le composant. Le critère : ce que l'élève ferait sur sa copie, et ce qui
se lit le mieux.

**Commenter le pourquoi, jamais le quoi.** Les commentaires du dépôt expliquent
des décisions et des pièges. Les imiter, ne pas paraphraser le code.

## Les contrôles

```bash
pnpm lint && pnpm typecheck && pnpm build
```

Les trois sont nécessaires : `typecheck` peut passer sur des types `.nuxt`
périmés là où `build` échoue.

Vérifications qui demandent un serveur en marche et une base vierge :

```bash
pnpm dev
node scripts/verifier-comptes.mjs   # inscription, connexion, isolation entre comptes
node scripts/verifier-api.mjs       # progression, QCM, to-do, export
pnpm verif:quiz                     # banque, filtres, file du quiz, isolation
pnpm verif:quiz:rendu               # le quiz dans un vrai navigateur (Playwright)
pnpm verif:controles                # feuille de route, séance du jour, examen blanc
pnpm verif:revisions                # paliers, échéances, séance de révisions
pnpm verif:clotures                 # clore, ce qui en sort, rouvrir, isolation
```

Elles ne sont pas dans la CI : elles ont besoin d'une base réelle, et leur rôle
est d'être relancées quand on touche au schéma ou aux routes. La configuration
`cours-verif` de `.claude/launch.json` lance le serveur avec un code
d'inscription et une base à part (`.data/verif/`), ce qu'elles demandent.

Le contrôle qui compte pour le contenu tient en une commande, serveur lancé :
`pnpm verif:contenu --rendu` — rendu contre comptage du build, et toutes les
pannes silencieuses du contenu. Voir `docs/contenu.md`. Un nouveau cours arrive
par le skill `importer-cours` (`.claude/skills/importer-cours/`). Aujourd'hui : **1064 questions rendues sur 1064**, et les
45 fiches portent leur `type`.

## Où lire la suite

- `docs/contenu.md` — la collection, le comptage des questions, l'import d'un
  ancien export, et pourquoi `remark-mdc` est épinglé.
- `docs/quiz.md` — le mode quiz : la banque relevée au build, le thème déduit du
  rappel de cours, la file qui rejoue une place ratée, et ce qu'il n'écrit pas.
- `docs/domaines.md` — la progression rangée par point de cours : d'où viennent
  les domaines, ce que les deux segments d'une barre veulent dire, et pourquoi
  le relevé porte les 1064 questions et non les seules 652 du quiz.
- `docs/controles.md` — les contrôles : le programme, la feuille de route et
  son découpage, l'examen blanc, le fuseau de l'élève.
- `docs/revisions.md` — la révision espacée, déduite de l'histoire, et
  l'accueil « Aujourd'hui ».
- `docs/clotures.md` — clore une matière, un chapitre ou une fiche, et la
  séance du jour restreinte à quelques chapitres.
- `docs/mes-qcm.md` — les QCM composés : pourquoi en base plutôt qu'en fichier,
  ce qu'ils empruntent aux fiches, et les règles tenues au serveur.
- `docs/comptes.md` — comptes, hachage, isolation des données.
- `docs/deploiement.md` — conteneur, CI/CD, VPS, domaine, sauvegarde.
- `.claude/pieges.md` — les pièges rencontrés, avec ce qui les a démasqués.
- `.claude/etat.md` — où en est le projet, ce qui reste, ce qui est en dette.
