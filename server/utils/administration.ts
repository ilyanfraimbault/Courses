import type { DatabaseSync } from 'node:sqlite'
import type { H3Event } from 'h3'

/**
 * Qui administre le site : les pseudos de `NUXT_ADMINISTRATEURS`, séparés par
 * des virgules, repliés comme à l'unicité — « Ilyann » et « ilyann » désignent
 * le même compte, et c'est le même pli qui en garantit l'unicité en base.
 *
 * Une variable plutôt qu'une colonne : le rôle se donne et se retire en une
 * ligne de configuration, sans requête SQL sur le serveur de production. Vide,
 * personne n'administre — c'est le défaut sûr.
 *
 * Le pseudo est relu **en base** à partir de l'identifiant de session, jamais
 * pris dans la session : une session scellée vit sa vie après son émission, et
 * retirer quelqu'un de la liste doit valoir à la requête suivante.
 */
export function pseudosAdministrateurs(event: H3Event): Set<string> {
  const { administrateurs } = useRuntimeConfig(event)
  return new Set(String(administrateurs ?? '')
    .split(',')
    .map(replierPseudo)
    .filter(Boolean))
}

export function estAdministrateur(event: H3Event, db: DatabaseSync, uid: number): boolean {
  const liste = pseudosAdministrateurs(event)
  if (!liste.size) return false
  const ligne = db.prepare('SELECT pseudo_replie FROM utilisateur WHERE id = ?').get(uid) as { pseudo_replie: string } | undefined
  return !!ligne && liste.has(ligne.pseudo_replie)
}

/**
 * La garde des routes `/api/admin/*`. Ce sont les seules du site qui lisent au
 * delà du compte connecté : elles passent quand même par `idUtilisateur`, pour
 * qu'une session périmée y reçoive le même 401 qu'ailleurs, puis refusent en
 * 403 à qui n'est pas dans la liste.
 */
export async function exigerAdministrateur(event: H3Event): Promise<number> {
  const uid = await idUtilisateur(event)
  if (!estAdministrateur(event, useBase(), uid)) {
    throw createError({ statusCode: 403, statusMessage: 'Réservé à l\'administration' })
  }
  return uid
}
