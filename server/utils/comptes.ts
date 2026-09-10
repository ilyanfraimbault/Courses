import type { DatabaseSync } from 'node:sqlite'
import type { H3Event } from 'h3'

export interface Compte {
  id: number
  pseudo: string
  mot_de_passe: string
}

/**
 * Le pseudo replié, tel qu'il sert de clé d'unicité.
 *
 * On replie les accents en plus de la casse : « Chloé » et « chloe » se lisent
 * comme le même nom, et deux comptes qu'on ne distingue pas à l'œil finissent
 * par se prendre pour un vol de compte.
 */
export function replierPseudo(pseudo: string): string {
  return pseudo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Ce qu'on accepte comme pseudo. Volontairement étroit, et dit à l'utilisateur. */
export const PSEUDO_MOTIF = /^[\p{L}\p{N}](?:[\p{L}\p{N} ._-]{1,30})$/u
export const PSEUDO_AIDE = 'Entre 2 et 31 caractères : lettres, chiffres, espace, point, tiret ou souligné.'

/** Longueur minimale d'un mot de passe. Le reste est laissé au jugement. */
export const MOT_DE_PASSE_MIN = 8

export function trouverCompte(db: DatabaseSync, pseudo: string): Compte | null {
  const ligne = db
    .prepare('SELECT id, pseudo, mot_de_passe FROM utilisateur WHERE pseudo_replie = ?')
    .get(replierPseudo(pseudo)) as Record<string, unknown> | undefined
  if (!ligne) return null
  return {
    id: Number(ligne.id),
    pseudo: String(ligne.pseudo),
    mot_de_passe: String(ligne.mot_de_passe)
  }
}

export function creerCompte(db: DatabaseSync, pseudo: string, empreinte: string): number {
  const r = db
    .prepare('INSERT INTO utilisateur (pseudo, pseudo_replie, mot_de_passe, cree_le) VALUES (?, ?, ?, ?)')
    .run(pseudo.trim(), replierPseudo(pseudo), empreinte, Date.now())
  return Number(r.lastInsertRowid)
}

/**
 * L'identifiant du compte connecté, pour cadrer toute requête de données.
 *
 * Il vient de la session scellée, jamais du corps de la requête : sans quoi
 * il suffirait d'écrire l'identifiant d'un autre pour lire sa progression.
 *
 * On vérifie que le compte existe encore. Une session scellée est autonome :
 * elle reste valide après la disparition de la ligne à laquelle elle renvoie,
 * et les écritures partiraient alors vers un identifiant fantôme — violation de
 * clé étrangère à l'écriture, silence à la lecture. Mieux vaut redemander une
 * connexion.
 */
export async function idUtilisateur(event: H3Event): Promise<number> {
  const { user } = await requireUserSession(event)
  const id = (user as unknown as { id?: unknown })?.id

  // On vérifie la forme avant d'interroger la base. Une session scellée par une
  // version antérieure du site ne porte pas les mêmes champs, et passer
  // `undefined` à SQLite lève — ce qui rendrait une 500 là où il faut inviter à
  // se reconnecter.
  const valide = typeof id === 'number' && Number.isInteger(id) && id > 0
    && !!useBase().prepare('SELECT 1 FROM utilisateur WHERE id = ?').get(id)

  if (!valide) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Session expirée, reconnecte-toi' })
  }

  return id as number
}
