# La syntaxe des fiches

Tout ce qui suit est tiré des fiches existantes, qui se rendent et se relèvent
sans défaut. En cas de doute, ouvrir la fiche citée et imiter.

## Frontmatter

```yaml
---
title: Nombres complexes — les exercices du TD
description: "Les quatre exercices du TD, corrigés dans l'ordre du sujet : formes algébriques, second degré…"
type: exercices          # cours | exercices | entrainement | qcm | formulaire — absent sur un index
annee: A1
matiere: Remise à niveau en maths
ordre: 2                 # rang dans le chapitre
icone: i-lucide-pencil-line
interactif: true         # sur une fiche de cours : « tout afficher / tout masquer »
navigation:
  title: Exercices       # le libellé court dans la barre latérale
  icon: i-lucide-pencil-line
---
```

**Guillemets doubles dès qu'une valeur contient « : » ou « # ».** Sans eux, le
YAML lit un objet et perd tout ce qui suit — `type` compris — sans erreur.

Ne jamais écrire `questions`, `blocs`, `sections` ni `releve` : le build les
remplit.

Icônes : Lucide, `i-lucide-<nom>` (voir lucide.dev). Comme les fiches
existantes : le cours prend l'icône de son chapitre (`git-compare-arrows` pour
les complexes, `compass` pour la trigonométrie), les exercices `pencil-line`,
l'entraînement `list-checks`, un QCM `circle-check-big` ou une icône à lui.

## Les index

Année (`content/cours/a2/index.md`), matière, chapitre : un frontmatter sans
`type`, un paragraphe, et des cartes.

```md
::carte-lien{to="/cours/a1/remise-a-niveau-maths/nombres-complexes/cours" titre="Le cours" description="Forme algébrique, opérations, second degré…" type="cours" meta="8 sections"}
::
```

`meta` s'écrit à la main : s'il annonce « 11 questions », la fiche doit les
porter — `verifier-contenu` le vérifie.

## Imbrication : un deux-points de plus par niveau

Un composant qui en contient un autre prend **un `:` de plus** que son enfant :

```md
::::exercice{titre="Exercice 3" theme="Études de fonctions"}
:::exo-question{label="1." cours="cours-limites"}
…
::tableau-variations
---
…
---
::
:::
::::
```

Le cas courant, sans rien d'imbriqué dans la question :

```md
:::exercice{titre="Exercice 1" theme="…"}
…
::exo-question{…}
…
::
:::
```

Un `::` fermant manquant ou en trop ne fait **aucune** erreur : les questions
suivantes disparaissent dans la précédente. C'est ce que `--rendu` attrape.

## Le cours

```md
## 1. La forme algébrique

On admet l'existence d'un nombre $i$ tel que $i^2 = -1$…

::exemple{id="nc-identification" titre="Lire les parties réelle et imaginaire, identifier" pour="Le premier réflexe, utile dans tout l'exercice 1"}
$\mathcal{R}e(5-4i) = 5$ …
::
```

- `## N. Titre` : une section, une notion. L'ancre sera `_1-la-forme-algébrique`
  (accents gardés, `_` devant un chiffre).
- `::exemple` : `id` unique dans la page, `titre` en texte simple (pas de LaTeX
  dans un attribut), `pour` dit quand s'en servir.
- `::rappel{titre="…" icone="i-lucide-…"}` : un encadré — la boîte à outils en
  tête de cours, le mode d'emploi en tête d'exercices.
- Des contrôles express au fil du cours : un `:::qcm{titre="Contrôle express — le radian" compact}`
  de trois `::qcm-question`, placé **dans** la section dont il parle.

## Un exercice

Tiré de `4.nombres-complexes/2.exercices.md` :

```md
:::exercice{titre="Exercice 1" theme="Forme algébrique d'une somme, d'un produit et d'un quotient"}
On pose $z_1 = 2+3i$ et $z_2 = 4-2i$. Donner la forme algébrique de chacune des expressions suivantes.

::exo-question{label="a)" cours="cours-operations" bonne="b"}
$z_1 + z_2$

#a
$6+5i$

#b
$6+i$

#c
$-2+5i$

#d
$8-6i$

#indice
L'addition de deux complexes se fait « composante par composante »…

#solution
On regroupe les parties réelles d'un côté, les parties imaginaires de l'autre :

$$
z_1+z_2 = (2+4)+(3-2)i = 6+i
$$

La forme algébrique cherchée est donc $\boxed{6+i}$.
::
:::
```

- Le texte avant la première question est **l'énoncé commun** : le quiz le
  rappelle au-dessus de chaque question du bloc.
- `titre` unique dans la page, `label` unique dans le bloc : ensemble, avec le
  chemin, c'est l'identité de la question en base.
- Sans `bonne`, la question est ouverte et s'auto-évalue (démonstrations,
  études, tableaux).
- Attributs facultatifs du bloc : `badge="★★☆☆☆"`, `icone`, `entete="introduction"`.

## Un palier d'entraînement

Tiré de `4.nombres-complexes/4.entrainement.md` :

```md
:::exercice{titre="Palier 1 — Apprivoiser i" theme="Reconnaître un nombre complexe…" badge="★☆☆☆☆" icone="i-lucide-sprout" entete="introduction"}
Rien à calculer de compliqué ici : il s'agit de prendre l'habitude…

::exo-question{label="1." cours="xnc-forme-algebrique" bonne="c"}
…
::
:::
```

`entete="introduction"` parce que ce texte **n'est pas** un énoncé : le rappeler
au-dessus de chaque question soufflerait la méthode.

## Un QCM

```md
:::qcm{titre="QCM 7 — La réplique du sujet initial" theme="…" duree="1 h" icone="i-lucide-copy-check"}

::qcm-question{label="1." bonne="d" cours="qcm-r-composees"}
La fonction $f$ … a pour dérivée

#a
…
#indice
…
#solution
…

**Les distracteurs :** **a** oublie le facteur $u'$…
::
:::
```

## Les rappels de cours

En bas de la page qui porte les questions, un par point de cours visé :

```md
::extrait-cours{id="cours-operations" titre="Somme, produit et carré" source="/cours/a1/remise-a-niveau-maths/nombres-complexes/cours#_2-les-opérations"}
La règle du jeu tient en une phrase : **on calcule comme en algèbre ordinaire**…
::
```

- `id` unique dans la page ; les questions le visent par `cours="…"`.
- `source` : la page de cours **et l'ancre de la section** — c'est elle qui range
  la question dans le plan du chapitre. Relever les ancres dans la base de
  contenu après un `pnpm dev`, ne pas les deviner.
- Le corps est un vrai rappel, autonome : il s'ouvre dans un tiroir, loin du
  cours.

## Un tableau de variations

```md
::tableau-variations
---
titre: Variations de f₁ sur [0 ; +∞[
variable: x
bornes: ['0', '1', '+∞']
barres: [0]              # indices des bornes exclues : double barre
lignes:
  - nom: f′(x)
    type: signe
    entre: ['-', '+']
  - nom: f
    type: variation
    aux: ['+∞', '0', '+∞']
---
::
```

## Les maths

KaTeX : `$…$` en ligne, `$$` seuls sur leur ligne pour un bloc. Préférer
`\dfrac` en ligne, `\lvert z\rvert` pour un module, `\left( … \right)` autour des
fractions, `\mathbb{R}`, `\text{…}` pour du texte. Pas de macro du document
source : les développer. Pas de LaTeX dans un attribut (`titre="…"`) — du texte
et des caractères Unicode (`f₁′`, `π`, `∞`).

Le français du site tutoie l'élève dans les indices et les solutions (« Développe
le produit… »).
