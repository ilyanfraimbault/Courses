# Les contrôles

`/mes-controles`. On déclare un contrôle — un intitulé, une date, une matière et
un programme — et le site en tire une **feuille de route** jusqu'au jour J : ce
qu'il reste à apprendre, découpé en journées, un examen blanc l'avant-veille, et
la dette à solder la veille.

## Il ne retient presque rien

Une ligne de `controle` porte le titre, la matière, le jour (« 2026-10-09 »), le
programme et, une fois l'épreuve passée, la note. **Rien d'autre.** Ni questions,
ni feuille de route, ni avancement : tout se recalcule à chaque lecture, depuis
la même mémoire que le reste du site — `reussite` pour ce qui est trouvé, `faute`
pour ce qui est en dette.

C'est ce qui permet à une question gagnée **n'importe où** — sur sa fiche, au
quiz, dans un QCM composé — de faire avancer tous les contrôles qui la couvrent
sans que personne ait à les prévenir. Une feuille de route stockée aurait vieilli
dès la première séance faite ailleurs.

Le programme se désigne dans la nomenclature du quiz : des **chapitres** et des
**sections du cours**, les mêmes clés que `FiltreQuiz`, cochées avec le même
composant (`QuizFiltre`, en mode `programme`). C'est ce qui garantit qu'une
journée de la feuille de route désigne exactement ce qu'une séance saura poser.
Rien de coché : toute la matière. Un contrôle, comme une séance, ne mélange pas
deux matières.

Seules les questions **interrogeables** comptent — celles que le quiz sait
corriger tout seul. Un contrôle promet des séances : annoncer « 30 questions à
apprendre aujourd'hui » dont six ne se corrigent pas ferait une journée qui ne
finit jamais. C'est la règle du catalogue du quiz, pour la même raison.

## Su, en dette, jamais trouvé

Chaque question du programme est dans un et un seul de trois états :

| | |
|---|---|
| **sue** | trouvée un jour, et pas ratée depuis |
| **en dette** | ratée quelque part, pas encore retrouvée |
| **jamais trouvée** | le reste |

« Prêt à 42 % », c'est la part sue. Une question trouvée puis ratée n'est plus
sue : la dette dit qu'elle ne passe pas, et la barre recule. C'est plus sévère
que « Mes domaines », où une question retrouvée reste acquise — mais un contrôle
demande ce qu'on saura **le jour J**, pas ce qu'on a su un jour.

## La feuille de route

`feuilleDeRoute` (`server/utils/controles.ts`). Les derniers jours ont un rôle
fixe, les autres apprennent :

- **J-2 : l'examen blanc.** Assez tôt pour que ses fautes aient un jour entier
  pour être reprises, assez tard pour mesurer ce qu'on saura vraiment.
- **J-1 et J : la dette.** Rien de neuf la veille, on consolide.
- **Avant : le programme**, découpé en journées dans l'ordre du cours.

Quand le temps manque, les rôles se tassent : à J-2, on apprend aujourd'hui et
l'examen blanc passe la veille avec la dette ; à J-1, examen blanc et dette le
même jour.

### Le découpage

Le programme se découpe sur ce qu'il restait **ce matin** — ce qui n'est pas su
maintenant, plus ce qui a été gagné depuis minuit —, et non sur ce qu'il reste à
l'instant. Sinon, finir sa journée ferait glisser celle de demain dans celle-ci,
et la journée ne finirait jamais. Une journée manquée se rattrape toute seule :
le lendemain, le reste se redécoupe sur les jours qui restent.

Le nombre de journées est choisi pour qu'elles portent **au moins dix questions**
en moyenne (`QUOTA_MIN`) : un programme court se finit tôt, et les jours libérés
deviennent de la marge.

Une section peut **s'étaler sur plusieurs jours**. Il le faut : le chapitre des
fonctions porte une section de 53 questions et une de 45. Chaque coupure vise une
part égale de ce qui reste — une journée qui a débordé est compensée par les
suivantes —, et une coupure qui laisserait un morceau de moins de trois questions
glisse au bord de la section. Mesuré sur le contenu actuel :

| Programme | Jours avant le contrôle | Charge par journée |
|---|---|---|
| Trigonométrie, 63 q. | 10 | 8 · 7 · 11 · 10 · 9 · 9 · 9 |
| Fonctions d'une variable réelle, 109 q. | 14 | 10 × 10, puis 9 |
| Nombres complexes, 102 q. | 30 | entre 8 et 10 |

Le premier découpage gardait chaque section entière, placée dans la part où
tombait son milieu. Il rendait sur la trigonométrie 8 · 12 · 6 · 10 · 9 · 3 · 15.

### Le jour de l'élève, pas celui du serveur

Le jour du contrôle est une **date de calendrier** (`AAAA-MM-JJ`), pas un
instant : ramenée à des millisecondes, elle glisserait d'un jour selon le fuseau
de qui la lit. Les routes reçoivent `?fuseau=` — celui du navigateur — et c'est
dans ce fuseau que se comptent « dans deux jours » et « gagné aujourd'hui »
(`shared/utils/jours.ts`). Le serveur tourne en UTC ; à 0 h 30 à Paris, sans cela,
il serait encore hier.

## Les séances

Le contrôle ne pose rien lui-même. Il choisit une sélection, et le quiz fait le
reste — file, reprises, report sur les fiches, dette :

- **la séance du jour** : les sections de la journée, avec `nonAcquises` — un
  tamis du filtre qui ne garde que ce qui n'est pas su —, et autant de questions
  qu'il en reste à gagner aujourd'hui. Une section étalée sur deux jours n'est
  donc pas posée en entier le premier ;
- **solder la dette** : le programme, avec `erreurs` ;
- **une section** depuis la liste du programme : ce qui manque tant qu'elle
  n'est pas sue, toute la section ensuite.

`nonAcquises` est le seul endroit où le quiz lit `reussite`. Il ne s'en sert que
pour **choisir** quand on le lui demande : sa file ne s'en sert jamais, et une
séance n'arrive toujours pas pré-remplie.

## L'examen blanc

`POST /api/controles/:id/examen-blanc` compose un **QCM composé** de vingt
questions tirées dans le programme, et le rattache au contrôle. Il se passe dans
« Mes QCM », avec tout ce qu'une copie y fait : correction au serveur, questions
justes cochées sur leur fiche, ratées dans la dette.

Son tirage **n'a pas de rang**, contrairement à celui du quiz. Une séance soigne
— la dette d'abord, puis le neuf —, un examen blanc **mesure** : il doit
ressembler au contrôle, donc couvrir le programme à parts égales sans choisir ce
qu'on sait le moins. L'étalement par chapitre et par point de cours du tirage y
suffit.

En composer un second remplace le lien, pas le premier QCM, qui garde ses copies.
Supprimer le QCM dans « Mes QCM » détache le lien (`ON DELETE SET NULL`) ;
supprimer le contrôle laisse le QCM.

## Les règles, toutes au serveur

- Une partie du programme inconnue de la matière est **refusée** à l'écriture.
  Une section déjà couverte par son chapitre coché est écartée.
- Une partie qui a **disparu** du contenu depuis ne compte plus, et la page le
  dit. Un programme dont toutes les parties ont disparu ne couvre plus rien — il
  ne retombe pas sur la matière entière, ce que ferait un filtre vide.
- Un contrôle se **modifie librement** : titre, date, programme. Il n'a pas de
  copies dont les notes deviendraient incomparables, et un programme qui change
  doit pouvoir changer ici. Sa matière, elle, ne bouge pas.
- Toute route lit `id = ? AND utilisateur_id = ?` : le contrôle d'un autre
  compte est une 404.

## Les routes

| Route | Rôle |
|---|---|
| `GET /api/controles?fuseau=` | les contrôles du compte, à venir puis passés, évalués |
| `POST /api/controles` | déclare un contrôle : `{ titre, matiere, jour, themes, sections }` |
| `GET /api/controles/:id?fuseau=` | un contrôle : état, sections, feuille de route, examen blanc |
| `PATCH /api/controles/:id` | titre, jour, programme (`themes` et `sections` ensemble), note, barème |
| `DELETE /api/controles/:id` | le supprime — pas son examen blanc |
| `POST /api/controles/:id/examen-blanc` | compose un examen blanc et le rattache |

## Vérifier

```bash
pnpm dev   # ou la configuration « cours-verif »
pnpm verif:controles
```

Elle déclare un contrôle sur la trigonométrie, contrôle l'arithmétique de la
feuille de route — chaque section planifiée en entier et une seule fois, l'ordre
du cours gardé, pas de miette, des journées équilibrées —, apprend et rate des
questions pour voir la journée avancer sans glisser, vérifie que la séance du
jour ne repose pas ce qui est su, compose l'examen blanc, avance la date jusqu'au
jour passé, et finit par l'isolation entre deux comptes.
