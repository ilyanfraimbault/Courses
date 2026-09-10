# Le projet, en bref

Cahier de révisions personnel : fiches de cours, exercices corrigés et QCM, avec
suivi de progression, to-do et tableau de bord. Nuxt 4, Nuxt UI, Nuxt Content,
SQLite, déployé en conteneur sur un VPS Hostinger.

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
Le même `slugifier` est réimplémenté dans `nuxt.config.ts` pour le relevé des
blocs au build : **les deux doivent bouger ensemble**.

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
```

Elles ne sont pas dans la CI : elles ont besoin d'une base réelle, et leur rôle
est d'être relancées quand on touche au schéma ou aux routes.

Le contrôle qui compte pour le contenu — rendu contre comptage du build — est
dans `docs/contenu.md`. Aujourd'hui : **453 questions rendues sur 453**.

## Où lire la suite

- `docs/contenu.md` — la collection, le comptage des questions, l'import d'un
  ancien export, et pourquoi `remark-mdc` est épinglé.
- `docs/comptes.md` — comptes, hachage, isolation des données.
- `docs/deploiement.md` — conteneur, CI/CD, VPS, domaine, sauvegarde.
- `.claude/pieges.md` — les pièges rencontrés, avec ce qui les a démasqués.
- `.claude/etat.md` — où en est le projet, ce qui reste, ce qui est en dette.
