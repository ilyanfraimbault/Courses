/** « Repartir de zéro » sur une fiche : la cascade emporte ses réussites. */
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const { chemin: brut } = getQuery(event)
  if (typeof brut !== 'string' || !brut.startsWith('/')) {
    throw createError({ statusCode: 400, statusMessage: 'chemin manquant ou invalide' })
  }

  useBase().prepare('DELETE FROM fiche WHERE chemin = ?').run(cheminCanonique(brut))
  return { ok: true }
})
