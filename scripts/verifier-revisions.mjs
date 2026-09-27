/**
 * Vérification de la révision espacée, en deux temps.
 *
 * **La règle**, d'abord, sans serveur : `planifier` est une fonction pure, et
 * Node 24 charge le TypeScript du serveur tel quel. On lui fait rejouer des
 * histoires écrites à la main et on regarde les paliers.
 *
 * **Le branchement**, ensuite, contre un vrai serveur : une révision ne se
 * vérifie qu'avec du temps qui passe, et on ne va pas attendre trois jours. On
 * vieillit donc les réussites d'un compte jetable **dans la base de
 * vérification** — celle de la configuration « cours-verif », jamais une autre —
 * puis on regarde ce que l'accueil et le quiz en font.
 *
 *   # configuration « cours-verif » de .claude/launch.json lancée
 *   node scripts/verifier-revisions.mjs
 */
import { DatabaseSync } from 'node:sqlite'
import { INTERVALLES, planifier } from '../server/utils/revisions.ts'

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

console.log('\n— La règle')
const juste = t => ({ t: t * J, juste: true })
const faux = t => ({ t: t * J, juste: false })
let e = planifier([juste(0)])
verifier('trouvée : revient le lendemain', e.palier === 0 && e.echeance === 1 * J)
e = planifier([juste(0), juste(1)])
verifier('retrouvée le lendemain : dans trois jours', e.palier === 1 && e.echeance === 4 * J, `palier ${e.palier}`)
e = planifier([juste(0), juste(0.1), juste(0.2), juste(0.3)])
verifier('réussie quatre fois dans la même heure : toujours le lendemain', e.palier === 0 && e.echeance === 1 * J)
e = planifier([juste(0), juste(1), juste(4), juste(11), juste(27), juste(62), juste(152), juste(300)])
verifier('le dernier palier plafonne', e.palier === INTERVALLES.length - 1, `palier ${e.palier}`)
verifier('une faute sort la question du calendrier', planifier([juste(0), juste(1), faux(3)]) === null)
e = planifier([juste(0), juste(1), faux(3), juste(3.5)])
verifier('retrouvée après une faute : repart du début', e.palier === 0 && e.echeance === 4.5 * J)
e = planifier([juste(1), juste(0)])
verifier('l\'ordre d\'arrivée ne compte pas, seule la date', e.palier === 1)
verifier('jamais trouvée : hors du calendrier', planifier([faux(0)]) === null && planifier([]) === null)
// Une faute et une réussite au même instant : la réussite l'emporte. C'est ce
// qu'écrit la mémoire des fautes quand une question est rattrapée dans la
// milliseconde où la faute a été enregistrée — cas d'une copie importée.
verifier('faute et réussite simultanées : sue', planifier([juste(0), faux(2), juste(2)])?.palier === 0)

console.log('\n— Le branchement')
let cookie = ''
async function api(chemin, options = {}) {
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

const pseudo = 'revision-' + Math.random().toString(36).slice(2, 8)
let r = await api('/api/auth/register', { method: 'POST', body: { pseudo, motDePasse: 'motdepasse-de-verification', code: CODE } })
if (r.statut >= 400) {
  console.log('Inscription impossible : vérifier NUXT_CODE_INSCRIPTION et la configuration « cours-verif ».')
  process.exit(1)
}

const revisions = async () => (await api('/api/revisions?fuseau=Europe/Paris')).corps.matieres.find(m => m.cle === MATIERE)
let m = await revisions()
verifier('un compte neuf n\'a rien à revoir', m.aRevoir === 0 && m.suivies === 0 && m.enDette === 0)

// Six questions trouvées sur une fiche : on les prend dans une séance, pour
// avoir de vraies identités interrogeables.
r = await api('/api/quiz/session', { method: 'POST', body: { matiere: MATIERE, taille: 6 } })
const session = r.corps.session
const ids = []
for (let p = 0; p < session.taille; p++) ids.push((await api(`/api/quiz/session/${session.id}/question?position=${p}`)).corps.question)
await api(`/api/quiz/session/${session.id}`, { method: 'DELETE' })
const parFiche = new Map()
for (const q of ids) parFiche.set(q.fiche.chemin, [...(parFiche.get(q.fiche.chemin) ?? []), q.id])
for (const [chemin, liste] of parFiche) {
  await api('/api/fiche', { method: 'PUT', body: { chemin, total: 99, faites: Object.fromEntries(liste.map(id => [id, 'a'])) } })
}

m = await revisions()
verifier('trouvées aujourd\'hui : suivies, rien à revoir', m.suivies === 6 && m.aRevoir === 0, `suivies ${m.suivies}`)
verifier('elles reviennent demain', m.demain === 6, `demain ${m.demain}`)

// Le temps passe : trois jours en arrière pour ces six réussites.
const db = new DatabaseSync(FICHIER)
const { id: uid } = db.prepare('SELECT id FROM utilisateur WHERE pseudo = ?').get(pseudo)
db.prepare('UPDATE reussite SET premiere = premiere - ?, maj = maj - ? WHERE utilisateur_id = ?').run(3 * J, 3 * J, uid)

m = await revisions()
verifier('trois jours plus tard : les six sont à revoir', m.aRevoir === 6 && m.demain === 0, `à revoir ${m.aRevoir}`)

r = await api('/api/quiz/session?fuseau=Europe/Paris', { method: 'POST', body: { matiere: MATIERE, aRevoir: true, taille: 20 } })
verifier('la séance de révisions s\'ouvre', r.statut === 201, 'statut ' + r.statut)
const revision = r.corps.session
verifier('elle ne pose que ce qui est dû', revision.taille === 6, `taille ${revision.taille}`)
const posee = r.corps.question
verifier('la première question est l\'une des six', ids.some(q => q.id === posee.id))

// Une faute pendant la révision : la question sort du calendrier et entre dans
// la dette.
r = await api(`/api/quiz/session/${revision.id}/reponse`, { method: 'POST', body: { position: 0, passee: true } })
verifier('réponse enregistrée', r.statut === 200, 'statut ' + r.statut)
m = await revisions()
verifier('la question ratée quitte les révisions', m.aRevoir === 5, `à revoir ${m.aRevoir}`)
verifier('elle entre dans la dette', m.enDette === 1, `en dette ${m.enDette}`)

const historique = (await api('/api/quiz/historique')).corps
const libelle = historique.encours?.themes?.[0] ?? historique.sessions.find(s => s.id === revision.id)?.themes?.[0]
verifier('l\'historique nomme la séance', libelle === 'Révisions du jour', libelle)

r = await api('/api/quiz/session?fuseau=Europe/Paris', { method: 'POST', body: { matiere: '/cours/a1/autre-matiere', aRevoir: true, taille: 5 } })
verifier('rien à revoir hors de la matière', r.statut === 400)

console.log(echecs.length ? `\n${echecs.length} échec(s) : ${echecs.join(' ; ')}` : '\nTout est vert.')
process.exit(echecs.length ? 1 : 0)
