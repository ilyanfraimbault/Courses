---
name: importer-cours
description: Importer un cours dans le site à partir de ses PDF (souvent écrits en LaTeX) ou de ses sources .tex — cours, TD, corrigés, annales. Produit les fiches Markdown/MDC du site (cours, exercices, entraînement), les pages d'index de la matière et du chapitre, vérifie chaque réponse par le calcul, passe le contrôle du contenu, et ouvre une PR à relire. À utiliser dès qu'on dépose un PDF de cours ou de TD, qu'on demande « ajoute ce chapitre », « importe ce cours », « mets ce TD sur le site », ou qu'une nouvelle matière arrive.
---

# Importer un cours

Le site n'a de valeur que si **tous** les cours y sont, et un cours ne sert que
s'il s'y **apprend** : chaque notion suivie d'un exemple, chaque exercice découpé
en questions qui se corrigent, chaque question rattachée au rappel de cours qui
lui manque. Ce skill transforme un PDF en fiches qui tiennent ces promesses — et
qui passent les contrôles, parce que les défauts de contenu ici ne lèvent jamais
rien.

Lire d'abord `.claude/CLAUDE.md` (les invariants) et `docs/contenu.md`. La
syntaxe exacte des composants est dans `syntaxe.md`, à côté de ce fichier.

## 0. Ce qu'on importe, et où

Rien ne s'écrit avant que ce plan soit établi **et confirmé** par la personne
qui importe. Le dépôt est public et reçoit les cours de toute la classe : la
plupart des imports viennent d'un camarade, par son propre agent, qui ne connaît
ni les conventions du site ni ce que d'autres ont déjà importé. L'entretien
ci-dessous est ce qui rend l'import « déposer les PDF, répondre à quelques
questions, relire la PR ».

### 0.1 Qui importe

```bash
gh api user --jq .login                                         # qui est connecté
gh repo view ilyanfraimbault/Courses --json viewerPermission -q .viewerPermission
```

- `ADMIN` : c'est la propriétaire du dépôt. Branche locale, PR, et c'est elle
  qui met à jour les comptes globaux (étape 5).
- Autre chose (`READ`, ou `gh` non connecté) : c'est un **contributeur**. Il
  travaille depuis un fork, ouvre sa PR vers `ilyanfraimbault/Courses`, et ne
  touche pas aux comptes globaux. Voir `CONTRIBUTING.md` à la racine. Si `gh`
  n'est pas connecté, le lui faire faire (`gh auth login`) avant la fin : la PR
  en dépend.

### 0.2 Ce qui existe déjà

Avant de poser une question, regarder ce que le site a déjà, pour proposer au
lieu de demander à l'aveugle :

```bash
ls content/cours/                       # les années
ls content/cours/<annee>/               # les matières
ls content/cours/<annee>/<matiere>/     # ses chapitres et leur numérotation
gh pr list --repo ilyanfraimbault/Courses --state open --json number,title,headRefName
```

Une PR ouverte sur le même chapitre, c'est quelqu'un qui l'importe déjà : le
dire tout de suite et demander s'il faut continuer (compléter plutôt que
doubler).

### 0.3 Faire l'inventaire des documents

Les documents arrivent d'ordinaire dans `sources/` à la racine (ignoré par git :
les PDF des professeurs ne se versionnent pas), ou en pièces jointes. Ouvrir les
**premières pages** de chacun et le classer : cours, TD / feuille d'exercices,
corrigé, TP, annale ou sujet de contrôle, diapos, formulaire. En retenir les
titres tels que le prof les écrit et le plan du cours : c'est d'eux que viennent
les noms proposés à l'étape suivante.

### 0.4 L'entretien

Poser les questions avec l'outil de question (`AskUserQuestion`), **par salves
de trois ou quatre au plus**, chacune avec des propositions concrètes tirées des
documents — pas de question ouverte quand une réponse se devine. Mettre la
proposition qu'on recommande en premier. Sans outil de question, les poser en
texte, numérotées, une salve à la fois.

**Salve 1 — les pièces.**

- « J'ai reçu : `cours.pdf` (cours, 34 p.), `td3.pdf` (TD, 6 exercices). Est-ce
  **tout** ce que le prof a donné pour ce chapitre ? » — *Oui, c'est tout* / *Il
  manque des pièces, je les ajoute*. Citer ce qui manque d'ordinaire : le
  corrigé du TD, l'énoncé du TP, une annale, les sources `.tex`.
- Si un TD arrive sans corrigé : « Le prof a-t-il donné un corrigé, même une
  photo du tableau ? » — le corrigé fait foi sur nos calculs, il vaut la peine
  de le chercher.
- S'il y a des diapos, le dire : elles serviront à recouper le cours, elles ne
  deviendront pas une fiche.

**Salve 2 — où ça va.** Une question par niveau, chacune formulée comme une
confirmation :

- « L'année est-elle **A1** (`a1`) ? »
- Matière existante : « Ce chapitre va-t-il dans la matière existante
  **« Réseaux et protocoles »** ? ». Matière nouvelle : « Le nom de la matière
  est-il **« Structures de données et algorithmique »** ? (dossier
  `structures-donnees-algorithmique`) » — le nom du prof, celui qu'on lit sur
  l'emploi du temps, en proposition principale ; une variante plus courte en
  seconde.
- « Le chapitre est-il **« 3. Tables de hachage et récursion »** ? (dossier
  `3.tables-de-hachage-et-recursion`) » — le numéro suit les chapitres déjà
  présents, ou celui que le prof donne.
- Si plusieurs documents pourraient faire une ou deux fiches : « Une fiche par
  document, nommées comme le prof (`cours`, `td`) ? » — c'est la règle ; fondre
  deux documents ne se fait que sur réponse explicite.

**Salve 3 — ce qu'on ajoute au cours du prof.** En choix multiple, chaque option
dite avec ce qu'elle coûte et apporte :

- **une feuille d'entraînement** — des questions en paliers, de zéro au niveau
  du TD, pour qui bloque sur le premier exercice ;
- **des révisions** — l'essentiel du chapitre en questions courtes ;
- **un QCM de chapitre** — vingt questions mêlées, pour s'évaluer d'un coup ;
- **le contrôle corrigé** — si une annale ou un sujet d'exemple a été fourni ;
- **rien de plus** — seulement les documents du prof.

Et, si le doute existe : « Le contrôle est-il en **anglais** ? » (les questions
suivent alors la langue de l'examen, comme en ethical hacking).

### 0.5 Le récapitulatif

Avant d'écrire, montrer l'arborescence qui va être créée, et la faire
confirmer :

```
content/cours/a1/structures-donnees-algorithmique/
├── index.md                 (nouvelle matière, + carte dans a1/index.md)
└── 3.tables-de-hachage-et-recursion/
    ├── index.md
    ├── cours.md             ← cours.pdf
    ├── tp.md                ← tp3.pdf, corrigé tp3-corrige.pdf
    └── entrainement.md      (ajoutée, demandée)
```

Ce qu'on a tranché sans demander (une icône, l'ordre des sections) se dit dans
la PR.

## 1. Lire le PDF

- **L'outil Read sur le PDF**, par tranches de 20 pages (`pages: "1-20"`) : c'est
  la seule lecture qui voit les formules telles qu'elles sont composées, les
  figures et les tableaux. C'est la lecture de référence.
- `pdftotext -layout fichier.pdf -` en complément, pour chercher un mot ou
  compter les exercices — jamais pour recopier une formule : il aplatit les
  fractions, perd les indices et invente des espaces.
- Si l'utilisateur a les **sources `.tex`**, les demander : elles valent mieux
  que tout. Développer alors les macros maison (`\R`, `\dx`…) — KaTeX ne connaît
  pas `\newcommand` du document.

Relever d'abord le **plan** : les sections du cours, les exercices du TD et leurs
questions. C'est lui qui deviendra les `##` de la fiche de cours et les blocs des
fiches d'exercices.

## 2. Écrire les fiches

**L'arborescence calque celle des documents du professeur.** Chaque prof range
sa matière à sa façon, et le site le suit : un chapitre par dossier reçu, une
fiche par document, dans l'ordre et sous les noms que le prof leur donne. Il n'y
a pas de gabarit commun à toutes les matières. Par exemple :

- la remise à niveau (`4.nombres-complexes/`) a un TD par chapitre : cours,
  exercices, et des révisions et un entraînement ajoutés parce que le TD est court ;
- les mathématiques pour l'ingénieur ont un dossier par chapitre qui contient un
  cours, une feuille d'exercices et des diapos : chaque chapitre a une fiche
  `cours` et une fiche `exercices` (`/feuille` pour la logique, dont `/exercices`
  était déjà pris par le travail en autonomie).

Les **diapos ne deviennent jamais une fiche** : elles doublent le cours, et des
slides n'ont rien à faire en page web. On les lit pour recouper le cours.

Le `type` d'une fiche dit comment elle se lit :

| `type` | Pour |
|---|---|
| `cours` | le cours, section par section, chaque notion suivie d'un `::exemple` traité |
| `exercices` | un TD ou une feuille, dans l'ordre du sujet, un `:::exercice` par exercice |
| `entrainement` | des questions en paliers, de zéro au niveau du TD |
| `qcm` | un QCM de contenu |
| `formulaire` | des formules à consulter, sans question |

Fondre deux documents en une fiche, ou ajouter une fiche que le prof n'a pas
faite (révisions, entraînement), se **demande** à l'utilisateur avant d'écrire.
Chaque `index.md` de chapitre porte `title`, `description`, `ordre`, `icone`, et
des cartes vers ses fiches.

### Fidélité

- **Le cours dit ce que dit le PDF.** On réorganise, on explique, on ajoute des
  exemples traités — on n'ajoute pas de notion que le professeur n'a pas faite,
  et on ne change pas ses notations.
- **Les exercices du TD sont ceux du sujet**, dans son ordre, avec ses valeurs.
  Ce qu'on invente (révisions, entraînement) se dit dans la description de la
  fiche.

### Les sections du cours sont le plan du quiz

Chaque `## N. Titre` de la fiche de cours devient une case de la sélection du
quiz et une étape possible de la feuille de route d'un contrôle. Donc :

- des sections **de taille comparable**, une notion chacune — pas une section
  « Exercices » de cinquante questions ;
- numérotées (`## 1. La forme algébrique`) : l'ancre devient `_1-la-forme-algébrique`.

### Les questions

Une question qui se corrige toute seule vaut mieux qu'une question ouverte. Mais
**la réponse prend la forme que la question appelle** : ce que l'élève ferait sur
sa copie, et ce qui se lit le mieux. Le choix à quatre propositions n'est qu'un
format parmi d'autres :

- **un vrai ou faux se tranche entre deux propositions**, « Vraie » et « Fausse »
  (ou « Oui » et « Non ») — sans justification accolée : quatre propositions
  qui mêlent la valeur et sa raison soufflent la réponse. La justification va
  dans la solution. Le choix à quatre ne vaut que si la réponse est un objet à
  écrire (une négation, une formule, un ensemble). Un sujet qui demande les deux
  — « vraie ? sinon, donner sa négation », « décider, en justifiant par deux
  valeurs » — fait **deux questions** : le vrai ou faux (`1.`), puis l'objet
  (`1 bis.`, ou la lettre suivante), jamais une proposition qui accole la valeur
  et sa justification ;
- **une table de vérité se remplit** case par case (`table-verite`, dans une
  question sans `bonne`), au lieu d'un choix entre quatre colonnes « V, V, F… »
  illisibles ;
- **une commande se tape** dans un terminal (`commande`, dans une question
  sans `bonne`) : le jour du contrôle, on l'écrit, on ne la coche pas. Le
  correcteur accepte ce que l'outil accepte — l'ordre des options, les formes
  longues, les synonymes — et le mode `dockerfile` ou `yaml` en fait un
  éditeur ;
- un angle se lit sur le cercle (`cercle-trigo`), un tableau de variations se
  dresse ;
- **quand un cours demande un geste qu'aucun composant ne sait corriger, on écrit
  le composant** (`app/components/content/`), puis on le documente dans
  `syntaxe.md`. Pour un contributeur, c'est permis mais **jamais en silence** :
  la fusion déploie en production, et du code se relit autrement que du
  contenu. Le demander d'abord à la personne (« aucun composant ne sait corriger
  un tableau de Karnaugh : j'en écris un ? »), puis l'annoncer en tête de la PR,
  avec les fichiers touchés hors de `content/`.

Pour les choix à propositions :

- **Un résultat calculable devient un choix à quatre propositions** (`bonne="…"`,
  `#a` à `#d`). Les trois fausses sont des **erreurs typiques** — signe oublié,
  facteur `u'` manquant, une seule des deux familles de solutions —, jamais des
  valeurs au hasard. La solution les nomme : « **b** oublie le facteur… ».
- **La bonne lettre varie** : répartir à peu près également entre a, b, c et d
  (entre a et b pour un vrai ou faux).
- **Une démonstration, une étude, un tableau de variations** restent ouverts
  (pas de `bonne`) : ils s'auto-évaluent sur la fiche et ne vont pas au quiz.
- **Toute question a un `#indice`** (la piste, sans le résultat) et une
  `#solution` (rédigée, étape par étape, le résultat encadré par `\boxed{}`).
- **Toute question vise un rappel de cours** : `cours="id"`, et un
  `::extrait-cours{id="id" titre="…" source="/chemin/du/cours#ancre"}` en bas de
  page. C'est l'ancre de `source` qui range la question dans le plan du chapitre ;
  sans elle, la question tombe dans « Le reste du chapitre ».
- **Toute question vit dans un bloc** (`:::exercice` ou `:::qcm`) et porte un
  `label` (`a)`, `1.`). Hors bloc, elle s'affiche et ne sert à rien.

### Une solution se rédige comme le prof la rédige

La solution est le modèle que l'élève recopiera sur sa copie : elle suit la
méthode **et les formules** du professeur, pas un raccourci plus élégant. Quand
il a corrigé l'exercice (au tableau, dans un corrigé), sa méthode est la
solution principale, et les autres chemins viennent après, en plus court.

Une récurrence, par exemple, se rédige toujours en quatre temps, avec ses mots :

- **Énoncé.** « Notons, pour $n \in \mathbb{N}$, $P(n)$ : « … » ».
- **Initialisation.** « Pour $n = 0$ : … Donc $P(0)$ est vraie. »
- **Hérédité.** « Soit $n \in \mathbb{N}$ tel que $P(n)$ est vraie. Montrons
  qu'alors $P(n+1)$ est vraie, c'est-à-dire … » — $P(n+1)$ écrite en clair —,
  le calcul, chaque usage de l'hypothèse annoncé par « Par hypothèse de
  récurrence », puis « Ainsi, $P(n)$ vraie $\Rightarrow$ $P(n+1)$ vraie. »
- **Conclusion.** « D'après le principe de récurrence, pour tout $n \in \mathbb{N}$, … »

Ordre $2$ et récurrence forte gardent ce plan : deux rangs à l'initialisation,
ou une hypothèse sur tous les rangs de $n_0$ à $n$.

### L'énoncé commun d'un bloc

Le texte écrit en tête d'un `:::exercice`, avant ses questions, est rappelé par
le quiz **au-dessus de chaque question** qu'il en tire : « Donner l'affixe de
M₂M₄ » est insoluble sans les coordonnées. Y mettre donc **tout ce dont les
questions ont besoin** — les données, la fonction, la figure décrite.

Si l'entête est une introduction pédagogique et non un énoncé (les paliers
d'entraînement), le déclarer : `entete="introduction"`. Sans attribut, c'est un
énoncé — le sens sûr. Ne jamais le deviner autrement.

### L'identité d'une question est définitive

`chemin#slug(titre du bloc)#label`. Deux blocs d'une même page ne peuvent pas
avoir le même titre, deux questions d'un même bloc pas le même label. Et **une
fois la fiche publiée, on ne renomme plus ni les titres de blocs ni les labels** :
la progression de l'élève y est accrochée. Ajouter des questions ne coûte rien ;
renommer efface.

## 3. Vérifier chaque réponse par le calcul

Une mauvaise lettre dans `bonne` fait apprendre le faux — c'est le pire défaut
possible. Pour **chaque** question à choix :

1. recalculer la bonne réponse, avec sympy quand c'est du calcul
   (`python3 -m venv /tmp/sympy && /tmp/sympy/bin/pip install -q sympy`) ;
2. vérifier que **chaque distracteur est faux** — deux propositions justes rendent
   la question injuste ;
3. confronter au corrigé du professeur s'il existe. Un écart se tranche en le
   signalant dans la solution concernée, comme le font les fiches existantes.

Garder la trace : le nombre de questions vérifiées et celles qui ne se vérifient
pas au calcul (raisonnement, lecture de figure) iront dans la PR.

## 4. Contrôler

Sur un clone neuf — c'est le cas d'un contributeur —, installer d'abord : Node 24
(`node:sqlite` en fait partie) et pnpm.

```bash
pnpm install
cp .env.example .env      # les valeurs d'exemple suffisent en local
```

```bash
NUXT_CODE_INSCRIPTION=code-de-classe pnpm dev            # relève et rend le contenu ; --rendu se crée un compte
node scripts/verifier-contenu.mjs /cours/<annee>/<matiere> --rendu
pnpm lint && pnpm typecheck && pnpm build
```

`verifier-contenu` doit finir sur **Aucune erreur**. Il lit l'arbre que le build a
produit et cherche une à une les pannes silencieuses : question hors bloc ou sans
label, identité en double, `bonne` qui ne désigne aucune proposition, `cours=`
sans extrait, ancre de `source` inexistante, carte de lien qui ment sur un
compte, frontmatter illisible, et — avec `--rendu` — une page qui affiche moins
de questions que le build n'en compte. Lire aussi ses avertissements : une
question sans indice passe le contrôle, mais dessert l'élève.

Les ancres des sections se lisent dans la base de contenu après un premier
`pnpm dev` — ne pas les deviner :

```bash
node -e "const {DatabaseSync}=require('node:sqlite');console.log(new DatabaseSync('.data/content/contents.sqlite').prepare(\"SELECT sections FROM _content_cours WHERE path=?\").get('/cours/…/cours').sections)"
```

Puis ouvrir les fiches dans le navigateur (configuration `cours-dev`) : les
formules se composent, les boutons Indice / Solution / Cours s'ouvrent, une
question se corrige. Vérifier la chose, pas un substitut.

## 5. Livrer

Une branche `contenu/<matiere>-<chapitre>`, des commits en français qui disent
pourquoi, et une PR qui donne à la relectrice de quoi relire vite. Le corps de la
PR suit `.github/pull_request_template.md` :

- les fiches créées, avec leurs comptes (sections, questions, dont au quiz) ;
- « N questions vérifiées au calcul sur M » et la liste de celles qui ne l'ont
  pas été ;
- les écarts avec le corrigé du professeur, et ce qui a été ajouté au PDF
  (exemples, entraînement) ;
- la sortie de `verifier-contenu`.

**Propriétaire** : mettre à jour les chiffres qui en dépendent — `BANQUE` dans
`scripts/verifier-quiz.mjs`, les comptes attendus de `docs/contenu.md`, et la
ligne « Aujourd'hui : N questions » de `.claude/CLAUDE.md`.

**Contributeur** : ne **pas** toucher à ces chiffres. Plusieurs PR de
camarades sont ouvertes en même temps ; si chacune réécrivait le total, elles
entreraient toutes en conflit les unes avec les autres. Donner plutôt, dans la
PR, ce que l'import ajoute (« +84 questions, dont +52 au quiz ») : la
propriétaire recalcule les totaux à la fusion. Puis, depuis le fork :

```bash
gh repo fork ilyanfraimbault/Courses --clone=false    # crée le fork, ou dit qu'il existe
git remote add fork "https://github.com/$(gh api user --jq .login)/Courses.git" 2>/dev/null
git push -u fork contenu/<matiere>-<chapitre>
gh pr create --repo ilyanfraimbault/Courses --base master \
  --head "$(gh api user --jq .login):contenu/<matiere>-<chapitre>" \
  --title "contenu(<matiere>) : <ce que la PR apporte>" --body-file <corps.md>
```

Si le clone vient déjà du fork (`origin` pointe sur lui), `git push -u origin`
suffit. Ne jamais pousser sur `master`, ni ouvrir la PR vers le fork lui-même.
Seule la propriétaire fusionne : la PR reste ouverte jusqu'à sa relecture, et
ses remarques se traitent par de nouveaux commits sur la même branche.
