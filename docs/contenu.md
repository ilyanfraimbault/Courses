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

## Importer un ancien export

Le format d'export du portfolio d'origine est repris à l'identique, si bien qu'un
fichier produit là-bas se verse ici tel quel.

```bash
node scripts/importer-resultats.mjs resultats-2026-09-09.json --simulation  # n'écrit rien
node scripts/importer-resultats.mjs resultats-2026-09-09.json
```

En production on passe par la page « mes résultats » : l'image d'exécution ne
contient que `.output`, pas `scripts/`.

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
