/** Oublie l'historique d'un bloc de QCM. */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)

  const { chemin: brut, bloc } = getQuery(event)
  if (typeof brut !== 'string' || !brut.startsWith('/') || typeof bloc !== 'string' || !bloc) {
    throw createError({ statusCode: 400, statusMessage: 'chemin et bloc sont requis' })
  }

  const r = useBase()
    .prepare('DELETE FROM qcm_tentative WHERE utilisateur_id = ? AND chemin = ? AND bloc = ?')
    .run(uid, cheminCanonique(brut), bloc)

  return { supprimees: Number(r.changes) }
})
