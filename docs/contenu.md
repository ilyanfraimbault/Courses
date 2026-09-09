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
production, qui tourne lui aussi en 3.9.0. Sur l'ensemble des 27 fiches, 3.9.0
donne 453 questions rendues pour 453 comptées.

La borne exacte d'apparition du défaut (3.10 ou 3.11) n'a pas été cherchée :
3.9.0 est la dernière version dont le rendu est vérifié en production.

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

Attendu aujourd'hui : `453 / 453 aucun écart`.

Ce contrôle vaut d'être relancé après toute montée de version de `@nuxt/content`,
`@nuxtjs/mdc` ou `remark-mdc` — c'est le seul moyen de voir la panne.

## Structure

Une seule collection, `cours`, dont la source est `cours/**/*.md`. Le chemin
d'URL découle de l'arborescence : `content/cours/a1/remise-a-niveau-maths/…`
donne `/cours/a1/remise-a-niveau-maths/…`. Les chemins sont **identiques** à ceux
du portfolio d'origine, volontairement.

Frontmatter : `title`, `description`, `type` (`cours` | `exercices` |
`entrainement` | `qcm`), `annee`, `matiere`, `ordre`, `icone`, `interactif`, et
`questions` — ce dernier rempli au build, à ne jamais écrire à la main.
