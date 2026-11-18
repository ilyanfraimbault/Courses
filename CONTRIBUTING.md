# Contribuer : ajouter un cours

Le site n'a de valeur que si **tous** les cours de la classe y sont. Si tu as les
documents d'un chapitre qui manque (cours, TD, corrigé, TP, annale), tu peux
l'ajouter toi-même : ton agent Claude fait l'essentiel, tu réponds à ses
questions et tu relis.

Le dépôt est public, mais **seule la propriétaire fusionne**. Tu ne pousses
jamais sur `master` : tu proposes une *pull request* depuis ton fork, elle la
relit, et la fusion met le cours en ligne.

## En cinq minutes

**Une fois :** Node 24, [pnpm](https://pnpm.io), [Claude Code](https://claude.com/claude-code)
et la [CLI GitHub](https://cli.github.com) connectée (`gh auth login`).

```bash
gh repo fork ilyanfraimbault/Courses --clone
cd Courses
pnpm install
cp .env.example .env
```

**À chaque cours :**

1. Ouvre Claude Code dans le dossier `Courses`.
2. Envoie-lui les PDF du chapitre (glisse-les dans la conversation) avec,
   simplement :

   > Ajoute ce cours.

   Les documents des profs ne sont jamais versionnés : seules les fiches qu'on
   en tire le sont.
3. Réponds à ses questions. Le skill `importer-cours` lui fait vérifier avec toi,
   avant d'écrire quoi que ce soit :
   - que tu as fourni **toutes** les pièces du chapitre (le corrigé du TD
     surtout : il fait foi sur les calculs) ;
   - le **nom de la matière** et celui du **chapitre**, proposés d'après les
     documents ;
   - ce qu'il faut ajouter au cours du prof : une **feuille d'entraînement**,
     des révisions, un QCM, le contrôle corrigé… ou rien de plus.
4. Il écrit les fiches, vérifie chaque réponse par le calcul, lance les
   contrôles et ouvre la PR. Relis-la dans le navigateur avant de la laisser
   partir : c'est ta classe qui révisera dessus.

## Les règles

Ton agent les trouve dans `.claude/CLAUDE.md` et dans le skill. Elles se
résument ainsi :

- **Le site calque le prof.** Un chapitre par dossier reçu, une fiche par
  document, avec les noms et l'ordre du prof. Pas de gabarit commun à toutes les
  matières.
- **Les diapos ne deviennent pas une fiche.** Elles doublent le cours ; on s'en
  sert pour le vérifier.
- **Rien n'est inventé sans le dire.** Le cours dit ce que dit le PDF. Ce qu'on
  ajoute (entraînement, révisions) se demande et s'annonce dans la PR.
- **Une mauvaise réponse est le pire défaut possible.** Chaque bonne réponse est
  recalculée, chaque mauvaise proposition vérifiée fausse. La PR dit combien
  l'ont été.
- **Un label publié ne se renomme plus.** Les progressions des élèves y sont
  accrochées : renommer un titre de bloc ou un label efface leurs réponses.
- **Du code ? Annonce-le.** Si un cours demande un composant qui n'existe pas
  (un tableau de Karnaugh à remplir, par exemple), ton agent peut l'écrire, mais
  la PR le dit **en tête** et liste les fichiers touchés hors de `content/`. Une
  fusion déploie directement en production.
- **Ne touche pas aux totaux** (le nombre de questions du site, dans
  `.claude/CLAUDE.md`, `docs/contenu.md` et `scripts/verifier-quiz.mjs`). Donne
  plutôt ce que ton import ajoute ; les totaux se recalculent à la fusion, sans
  quoi toutes les PR ouvertes entreraient en conflit.

## Avant de commencer

Regarde les [PR ouvertes](https://github.com/ilyanfraimbault/Courses/pulls) :
si quelqu'un importe déjà ton chapitre, mieux vaut compléter sa PR que la
doubler. Ton agent le vérifie aussi.

## Après l'ouverture de la PR

La CI (lint, types, build, image) doit passer au vert. La propriétaire relit,
commente au besoin : réponds par de nouveaux commits sur la **même branche**,
la PR se met à jour toute seule. Une fois fusionnée, le cours est en ligne
quelques minutes plus tard.

## Le contenu n'appartient pas au dépôt

Les cours sont ceux de nos professeurs. Le dépôt est public pour que la classe
puisse y contribuer, pas pour les redistribuer : ne les recopie pas ailleurs, et
si un prof demande le retrait de sa matière, elle sera retirée.
