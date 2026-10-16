/**
 * Vérification des clôtures, contre un vrai serveur et une base à part.
 *
 * Une clôture retire du « tout », jamais du « coché » : c'est la règle qu'on
 * vérifie ici, écran par écran — révisions, catalogue, séances, domaines — puis
 * la réouverture, qui doit tout rendre tel quel, et l'isolation entre comptes.
 * Le temps qui passe se simule en vieillissant les réussites d'un compte jetable
 * dans la base de vérification, comme pour les révisions.
 *
 *   # configuration « cours-verif » de .claude/launch.json lancée
 *   node scripts/verifier-clotures.mjs
 */
import { DatabaseSync } from 'node:sqlite'

const BASE = process.env.QUIZ_BASE ?? 'http://localhost:3000'
const CODE = process.env.NUXT_CODE_INSCRIPTION ?? 'code-de-classe'
const FICHIER = process.env.NUXT_BASE_FICHIER ?? '.data/verif/cours.sqlite'
const MATIERE = '/cours/a1/remise-a-niveau-maths'
const J = 24 * 60 * 60 * 1000

const echecs = []
function verifier(nom, condition, detail = '') {
  console.log(`${condition ? '  ok  ' : ' ÉCHEC'} ${nom}${detail ? ' — ' + detail : ''}`)
  if (!condition) echecs.push(nom)
}

/** Un client par compte : chacun garde son cookie de session. */
function client() {
  let cookie = ''
  return async function api(chemin, options = {}) {
    const r = await fetch(BASE + chemin, {
      ...options,
      headers: { 'content-type': 'application/json', cookie },
      body: options.body ? JSON.stringify(options.body) : undefined
    })
    for (const c of r.headers.getSetCookie?.() ?? []) cookie = c.split(';')[0]
    try {
      return { statut: r.status, corps: await r.json() }
    } catch {
      return { statut: r.status, corps: null }
    }
  }
}

async function inscrire(api, prefixe) {
  const pseudo = prefixe + '-' + Math.random().toString(36).slice(2, 8)
  const r = await api('/api/auth/register', { method: 'POST', body: { pseudo, motDePasse: 'motdepasse-de-verification', code: CODE } })
  if (r.statut >= 400) {
    console.log('Inscription impossible : vérifier NUXT_CODE_INSCRIPTION et la configuration « cours-verif ».')
    process.exit(1)
  }
  return pseudo
}

const a = client()
const pseudoA = await inscrire(a, 'cloture')
const F = '?fuseau=Europe/Paris'

const catalogue = async (api = a) => (await api('/api/quiz/catalogue' + F)).corps.matieres.find(m => m.cle === MATIERE)
const revisions = async () => (await a('/api/revisions' + F)).corps.matieres.find(m => m.cle === MATIERE)
const domaines = async () => (await a('/api/progression/domaines')).corps.matieres.find(m => m.cle === MATIERE)

let cat = await catalogue()
const TRIGO = cat.themes[0].cle
const totalAvant = cat.questions
const trigoAvant = cat.themes[0].questions
console.log(`\nMatière : ${totalAvant} questions, dont ${trigoAvant} dans ${TRIGO}`)

console.log('\n— Mise en place : six questions du chapitre, sues il y a trois jours')
let r = await a('/api/quiz/session', { method: 'POST', body: { matiere: MATIERE, themes: [TRIGO], taille: 6 } })
const session = r.corps.session
const questions = []
for (let p = 0; p < session.taille; p++) questions.push((await a(`/api/quiz/session/${session.id}/question?position=${p}`)).corps.question)
await a(`/api/quiz/session/${session.id}`, { method: 'DELETE' })
const parFiche = new Map()
for (const q of questions) parFiche.set(q.fiche.chemin, [...(parFiche.get(q.fiche.chemin) ?? []), q.id])
for (const [chemin, liste] of parFiche) {
  await a('/api/fiche', { method: 'PUT', body: { chemin, total: 99, faites: Object.fromEntries(liste.map(id => [id, 'a'])) } })
}
const db = new DatabaseSync(FICHIER)
const { id: uidA } = db.prepare('SELECT id FROM utilisateur WHERE pseudo = ?').get(pseudoA)
db.prepare('UPDATE reussite SET premiere = premiere - ?, maj = maj - ? WHERE utilisateur_id = ?').run(3 * J, 3 * J, uidA)
let m = await revisions()
verifier('les six sont à revoir', m.aRevoir === 6, `à revoir ${m.aRevoir}`)
cat = await catalogue()
verifier('le catalogue les compte dans leur chapitre', cat.themes[0].aRevoir === 6 && cat.aRevoir === 6,
  `chapitre ${cat.themes[0].aRevoir}, matière ${cat.aRevoir}`)

console.log('\n— Clore')
r = await a('/api/clotures', { method: 'POST', body: { chemin: '/cours/a1' } })
verifier('une année ne se clôt pas', r.statut === 400, 'statut ' + r.statut)
r = await a('/api/clotures', { method: 'POST', body: { chemin: MATIERE + '/inexistant' } })
verifier('un chemin inventé non plus', r.statut === 400, 'statut ' + r.statut)
r = await a('/api/clotures', { method: 'POST', body: { chemin: TRIGO } })
verifier('le chapitre se clôt', r.statut === 201, 'statut ' + r.statut)
r = await a('/api/clotures', { method: 'POST', body: { chemin: TRIGO } })
verifier('clore deux fois ne change rien', r.statut === 200, 'statut ' + r.statut)
const liste = (await a('/api/clotures')).corps
verifier('la clôture se lit, nommée', liste.length === 1 && liste[0].nature === 'chapitre' && liste[0].titre !== TRIGO,
  JSON.stringify(liste.map(c => [c.nature, c.titre])))

console.log('\n— Ce que la clôture retire du « tout »')
m = await revisions()
verifier('les révisions ne le proposent plus', m.aRevoir === 0, `à revoir ${m.aRevoir}`)
cat = await catalogue()
const theme = cat.themes.find(t => t.cle === TRIGO)
verifier('la matière se compte sans lui', cat.questions <= totalAvant - trigoAvant && cat.questions > 0,
  `${cat.questions} sur ${totalAvant}`)
verifier('le chapitre est marqué clos, et garde son compte entier', theme.clos && theme.questions === trigoAvant && theme.aRevoir === 6)
r = await a('/api/quiz/session' + F, { method: 'POST', body: { matiere: MATIERE, aRevoir: true, taille: 10 } })
verifier('une séance sur toute la matière ne le pose plus', r.statut === 400, 'statut ' + r.statut)
const d = await domaines()
verifier('« Mes domaines » ne le montre plus', !d.chapitres.some(c => c.cle === TRIGO))

console.log('\n— Ce qu\'elle ne retire pas du « coché »')
r = await a('/api/quiz/session' + F, { method: 'POST', body: { matiere: MATIERE, themes: [TRIGO], aRevoir: true, taille: 10 } })
verifier('coché à la main, il est pris en entier', r.statut === 201 && r.corps.session.taille === 6, `taille ${r.corps.session?.taille}`)
await a(`/api/quiz/session/${r.corps.session?.id}`, { method: 'DELETE' })
r = await a('/api/quiz/session' + F, { method: 'POST', body: { matiere: MATIERE, aRevoir: true, ignorerClotures: true, taille: 10 } })
verifier('la séance d\'un contrôle le voit toujours', r.statut === 201 && r.corps.session.taille === 6, `taille ${r.corps.session?.taille}`)
await a(`/api/quiz/session/${r.corps.session?.id}`, { method: 'DELETE' })

console.log('\n— Isolation')
const b = client()
await inscrire(b, 'cloture-b')
verifier('un autre compte n\'en voit rien', (await b('/api/clotures')).corps.length === 0)
const catB = await catalogue(b)
verifier('ni dans son catalogue', !catB.themes.find(t => t.cle === TRIGO).clos && catB.questions === totalAvant)
await b('/api/clotures?chemin=' + encodeURIComponent(TRIGO), { method: 'DELETE' })
verifier('et ne peut pas la rouvrir', (await a('/api/clotures')).corps.length === 1)

console.log('\n— Rouvrir')
r = await a('/api/clotures?chemin=' + encodeURIComponent(TRIGO), { method: 'DELETE' })
verifier('le chapitre se rouvre', r.statut === 204, 'statut ' + r.statut)
m = await revisions()
verifier('les révisions reviennent telles quelles', m.aRevoir === 6, `à revoir ${m.aRevoir}`)
verifier('« Mes domaines » le montre à nouveau', (await domaines()).chapitres.some(c => c.cle === TRIGO))
verifier('la matière retrouve son compte', (await catalogue()).questions === totalAvant)

console.log('\n— Clore la matière entière')
r = await a('/api/clotures', { method: 'POST', body: { chemin: MATIERE } })
verifier('la matière se clôt', r.statut === 201, 'statut ' + r.statut)
verifier('elle sort des révisions', !(await revisions()))
cat = await catalogue()
verifier('son « tout » est vide, ses chapitres restent cochables', cat.clos && cat.questions === 0 && cat.themes.every(t => t.clos && t.questions > 0))
await a('/api/clotures', { method: 'POST', body: { chemin: TRIGO } })
await a('/api/clotures?chemin=' + encodeURIComponent(TRIGO), { method: 'DELETE' })
verifier('rouvrir un chapitre ne perce pas la matière close', (await catalogue()).themes.find(t => t.cle === TRIGO).clos)
await a('/api/clotures?chemin=' + encodeURIComponent(MATIERE), { method: 'DELETE' })
verifier('rouvrir la matière rend tout', (await revisions())?.aRevoir === 6)

console.log(echecs.length ? `\n${echecs.length} échec(s) : ${echecs.join(' ; ')}` : '\nTout est vert.')
process.exit(echecs.length ? 1 : 0)
