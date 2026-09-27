# Le contenu des cours

## Pourquoi `remark-mdc` est épinglé à 3.9.0

`package.json` porte un `pnpm.overrides` sur `remark-mdc`. **Ne pas le retirer sans
relancer la vérification décrite plus bas.**

`remark-mdc` est le parseur de la syntaxe MDC — c'est lui qui transforme

```md
::exo-question{label="1." bonne="c"}
Énoncé

#a
Première proposition
::
```

en un nœud `exo-question` portant des slots. À partir de la **3.11.1**, le `::`
fermant qui suit immédiatement le contenu d'un slot n'est plus reconnu comme une
fermeture : il est avalé dans le texte du slot. L'arbre produit devient

```
exercice
  exo-question (1.)
  template v-slot:b  →  texte "Non\n::"
                        exo-question (2.)   ← imbriquée, au lieu d'être sœur
```

Conséquence : **seule la première question de chaque bloc s'affiche**, les autres
disparaissent dans un slot replié. Rien ne plante, aucun avertissement — la page
se rend, simplement amputée des trois quarts de son contenu. C'est exactement le
genre de régression qu'on ne voit pas en relisant un diff.

Mesuré sur ce dépôt, sur la fiche `fonctions-usuelles/exercices` : avec 3.11.1,
**10 questions rendues sur 40** et 61 formules KaTeX sur 286 ; avec 3.9.0, 40 sur
40 et 286 sur 286 — soit la parité exacte avec le rendu du portfolio en
production, qui tourne lui aussi en 3.9.0. Sur l'ensemble des 28 fiches, 3.9.0
donne 473 questions rendues pour 473 comptées.

La borne exacte d'apparition du défaut (3.10 ou 3.11) n'a pas été cherchée :
3.9.0 est la dernière version dont le rendu est vérifié en production.

## Le contrôle en une commande

```bash
pnpm dev                                 # ou pnpm build : il écrit la base de contenu
pnpm verif:contenu                       # tout le site
pnpm verif:contenu /cours/a1/remise-a-niveau-maths --rendu   # une matière, rendu compris
```

`scripts/verifier-contenu.mjs` rassemble les témoins décrits plus bas, et en
ajoute : il parcourt l'arbre que le build a produit — pas la source — et
cherche une question hors bloc ou sans label, deux questions à la même identité,
deux blocs au même titre, un `bonne` qui ne désigne aucune proposition écrite,
une lettre manquante au milieu des propositions, un `cours=` sans extrait, une
`source` d'extrait vers une ancre qui n'existe pas, une carte de lien vers une
page absente ou qui annonce un compte faux, un dossier sans `index.md`, un
frontmatter qui ne se lit plus. Il recoupe ses comptes avec ceux du build, et
avec `--rendu` compte les questions dans le HTML servi.

Il sort en erreur sur une erreur. Ses avertissements signalent ce qui marche
mais dessert — une question sans indice. Aujourd'hui : **aucune erreur**,
353 questions dont 312 au quiz, 44 cartes dont le compte tombe juste, et 35
avertissements, tous connus : les 33 questions des contrôles express du cours de
trigonométrie n'ont pas d'indice, et deux rappels de la réplique du QCM visent le
cours des fonctions usuelles sans ancre — leurs huit questions tombent dans « Le
reste du chapitre ».

C'est le contrôle que le skill `importer-cours` (`.claude/skills/`) fait passer
à tout cours importé.

## Vérifier que le contenu se rend en entier

Le hook `content:file:afterParse` de `nuxt.config.ts` compte les questions de
chaque fiche au build (balises `exo-question`, `qcm-question`, `question`) et
écrit le total dans le champ `questions`. Ce nombre est le témoin : il vient de
l'arbre parsé, donc il reste juste même quand le rendu, lui, perd des nœuds.

Serveur de développement lancé, comparer le rendu au compte du build :

```bash
node -e "
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('.data/content/contents.sqlite');
const rows=db.prepare('SELECT path, questions FROM _content_cours ORDER BY path').all();
(async()=>{
  let rendu=0, attendu=0, ecarts=[];
  for (const r of rows){
    const html = await (await fetch('http://localhost:3000'+r.path)).text();
    const n = (html.match(/cours-question/g)||[]).length;
    rendu+=n; attendu+=(r.questions??0);
    if (n!==(r.questions??0)) ecarts.push(r.path+': '+n+' vs '+(r.questions??0));
  }
  console.log(rendu, '/', attendu, ecarts.length?('ÉCARTS: '+ecarts.join(', ')):'aucun écart');
})();
"
```

Attendu aujourd'hui : `353 / 353 aucun écart`.

Le compte porte sur le texte `cours-question` dans le HTML, et le serveur de
développement garde les commentaires de gabarit : un commentaire qui cite ce nom
de classe fait doubler le compte sans que rien ne soit cassé (voir
`.claude/pieges.md`). Un écart d'exactement ×2 sur toutes les pages désigne le
compteur, pas le contenu.

Ce contrôle vaut d'être relancé après toute montée de version de `@nuxt/content`,
`@nuxtjs/mdc` ou `remark-mdc` — c'est le seul moyen de voir la panne.

Le même hook relève l'index des questions. Il en a **353**, autant que le
comptage — chacune vit dans un bloc et porte un repère, donc chacune a une
identité et peut être rangée dans un domaine. Parmi elles, **312** sont
interrogeables, réparties sur les quatre chapitres d'une matière : c'est la banque du quiz,
décrite dans `docs/quiz.md`. Ce second témoin vaut d'être relu au même moment
qu'un changement de contenu — une question qui cesse d'être relevée disparaît du
quiz et d'un domaine sans que rien ne le signale.

```bash
node -e "
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('.data/content/contents.sqlite');
const rows=db.prepare('SELECT questions, releve FROM _content_cours').all();
let relevees=0, interrogeables=0, comptees=0, sansRenvoi=0; const notions=new Set();
for (const r of rows) {
  comptees += r.questions||0;
  for (const q of JSON.parse(r.releve||'[]')) {
    relevees++;
    if (q.interrogeable) interrogeables++;
    if (q.notion) notions.add((q.theme||'?')+'#'+q.notion); else sansRenvoi++;
  }
}
console.log({relevees, comptees, interrogeables, notions: notions.size, sansRenvoi});
"
```

Attendu aujourd'hui : `{ relevees: 353, comptees: 353, interrogeables: 312,
notions: 67, sansRenvoi: 48 }`. Un écart entre `relevees` et `comptees`
signalerait une question hors bloc ou sans repère : elle se rendrait bien, mais
n'aurait pas d'identité, donc pas de mémoire.

## Une question doit vivre dans un bloc

Une question écrite hors d'un `::exercice` ou d'un `::qcm` **s'affiche
normalement** et ne sert à rien : sans bloc pour lui prêter son titre, elle n'a
pas d'identité, donc pas de progression ; sans conteneur, pas de bouton
« Corriger » ; et le quiz ne la relève pas. Trois fonctions perdues, zéro
message. C'est arrivé au QCM 7, resté vingt questions durant sans son bloc.

Le témoin est le relevé `blocs` : une page qui compte des questions doit en
avoir au moins un.

```bash
node -e "
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('.data/content/contents.sqlite');
const orphelines = db.prepare('SELECT path, questions, blocs FROM _content_cours').all()
  .filter(r => (r.questions ?? 0) > 0 && Object.keys(JSON.parse(r.blocs || '{}')).length === 0);
console.log(orphelines.length ? 'HORS BLOC : ' + orphelines.map(r => r.path).join(', ') : 'aucune question hors bloc');
"
```

Attendu : `aucune question hors bloc`.

## Toute fiche porte son type

Un « : » non protégé dans un `title` ou une `description` de frontmatter fait
lire la valeur comme un objet, et le YAML perd **tout ce qui suit** — `type`,
`navigation`, `ordre` — sans une erreur. La page s'affiche ; elle perd sa
pastille, son bouton de to-do, et disparaît du catalogue de la to-do, qui écarte
les pages sans `type`. Guillemets doubles dès qu'une valeur contient « : » ou
« # ».

Le témoin : les fichiers qui écrivent un `type:` doivent tous l'avoir dans la
base de contenu.

```bash
node -e "
const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const ecrits=[];(function p(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);e.isDirectory()?p(f):f.endsWith('.md')&&/^type:/m.test(fs.readFileSync(f,'utf8').split(/^---$/m)[1]??'')&&ecrits.push(f)}})('content');
const types=new DatabaseSync('.data/content/contents.sqlite').prepare('SELECT COUNT(*) n FROM _content_cours WHERE type IS NOT NULL').get().n;
console.log(types, '/', ecrits.length, types===ecrits.length?'':'ÉCART : un frontmatter ne se lit plus');
"
```

Attendu aujourd'hui : `15 / 15`.

## Structure

Une seule collection, `cours`, dont la source est `cours/**/*.md`. Le chemin
d'URL découle de l'arborescence : `content/cours/a1/remise-a-niveau-maths/…`
donne `/cours/a1/remise-a-niveau-maths/…`. Les chemins sont **identiques** à ceux
du portfolio d'origine, volontairement.

L'arborescence **est** la hiérarchie du site : `/cours/<année>/<matière>/<chapitre>/<fiche>`.
`shared/utils/niveaux.ts` la lit dans le chemin, et c'est la seule règle qui
existe — le relevé du build, la banque du quiz, les domaines, le tableau de bord
et la barre latérale l'appellent tous. Une nouvelle matière est donc un dossier
de plus sous son année, avec un `index.md` qui la nomme ; une nouvelle année, un
dossier sous `cours/`. Rien d'autre à déclarer.

Un chapitre se désigne par son chemin et non par son slug, puisque deux matières
peuvent en avoir un du même nom. La page d'index d'un dossier lui donne son
intitulé, son icône et son rang (`ordre`).

Frontmatter : `title`, `description`, `type` (`cours` | `exercices` |
`entrainement` | `qcm` | `formulaire`), `annee`, `matiere`, `ordre`, `icone`,
`interactif`, et
quatre champs **remplis au build**, à ne jamais écrire à la main : `questions`
(le compte de la page), `blocs` (les exercices et QCM, avec leur dénominateur),
`sections` (les titres de niveau 2 de la page, par ancre — ils nomment les cases
de la sélection du quiz) et `releve` (une entrée par question, avec son bloc,
son repère, le point de cours qu'elle vise, sa section et le chemin de son
chapitre — voir
`docs/quiz.md` pour la banque du quiz qu'on en tire, et `docs/domaines.md` pour
la progression par point de cours).

Le hook qui les relève, dans `nuxt.config.ts`, importe `slugifier` depuis
`app/utils/cours.ts` : il n'existe qu'une implémentation, et c'est ce qui
garantit que le bloc relevé au build et l'identité écrite en base désignent la
même chose. En contrepartie, `app/utils/cours.ts` doit rester libre de tout
import Nuxt.

## Importer un ancien export

Le format d'export du portfolio d'origine est repris à l'identique, si bien qu'un
fichier produit là-bas se verse ici tel quel.

```bash
node scripts/importer-resultats.mjs resultats-2026-09-09.json --simulation  # n'écrit rien
node scripts/importer-resultats.mjs resultats-2026-09-09.json
```

En production on passe par la page « mes résultats » : l'image d'exécution ne
contient que `.output`, pas `scripts/`.

L'export transporte aussi la **to-do**, dans son ordre et avec les cases
cochées. Le champ est facultatif et la version du format ne bouge pas : un
export produit avant qu'il existe reste lisible, puisqu'un champ qu'on peut
ignorer n'est pas une rupture. À l'import, la to-do se range **à la suite** de
celle qui existe déjà — l'import complète, il ne réordonne pas.

L'import est une **fusion**, jamais un remplacement : rien n'est supprimé, et le
rejouer n'insère rien. Trois règles gouvernent les conflits.

- Une fiche ne voit son `total` et sa date mis à jour que si l'archive est **plus
  récente** que ce qu'il y a en base : réimporter une vieille sauvegarde ne
  rétrograde pas une fiche travaillée depuis.
- Une question déjà trouvée garde sa **vraie lettre**. L'export ne transporte pas
  la réponse, seulement la liste des questions réussies : on écrit donc la
  sentinelle `importe`, et elle ne remplace jamais un `c` gagné à la main.
- Une tentative de QCM est identifiée par son horodatage à la milliseconde.

Deux formes d'entrée sont acceptées dans `fiches[].questions` : `bloc#label`, la
forme normale, et l'identité complète `/chemin#bloc#label`. La seconde n'est pas
théorique — l'export ne retire le préfixe que s'il le reconnaît, si bien qu'une
clé écrite avant une normalisation de chemin ressort entière. Ce qui n'est
découpable ni d'une façon ni de l'autre est **compté et signalé**, jamais avalé
en silence.

### Un piège à connaître

Une identité importée qui ne correspond à aucune question du contenu actuel est
**supprimée à la première ouverture de la fiche**. Ce n'est pas un défaut : c'est
l'élagage de l'instantané, celui-là même qui empêche le décompte de gonfler quand
une question disparaît du cours. Mais si l'export vient d'une version plus
ancienne du contenu, la progression correspondante est perdue à la visite
suivante — et sans avertissement.

Pour le vérifier avant d'importer, comparer les identités du fichier à celles que
le contenu produit : le slug de bloc vient de `slugifier(titre du bloc)`, le
label est celui écrit dans le frontmatter de la question (`a)`, `1.`, …).
