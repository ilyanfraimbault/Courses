/**
 * Rouvre ce qui était clos. Rien n'avait été effacé à la clôture : la dette,
 * les réussites et le calendrier de révision reviennent tels qu'ils étaient.
 *
 * Rouvrir un chapitre d'une matière close ne le rouvre pas : la clôture de la
 * matière le couvre toujours. C'est la matière qu'il faut rouvrir — l'écran le
 * dit, et propose le bon chemin.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)
  const chemin = getQuery(event).chemin
  if (typeof chemin !== 'string' || !chemin.startsWith('/')) {
    throw createError({ statusCode: 400, statusMessage: 'chemin manquant ou invalide' })
  }
  useBase().prepare('DELETE FROM cloture WHERE utilisateur_id = ? AND chemin = ?')
    .run(uid, cheminCanonique(chemin))
  setResponseStatus(event, 204)
  return null
})
