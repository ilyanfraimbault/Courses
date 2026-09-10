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
