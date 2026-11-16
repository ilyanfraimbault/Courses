interface CorpsDemande {
  message?: unknown
}

/** Assez pour dire qui l'on est, pas assez pour s'en servir de messagerie. */
const MESSAGE_MAX = 500

/**
 * La seule chose qu'un compte sans accès puisse faire : demander l'accès.
 *
 * Elle passe par `compteConnecte` et non par `idUtilisateur`, qui refuserait
 * précisément ce compte. Redemander remplace la demande en cours — le message
 * et la date — sans en créer une seconde : il n'y a qu'une ligne par compte.
 */
export default defineEventHandler(async (event) => {
  const { id, acces } = await compteConnecte(event)
  if (acces === 'accorde') return { acces }

  const corps = await readBody<CorpsDemande>(event)
  const brut = typeof corps?.message === 'string' ? corps.message.trim() : ''
  if (brut.length > MESSAGE_MAX) {
    throw createError({ statusCode: 400, statusMessage: `Le message tient en ${MESSAGE_MAX} caractères` })
  }

  useBase()
    .prepare('UPDATE utilisateur SET acces = \'demande\', demande_le = ?, demande_message = ? WHERE id = ? AND acces != \'accorde\'')
    .run(Date.now(), brut || null, id)

  return { acces: 'demande' as const }
})
