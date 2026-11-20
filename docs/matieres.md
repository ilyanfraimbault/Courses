# Les matières, les parcours et les moyennes

## Le programme en base

Les matières n'existaient que dans l'arborescence du contenu. Elles ont
désormais deux tables, semées depuis le programme officiel de la promotion
INFRES 19 (`server/utils/programme.ts`) :

- `ue` — semestre, code (« 5.1 MATH »), intitulé, ECTS, parcours ;
- `matiere` — **code**, intitulé, UE, coefficient, heures.

Le programme a été recopié des tableaux de l'école et **recompté** contre ses
totaux : 360, 360, 303, 327 et 450 heures d'école du S5 au S9, 20, 20, 20, 16 et
20 ECTS, parcours par parcours à partir du S7. `pnpm verif:matieres` refait ce
compte depuis la base. Un coefficient absent du document (DevOps, séminaire
créativité) reste nul : la matière existe, elle ne compte pas.

L'**UE Entreprise** n'a pas de matière — c'est la période en entreprise, notée
d'un bloc. On lui en donne une, du même nom, pour qu'elle ait sa case.

`semerProgramme` tourne à chaque ouverture de la base : il **insère ce qui
manque** et ne réécrit jamais une ligne existante. Ajouter une matière au
fichier la fait apparaître au déploiement suivant, sans migration. La base garde
aussi les matières **ajoutées depuis le site** — on tape un nom absent de la
liste dans « Planifier un contrôle » : hors programme, sans UE ni coefficient,
avec leur auteur. Un nom déjà pris, à la casse et aux accents près, rend la
matière existante au lieu d'en créer une seconde.

## Le lien avec le cours

Le **code** d'une matière (« s5-ethical-hacking ») est son identité : notes et
contrôles le retiennent, et il ne se recalcule jamais — corriger un intitulé ne
doit rien détacher.

Le lien va **du cours vers la table** : la page d'index d'une matière écrit le
code qu'elle enseigne en frontmatter (`programme: s5-ethical-hacking`). Un
camarade qui apporte un cours n'a qu'un fichier à écrire, sans toucher à la base
ni écrire de migration. Une matière du cours sans code reste visible, hors
programme et commune, sous son chemin.

| Cours | Matière du programme |
|---|---|
| Ethical hacking | `s5-ethical-hacking` (5.5 ASSI) |
| Mathématiques pour l'ingénieur | `s5-mathematiques-ingenieur` (5.1 MATH) |
| Mise à niveau en C | `s5-langage-fonctionnel` (5.2 BST) |
| Réseaux et protocoles | `s5-reseaux-protocoles-1` (5.2 BST) |
| Structures de données et algorithmique | `s5-structures-donnees-algorithmique` (5.1 MATH) |
| Virtualisation et conteneurisation | `s5-virtualisation-conteneurisation` (5.5 ASSI) |
| Remise à niveau en maths | `remise-a-niveau-maths` (hors programme) |

## Le profil et les parcours

DL (développement logiciel) ou SR (systèmes et réseaux) : les deux parcours se
séparent au S7. Le parcours se choisit **au premier passage**, avec le prénom et
le nom, dans une fenêtre « Bienvenue » qu'on ne ferme pas sans répondre ; un
badge le rappelle à côté du titre, et « Mon profil » (le badge, ou le menu du
compte) permet d'en changer. Le prénom salue l'élève sur l'accueil ; le pseudo,
lui, ne sert qu'à se connecter.

`utilisateur.parcours`, `prenom` et `nom` valent `NULL` tant qu'ils ne sont pas
dits — c'est ce qui rouvre la fenêtre. La session le
rapporte, relu en base à chaque lecture comme l'accès et le rôle
d'administrateur (`server/plugins/session-administration.ts`) : il choisit ce
que la page montre. Le serveur, lui, relit le sien à chaque requête
(`parcoursDuCompte`) et ne croit jamais la session ni le corps.

Une matière d'un parcours sort, pour l'autre, du sommaire, du quiz, du tableau
des moyennes et de la liste des matières d'un contrôle. Elle reste ouvrable par
son adresse : le dépôt est public, ce n'est pas un secret — c'est du bruit qu'on
retire. Sans parcours choisi, on ne voit que le tronc commun.

## Les moyennes

`/mes-moyennes`, dans le menu du profil. On saisit sa moyenne dans chaque
matière ; le reste se calcule, avec une seule fonction (`shared/utils/moyennes.ts`) :

- **une UE** : ses matières pondérées par leur coefficient ;
- **un semestre** : ses UE pondérées par leurs ECTS, l'UE Entreprise comprise.

Une moyenne ne porte que sur ce qui est **renseigné** : une UE dont on ne connaît
qu'une note a pour moyenne cette note, et l'écran dit « provisoire : 2 UE sur 9
renseignées ». Les moyennes d'UE et de semestre ne s'écrivent pas : elles se
recalculent à l'affichage.

Chaque case s'enregistre **seule**, à la frappe (`PUT /api/notes` : une matière,
une valeur ou `null`), comme le code écrit sous une question : jamais au
montage, jamais avant une lecture réussie, et jamais le tableau entier — un
onglet resté ouvert écraserait une note saisie ailleurs depuis.

## Les routes

| Route | Rôle |
|---|---|
| `GET /api/matieres` | les matières que le compte voit |
| `POST /api/matieres` | ajouter une matière hors programme (ou retrouver la même) |
| `GET /api/matieres/masquees` | les cours de l'autre parcours, que le sommaire retire |
| `PUT /api/compte/profil` | prénom, nom et parcours, ensemble |
| `PUT /api/compte/parcours` | le parcours seul |
| `GET /api/notes` | le programme du compte, avec ses notes |
| `PUT /api/notes` | une note, ou `null` pour l'effacer |

Vérification, serveur `cours-verif` lancé : `pnpm verif:matieres`.
