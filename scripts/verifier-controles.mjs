/**
 * Vérification manuelle des contrôles : l'agenda de la classe.
 *
 * Un contrôle est posé par un élève pour tous ceux qu'il concerne. Ce script
 * vérifie les deux règles qui le gardent, avec trois comptes plutôt qu'en les
 * supposant : **le parcours décide de ce qu'on voit** — un contrôle SR n'existe
 * pas pour un DL —, et **seul l'auteur le change**. Puis la validation : la
 * matière d'un parcours impose le sien, le programme ne sort pas de la matière.
 *
 *   pnpm dev            # ou la configuration « cours-verif » de .claude/launch.json
 *   node scripts/verifier-controles.mjs
 */
const BASE = process.env.QUIZ_BASE ?? 'http://localhost:3000'
const CODE = process.env.NUXT_CODE_INSCRIPTION ?? 'code-de-classe'
const FUSEAU = 'Europe/Paris'

const SDA = 's5-structures-donnees-algorithmique'
const COURS_SDA = '/cours/a1/structures-donnees-algorithmique'
const MATIERE_DL = 's7-dl-validation-logiciels'
const MATIERE_SR = 's7-sr-reseaux-avances'

let cookie = ''
const echecs = []

function verifier(nom, condition, detail = '') {
  console.log(`${condition ? '  ok  ' : ' ÉCHEC'} ${nom}${detail ? ' — ' + detail : ''}`)
  if (!condition) echecs.push(nom)
}

async function api(chemin, options = {}) {
  const r = await fetch(BASE + chemin, {
    ...options,
    headers: { 'content-type': 'application/json', cookie, ...(options.headers ?? {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  })
  for (const c of r.headers.getSetCookie?.() ?? []) cookie = c.split(';')[0]
  try {
    return { statut: r.status, corps: await r.json() }
  } catch {
    return { statut: r.status, corps: null }
  }
}

function jourDans(n) {
  const aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date())
  const d = new Date(aujourdhui + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

async function inscrire(prefixe, parcours) {
  cookie = ''
  const pseudo = prefixe + '-' + Math.random().toString(36).slice(2, 8)
  const r = await api('/api/auth/register', { method: 'POST', body: { pseudo, motDePasse: 'motdepasse-de-verification', code: CODE } })
  if (r.statut >= 400) {
    console.log('\nInscription impossible : vérifier NUXT_CODE_INSCRIPTION.')
    process.exit(1)
  }
  if (parcours) await api('/api/compte/parcours', { method: 'PUT', body: { parcours } })
  return cookie
}

const liste = () => api(`/api/controles?fuseau=${encodeURIComponent(FUSEAU)}`)
const lire = id => api(`/api/controles/${id}?fuseau=${encodeURIComponent(FUSEAU)}`)
const valeurs = (champs = {}) => ({ titre: 'Partiel', matiere: SDA, jour: jourDans(5), parcours: null, programme: [], precisions: null, ...champs })

console.log('\n— Trois comptes : deux DL, un SR')
const cookieSr = await inscrire('controle-sr', 'sr')
const cookieB = await inscrire('controle-b', 'dl')
const cookieA = await inscrire('controle-a', 'dl')
verifier('inscriptions', !!cookieA && !!cookieB && !!cookieSr)

console.log('\n— Planifier')
let r = await api('/api/controles', { method: 'POST', body: valeurs({ programme: [`${COURS_SDA}/listes`, `${COURS_SDA}/arbres/tp#exercice-1`] }) })
verifier('A planifie un contrôle pour toute la classe', r.statut === 201, `statut ${r.statut}`)
const commun = r.corps?.id
let c = (await lire(commun)).corps
verifier('il se relit tel quel', c?.matiere === SDA && c.parcours === null && c.programme.length === 2 && c.cours === COURS_SDA)
verifier('son auteur peut le changer', c?.modifiable === true)
verifier('le compte à rebours se fait chez l\'élève', c?.joursRestants === 5, String(c?.joursRestants))

r = await api('/api/controles', { method: 'POST', body: valeurs({ titre: 'TP noté', parcours: 'sr' }) })
const pourSr = r.corps?.id
verifier('une matière commune peut viser un seul parcours', r.statut === 201)
verifier('son auteur DL le voit encore — c\'est lui qui le corrige', (await lire(pourSr)).statut === 200 && (await liste()).corps.some(x => x.id === pourSr))

r = await api('/api/controles', { method: 'POST', body: valeurs({ matiere: MATIERE_DL, parcours: 'sr' }) })
const dl = r.corps?.id
verifier('une matière DL impose son parcours, quoi qu\'on demande', r.statut === 201 && (await lire(dl)).corps?.parcours === 'dl')

r = await api('/api/controles', { method: 'POST', body: valeurs({ matiere: MATIERE_SR }) })
verifier('un DL ne planifie pas dans une matière SR', r.statut === 400)
r = await api('/api/controles', { method: 'POST', body: valeurs({ programme: ['/cours/a1/ethical-hacking/introduction'] }) })
verifier('le programme ne sort pas de la matière', r.statut === 400)
r = await api('/api/controles', { method: 'POST', body: valeurs({ matiere: 's5-anglais', programme: ['/cours/a1/x'] }) })
verifier('pas de programme pour une matière sans cours', r.statut === 400)
r = await api('/api/controles', { method: 'POST', body: valeurs({ matiere: 's5-anglais' }) })
verifier('mais un contrôle d\'anglais, oui', r.statut === 201)
const anglais = r.corps?.id
r = await api('/api/controles', { method: 'POST', body: valeurs({ jour: '2026-02-30' }) })
verifier('une date impossible est refusée', r.statut === 400)
r = await api('/api/controles', { method: 'POST', body: valeurs({ titre: '   ', programme: [COURS_SDA] }) })
const sansTitre = r.corps?.id
c = (await lire(sansTitre)).corps
verifier('sans intitulé, il prend le nom de la matière', c?.titre === 'Contrôle — Structures de données et algorithmique', c?.titre)
verifier('« toute la matière » s\'écrit du chemin du cours', c?.programme.length === 1 && c.programme[0] === COURS_SDA)

console.log('\n— Ce que chacun voit')
cookie = cookieB
let ids = (await liste()).corps.map(x => x.id)
verifier('B (DL) voit le contrôle commun et celui de DL', ids.includes(commun) && ids.includes(dl) && ids.includes(anglais))
verifier('B ne voit pas celui des SR', !ids.includes(pourSr))
verifier('… ni en le demandant par son numéro', (await lire(pourSr)).statut === 404)
verifier('B ne peut pas changer celui de A', (await lire(commun)).corps?.modifiable === false)
r = await api(`/api/controles/${commun}`, { method: 'PATCH', body: valeurs({ titre: 'détourné' }) })
verifier('… et le serveur le refuse', r.statut === 403)
r = await api(`/api/controles/${commun}`, { method: 'DELETE' })
verifier('B ne peut pas le retirer', r.statut === 403)

cookie = cookieSr
ids = (await liste()).corps.map(x => x.id)
verifier('le SR voit le commun et le sien, pas celui des DL', ids.includes(commun) && ids.includes(pourSr) && !ids.includes(dl))

console.log('\n— Retoucher, retirer')
cookie = cookieA
r = await api(`/api/controles/${commun}`, { method: 'PATCH', body: valeurs({ titre: 'Partiel déplacé', jour: jourDans(9) }) })
c = (await lire(commun)).corps
verifier('A le déplace', r.statut === 200 && c.titre === 'Partiel déplacé' && c.joursRestants === 9)
const retraits = []
for (const id of [commun, pourSr, dl, anglais, sansTitre]) retraits.push((await api(`/api/controles/${id}`, { method: 'DELETE' })).statut)
verifier('A retire les siens, celui des SR compris', retraits.every(s => s === 200), retraits.join(','))
const restants = []
for (const id of [commun, pourSr, dl, anglais, sansTitre]) restants.push((await lire(id)).statut)
verifier('… et ils ont disparu', restants.every(s => s === 404), restants.join(','))
cookie = cookieSr
verifier('le SR ne voit plus le sien', (await lire(pourSr)).statut === 404)

console.log(echecs.length ? `\n${echecs.length} échec(s) : ${echecs.join(' ; ')}` : '\nTout est vert.')
process.exit(echecs.length ? 1 : 0)
