# Le projet, en bref

Cahier de révisions personnel : fiches de cours, exercices corrigés et QCM, un
mode quiz qui pioche dans toutes leurs questions, avec suivi de progression,
to-do et tableau de bord. Nuxt 4, Nuxt UI, Nuxt Content, SQLite, déployé en
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

**Le quiz emprunte les questions, il n'en écrit aucune.** Ses 412 questions
sont celles des fiches, découpées dans l'arbre de la page au moment de les
poser — énoncé, propositions, indice, solution et rappel de cours compris.
Corriger un cours corrige le quiz. Le thème d'une question vient du rappel de
cours qu'elle vise, pas de la page où elle vit : un QCM mélange les chapitres
exprès. Voir `docs/quiz.md`.

**Une question ne se pose jamais sans l'énoncé commun de son bloc.** « Donner
l'affixe du vecteur M₂M₄ » est insoluble sans les coordonnées, écrites une fois
en tête de l'exercice — et 251 des 453 questions du site sont dans ce cas. Le
quiz rappelle donc cet énoncé au-dessus de chaque question, en entier et sans
repli.

**Une question gagnée au quiz est cochée sur sa fiche**, dans la même
transaction. Le report n'emprunte pas `PUT /api/fiche`, dont l'instantané
effacerait le reste de la fiche que le quiz ne connaît pas : il écrit la seule
ligne concernée, et crée au besoin la fiche avec le compte de questions relevé
au build — jamais avec zéro. L'inverse n'existe pas : une faute n'efface rien,
et le quiz ne relit jamais cette mémoire.

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
```

Elles ne sont pas dans la CI : elles ont besoin d'une base réelle, et leur rôle
est d'être relancées quand on touche au schéma ou aux routes.

Le contrôle qui compte pour le contenu — rendu contre comptage du build — est
dans `docs/contenu.md`. Aujourd'hui : **453 questions rendues sur 453**.

## Où lire la suite

- `docs/contenu.md` — la collection, le comptage des questions, l'import d'un
  ancien export, et pourquoi `remark-mdc` est épinglé.
- `docs/quiz.md` — le mode quiz : la banque relevée au build, le thème déduit du
  rappel de cours, la file qui rejoue une place ratée, et ce qu'il n'écrit pas.
- `docs/comptes.md` — comptes, hachage, isolation des données.
- `docs/deploiement.md` — conteneur, CI/CD, VPS, domaine, sauvegarde.
- `.claude/pieges.md` — les pièges rencontrés, avec ce qui les a démasqués.
- `.claude/etat.md` — où en est le projet, ce qui reste, ce qui est en dette.
