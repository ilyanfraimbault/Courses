import { estParcours, type Parcours } from '~~/shared/types/matieres'

/**
 * Choisir son parcours : DL ou SR.
 *
 * Il se choisit au premier passage, dans une fenêtre qu'on ne peut pas fermer
 * sans répondre, et se change ensuite depuis le badge de l'en-tête. Il décide
 * des matières qu'on voit et des contrôles qui nous concernent ; le serveur le
 * relit en base à chaque requête, jamais dans la session.
 */
export default defineEventHandler(async (event): Promise<{ parcours: Parcours }> => {
  const uid = await idUtilisateur(event)
  const corps = await readBody<{ parcours?: unknown }>(event)
  if (!estParcours(corps?.parcours)) {
    throw createError({ statusCode: 400, statusMessage: 'Parcours inconnu : « dl » ou « sr »' })
  }
  useBase().prepare('UPDATE utilisateur SET parcours = ? WHERE id = ?').run(corps.parcours, uid)
  return { parcours: corps.parcours }
})
