import type { DatabaseSync } from 'node:sqlite'

/**
 * Le schéma, en migrations numérotées. `user_version` est le compteur : on
 * n'applique que les deltas manquants, dans une transaction. Ajouter une
 * migration = ajouter une entrée au tableau, jamais modifier une existante.
 */
const MIGRATIONS: string[] = [
  // v1 — progression, historique des QCM, to-do.
  `
  -- Une fiche par chemin canonique (sans barre oblique finale).
  -- « total » est recopié plutôt que recalculé : une carte de lien ne connaît
  -- pas le contenu de la page qu'elle vise, et c'est la fiche, en s'affichant,
  -- qui le lui apprend.
  CREATE TABLE fiche (
    chemin TEXT    PRIMARY KEY,
    total  INTEGER NOT NULL DEFAULT 0,
    maj    INTEGER NOT NULL
  ) STRICT;

  -- Une ligne par question trouvée. L'identité « chemin#bloc#label » est
  -- éclatée en trois colonnes plutôt que stockée telle quelle : c'est ce qui
  -- rend interrogeable « combien de questions de l'exercice 3 sont faites »,
  -- dont la to-do a besoin pour afficher un dénominateur par bloc.
  CREATE TABLE reussite (
    chemin   TEXT    NOT NULL,
    bloc     TEXT    NOT NULL,
    label    TEXT    NOT NULL,
    reponse  TEXT    NOT NULL,
    premiere INTEGER NOT NULL,
    maj      INTEGER NOT NULL,
    PRIMARY KEY (chemin, bloc, label),
    FOREIGN KEY (chemin) REFERENCES fiche(chemin) ON DELETE CASCADE
  ) STRICT, WITHOUT ROWID;

  CREATE INDEX reussite_par_bloc ON reussite (chemin, bloc);

  -- Historique des QCM : une ligne par copie rendue. L'unicité (chemin, bloc, t)
  -- est ce qui rend l'import rejouable et un double-clic sur « Corriger »
  -- inoffensif.
  CREATE TABLE qcm_tentative (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    chemin TEXT    NOT NULL,
    bloc   TEXT    NOT NULL,
    t      INTEGER NOT NULL,
    justes INTEGER NOT NULL,
    total  INTEGER NOT NULL,
    ratees TEXT    NOT NULL,
    UNIQUE (chemin, bloc, t)
  ) STRICT;

  CREATE INDEX qcm_tentative_par_bloc ON qcm_tentative (chemin, bloc, t DESC);

  -- To-do manuelle et ordonnée. « bloc » NULL désigne la fiche entière.
  -- « titre » et « type » sont figés à l'ajout : la ligne reste lisible même si
  -- le contenu bouge, et la page to-do n'a pas à interroger la collection.
  CREATE TABLE todo (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    chemin  TEXT    NOT NULL,
    bloc    TEXT,
    titre   TEXT    NOT NULL,
    type    TEXT,
    rang    INTEGER NOT NULL,
    note    TEXT,
    fait_le INTEGER,
    cree_le INTEGER NOT NULL
  ) STRICT;

  -- COALESCE, et non la colonne nue : en SQLite deux NULL ne s'égalent jamais,
  -- si bien qu'un index sur (chemin, bloc) laisserait passer autant de doublons
  -- « fiche entière » qu'on veut.
  CREATE UNIQUE INDEX todo_cible ON todo (chemin, COALESCE(bloc, ''));
  CREATE INDEX todo_ordre ON todo (rang);
  `,

  // v2 — plusieurs comptes.
  //
  // Chaque donnée appartient désormais à quelqu'un. On ne pouvait pas se
  // contenter d'ajouter une colonne : les clés primaires de `fiche` et
  // `reussite` devaient s'élargir, et SQLite ne sait pas modifier une clé
  // primaire en place. D'où la reconstruction.
  //
  // Les lignes de la v1 ne sont pas reprises : elles n'appartiendraient à
  // personne, et le site n'a jamais été déployé — il n'existe donc aucune
  // donnée de production à préserver. En développement, on réimporte depuis un
  // export si besoin.
  `
  CREATE TABLE utilisateur (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    pseudo       TEXT    NOT NULL,
    -- Le pseudo replié en minuscules, pour que « Ilyan » et « ilyan » ne
    -- puissent pas coexister : deux comptes qu'on ne distingue pas à l'œil
    -- sont une invitation à se tromper de mot de passe, puis à croire à un vol.
    pseudo_replie TEXT   NOT NULL UNIQUE,
    -- Empreinte scrypt au format PHC : elle transporte son propre sel et ses
    -- propres paramètres, donc les durcir plus tard n'invalide pas l'existant.
    mot_de_passe TEXT    NOT NULL,
    cree_le      INTEGER NOT NULL
  ) STRICT;

  DROP TABLE reussite;
  DROP TABLE qcm_tentative;
  DROP TABLE todo;
  DROP TABLE fiche;

  CREATE TABLE fiche (
    utilisateur_id INTEGER NOT NULL,
    chemin         TEXT    NOT NULL,
    total          INTEGER NOT NULL DEFAULT 0,
    maj            INTEGER NOT NULL,
    PRIMARY KEY (utilisateur_id, chemin),
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE
  ) STRICT;

  CREATE TABLE reussite (
    utilisateur_id INTEGER NOT NULL,
    chemin         TEXT    NOT NULL,
    bloc           TEXT    NOT NULL,
    label          TEXT    NOT NULL,
    reponse        TEXT    NOT NULL,
    premiere       INTEGER NOT NULL,
    maj            INTEGER NOT NULL,
    PRIMARY KEY (utilisateur_id, chemin, bloc, label),
    FOREIGN KEY (utilisateur_id, chemin) REFERENCES fiche(utilisateur_id, chemin) ON DELETE CASCADE
  ) STRICT, WITHOUT ROWID;

  CREATE INDEX reussite_par_bloc ON reussite (utilisateur_id, chemin, bloc);

  CREATE TABLE qcm_tentative (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id INTEGER NOT NULL,
    chemin         TEXT    NOT NULL,
    bloc           TEXT    NOT NULL,
    t              INTEGER NOT NULL,
    justes         INTEGER NOT NULL,
    total          INTEGER NOT NULL,
    ratees         TEXT    NOT NULL,
    UNIQUE (utilisateur_id, chemin, bloc, t),
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE
  ) STRICT;

  CREATE INDEX qcm_tentative_par_bloc ON qcm_tentative (utilisateur_id, chemin, bloc, t DESC);

  CREATE TABLE todo (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id INTEGER NOT NULL,
    chemin         TEXT    NOT NULL,
    bloc           TEXT,
    titre          TEXT    NOT NULL,
    type           TEXT,
    rang           INTEGER NOT NULL,
    note           TEXT,
    fait_le        INTEGER,
    cree_le        INTEGER NOT NULL,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE
  ) STRICT;

  -- COALESCE, et non la colonne nue : en SQLite deux NULL ne s'égalent jamais,
  -- si bien qu'un index sur (bloc) laisserait passer autant de doublons
  -- « fiche entière » qu'on veut.
  CREATE UNIQUE INDEX todo_cible ON todo (utilisateur_id, chemin, COALESCE(bloc, ''));
  CREATE INDEX todo_ordre ON todo (utilisateur_id, rang);
  `,

  // v3 — le mode quiz.
  //
  // Une session de quiz n'est pas une copie rendue : c'est une file qu'on
  // rallonge à chaque faute et qui ne se vide que lorsque tout est acquis. Elle
  // se reprend d'un appareil à l'autre, donc elle vit en base et non dans le
  // navigateur.
  `
  CREATE TABLE quiz_session (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id INTEGER NOT NULL,
    -- Ce sur quoi on a demandé à être interrogé, en JSON : { themes, notions }.
    filtre         TEXT    NOT NULL,
    -- Nombre de questions demandées au départ, qui est aussi le nombre de
    -- places à acquérir : la file, elle, s'allonge.
    taille         INTEGER NOT NULL,
    -- La file entière, en JSON. Elle s'écrit par instantané, comme la
    -- progression d'une fiche : rejouer une écriture est sans effet de bord.
    etat           TEXT    NOT NULL,
    poses          INTEGER NOT NULL DEFAULT 0,
    justes         INTEGER NOT NULL DEFAULT 0,
    fautes         INTEGER NOT NULL DEFAULT 0,
    commencee_le   INTEGER NOT NULL,
    maj            INTEGER NOT NULL,
    finie_le       INTEGER,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE
  ) STRICT;

  CREATE INDEX quiz_session_par_utilisateur ON quiz_session (utilisateur_id, maj DESC);

  -- Une ligne par question posée. Elle est redondante avec la file, et c'est
  -- voulu : la file dit où en est **cette** session, ces lignes disent ce qui
  -- résiste depuis toujours, et ça ne se lit pas en désérialisant trente JSON.
  CREATE TABLE quiz_reponse (
    session_id INTEGER NOT NULL,
    ordre      INTEGER NOT NULL,
    question   TEXT    NOT NULL,
    theme      TEXT,
    notion     TEXT,
    juste      INTEGER NOT NULL,
    t          INTEGER NOT NULL,
    PRIMARY KEY (session_id, ordre),
    FOREIGN KEY (session_id) REFERENCES quiz_session(id) ON DELETE CASCADE
  ) STRICT, WITHOUT ROWID;

  CREATE INDEX quiz_reponse_par_notion ON quiz_reponse (notion);
  `,

  // v4 — la mémoire des fautes, et la section du cours dans l'historique.
  //
  // Jusqu'ici le site ne retenait que ce qui était **trouvé** : `reussite` pour
  // les fiches, `qcm_tentative` pour les copies. Une faute d'exercice mourait
  // dans le navigateur, si bien que « m'interroger sur ce que j'ai raté » ne
  // pouvait pas exister — le site ne le savait pas.
  //
  // Une ligne par question ratée au moins une fois, quel que soit l'endroit :
  // exercice, QCM ou quiz. `rattrapee` porte la date de la bonne réponse qui a
  // éteint la dette ; NULL veut dire « toujours en dette », et c'est cette
  // colonne que la sélection du quiz interroge.
  `
  CREATE TABLE faute (
    utilisateur_id INTEGER NOT NULL,
    chemin         TEXT    NOT NULL,
    bloc           TEXT    NOT NULL,
    label          TEXT    NOT NULL,
    -- Combien de fois la question a été ratée, toutes occasions confondues.
    -- Ce n'est pas décoratif : c'est ce qui distingue l'étourderie de la notion
    -- qui ne passe pas.
    compte         INTEGER NOT NULL DEFAULT 1,
    derniere       INTEGER NOT NULL,
    rattrapee      INTEGER,
    PRIMARY KEY (utilisateur_id, chemin, bloc, label),
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE
  ) STRICT, WITHOUT ROWID;

  CREATE INDEX faute_en_dette ON faute (utilisateur_id, rattrapee);

  -- Le second niveau de la sélection du quiz est devenu la section du cours ;
  -- « ce qui résiste » s'agrège donc sur elle. La colonne « notion » reste :
  -- elle sert toujours à choisir la question qui remplace une ratée, au point
  -- de cours près.
  ALTER TABLE quiz_reponse ADD COLUMN section TEXT;

  CREATE INDEX quiz_reponse_par_section ON quiz_reponse (section);
  `,

  // v5 — un chapitre se désigne par son chemin, plus par son slug.
  //
  // Le site porte plusieurs matières, et deux d'entre elles peuvent avoir un
  // chapitre du même nom : « trigonometrie » ne suffit plus à le désigner, il
  // faut « /cours/a1/remise-a-niveau-maths/trigonometrie ». Les points de cours
  // suivent, et prennent un « # » pour séparer le chapitre de l'identifiant :
  // « …/nombres-complexes#cours-module ».
  //
  // Ce qu'on réécrit ici, ce sont les clés déjà stockées — les filtres des
  // séances et la colonne « theme » des réponses. Sans cela, une séance ouverte
  // au moment de la mise en ligne ne trouverait plus de candidats pour ses
  // reprises. Le préfixe est écrit en dur, et c'est exact : à cette migration,
  // une seule matière existait, et tous les slugs stockés en venaient. Les
  // clés déjà écrites en chemin (« /… ») ne sont pas touchées, ce qui rend la
  // réécriture sans effet si on la rejoue.
  `
  UPDATE quiz_session SET filtre = json_set(filtre,
    '$.themes', json((
      SELECT json_group_array(CASE WHEN value LIKE '/%' THEN value
        ELSE '/cours/a1/remise-a-niveau-maths/' || value END)
      FROM json_each(filtre, '$.themes'))),
    '$.notions', json((
      SELECT json_group_array(CASE WHEN value LIKE '/%' OR instr(value, '/') = 0 THEN value
        ELSE '/cours/a1/remise-a-niveau-maths/' || substr(value, 1, instr(value, '/') - 1)
          || '#' || substr(value, instr(value, '/') + 1) END)
      FROM json_each(filtre, '$.notions')))
  ) WHERE json_valid(filtre);

  UPDATE quiz_reponse SET theme = '/cours/a1/remise-a-niveau-maths/' || theme
  WHERE theme IS NOT NULL AND theme NOT LIKE '/%';

  UPDATE quiz_reponse SET notion = '/cours/a1/remise-a-niveau-maths/'
    || substr(notion, 1, instr(notion, '/') - 1) || '#' || substr(notion, instr(notion, '/') + 1)
  WHERE notion IS NOT NULL AND notion NOT LIKE '/%' AND instr(notion, '/') > 0;
  `,

  // v6 — les QCM composés.
  //
  // Un QCM composé n'a pas de page de contenu : c'est une liste de questions
  // choisies dans les fiches, rangée sur le compte de qui l'a composée. Il vit
  // donc en base, et se crée en production sans redéployer.
  //
  // La liste est un JSON d'identités « /chemin#bloc#label », dans l'ordre du
  // QCM. Elle ne recopie **aucun** énoncé : les questions sont relues dans les
  // fiches à chaque ouverture, comme au quiz, si bien que corriger un cours
  // corrige tous les QCM qui l'empruntent.
  `
  CREATE TABLE qcm_compose (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id INTEGER NOT NULL,
    titre          TEXT    NOT NULL,
    -- Le chemin de la matière : un QCM composé n'en mélange pas deux.
    matiere        TEXT    NOT NULL,
    questions      TEXT    NOT NULL,
    cree_le        INTEGER NOT NULL,
    maj            INTEGER NOT NULL,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE
  ) STRICT;

  CREATE INDEX qcm_compose_par_utilisateur ON qcm_compose (utilisateur_id, maj DESC);

  -- Une ligne par copie rendue, comme qcm_tentative — mais les questions ratées
  -- y sont des identités complètes et non des repères : un QCM composé mêle
  -- des blocs où « 3. » revient dix fois. L'unicité (compose_id, t) rend un
  -- double clic sur « Corriger » inoffensif.
  CREATE TABLE qcm_compose_copie (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    compose_id INTEGER NOT NULL,
    t          INTEGER NOT NULL,
    justes     INTEGER NOT NULL,
    total      INTEGER NOT NULL,
    ratees     TEXT    NOT NULL,
    UNIQUE (compose_id, t),
    FOREIGN KEY (compose_id) REFERENCES qcm_compose(id) ON DELETE CASCADE
  ) STRICT;

  CREATE INDEX qcm_compose_copie_par_qcm ON qcm_compose_copie (compose_id, t DESC);
  `,

  // v7 — les contrôles.
  //
  // Un contrôle est une date, une matière et un programme. Il ne retient ni
  // questions ni feuille de route : ce qui est su, ce qui reste et comment
  // l'étaler d'ici au jour J se recalculent à chaque lecture, depuis la même
  // mémoire que le reste du site. Une feuille de route stockée vieillirait dès
  // la première séance faite ailleurs.
  `
  CREATE TABLE controle (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id INTEGER NOT NULL,
    titre          TEXT    NOT NULL,
    matiere        TEXT    NOT NULL,
    -- Le jour de l'épreuve, « AAAA-MM-JJ » : une date de calendrier et non un
    -- instant, qui glisserait d'un jour selon le fuseau de qui la lit.
    jour           TEXT    NOT NULL,
    -- { themes, sections } : les clés du filtre du quiz. Vide = toute la matière.
    programme      TEXT    NOT NULL,
    -- Le dernier examen blanc composé pour ce contrôle. C'est un QCM composé
    -- comme un autre : le supprimer dans « Mes QCM » détache le lien sans
    -- toucher au contrôle.
    examen_blanc   INTEGER REFERENCES qcm_compose(id) ON DELETE SET NULL,
    -- La note obtenue, une fois l'épreuve passée. Le barème l'accompagne : un
    -- 14 ne se lit pas sans lui.
    note           REAL,
    bareme         REAL,
    cree_le        INTEGER NOT NULL,
    maj            INTEGER NOT NULL,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE
  ) STRICT;

  CREATE INDEX controle_par_utilisateur ON controle (utilisateur_id, jour);
  `,

  // v8 — les clôtures.
  //
  // Clore une matière, un chapitre ou une fiche, c'est dire « j'en ai fini ».
  // On ne retient que le chemin : ce qu'il contient se lit dans la hiérarchie
  // des chemins, comme partout ailleurs, et un chapitre ajouté plus tard sous
  // une matière close y tombe sans rien réécrire. Rien n'est effacé — dette,
  // réussites et histoire de révision restent, et rouvrir rend tout tel quel.
  `
  CREATE TABLE cloture (
    utilisateur_id INTEGER NOT NULL,
    chemin         TEXT    NOT NULL,
    close_le       INTEGER NOT NULL,
    PRIMARY KEY (utilisateur_id, chemin),
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE
  ) STRICT;
  `,

  // v9 — l'accès sur demande.
  //
  // Un compte créé sans code d'invitation n'ouvre rien : il peut seulement
  // demander l'accès, que l'administration accorde ou refuse. « aucun » est un
  // compte qui n'a encore rien demandé, « demande » une demande qui attend.
  //
  // Le défaut de la colonne est « aucun », le sens sûr : une insertion qui
  // oublierait de le dire ne donnerait accès à rien. Les comptes déjà créés
  // l'ont été avec le code, ils gardent leur accès.
  `
  ALTER TABLE utilisateur ADD COLUMN acces TEXT NOT NULL DEFAULT 'aucun'
    CHECK (acces IN ('aucun', 'demande', 'accorde'));
  ALTER TABLE utilisateur ADD COLUMN demande_le INTEGER;
  -- Ce que l'élève dit de lui à l'administration : qui il est, d'où il vient.
  ALTER TABLE utilisateur ADD COLUMN demande_message TEXT;

  UPDATE utilisateur SET acces = 'accorde';
  `,

  // v10 — le code qu'on écrit sous une question.
  //
  // Un brouillon, pas un résultat : rien ne le corrige, il ne compte dans
  // aucune progression, et l'élève se note lui-même après l'avoir comparé à la
  // solution. Il est donc rattaché au compte et non à la fiche : une ligne de
  // `fiche` ne se crée jamais avec un total à zéro, et « repartir de zéro » sur
  // une fiche efface un score, pas le travail qu'on y a écrit.
  `
  CREATE TABLE reponse_ecrite (
    utilisateur_id INTEGER NOT NULL,
    chemin         TEXT    NOT NULL,
    bloc           TEXT    NOT NULL,
    label          TEXT    NOT NULL,
    texte          TEXT    NOT NULL,
    maj            INTEGER NOT NULL,
    PRIMARY KEY (utilisateur_id, chemin, bloc, label),
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE
  ) STRICT, WITHOUT ROWID;
  `,

  // v11 — le programme de l'école, les parcours, les notes, et des contrôles
  // tenus par la classe.
  //
  // Les matières n'existaient que dans l'arborescence du contenu. Elles ont
  // désormais une table, semée au démarrage depuis le programme officiel
  // (`server/utils/programme.ts`) : UE, coefficient, ECTS, parcours. C'est elle
  // que retiennent les notes et les contrôles, par **code** — une matière qui
  // n'a pas encore de cours sur le site (l'anglais, les probabilités) peut
  // avoir un contrôle et une note.
  //
  // Le parcours (DL ou SR) se choisit une fois, au premier passage. NULL veut
  // dire « pas encore choisi », et c'est ce qui ouvre la fenêtre de choix.
  //
  // Un contrôle n'est plus une feuille de route personnelle : c'est une date
  // dans l'agenda de la classe, posée par un élève pour tous ceux qu'elle
  // concerne. L'ancienne table reste en place, intacte : la conversion se
  // relit, et rien n'est perdu si elle doit être refaite. La note et le barème
  // n'y passent pas — ils étaient à un élève, l'agenda est à tous.
  `
  CREATE TABLE ue (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    semestre INTEGER NOT NULL,
    -- « 5.1 MATH », tel que l'école l'écrit. Le même code revient d'un
    -- parcours à l'autre à partir du S7, avec un contenu différent.
    code     TEXT    NOT NULL,
    intitule TEXT    NOT NULL,
    ects     REAL    NOT NULL,
    parcours TEXT CHECK (parcours IN ('dl', 'sr')),
    ordre    INTEGER NOT NULL
  ) STRICT;

  CREATE UNIQUE INDEX ue_unique ON ue (semestre, code, COALESCE(parcours, ''));

  CREATE TABLE matiere (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    -- L'identité de la matière, figée : « s5-ethical-hacking ». Une page de
    -- matière du cours la désigne par ce code (\`programme:\` en frontmatter).
    code      TEXT    NOT NULL UNIQUE,
    intitule  TEXT    NOT NULL,
    -- NULL : hors programme — une remise à niveau, ou une matière ajoutée
    -- depuis le site. Elle n'entre dans aucune moyenne.
    ue_id     INTEGER REFERENCES ue(id),
    -- NULL : la matière existe au programme mais ne compte pas.
    coef      REAL,
    heures    INTEGER,
    ordre     INTEGER NOT NULL DEFAULT 0,
    cree_par  INTEGER REFERENCES utilisateur(id) ON DELETE SET NULL,
    cree_le   INTEGER NOT NULL
  ) STRICT;

  ALTER TABLE utilisateur ADD COLUMN parcours TEXT CHECK (parcours IN ('dl', 'sr'));

  -- Une moyenne par matière, telle que l'élève la saisit. Les moyennes d'UE et
  -- de semestre ne s'écrivent pas : elles se recalculent à l'affichage.
  CREATE TABLE note (
    utilisateur_id INTEGER NOT NULL,
    matiere_id     INTEGER NOT NULL,
    valeur         REAL    NOT NULL CHECK (valeur >= 0 AND valeur <= 20),
    maj            INTEGER NOT NULL,
    PRIMARY KEY (utilisateur_id, matiere_id),
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE,
    FOREIGN KEY (matiere_id) REFERENCES matiere(id) ON DELETE CASCADE
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE controle_classe (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Qui l'a posé : lui seul, avec l'administration, peut le changer.
    auteur_id  INTEGER REFERENCES utilisateur(id) ON DELETE SET NULL,
    titre      TEXT    NOT NULL,
    -- Le code de la matière (table \`matiere\`).
    matiere    TEXT    NOT NULL,
    jour       TEXT    NOT NULL,
    -- À qui il s'adresse. NULL : toute la classe.
    parcours   TEXT CHECK (parcours IN ('dl', 'sr')),
    -- Ce sur quoi il porte, s'il est connu : un tableau JSON de chemins —
    -- chapitres, fiches, ou « /fiche#bloc » pour un exercice. Des identités
    -- seulement : les intitulés se relisent dans le contenu.
    programme  TEXT    NOT NULL DEFAULT '[]',
    -- Ce que le contenu ne sait pas dire : « documents autorisés », « tout le
    -- chapitre 3 sauf les preuves ».
    precisions TEXT,
    cree_le    INTEGER NOT NULL,
    maj        INTEGER NOT NULL
  ) STRICT;

  CREATE INDEX controle_classe_par_jour ON controle_classe (jour);

  -- Les contrôles personnels deviennent des contrôles de la classe. Deux élèves
  -- qui avaient déclaré le même (même matière, même jour) n'en font qu'un : le
  -- premier déclaré. Les chapitres du programme passent tels quels ; une
  -- section du cours (« /fiche#ancre ») devient sa fiche, la nomenclature des
  -- sections n'existant plus.
  INSERT INTO controle_classe (auteur_id, titre, matiere, jour, parcours, programme, precisions, cree_le, maj)
  SELECT
    c.utilisateur_id,
    c.titre,
    CASE c.matiere
      WHEN '/cours/a1/ethical-hacking' THEN 's5-ethical-hacking'
      WHEN '/cours/a1/mathematiques-ingenieur' THEN 's5-mathematiques-ingenieur'
      WHEN '/cours/a1/mise-a-niveau-c' THEN 's5-langage-fonctionnel'
      WHEN '/cours/a1/remise-a-niveau-maths' THEN 'remise-a-niveau-maths'
      WHEN '/cours/a1/reseaux-protocoles' THEN 's5-reseaux-protocoles-1'
      WHEN '/cours/a1/structures-donnees-algorithmique' THEN 's5-structures-donnees-algorithmique'
      WHEN '/cours/a1/virtualisation-conteneurisation' THEN 's5-virtualisation-conteneurisation'
      ELSE c.matiere
    END,
    c.jour,
    NULL,
    COALESCE((
      SELECT json_group_array(v) FROM (
        SELECT value AS v FROM json_each(c.programme, '$.themes')
        UNION
        SELECT substr(value, 1, instr(value, '#') - 1) FROM json_each(c.programme, '$.sections') WHERE instr(value, '#') > 1
      )
    ), '[]'),
    NULL,
    c.cree_le,
    c.maj
  FROM controle c
  WHERE c.id = (SELECT MIN(d.id) FROM controle d WHERE d.matiere = c.matiere AND d.jour = c.jour);
  `,

  // v12 — le prénom et le nom.
  //
  // Le pseudo sert à se connecter ; l'accueil, lui, salue quelqu'un. Ils se
  // demandent au premier passage, avec le parcours, dans la même fenêtre — et
  // aident l'administration à savoir qui demande l'accès. NULL : pas encore dit.
  `
  ALTER TABLE utilisateur ADD COLUMN prenom TEXT;
  ALTER TABLE utilisateur ADD COLUMN nom TEXT;
  `
]

/** Applique les migrations manquantes. Idempotent : rejouer ne fait rien. */
export function appliquerSchema(db: DatabaseSync): number {
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number }

  for (let i = version; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[i]!)
      // PRAGMA n'accepte pas de paramètre lié : l'entier vient d'un indice de
      // boucle, jamais d'une entrée extérieure.
      db.exec(`PRAGMA user_version = ${i + 1}`)
      db.exec('COMMIT')
    } catch (erreur) {
      db.exec('ROLLBACK')
      throw erreur
    }
  }

  return MIGRATIONS.length
}
