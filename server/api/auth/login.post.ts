import { timingSafeEqual } from 'node:crypto'

interface CorpsConnexion {
  motDePasse?: unknown
}

// Garde-fou contre la force brute, en mémoire et par IP. Nitro n'applique aucune
// limitation de débit par défaut et la comparaison ci-dessous est bon marché :
// sans ce compteur, qui peut joindre le port peut essayer des milliers de mots
// de passe par seconde. Un seul processus sert le site, un compteur local suffit.
const MAX_ESSAIS = 5
const FENETRE_MS = 60_000
const essais = new Map<string, { compte: number, finFenetre: number }>()

// On purge les entrées dont la fenêtre est écoulée, sinon la table garderait un
// enregistrement périmé par IP source pour toute la vie du processus.
function purger(maintenant: number): void {
  for (const [ip, entree] of essais) {
    if (maintenant > entree.finFenetre) essais.delete(ip)
  }
}

function tropDEssais(ip: string): boolean {
  const maintenant = Date.now()
  purger(maintenant)
  const entree = essais.get(ip)
  if (!entree || maintenant > entree.finFenetre) {
    essais.set(ip, { compte: 1, finFenetre: maintenant + FENETRE_MS })
    return false
  }
  entree.compte += 1
  return entree.compte > MAX_ESSAIS
}

// Comparaison à temps constant. Un « !== » s'arrête au premier octet différent
// et laisse fuir la longueur et le préfixe par le temps de réponse.
// `timingSafeEqual` exige deux tampons de même taille : on encode chaque côté
// dans un tampon de taille fixe, rempli de zéros. On dimensionne en *octets* et
// non en caractères — `padEnd` compte des unités UTF-16, alors qu'UTF-8 émet un
// nombre variable d'octets par caractère, et un accent suffirait à produire deux
// longueurs différentes, donc une 500.
const LARGEUR = 512
const encodeur = new TextEncoder()
function egalConstant(a: string, b: string): boolean {
  const tamponA = new Uint8Array(LARGEUR)
  const tamponB = new Uint8Array(LARGEUR)
  encodeur.encodeInto(a, tamponA)
  encodeur.encodeInto(b, tamponB)
  return timingSafeEqual(tamponA, tamponB)
}

/**
 * Connexion à un seul compte : il n'y a qu'une personne à qui ce cahier
 * appartient, donc pas d'identifiant, juste un mot de passe. En cas de succès on
 * scelle un cookie de session (nuxt-auth-utils) et le mot de passe ne repasse
 * plus jamais sur le réseau.
 */
export default defineEventHandler(async (event) => {
  const { coursMotDePasse, trustProxy } = useRuntimeConfig(event)

  if (!coursMotDePasse) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_COURS_MOT_DE_PASSE n\'est pas défini' })
  }

  // On ne fait confiance à « X-Forwarded-For » que derrière un proxy qui le
  // réécrit (Caddy, en production, avec NUXT_TRUST_PROXY=true). Exposé en
  // direct, cet en-tête est contrôlé par le client : il suffirait d'en changer à
  // chaque essai pour contourner la limite par IP. On retombe alors sur l'IP de
  // la connexion TCP, qui elle ne se falsifie pas.
  const ip = getRequestIP(event, { xForwardedFor: trustProxy }) ?? 'inconnue'
  if (tropDEssais(ip)) {
    throw createError({ statusCode: 429, statusMessage: 'Trop de tentatives, réessaie dans une minute' })
  }

  const corps = await readBody<CorpsConnexion>(event)
  const motDePasse = typeof corps?.motDePasse === 'string' ? corps.motDePasse : ''

  if (!egalConstant(motDePasse, coursMotDePasse)) {
    throw createError({ statusCode: 401, statusMessage: 'Mot de passe invalide' })
  }

  essais.delete(ip)

  await setUserSession(event, { user: { nom: 'ilyan' } })

  return { ok: true }
})
