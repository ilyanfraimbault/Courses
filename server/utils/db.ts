import { DatabaseSync } from 'node:sqlite'
import { dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import { appliquerSchema } from './schema.ts'
import { semerProgramme } from './programme.ts'

/**
 * Ouvre la base et met le schéma à jour.
 *
 * Ce fichier n'importe **rien** de Nitro : le script d'import en ligne de
 * commande l'utilise aussi, hors de tout serveur. C'est également le seul
 * endroit qui connaisse `node:sqlite` — basculer sur better-sqlite3 un jour
 * tiendrait dans ces quinze lignes.
 */
export function ouvrirBase(fichier: string): DatabaseSync {
  mkdirSync(dirname(fichier), { recursive: true })

  const db = new DatabaseSync(fichier)

  // WAL : les lectures ne bloquent plus l'écriture. Il crée « -wal » et « -shm »
  // à côté du fichier, d'où l'exigence que le point de montage soit un
  // répertoire inscriptible et non un fichier monté seul.
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA synchronous = NORMAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')

  appliquerSchema(db)
  // Après le schéma, à chaque ouverture : ce qui manque du programme s'ajoute,
  // rien de ce qui existe n'est réécrit.
  semerProgramme(db)

  return db
}

let base: DatabaseSync | null = null

/** La connexion du serveur, ouverte une fois au démarrage. */
export function useBase(): DatabaseSync {
  if (!base) {
    const { baseFichier } = useRuntimeConfig()
    base = ouvrirBase(baseFichier)
  }
  return base
}
