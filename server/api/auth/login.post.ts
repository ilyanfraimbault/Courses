interface CorpsConnexion {
  pseudo?: unknown
  motDePasse?: unknown
}

const MAX_ESSAIS = 8
const FENETRE_MS = 60_000

/**
 * Connexion par pseudo et mot de passe.
 *
 * On ne dit jamais lequel des deux est faux : distinguer « ce pseudo n'existe
 * pas » de « mauvais mot de passe » donnerait la liste des comptes à qui
 * voudrait la constituer.
 */
export default defineEventHandler(async (event) => {
  const { trustProxy } = useRuntimeConfig(event)

  // On ne fait confiance à « X-Forwarded-For » que derrière un proxy qui le
  // réécrit (Caddy, en production). Exposé en direct, cet en-tête est contrôlé
  // par le client : il suffirait d'en changer à chaque essai pour contourner la
  // limite. On retombe alors sur l'IP de la connexion TCP, qui ne se falsifie pas.
  const ip = getRequestIP(event, { xForwardedFor: trustProxy }) ?? 'inconnue'
  if (tropDEssais(`connexion:${ip}`, MAX_ESSAIS, FENETRE_MS)) {
    throw createError({ statusCode: 429, statusMessage: 'Trop de tentatives, réessaie dans une minute' })
  }

  const corps = await readBody<CorpsConnexion>(event)
  const pseudo = typeof corps?.pseudo === 'string' ? corps.pseudo : ''
  const motDePasse = typeof corps?.motDePasse === 'string' ? corps.motDePasse : ''

  const compte = pseudo ? trouverCompte(useBase(), pseudo) : null

  // On vérifie une empreinte même quand le compte n'existe pas : sans cela, le
  // temps de réponse trahirait l'existence d'un pseudo. L'empreinte factice est
  // un scrypt valide, donc du même coût que le cas réel.
  const empreinte = compte?.mot_de_passe ?? await empreinteFactice()
  const valide = await verifyPassword(empreinte, motDePasse)

  if (!compte || !valide) {
    throw createError({ statusCode: 401, statusMessage: 'Pseudo ou mot de passe incorrect' })
  }

  oublierEssais(`connexion:${ip}`)
  await setUserSession(event, { user: { id: compte.id, pseudo: compte.pseudo } })

  return { ok: true, pseudo: compte.pseudo }
})
