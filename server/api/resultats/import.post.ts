/**
 * Verse un export dans la base. C'est le chemin principal : en conteneur,
 * l'image ne contient que `.output`, pas `scripts/` — le script en ligne de
 * commande ne sert qu'au développement local.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)

  const corps = await readBody(event)
  const simulation = getQuery(event).simulation === 'true'

  try {
    return importerResultats(useBase(), uid, corps, { simulation })
  } catch (erreur) {
    throw createError({ statusCode: 400, statusMessage: (erreur as Error).message })
  }
})
