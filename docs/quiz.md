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

## La banque : 312 questions, aucune écrite pour le quiz

Le quiz **n'a pas de questions à lui**. Il tire dans celles qui existent déjà :
les exercices du TD, les fiches d'entraînement, les révisions, le cours et le QCM
de contenu. Sur les 353 questions du site, **312** sont exploitables — celles qui portent
une lettre attendue et au moins deux propositions. Les **41** autres sont des
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
et valable pour toutes ses questions. C'était le cas de **251 des 473** questions
du site quand le défaut a été relevé, avant le retrait des QCM 1 à 6 — dont
aucun bloc n'avait d'énoncé commun.

Le quiz relit donc, avec chaque question, l'énoncé commun de son bloc — tout ce
qui précède la première question — et l'affiche au-dessus, en retrait. En
entier, et sans repli : un énoncé qu'il faut déplier pour lire est précisément
le défaut qu'on corrige. La médiane fait 232 caractères, le maximum 849.

Deux relevés rendent l'affaire simple. Aucun `extrait-cours` ne vit à
l'intérieur d'un bloc — vérifié sur les 111 du site — il n'y a donc pas de
rappel de cours à écarter de l'énoncé. Et seules quatre questions renvoient à
autre chose qu'elles-mêmes, toutes à leur propre partie *a)* : aucune ne devient
insoluble une fois son bloc rappelé.

### Tous les entêtes ne sont pas des énoncés

Un palier d'entraînement s'ouvre sur la méthode à suivre — « Une seule idée
gouverne tout ce palier : quand une fonction est appliquée à une autre… ». Le
rappeler au-dessus de chaque question du palier reviendrait à souffler la
réponse.

Le bloc le dit donc lui-même :

```md
:::exercice{titre="Palier 3 — Les formes composées" entete="introduction"}
```

L'attribut est **explicite**, pas déduit : une heuristique qui se trompe rend
une question insoluble sans le dire, et ce n'est pas un risque qu'on prend pour
économiser dix-huit attributs. Deux valeurs seulement — `enonce`, le défaut, et
`introduction`.

**Le défaut compte.** Sans attribut, l'entête est traitée comme un énoncé. C'est
le sens sûr : oublier de marquer une introduction ne coûte qu'un peu de bruit
dans le quiz, tandis que l'oubli inverse rendrait la question impossible. Le
texte reste affiché sur la fiche dans tous les cas — l'attribut ne concerne que
le quiz.

Classement actuel, fait en lisant les 53 entêtes une par une : **18 blocs**
marqués `introduction`, tous des paliers d'entraînement, pour 50 questions. Les
paliers 2 et 4 des nombres complexes n'en sont pas : ils posent
`z₁ = 1−2i, z₂ = −3+i` et les points `A, B, C`, dont les questions dépendent.
Restent **160 questions** dont l'énoncé est rappelé.

### L'index, relevé au build

Tirer quarante questions au hasard demanderait autrement d'ouvrir les
vingt-sept fiches, soit **27 Mo** d'arbre à parcourir. Le hook
`content:file:afterParse` de `nuxt.config.ts` relève donc, à côté du comptage
des questions et du relevé des blocs, un champ `releve` par page : une entrée
par question, **de quoi la choisir et la classer, jamais de quoi la poser**.
L'ensemble se charge une fois en mémoire ; les énoncés, eux, ne sont jamais mis
en cache.

Le relevé porte les **353** questions du site et non les seules 312 du quiz. Le
champ `interrogeable` fait le tri, et la banque n'est que la part vraie de ce
champ. C'est la progression par domaine qui a demandé cet élargissement — elle
compte aussi les questions ouvertes, sans quoi le total d'un chapitre ne
tomberait plus juste (voir `docs/domaines.md`). Deux relevés côte à côte se
seraient contredits le jour où l'un aurait changé.

Vérifier le relevé après une modification de contenu :

```bash
node -e "
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('.data/content/contents.sqlite');
const rows=db.prepare('SELECT path, releve FROM _content_cours').all();
let n=0; const t={};
for (const r of rows) for (const q of JSON.parse(r.releve||'[]')) {
  if (!q.interrogeable) continue; n++; t[q.theme]=(t[q.theme]||0)+1
}
console.log(n, t);
"
```

Attendu aujourd'hui, les chapitres désignés par leur chemin :

```
312 {
  '/cours/a1/remise-a-niveau-maths/trigonometrie': 63,
  '/cours/a1/remise-a-niveau-maths/fonctions-variable-reelle': 109,
  '/cours/a1/remise-a-niveau-maths/fonctions-usuelles': 38,
  '/cours/a1/remise-a-niveau-maths/nombres-complexes': 102
}
```

Un thème `null` dans ce relevé signalerait une question que le catalogue ne
saurait pas classer — aujourd'hui il n'y en a aucune. Une `section` nulle est
moins grave : la question tombe dans « le reste du chapitre ». Il y en a huit,
et elles viennent des deux seuls rappels de cours dont la `source` ne porte pas
d'ancre.

## Le thème d'une question vient du cours, pas de la page

C'est la décision qui rend la catégorisation utilisable. Un QCM **mélange les
chapitres exprès** : le classer par son dossier mettrait ses vingt questions
dans un thème « qcm » dont personne ne veut, et « m'interroger sur la trigo »
ne trouverait rien dans un QCM.

Mais chaque question renvoie au rappel de cours exact qui lui manquait
(`::qcm-question{cours="qcm-g-derivees"}`), et ce rappel porte une `source` qui
pointe vers une section d'un chapitre :

```
::extrait-cours{id="qcm-g-derivees" source="/cours/…/fonctions-variable-reelle/cours#_5-les-formes-composées"}
```

Le thème est donc le chapitre de cette source, désigné par **son chemin** —
`/cours/a1/remise-a-niveau-maths/fonctions-variable-reelle` — et non plus par
son slug : deux matières peuvent avoir un chapitre du même nom, et le slug les
aurait fondus en un seul thème, dette comprise. La règle vit dans
`shared/utils/niveaux.ts`. Une question sans rappel retombe sur le chapitre de sa
fiche.

## La matière d'abord

Le site porte plusieurs matières, et une séance ne les mélange pas : deux cours
révisés dans la même file ne se révisent ni l'un ni l'autre. Le catalogue a donc
un niveau de plus, au-dessus des chapitres (`CatalogueQuiz.matieres`), et la
page commence par le choix de la matière — affiché même quand il n'y en a
qu'une, parce que c'est ce qui dit de quel cours viennent les questions.

Dans le filtre, `matiere` ne s'**ajoute** pas aux chapitres et aux sections : elle
les **croise**. « Rien de coché » prend toute la matière, pas tout le site, et
« seulement ce que j'ai raté » ne tire pas la dette d'un autre cours. Une séance
ouverte avant les matières n'en porte pas, et garde le site entier pour cadre.

La matière d'une question se déduit de son chapitre, un niveau plus haut : une
question de QCM qui vise le cours de trigonométrie appartient à la matière de ce
cours. Les liens venus d'ailleurs — `?matiere=`, `?theme=`, `?notion=` —
présélectionnent la matière qui porte la clé reçue. Rien n'est écrit à la main : une
table de correspondance vieillirait en silence, la `source` non.

## Le second niveau, c'est le plan du chapitre

L'ancre de cette même `source` nomme la **section du cours**, et c'est elle qui
sert de second niveau à la sélection : `/…/trigonometrie/cours#_4-les-valeurs-remarquables`
s'affiche « 4. Les valeurs remarquables », intitulé relu dans la page de cours.

Ça n'a pas toujours été le cas, et le changement mérite d'être expliqué. Le
second niveau était l'**intitulé du rappel de cours** visé. Deux défauts, chacun
suffisant pour rendre l'écran de sélection inutilisable :

- **le même intitulé apparaissait deux fois.** Deux rappels écrits dans deux
  fiches — l'un dans l'entraînement, l'autre dans un QCM — portent souvent le
  même titre : « Résoudre une équation trigonométrique » deux fois en trigo, six
  titres en double dans « fonctions dérivées » comme dans « complexes ». Rien à
  l'œil ne les distinguait ;
- **les comptes ne s'additionnaient pas.** Une question qui ne vise aucun rappel
  n'apparaissait dans aucune pastille. Trigonométrie annonçait **77** questions
  au chapitre pour **29** réparties dans ses pastilles : les 48 autres, les
  contrôles express de la page de cours, n'étaient atteignables qu'en cochant le
  chapitre entier.

Le plan du chapitre règle les deux. Un titre de section est unique dans sa page
par construction, et une question sans rappel se rattache au **titre de niveau 2
qui la précède dans sa propre page** — ce qui est précisément la section dont
elle parle, puisqu'un contrôle express est écrit sous le cours qu'il vérifie.

Le relevé donne aujourd'hui **34 cases pour 312 questions**, et chaque chapitre
est couvert sans reste :

| Chapitre | Cases | Questions |
|---|---|---|
| Trigonométrie | 12 | 63 |
| Fonctions d'une variable réelle | 6 | 109 |
| Fonctions usuelles | 8 | 38 |
| Nombres complexes | 8 | 102 |

Huit questions n'ont pas de section : deux rappels de cours pointent vers une
page sans ancre. Elles tombent dans une case « Le reste du chapitre », qui
existe pour que la somme des cases fasse toujours le compte du chapitre. Un
chiffre qui ne s'additionne pas est pire qu'un chiffre absent.

Le repli sur le titre de niveau 2 n'a lieu que si la question **appartient** au
chapitre de sa page : une question de QCM qui vise le cours des fonctions
usuelles ne doit pas classer « Partie B » du QCM parmi les sections de ce
chapitre.

La **notion** — l'intitulé du rappel — n'a pas disparu pour autant. Elle sert
encore à deux choses, où sa finesse est un atout et son ambiguïté sans
conséquence :

- elle est le **premier palier** du choix d'une question de reprise ;
- elle est ce que **« Mes domaines » désigne par lien.** Cette page-là raisonne
  en points de cours — c'est son sujet — et son bouton « m'interroger » ouvre
  `/quiz?notion=…`. Le catalogue porte donc toujours les notions, rangées sous
  leur section, mais il ne les **affiche** pas : une sélection reçue par lien
  arrive nommée dans un bandeau, avec la section qui la contient et de quoi la
  retirer. C'est la seule façon d'annoncer « 4 questions dans la sélection » en
  disant lesquelles.

Une notion vit dans une seule section, les deux venant de la même `source`.
Sa clé est `/chemin/du/chapitre#identifiant`, deux chapitres pouvant employer le même
identifiant d'extrait — `cours-quotient` désigne le quotient de fonctions ici,
le quotient de complexes ailleurs.

## La file

Une séance ouvre avec `taille` **places**, tirées une fois pour toutes. Chaque
place est une dette : elle n'est éteinte que par une bonne réponse.

- **Juste** → la place est acquise, on avance.
- **Faux** → la place retourne **à la fin de la file**, mais avec une **autre**
  question. La séance ne peut donc pas se terminer avant que tout ait fini par
  tomber juste, et on ne revoit jamais deux fois le même énoncé.
- **« Je ne sais pas »** → exactement comme une faute.

### « Je ne sais pas » est une réponse, pas une sortie

Devant quatre propositions, ne pas savoir se joue autrement : on coche au hasard
et on a une chance sur quatre d'être compté juste sans rien avoir appris. C'est
cette chance-là qu'il fallait retirer, et la seule façon honnête était de rendre
l'aveu **au moins aussi intéressant** que le tirage au sort.

Le bouton envoie donc la même route que les autres réponses, sans lettre
(`{ passee: true }`), et le serveur en tire la même conséquence : la place est
manquée, elle revient à la fin de la file avec une autre question du même point
de cours, la dette s'inscrit, et le compte des questions posées la retient — la
part de « justes du premier coup » du bilan reste donc une mesure vraie. Ce que
l'aveu rapporte, c'est ce qu'on venait chercher : la correction **et** l'indice
s'ouvrent d'office, là où une faute n'ouvre que la correction — l'indice n'a
plus rien à apprendre à qui a déjà cherché avec — et le rappel de cours passe au
premier plan.

Le verdict ne reproche rien : « Passée : la réponse était la B. » Il n'y a pas
de mauvaise réponse à barrer, puisqu'aucune n'a été donnée.

Au clavier, c'est `0` : le seul chiffre qui ne désigne aucune proposition, donc
le seul qui puisse dire « aucune ».

La question posée à la place n'est **pas** celle qu'on vient de passer. C'est la
même règle que pour une faute, et pour la même raison : réciter la solution
qu'on vient de lire ne prouverait rien.

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

### … et il préfère ce qui n'est pas su

À l'intérieur d'un point de cours, l'ordre n'est pas au hasard. Quatre paliers,
du plus urgent au moins utile :

1. **en dette** — ratée quelque part et pas encore retrouvée depuis ;
2. **jamais posée au quiz** — du neuf, tant qu'il en reste ;
3. **posée il y a plus de deux semaines** — le temps d'oublier ;
4. **posée récemment** — faute de mieux dans la sélection.

Sans ce classement, une banque de trois cents questions finit par reposer avant-hier ce
qu'on a vu hier, et une séance n'apprend plus qu'à reconnaître des énoncés. Le
tri est **stable** et n'intervient qu'après le mélange : à palier égal, l'ordre
reste aléatoire. Et il reste **subordonné à l'étalement**, sans quoi une séance
de vingt questions se réduirait aux vingt dettes du même chapitre.

### L'ordre des propositions est brassé

La bonne réponse d'un exercice donné finit par se retenir comme « c'est la c ».
Le serveur envoie donc les propositions dans un ordre **tiré pour cette place de
cette séance**, et l'écran ne montre jamais les lettres de la fiche : il
numérote les propositions dans l'ordre où elles s'affichent, et le clavier
désigne ce rang. La lettre écrite dans le contenu ne transparaît nulle part.

Le brassage est **déterministe** — un mulberry32 amorcé par `séance:place:question`.
Ce n'est pas un raffinement : la même question est lue deux ou trois fois — pour
l'afficher, pour la corriger, au préchargement — et un ordre retiré à chaque
lecture changerait sous les doigts entre le moment où on lit et celui où on
clique.

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
| `GET /api/quiz/catalogue` | matières, chapitres et sections du cours, avec leurs comptes et leur dette |
| `POST /api/quiz/session` | ouvre une séance, tire les places, rend la première question |
| `GET /api/quiz/session/:id` | reprend une séance là où elle s'était arrêtée |
| `DELETE /api/quiz/session/:id` | clôt une séance sans l'effacer |
| `GET /api/quiz/session/:id/question?position=` | une question de la file, pour le préchargement |
| `POST /api/quiz/session/:id/reponse` | corrige, allonge la file s'il le faut, rend la correction — `{ passee: true }` sans lettre pour « je ne sais pas » |
| `GET /api/quiz/historique` | les séances passées, et ce qui résiste |
| `POST /api/fautes` | les fautes commises sur une fiche — hors quiz, mais même mémoire |

Toutes passent par `idUtilisateur(event)` : une séance n'est lisible que par son
compte. Le découpage du catalogue est du contenu et n'appartient à personne,
mais ses comptes de dette, si — et le quiz tout entier est de toute façon
derrière la connexion, une porte entrouverte sur le côté ne servant qu'à
surprendre plus tard.

## Les tables

`quiz_session` porte la file entière en JSON, écrite par **instantané** comme la
progression d'une fiche : rejouer une écriture est sans effet.

`quiz_reponse` porte une ligne par question posée. Elle est redondante avec la
file, et c'est voulu : la file dit où en est *cette* séance, ces lignes disent ce
qui résiste depuis toujours — et ça ne se lit pas en désérialisant trente JSON.
C'est de là que vient le panneau « Ce qui résiste ».

`faute` porte la dette : une ligne par question ratée au moins une fois, son
compte de fautes, et la date qui l'a éteinte — ou `NULL` tant qu'elle tient.

L'intitulé lisible d'une section n'est **pas** recopié en base : il vient du
contenu à la lecture. Le figer ferait afficher une section renommée dans le
cours sous son ancien nom des mois plus tard. C'est aussi pourquoi « ce qui
résiste » agrège en mémoire plutôt qu'en SQL : la base ne connaît que des
identités de questions.

## Ce que j'ai raté

Le site ne retenait que ce qui était **trouvé** : `reussite` pour les fiches,
`qcm_tentative` pour les copies. Une faute d'exercice mourait dans le
navigateur. « M'interroger sur ce que j'ai raté » ne pouvait donc pas exister —
le site ne le savait pas.

La table `faute` porte une ligne par question ratée au moins une fois, quel que
soit l'endroit :

| D'où vient la faute | Qui l'écrit |
|---|---|
| une proposition fausse sur une fiche | `POST /api/fautes`, envoyé par la page |
| une question ratée dans une copie de QCM | `POST /api/qcm/tentative`, depuis ses `ratees` |
| une mauvaise réponse au quiz | `POST /api/quiz/session/:id/reponse` |

Et la dette **s'éteint** en retrouvant la question, où que ce soit : la
progression d'une fiche (`PUT /api/fiche`) et une bonne réponse au quiz
rattrapent l'une comme l'autre. `rattrapee` porte la date ; `NULL` veut dire
« toujours en dette », et c'est cette colonne que la sélection interroge.

La ligne n'est jamais effacée : `compte` retient le nombre de fautes, ce qui
distingue l'étourderie de la notion qui ne passe pas. C'est de là que vient le
panneau « ce qui résiste », qui couvre donc maintenant les exercices et les QCM
et non plus les seules séances de quiz.

Une faute est un **événement**, pas un état, et c'est la seule écriture du site
qui le soit. Elle ne peut donc pas voyager dans le corps de `PUT /api/fiche`,
qui décrit l'état complet des questions trouvées : la page ne connaît que les
fautes commises sous ses yeux, et son instantané effacerait tout le reste. D'où
une route à part, et un envoi par delta. Une seule faute est comptée par
question et par visite, quel que soit le nombre de mauvaises lettres essayées :
c'est la question qui n'est pas sue, pas chaque clic.

Dans l'écran de sélection, « seulement ce que j'ai raté » est un **tamis** posé
sur le reste : il croise ce qui est coché au lieu de s'y ajouter, et pris seul
il prend toute la dette.

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

- 312 questions dans la banque, rangées par matière puis sur quatre chapitres
  désignés par leur chemin et 34 sections de cours, chaque chapitre couvert
  **sans reste** et sans intitulé en double ;
- la bonne réponse n'est pas dans la charge utile d'une question ;
- l'ordre des propositions est brassé, et deux lectures d'une même place
  rendent le même ordre ;
- une faute d'exercice apparaît au catalogue dans sa section, « seulement ce que
  j'ai raté » ne tire qu'elle, et la retrouver éteint la dette ;
- les questions ratées d'une copie de QCM entrent dans la même dette ;
- une faute allonge la file d'une entrée qui porte le numéro de la place ratée ;
- la question de reprise n'est jamais celle qu'on vient de rater ;
- **aucune question n'est posée deux fois** dans une séance ;
- une séance finit par se terminer, même en répondant faux exprès ;
- répondre deux fois à la même position rend une 409 sans rien corrompre ;
- « je ne sais pas » n'est jamais compté juste, n'invente aucune réponse,
  révèle la bonne, renvoie la place à la fin de la file et compte pour une
  posée et une manquée — et une réponse sans lettre ni aveu est refusée ;
- chaque question d'un bloc à énoncé commun rend cet énoncé, une entête marquée
  `introduction` n'est jamais rappelée, et la part de questions concernées reste
  dans la bande attendue sur un large tirage — attention, un tirage n'est pas un
  échantillon uniforme de la banque, il s'étale par notion ;
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

Il tient aussi deux témoins de mise en page, parce que les deux défauts qu'ils
gardent étaient invisibles au code et criants à l'écran : **l'écart entre le
centre de la lettre et le centre de sa proposition** — la lettre flottait 20 px
au-dessus de sa formule, le paragraphe de la proposition ayant gardé les marges
de la prose — et **la réserve entre la frise et la carte de la question**, dont
l'anneau de la place en cours venait mordre le bord.

Playwright n'est pas une dépendance du projet. `import()` ne suivant pas
`NODE_PATH`, une installation globale se désigne par son chemin :

```bash
npm i -g playwright && playwright install chromium
PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs pnpm verif:quiz:rendu
```

Quand un Chromium est déjà là mais dans une autre version que celle que ce
Playwright irait chercher, `PLAYWRIGHT_CHROMIUM` désigne son exécutable et
évite un second téléchargement.

Le script se crée un compte jetable : il faut donc un `NUXT_CODE_INSCRIPTION`
dans le `.env` local, et le même dans `CODE` (`code-de-classe` par défaut). Sans
lui le serveur ferme l'inscription, et le script échoue à sa première étape sans
avoir rien pu regarder.
