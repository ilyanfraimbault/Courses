import type { DatabaseSync } from 'node:sqlite'
import type { H3Event } from 'h3'

/**
 * Où en est l'accès d'un compte. Seul « accorde » ouvre les données ; les deux
 * autres ne permettent que de demander, puis d'attendre la réponse.
 */
export type Acces = 'aucun' | 'demande' | 'accorde'

export interface Compte {
  id: number
  pseudo: string
  mot_de_passe: string
  acces: Acces
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
    .prepare('SELECT id, pseudo, mot_de_passe, acces FROM utilisateur WHERE pseudo_replie = ?')
    .get(replierPseudo(pseudo)) as Record<string, unknown> | undefined
  if (!ligne) return null
  return {
    id: Number(ligne.id),
    pseudo: String(ligne.pseudo),
    mot_de_passe: String(ligne.mot_de_passe),
    acces: ligne.acces as Acces
  }
}

/** L'accès est obligatoire : on ne crée pas de compte sans dire ce qu'il ouvre. */
export function creerCompte(db: DatabaseSync, pseudo: string, empreinte: string, acces: Acces): number {
  const r = db
    .prepare('INSERT INTO utilisateur (pseudo, pseudo_replie, mot_de_passe, cree_le, acces) VALUES (?, ?, ?, ?, ?)')
    .run(pseudo.trim(), replierPseudo(pseudo), empreinte, Date.now(), acces)
  return Number(r.lastInsertRowid)
}

/** L'accès d'un compte, relu en base. Nul si le compte n'existe plus. */
export function accesDuCompte(db: DatabaseSync, id: number): Acces | null {
  const ligne = db.prepare('SELECT acces FROM utilisateur WHERE id = ?').get(id) as { acces: Acces } | undefined
  return ligne?.acces ?? null
}

/**
 * Le compte connecté, qu'il ait accès ou non. Seule la demande d'accès s'en
 * contente ; toute route de données passe par `idUtilisateur`.
 *
 * On vérifie que le compte existe encore. Une session scellée est autonome :
 * elle reste valide après la disparition de la ligne à laquelle elle renvoie,
 * et les écritures partiraient alors vers un identifiant fantôme — violation de
 * clé étrangère à l'écriture, silence à la lecture. Mieux vaut redemander une
 * connexion. C'est aussi ce que voit un compte dont la demande a été refusée :
 * le refus le supprime.
 */
export async function compteConnecte(event: H3Event): Promise<{ id: number, acces: Acces }> {
  const { user } = await requireUserSession(event)
  const id = (user as unknown as { id?: unknown })?.id

  // On vérifie la forme avant d'interroger la base. Une session scellée par une
  // version antérieure du site ne porte pas les mêmes champs, et passer
  // `undefined` à SQLite lève — ce qui rendrait une 500 là où il faut inviter à
  // se reconnecter.
  const acces = typeof id === 'number' && Number.isInteger(id) && id > 0
    ? accesDuCompte(useBase(), id)
    : null

  if (!acces) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Session expirée, reconnecte-toi' })
  }

  return { id: id as number, acces }
}

/**
 * L'identifiant du compte connecté, pour cadrer toute requête de données.
 *
 * Il vient de la session scellée, jamais du corps de la requête : sans quoi
 * il suffirait d'écrire l'identifiant d'un autre pour lire sa progression.
 *
 * L'accès est relu en base à chaque requête, comme le rôle d'administrateur :
 * l'accorder vaut dès la requête suivante, sans reconnexion. Un compte sans
 * accès reçoit un 403 et garde sa session — il en a besoin pour demander.
 */
export async function idUtilisateur(event: H3Event): Promise<number> {
  const { id, acces } = await compteConnecte(event)
  if (acces !== 'accorde') {
    throw createError({ statusCode: 403, statusMessage: 'Ce compte attend l\'accord de l\'administration' })
  }
  return id
}
