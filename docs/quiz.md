# Le mode quiz

Une question au milieu de l'écran, une seule à la fois. On répond, on voit
aussitôt si c'était juste et pourquoi, on enchaîne. La séance ne se termine pas
au bout de N questions : elle se termine quand les N **places** sont acquises.

## Ce qui le distingue des QCM

| | QCM | Quiz |
|---|---|---|
| Questions | celles d'une page, dans l'ordre | tirées dans toute la banque |
| Correction | à la fin, d'un bloc | après chaque réponse |
| Une erreur | coûte un point | renvoie la place à la fin de la file |
| La séance finit | quand on rend la copie | quand tout est acquis |

Les deux modes gardent leur mémoire séparément : un QCM écrit dans
`qcm_tentative`, une séance de quiz dans `quiz_session`.

## La banque : 412 questions, aucune écrite pour le quiz

Le quiz **n'a pas de questions à lui**. Il tire dans celles qui existent déjà :
les exercices du TD, les fiches d'entraînement, les révisions et les six QCM.
Sur les 453 questions du site, **412** sont exploitables — celles qui portent
une lettre attendue et au moins deux propositions. Les 41 autres sont des
questions ouvertes, qui s'auto-évaluent : une file qui doit savoir si la réponse
était juste ne peut rien en faire.

L'énoncé, les propositions, l'indice, la solution rédigée et jusqu'au rappel de
cours visé sont **ceux de la fiche, à l'octet près** : le serveur les découpe
dans l'arbre de la page au moment de poser la question. Corriger une faute de
frappe dans un cours corrige donc le quiz du même coup, sans rien à
resynchroniser.

### Une question ne se pose pas sans son énoncé

Beaucoup de questions ne portent pas tout leur énoncé. « Donner l'affixe du
vecteur $\overrightarrow{M_2M_4}$ » n'a de sens qu'avec « les points lus sur la
figure sont $M_1(2,1)$, $M_2(0,3)$… », écrit **une fois** en tête de l'exercice
et valable pour toutes ses questions. C'est le cas de **251 des 453** questions
du site.

Le quiz relit donc, avec chaque question, l'énoncé commun de son bloc — tout ce
qui précède la première question — et l'affiche au-dessus, en retrait. En
entier, et sans repli : un énoncé qu'il faut déplier pour lire est précisément
le défaut qu'on corrige. La médiane fait 232 caractères, le maximum 849.

Deux relevés rendent l'affaire simple. Aucun `extrait-cours` ne vit à
l'intérieur d'un bloc — vérifié sur les 111 du site — il n'y a donc pas de
rappel de cours à écarter de l'énoncé. Et seules quatre questions renvoient à
autre chose qu'elles-mêmes, toutes à leur propre partie *a)* : aucune ne devient
insoluble une fois son bloc rappelé.

En contrepartie, un bloc dont l'entête est **pédagogique** plutôt qu'un énoncé —
les paliers d'entraînement s'ouvrent souvent sur la méthode à suivre — voit ce
texte s'afficher au-dessus de chacune de ses questions. On le donne quand même :
les distinguer demanderait une heuristique, et une heuristique qui se trompe
rend une question insoluble sans le dire.

### L'index, relevé au build

Tirer quarante questions au hasard demanderait autrement d'ouvrir les
vingt-sept fiches, soit **27 Mo** d'arbre à parcourir. Le hook
`content:file:afterParse` de `nuxt.config.ts` relève donc, à côté du comptage
des questions et du relevé des blocs, un champ `quiz` par page : une entrée par
question à choix, **de quoi la choisir, jamais de quoi la poser**. L'ensemble
pèse 84 Ko et se charge une fois en mémoire ; les énoncés, eux, ne sont jamais
mis en cache.

Vérifier le relevé après une modification de contenu :

```bash
node -e "
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('.data/content/contents.sqlite');
const rows=db.prepare('SELECT path, quiz FROM _content_cours').all();
let n=0; const t={};
for (const r of rows) for (const q of JSON.parse(r.quiz||'[]')) { n++; t[q.theme]=(t[q.theme]||0)+1 }
console.log(n, t);
"
```

Attendu aujourd'hui : `412 { 'fonctions-usuelles': 61, 'fonctions-variable-reelle': 145, 'nombres-complexes': 129, trigonometrie: 77 }`.

Un thème `null` dans ce relevé signalerait une question que le catalogue ne
saurait pas classer — aujourd'hui il n'y en a aucune.

## Le thème d'une question vient du cours, pas de la page

C'est la décision qui rend la catégorisation utilisable. Un QCM **mélange les
chapitres exprès** : le classer par son dossier mettrait ses vingt questions
dans un thème « qcm » dont personne ne veut, et « m'interroger sur la trigo »
ne trouverait rien dans les six QCM.

Mais chaque question renvoie au rappel de cours exact qui lui manquait
(`::qcm-question{cours="qcm-g-derivees"}`), et ce rappel porte une `source` qui
pointe vers une section d'un chapitre :

```
::extrait-cours{id="qcm-g-derivees" source="/cours/…/fonctions-variable-reelle/cours#…"}
```

Le thème est donc l'avant-dernier segment de cette source. Une question sans
rappel retombe sur le chapitre de sa fiche. Rien n'est écrit à la main : une
table de correspondance vieillirait en silence, la `source` non.

Le **nom** de la notion est l'intitulé de ce même extrait — « Dérivées : le
mécanisme des composées » —, ce qui donne 89 notions nommées sous les quatre
chapitres, et un second niveau de sélection sans un octet de métadonnée en plus.

Deux chapitres peuvent employer le même identifiant d'extrait — `cours-quotient`
désigne le quotient de fonctions ici, le quotient de complexes ailleurs. La clé
d'une notion est donc `chapitre/identifiant`, sans quoi rater une dérivée
proposerait une question de complexes.

## La file

Une séance ouvre avec `taille` **places**, tirées une fois pour toutes. Chaque
place est une dette : elle n'est éteinte que par une bonne réponse.

- **Juste** → la place est acquise, on avance.
- **Faux** → la place retourne **à la fin de la file**, mais avec une **autre**
  question. La séance ne peut donc pas se terminer avant que tout ait fini par
  tomber juste, et on ne revoit jamais deux fois le même énoncé.

Le tirage initial existe entièrement dès l'ouverture : c'est ce qui donne un
dénominateur honnête — « douze acquises sur quarante » veut dire quelque chose
— et ce qui permet de reprendre la séance sur un autre appareil.

### Quelle question revient à la place d'une ratée

Dans l'ordre, la première liste non vide gagne, et le tirage y est aléatoire :

1. une question du **même point de cours** ;
2. une question du **même exercice** — mais seulement si le bloc est un
   exercice : ses questions portent sur un même sujet par construction, alors
   qu'un QCM mélange les chapitres exprès, et « une autre question du QCM 1 »
   reviendrait à tirer au hasard ;
3. une question du **même chapitre** ;
4. n'importe laquelle de la sélection.

Toutes les questions déjà dans la file sont exclues à chaque palier. Quand il
ne reste rien — sélection étroite, séance longue — la question manquée est
reposée telle quelle, **et l'écran le dit** : c'est la seule façon de tenir la
promesse « ça continue tant que tout n'est pas acquis » quand la banque est à
sec.

### Le tirage s'étale

Un tirage uniforme donnerait volontiers six questions sur la même formule de
dérivation, simplement parce qu'elle est la plus représentée. Le tirage tourne
donc à deux niveaux : un chapitre après l'autre, et dans chacun une notion après
l'autre. Sur quarante questions et les quatre chapitres, la répartition observée
est 10 / 10 / 10 / 10.

## Le serveur est maître du barème

La bonne réponse **ne part pas** avec la question : elle reste au serveur
jusqu'à ce qu'on ait répondu. C'est vérifiable — la charge utile de
`/api/quiz/session/…/question` ne contient pas de champ `bonne`.

C'est aussi lui qui tient la file, choisit les reprises et décide qu'une séance
est finie. Le client n'en garde qu'un reflet, ce qui a deux conséquences
heureuses : recharger la page ne perd rien, et un onglet resté ouvert reçoit une
409 avec l'état à jour plutôt que de corriger la mauvaise question.

Le seul état vraiment local est le **préchargement** de la question suivante.
Son rang est connu dès qu'on affiche la question en cours, puisqu'une faute
allonge la file par la fin sans rien décaler : elle est donc chargée pendant
qu'on réfléchit, et « Question suivante » n'attend pas le réseau. Le seul cas où
le préchargement se trompe est celui de la dernière question de la file : il ne
trouve rien, et la faute qui suit crée justement l'entrée qu'il n'a pas vue —
d'où la règle « un préchargement vide ne s'utilise pas, il se refait ».

## Les routes

| Route | Rôle |
|---|---|
| `GET /api/quiz/catalogue` | chapitres et notions, avec leurs comptes |
| `POST /api/quiz/session` | ouvre une séance, tire les places, rend la première question |
| `GET /api/quiz/session/:id` | reprend une séance là où elle s'était arrêtée |
| `DELETE /api/quiz/session/:id` | clôt une séance sans l'effacer |
| `GET /api/quiz/session/:id/question?position=` | une question de la file, pour le préchargement |
| `POST /api/quiz/session/:id/reponse` | corrige, allonge la file s'il le faut, rend la correction |
| `GET /api/quiz/historique` | les séances passées, et ce qui résiste |

Toutes passent par `idUtilisateur(event)` : une séance n'est lisible que par son
compte. Le catalogue est du contenu et n'appartient à personne, mais il exige
quand même une session — le quiz tout entier est derrière la connexion, et une
porte entrouverte sur le côté ne sert qu'à surprendre plus tard.

## Les tables

`quiz_session` porte la file entière en JSON, écrite par **instantané** comme la
progression d'une fiche : rejouer une écriture est sans effet.

`quiz_reponse` porte une ligne par question posée. Elle est redondante avec la
file, et c'est voulu : la file dit où en est *cette* séance, ces lignes disent ce
qui résiste depuis toujours — et ça ne se lit pas en désérialisant trente JSON.
C'est de là que vient le panneau « Ce qui résiste ».

L'intitulé lisible d'une notion n'est **pas** recopié en base : il vient du
contenu à la lecture. Le figer ferait afficher une notion renommée dans le cours
sous son ancien nom des mois plus tard.

## Une question gagnée compte sur sa fiche

Une question trouvée est une question trouvée : la retrouver cochée en vert dans
son exercice est ce qu'on attend, et devoir la refaire sur la fiche pour qu'elle
compte serait une punition sans objet. Le report a donc lieu dans la **même
transaction** que l'avancée de la file — les deux décrivent le même événement.

Il ne peut pas passer par `PUT /api/fiche`, qui écrit un instantané de la fiche
**entière** : le quiz, qui n'a pas ouvert la page, n'en connaît pas les autres
questions, et son instantané effacerait tout le reste. Le serveur écrit donc la
seule ligne concernée, avec trois précautions (`server/utils/quiz-progression.ts`) :

- **le dénominateur vient du contenu.** Si le quiz est le premier à écrire pour
  cette fiche, la ligne `fiche` est créée avec le nombre de questions compté au
  build — pas avec zéro, qui ferait afficher « 1 / 0 » au tableau de bord ;
- **une fiche déjà connue garde son total.** C'est la page qui fait foi : elle le
  réécrit à chaque visite ;
- **une question déjà trouvée garde sa réponse.** Même règle qu'à l'import : la
  lettre gagnée sur la fiche ne se fait pas remplacer, et `premiere` retient la
  plus ancienne des deux dates.

L'inverse n'existe pas. Une faute au quiz n'efface rien, et le quiz ne **relit**
jamais la progression : il repose volontiers une question déjà trouvée sur sa
fiche — c'est le même contrat que le QCM, dont la copie arriverait sinon
pré-remplie.

## Ce que le quiz n'écrit pas

**L'export JSON.** `resultats-cours` transporte les fiches, les QCM et la to-do,
pas les séances de quiz. Le format est partagé avec le portfolio d'origine ;
l'y ajouter serait un champ facultatif de plus, à faire le jour où on en aura
besoin. Les questions gagnées au quiz, elles, voyagent — elles sont dans la
progression des fiches.

## Vérifier

Les deux scripts de vérification demandent un serveur en marche et une base
vierge, comme `verif:api` et `verif:comptes` :

```bash
pnpm dev                              # ou un build de production, plus léger
pnpm verif:quiz                       # banque, filtres, file, reprises, isolation
```

`QUIZ_BASE` vise une autre adresse que `http://localhost:3000` — un build de
production, par exemple :

```bash
pnpm build
NUXT_BASE_FICHIER=/tmp/essai.sqlite NUXT_CODE_INSCRIPTION=essai \
  NUXT_SESSION_PASSWORD=... PORT=3210 node .output/server/index.mjs &
QUIZ_BASE=http://localhost:3210 NUXT_CODE_INSCRIPTION=essai pnpm verif:quiz
```

Ce que le script établit, et qui vaut d'être relu avant de toucher au mode :

- 412 questions dans la banque, réparties sur quatre chapitres et 89 notions
  nommées, sans reste ;
- la bonne réponse n'est pas dans la charge utile d'une question ;
- une faute allonge la file d'une entrée qui porte le numéro de la place ratée ;
- la question de reprise n'est jamais celle qu'on vient de rater ;
- **aucune question n'est posée deux fois** dans une séance ;
- une séance finit par se terminer, même en répondant faux exprès ;
- répondre deux fois à la même position rend une 409 sans rien corrompre ;
- chaque question d'un bloc à énoncé commun rend cet énoncé, et la part de
  questions concernées reste dans la bande attendue sur un large tirage ;
- une question gagnée est cochée sur sa fiche, avec le bon dénominateur, et le
  tableau de bord la voit ;
- la séance d'un compte est introuvable depuis un autre.

Le rendu, lui, ne se vérifie pas au `curl` : la page charge tout au montage. Il
faut un vrai navigateur, et compter les formules produites — c'est ce que fait
`pnpm verif:quiz:rendu`, qui joue une séance et vérifie qu'énoncés,
propositions, corrections et rappels de cours sortent avec leur KaTeX, que le
clavier répond, et que rien ne déborde à 390 px de large. Il signale aussi
toute divergence d'hydratation : elle ne casse rien à l'œil et casse tout à
l'usage.

Playwright n'est pas une dépendance du projet. `import()` ne suivant pas
`NODE_PATH`, une installation globale se désigne par son chemin :

```bash
npm i -g playwright && playwright install chromium
PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs pnpm verif:quiz:rendu
```
