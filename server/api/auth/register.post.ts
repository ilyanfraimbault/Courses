interface CorpsInscription {
  pseudo?: unknown
  motDePasse?: unknown
  code?: unknown
}

const MAX_ESSAIS = 5
const FENETRE_MS = 300_000

/**
 * Création d'un compte, derrière un code d'inscription.
 *
 * Sans code, l'inscription est **fermée** plutôt qu'ouverte : le site n'est lié
 * depuis nulle part, mais il vit sur un domaine public, et une inscription
 * libre invite les robots. Le code se partage à qui de droit, et se change en
 * une ligne de la configuration.
 */
export default defineEventHandler(async (event) => {
  const { codeInscription, trustProxy } = useRuntimeConfig(event)

  if (!codeInscription) {
    throw createError({ statusCode: 403, statusMessage: 'Les inscriptions sont fermées' })
  }

  const ip = getRequestIP(event, { xForwardedFor: trustProxy }) ?? 'inconnue'
  if (tropDEssais(`inscription:${ip}`, MAX_ESSAIS, FENETRE_MS)) {
    throw createError({ statusCode: 429, statusMessage: 'Trop de tentatives, réessaie plus tard' })
  }

  const corps = await readBody<CorpsInscription>(event)
  const pseudo = typeof corps?.pseudo === 'string' ? corps.pseudo.trim() : ''
  const motDePasse = typeof corps?.motDePasse === 'string' ? corps.motDePasse : ''
  const code = typeof corps?.code === 'string' ? corps.code : ''

  if (code !== codeInscription) {
    throw createError({ statusCode: 403, statusMessage: 'Code d\'inscription invalide' })
  }
  if (!PSEUDO_MOTIF.test(pseudo)) {
    throw createError({ statusCode: 400, statusMessage: PSEUDO_AIDE })
  }
  if (motDePasse.length < MOT_DE_PASSE_MIN) {
    throw createError({
      statusCode: 400,
      statusMessage: `Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères`
    })
  }

  const db = useBase()
  if (trouverCompte(db, pseudo)) {
    throw createError({ statusCode: 409, statusMessage: 'Ce pseudo est déjà pris' })
  }

  const id = creerCompte(db, pseudo, await hashPassword(motDePasse))

  oublierEssais(`inscription:${ip}`)
  await setUserSession(event, { user: { id, pseudo } })

  return { ok: true, pseudo }
})
