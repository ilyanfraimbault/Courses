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
