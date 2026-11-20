import type { Controle } from '~~/shared/types/controles'

/**
 * L'agenda : les contrôles de la classe qui concernent le compte — ceux de
 * toute la classe et ceux de son parcours —, du plus proche au plus lointain.
 * `?fuseau=` : le compte à rebours se fait chez l'élève.
 */
export default defineEventHandler(async (event): Promise<Controle[]> => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  return listerControles(event, db, lecteur(event, db, uid))
})
