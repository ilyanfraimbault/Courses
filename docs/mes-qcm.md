# Mes QCM

`/mes-qcm`. Des QCM composés depuis le site, à partir des questions des fiches.
On choisit les questions — tirées comme pour un quiz, ou prises une à une —, on
donne un titre, et le QCM devient une page fixe : toutes les questions d'un
coup, on répond à tout, puis on rend la copie.

## Pourquoi en base, et pas un fichier de contenu

Un QCM de contenu est un fichier Markdown, relevé au build et servi par Nuxt
Content. Un QCM composé depuis le site ne peut pas l'être : l'image de
production ne contient que `.output`, le contenu y est figé, et écrire un
fichier supposerait un commit et un redéploiement à chaque QCM.

Il vit donc en base, sur le compte de qui l'a composé (`qcm_compose`), et il est
utilisable dès sa création. Comme toute donnée d'utilisateur, il est lu au
montage et jamais au rendu serveur.

## Il n'a pas de questions à lui

Un QCM composé ne retient qu'une liste d'**identités** `chemin#bloc#label`, dans
son ordre. À chaque ouverture, les questions sont relues dans leurs fiches par
les mêmes fonctions que le quiz (`poserQuestion`) : énoncé commun du bloc,
énoncé, propositions — puis, à la correction, bonne réponse, indice, solution et
rappel de cours. Corriger un cours corrige tous les QCM qui empruntent ses
questions.

Deux conséquences :

- **une question disparue du contenu sort du QCM** sans le casser. La page dit
  combien il en manque ; la liste aussi. C'est le même contrat que la file du
  quiz, qui retire une place devenue introuvable ;
- **on ne modifie pas un QCM composé**, on le renomme ou on le supprime. Retoucher
  la liste d'un QCM qui a déjà des copies rendrait ses notes incomparables d'un
  passage à l'autre.

Chaque question affiche sa **référence** en clair — la fiche, le bloc, le
repère — avec un lien vers sa fiche. Rien n'est recopié, et le dire est ce qui
permet d'aller relire la question chez elle.

## Les règles, toutes au serveur

- **Une matière par QCM.** La création refuse une question d'une autre matière,
  une identité inconnue du contenu, ou une question que le quiz ne saurait pas
  corriger — une question ouverte, qui s'auto-évalue. Entre 1 et 60 questions,
  les bornes du quiz ; les doublons sont écartés.
- **Aucune bonne réponse ne part avec le QCM.** Ni `GET /api/mes-qcm/:id`, ni
  l'aperçu d'une question pendant la composition ne la portent : l'aperçu
  servirait sinon de corrigé.
- **Les propositions sont brassées, de façon stable.** La graine est propre au
  QCM (`qcm-compose:<id>`) : l'ordre ne change pas d'une ouverture à l'autre —
  c'est une page fixe, on la refait pour comparer — mais ce n'est pas celui de
  la fiche, où la bonne réponse finirait par se retenir comme « la c ».
- **La copie se corrige au serveur**, dans une seule transaction qui tient les
  trois conséquences d'une copie rendue :
  - la copie rejoint l'historique du QCM (`qcm_compose_copie`), plafonné à
    vingt-quatre comme celui d'un QCM de contenu ;
  - une question juste est **cochée sur sa fiche** et éteint sa dette — le même
    report que le quiz (`reporterSurLaFiche`), jamais par l'instantané de
    `PUT /api/fiche`, qui effacerait le reste de la fiche ;
  - une question ratée **ou laissée blanche** entre dans la dette (`faute`), comme
    une copie de QCM de contenu. Une faute n'efface jamais rien.
- **Un double clic ne compte pas deux fois.** L'horodatage part avec la copie ;
  `UNIQUE (compose_id, t)` écarte le doublon, et une copie déjà enregistrée ne
  refait ni ses reports ni ses fautes.

Les copies d'un QCM composé retiennent les identités complètes des questions
ratées, et non leurs repères : un QCM composé mêle des blocs où « 3. » revient
dix fois. C'est aussi ce qui permet à « Mes domaines » de compter ces ratées
parmi les hésitantes.

## Composer

`/mes-qcm/nouveau`. Deux façons de choisir, qui se complètent :

- **tirer** : la sélection du quiz (`QuizFiltre`, par chapitre et section du
  cours, « seulement ce que j'ai raté ») et son rang (`rangDuTirage`) — la dette
  d'abord, puis ce qui n'a jamais été posé. Chaque tirage **s'ajoute** à la
  sélection : `exclues` écarte ce qui est déjà retenu ;
- **prendre à la main** : le plan de la matière, question par question, filtrable,
  avec un aperçu de l'énoncé avant de la retenir.

La sélection vit dans la page jusqu'à « Créer le QCM ». Pas de brouillon en base :
ce serait une chose de plus à nettoyer, pour une composition qui prend deux
minutes.

## Les routes

| Route | Rôle |
|---|---|
| `GET /api/mes-qcm` | les QCM du compte, résumés : questions présentes et manquantes, dernier passage |
| `POST /api/mes-qcm` | compose un QCM : `{ titre, matiere, questions }` |
| `GET /api/mes-qcm/:id` | un QCM prêt à être passé, questions relues et copies |
| `PATCH /api/mes-qcm/:id` | le renomme |
| `DELETE /api/mes-qcm/:id` | le supprime, copies comprises — pas ce qu'il a fait gagner |
| `POST /api/mes-qcm/:id/copie` | corrige une copie : `{ reponses: { identité: lettre }, t }` |
| `POST /api/mes-qcm/tirage` | propose des questions à la manière du quiz, sans rien écrire |
| `GET /api/mes-qcm/candidates?matiere=` | toutes les questions posables d'une matière, dans l'ordre du cours |
| `GET /api/mes-qcm/apercu?id=` | l'énoncé d'une question, sans la bonne réponse |

Toutes passent par `idUtilisateur(event)`, et un QCM se lit par
`id = ? AND utilisateur_id = ?` : celui d'un autre compte est une 404.

## Ce qu'il n'écrit pas

**L'export JSON.** Comme les séances de quiz, les QCM composés n'entrent pas dans
`resultats-cours`, dont le format est partagé avec le portfolio d'origine. Ce
qu'ils ont fait gagner voyage quand même : c'est dans la progression des fiches.

## Vérifier

`pnpm verif:quiz` en porte la section « Mes QCM » : tirage et exclusions,
candidates de toute la matière, aperçu sans bonne réponse, refus d'un titre vide
et d'une question inconnue, ordre et brassage stables, copie blanche puis à
moitié juste, report sur la fiche, entrée et extinction de la dette, double
clic, proposition inexistante refusée, renommage — et, dans « Cadrage par
utilisateur », un QCM introuvable depuis un autre compte.
