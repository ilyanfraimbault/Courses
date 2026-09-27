import type { Controle } from '~~/shared/types/controles'

/**
 * Un contrôle ouvert : son état, ses sections, sa feuille de route et son
 * examen blanc, en une requête. Tout est recalculé ici, rien n'est stocké — une
 * feuille de route écrite en base vieillirait dès la première séance faite
 * ailleurs.
 */
export default defineEventHandler(async (event): Promise<Controle> => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  const ligne = lireControle(db, uid, idControle(event))
  if (!ligne) throw createError({ statusCode: 404, statusMessage: 'contrôle introuvable' })

  const banque = await chargerBanque(event)
  return evaluerControle(db, banque, ligne, lireMemoire(db, uid), maintenantPour(event))
})
