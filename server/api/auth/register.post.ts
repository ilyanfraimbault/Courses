interface CorpsInscription {
  pseudo?: unknown
  motDePasse?: unknown
  code?: unknown
}

const MAX_ESSAIS = 5
const FENETRE_MS = 300_000

/**
 * Au delà, plus de compte sans accès : un robot qui en créerait à la chaîne
 * remplirait la liste des demandes et noierait les vraies. La limite par IP ne
 * suffit pas contre qui en change.
 */
const MAX_SANS_ACCES = 50

/**
 * Création d'un compte, de deux façons.
 *
 * **Avec le code d'invitation** (`NUXT_CODE_INSCRIPTION`), le compte a accès
 * d'emblée : le code se donne à qui de droit, c'est déjà un accord.
 *
 * **Sans code**, le compte est créé sans accès : on peut s'y connecter, et ne
 * rien y faire d'autre que demander l'accès à l'administration. Un code faux
 * n'y mène pas en silence — il est refusé, sans quoi on se croirait inscrit
 * avec un accès qu'on n'a pas.
 */
export default defineEventHandler(async (event) => {
  const { codeInscription, trustProxy } = useRuntimeConfig(event)

  const ip = getRequestIP(event, { xForwardedFor: trustProxy }) ?? 'inconnue'
  if (tropDEssais(`inscription:${ip}`, MAX_ESSAIS, FENETRE_MS)) {
    throw createError({ statusCode: 429, statusMessage: 'Trop de tentatives, réessaie plus tard' })
  }

  const corps = await readBody<CorpsInscription>(event)
  const pseudo = typeof corps?.pseudo === 'string' ? corps.pseudo.trim() : ''
  const motDePasse = typeof corps?.motDePasse === 'string' ? corps.motDePasse : ''
  const code = typeof corps?.code === 'string' ? corps.code.trim() : ''

  // Vide côté serveur, aucun code n'est bon : on ne compare jamais à une chaîne
  // vide, qui laisserait entrer quiconque n'en tape pas.
  const invite = !!code && !!codeInscription && code === codeInscription
  if (code && !invite) {
    throw createError({ statusCode: 403, statusMessage: 'Code d\'invitation invalide' })
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

  if (!invite) {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM utilisateur WHERE acces != \'accorde\'').get() as { n: number }
    if (n >= MAX_SANS_ACCES) {
      throw createError({ statusCode: 503, statusMessage: 'Trop de demandes en attente, réessaie plus tard' })
    }
  }

  const acces = invite ? 'accorde' : 'aucun'
  const id = creerCompte(db, pseudo, await hashPassword(motDePasse), acces)

  oublierEssais(`inscription:${ip}`)
  await setUserSession(event, { user: { id, pseudo } })

  return { ok: true, pseudo, acces }
})
