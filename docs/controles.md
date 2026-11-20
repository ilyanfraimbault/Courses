# Les contrôles

`/controles`. L'agenda de la classe : un contrôle est **une date dans une
matière**, pour toute la classe ou pour un parcours, et il apparaît dans le
calendrier de l'accueil de tous ceux qu'il concerne. On le planifie depuis le
calendrier (le jour choisi est prérempli), depuis la page d'une matière (la
matière l'est), ou depuis l'agenda.

## Ce qu'il retient

Une ligne de `controle_classe` : un intitulé, le **code** de la matière (table
`matiere`, voir `docs/matieres.md`), le jour (« 2026-12-01 »), le parcours
concerné (`NULL` : toute la classe), et deux champs facultatifs :

- **le programme**, s'il est connu : un tableau de chemins du cours — le cours
  entier (`/cours/a1/…`, « toute la matière »), un chapitre, une fiche, ou un
  exercice (`/cours/a1/…/arbres/tp#exercice-1`, le slug de bloc relevé au
  build). Des **identités** seulement : les intitulés se relisent dans le
  contenu à chaque affichage, si bien que renommer un exercice ne réécrit aucun
  contrôle. Vide : on ne le sait pas encore ;
- **les précisions**, en texte libre : ce que le plan du cours ne sait pas dire.

Rien d'autre. Il n'y a plus de feuille de route, d'examen blanc ni de séance du
jour attachés à un contrôle : c'était lourd à déclarer — il fallait cocher le
programme pour que l'agenda serve à quelque chose — et personne ne la suivait.
Le contrôle dit **quand** et **sur quoi** ; réviser se fait depuis la matière.

Le formulaire suit l'ordre où l'élève y pense : la matière, le jour, pour qui,
puis « Sur quoi porte-t-il ? » — **une question à trois réponses** avant d'être
une liste : *pas encore connu*, *toute la matière*, *des chapitres précis*. La
liste n'apparaît qu'à la troisième : les chapitres d'abord, comme on les lit au
tableau ; « Préciser » ouvre un chapitre sur ses fiches (avec leur nature :
cours, QCM…) puis une fiche sur ses exercices — un geste distinct de la case,
sans quoi ouvrir un chapitre pour y choisir un exercice le cocherait en entier.
Ce qui est choisi se relit en pastilles au-dessus, qu'on retire d'un clic. Le
modèle ne garde que le nœud le plus haut : « tout le chapitre 2 » s'écrit d'une
clé. L'intitulé est facultatif : « Contrôle — Ethical hacking » par défaut.

## Qui voit, qui change

C'est la seule donnée du site qu'un compte lit au-delà de la sienne. Deux règles
la gardent, appliquées au serveur et relues en base à chaque requête :

- **Le parcours décide de ce qu'on voit.** Un contrôle pour toute la classe, ou
  pour son parcours. Celui de l'autre parcours n'existe pas : la liste ne le
  porte pas, et le demander par son numéro rend 404. L'administration voit tout.
- **Seul l'auteur le change**, avec l'administration. Les autres le lisent ;
  `PATCH` et `DELETE` leur rendent 403. Retirer un contrôle l'efface pour toute
  la classe : l'écran le fait confirmer d'un second clic.

Une matière d'un parcours **impose** le sien : un contrôle de « Réseaux
avancés » est un contrôle SR, quoi que demande le corps. Une matière commune
laisse le choix — les deux groupes ne passent pas toujours le même jour. On ne
planifie pas dans une matière qu'on ne voit pas, et le programme ne sort pas de
la matière (un chemin hors de son cours est refusé ; une matière sans cours sur
le site n'a pas de programme, seulement des précisions).

## D'où il vient

Les contrôles étaient personnels (`controle`, v7) : chacun déclarait les siens,
avec une feuille de route recalculée chaque jour. La migration v11 les a
convertis en contrôles de la classe — deux élèves qui avaient déclaré le même
(même matière, même jour) n'en font plus qu'un, le premier déclaré ; une
section du cours (« /fiche#ancre ») est devenue sa fiche. La note et le barème
n'y sont pas passés : ils étaient à un élève, l'agenda est à tous — les notes
vivent désormais dans « Mes moyennes ». L'ancienne table est restée en place,
intacte, pour que la conversion se relise.

Les anciennes adresses `/mes-controles/**` mènent à l'agenda (`routeRules`), pas
au contrôle même : la conversion a renuméroté.

## Les routes

| Route | Rôle |
|---|---|
| `GET /api/controles?fuseau=` | ceux qui concernent le compte, du plus proche au plus lointain |
| `POST /api/controles` | planifier |
| `GET /api/controles/:id` | un contrôle — 404 s'il ne concerne pas le compte |
| `PATCH /api/controles/:id` | le contrôle entier, à nouveau — auteur ou administration |
| `DELETE /api/controles/:id` | le retirer — auteur ou administration |

`?fuseau=` : `joursRestants` se compte chez l'élève.

Vérification, serveur `cours-verif` lancé : `pnpm verif:controles` — trois
comptes (deux DL, un SR), ce que chacun voit, ce que seul l'auteur peut faire,
et la validation.
