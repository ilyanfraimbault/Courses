# La révision espacée

Une question trouvée n'est pas une question sue pour toujours. Elle **revient** :
le lendemain, puis au bout de trois jours, de sept, de seize, de trente-cinq, de
quatre-vingt-dix — tant qu'on la retrouve. Une faute la fait retomber au début.

C'est ce qui manquait pour qu'on **apprenne** sur le site et pas seulement qu'on
y coche : jusqu'ici, une question trouvée une fois ne revenait que par hasard,
au gré du tirage du quiz.

## Rien n'est stocké

Il n'y a **pas** de table de révision. L'état d'une question — son palier, sa
dernière bonne réponse, son échéance — se **déduit** de l'histoire que le site
tient déjà (`server/utils/revisions.ts`) :

| Source | Ce qu'elle apprend |
|---|---|
| `reussite.premiere` | la première fois qu'elle a été trouvée, n'importe où |
| `faute.derniere` | la dernière faute — la seule qui compte, puisqu'une faute remet à zéro |
| `faute.rattrapee` | la bonne réponse qui a éteint la dette |
| `quiz_reponse` | chaque réponse au quiz, juste ou non |
| `qcm_compose_copie` | chaque copie d'un QCM composé : ratées nommées, les autres justes |
| `qcm_tentative` | chaque copie d'un QCM de contenu : même chose, repères recomposés |

Pourquoi pas une table ? Un calendrier stocké demanderait un événement de plus à
chaque bonne réponse, sur chaque écran : quiz, QCM composé, QCM de contenu,
fiche. La première route qui l'oublierait le désaccorderait en silence — le
genre de panne que ce projet ne voit jamais venir. Celui-ci ne peut pas
diverger de l'histoire : il **est** l'histoire, relue. Et l'invariant du projet
tient toujours : la faute reste la seule écriture qui soit un événement.

Le coût est une relecture de l'historique du compte à chaque ouverture de
l'accueil, quelques milliers de lignes au plus : négligeable pour SQLite.

## La règle

`planifier` rejoue les réponses d'une question dans l'ordre des dates :

- **une bonne réponse** fait monter d'un palier — mais seulement si elle arrive
  après **au moins la moitié** de l'intervalle en cours. Réussir trois fois la
  même question dans la même séance ne prouve pas qu'on la saura dans un mois ;
  la file du quiz repose justement ce qu'on vient de voir ;
- **une faute** la sort du calendrier : elle est en dette, et c'est la dette qui
  s'en occupe. La bonne réponse qui l'éteindra la remettra au premier palier ;
- la première bonne réponse la fait entrer au premier palier : **revoir demain**.

Paliers, en jours : `1, 3, 7, 16, 35, 90`. Une question est **à revoir** quand
son échéance tombe avant la fin de la journée de l'élève — dans son fuseau,
comme pour les contrôles.

Une fiche n'écrit que la **première** réussite : une question déjà cochée ne se
repasse pas sur sa fiche. La révision se fait au quiz et dans les QCM, et c'est
voulu — c'est là qu'une question arrive sans son contexte, comme au contrôle.

## Où ça se voit

**L'accueil** (`/`) ne l'annonce plus. Il portait la séance du jour — la dette,
puis ce qui revient, puis du neuf, vingt questions au plus — avec les
contrôles, l'avancement et les matières, et c'était trop : on arrivait sur le
site sans savoir où regarder. Il est devenu un tableau de bord (l'agenda, la
moyenne, la progression par matière), sans séance. Une séance se
lancera depuis sa matière, là où l'on sait sur quoi on travaille. **D'ici là,
les révisions dues n'ont plus d'entrée** : `/quiz` ne propose que les questions
ratées, et le calcul des échéances tourne sans que rien ne l'affiche.

**Le quiz** reçoit deux tamis de plus, `aRevoir` et `nouvelles`, comme
`nonAcquises` : ils ne se cochent pas à l'écran, c'était l'accueil qui ouvrait ces
séances. Demandés avec `erreurs`, ils s'y **additionnent** au lieu de s'y
croiser, et le tirage sert les tas dans l'ordre — la dette, puis les révisions,
puis le neuf. Le rang seul ne suffirait pas : le tirage tourne de thème en
thème, et une séance plafonnée laisserait la dette des derniers thèmes derrière
elle, ou donnerait à du neuf la place d'une révision due. Une faute pendant une révision fait ce qu'elle fait partout — la
question entre dans la dette, et la place revient avec une autre question due.
Les matières ne se mélangent pas : une séance reste dans la sienne.

## Les routes

| Route | Rôle |
|---|---|
| `GET /api/revisions?fuseau=` | par matière : à revoir aujourd'hui, demain, suivies, en dette, nouvelles, prochaine échéance |
| `POST /api/quiz/session?fuseau=` | avec `aRevoir: true`, une séance sur ce qui est dû ; avec `erreurs: true` en plus, la dette d'abord ; avec `nouvelles: true`, le neuf en dernier |

La reprise d'une place ratée pendant une révision se calcule sans fuseau — la
réponse n'en porte pas —, donc sur la journée du site. Le bord du tas peut s'en
trouver décalé d'une heure ou deux ; aucune question n'est perdue pour autant.

## Vérifier

```bash
# configuration « cours-verif » lancée
pnpm verif:revisions
```

Elle rejoue d'abord des histoires écrites à la main dans `planifier` — Node 24
charge le TypeScript du serveur tel quel —, puis vieillit de trois jours les
réussites d'un compte jetable **dans la base de vérification** pour voir
l'accueil les annoncer, la séance ne poser qu'elles, et une faute les faire
passer dans la dette.
