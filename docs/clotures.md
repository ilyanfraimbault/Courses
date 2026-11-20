# Clore ce qu'on a fini

Une matière, un chapitre ou une fiche se **clôt** : « j'en ai fini ». Ce qui est
clos sort de la progression, des révisions du jour et des séances lancées sur
toute la matière. Rien n'est effacé — dette, réussites, histoire de révision
restent en base — et rouvrir rend tout tel quel.

## Pourquoi

Le site n'avait aucune notion de « terminé ». La révision espacée fait revenir
une question sue à 1, 3, 7, 16, 35 puis 90 jours, et c'est voulu : un chapitre
sert à plusieurs contrôles. Mais un cours abandonné, ou une matière de l'an
dernier, continuait de remplir l'accueil, de gonfler les dénominateurs et de
nourrir la séance du jour. La clôture est le geste qui manquait.

## La règle : le « tout », pas le « coché »

Une clôture retire ce qui est clos de **ce qu'on obtient sans rien choisir** :

- les révisions du jour et la dette ;
- une séance de quiz ou un tirage de QCM lancés sur toute la matière ;
- « Mes domaines ».

Elle ne retire rien de **ce qu'on coche à la main**. Un chapitre clos, coché
dans le quiz, est pris en entier. C'est ce qui garde
la clôture sans détour : on retravaille un chapitre fini sans avoir à le
rouvrir, et le geste « je coche ceci » ne se fait jamais contredire en silence.

Les **contrôles** ignorent les clôtures (`ignorerClotures` dans le filtre). Le
programme d'un contrôle est un choix explicite, et sa feuille de route compte
« toute la matière » comme toute la matière : une séance qui en retirerait une
partie servirait moins que ce que la feuille annonce.

## Ce qui est clos

Le chemin seul est retenu (`cloture`, une ligne par chemin et par compte). Ce
qu'il couvre se lit dans la hiérarchie des chemins, comme partout : un chapitre
ajouté plus tard sous une matière close y tombe sans rien réécrire.

Une question est close quand **sa fiche**, **le chapitre de son rappel de
cours** ou **sa matière** l'est. Le chapitre ne se lit pas seulement dans le
chemin de la fiche : une question du QCM final vit dans la fiche du QCM mais
relève de la trigonométrie, et clore la trigonométrie l'emporte avec elle.

## Où ça se voit

- **La page close** porte un bandeau, et le bouton « Rouvrir ». Une fiche d'un
  chapitre clos dit lequel, et propose de rouvrir ce chapitre-là — rouvrir une
  fiche ne perce pas la clôture de son chapitre.
- **Le sommaire** garde ce qui est clos, grisé : le cacher empêcherait de le
  retrouver, donc de le rouvrir.
- **« Mes domaines »** nomme les clôtures en bas de page, avec « Rouvrir ».
- **Le quiz** marque les chapitres clos d'une pastille, et la phrase « rien de
  coché » précise « hors ce que tu as clos ». Le compte de la matière ne fait
  alors plus la somme de ses chapitres — c'est la seule exception à cette règle
  de l'écran, et elle est écrite.

Comme toute donnée d'utilisateur, les clôtures ne sont lues qu'au montage. Le
HTML servi reste le même pour tout le monde ; le grisé arrive après
l'hydratation.

## La séance du jour, restreinte

L'accueil proposait de restreindre la séance du jour à quelques chapitres. Il ne
porte plus de séance (voir `docs/revisions.md`) ; le catalogue garde ses comptes
par section — révisions dues (`aRevoir`) et neuf (`nouvelles`) — pour la séance
qui se lancera depuis la matière.

## Les routes

| Route | Rôle |
|---|---|
| `GET /api/clotures` | les clôtures du compte, nommées |
| `POST /api/clotures` | clore un chemin — refusé s'il ne désigne ni matière, ni chapitre, ni fiche à questions |
| `DELETE /api/clotures?chemin=` | rouvrir |

Vérification, serveur `cours-verif` lancé : `pnpm verif:clotures`.
