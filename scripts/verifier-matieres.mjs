/**
 * Vérification manuelle des matières, des parcours et des moyennes.
 *
 * Le programme semé en base doit retomber sur les totaux du document de
 * l'école ; un compte sans parcours ne voit que le tronc commun ; les notes
 * sont à leur compte et nulle part ailleurs ; une matière ajoutée depuis le
 * site ne se duplique pas.
 *
 *   pnpm dev            # ou la configuration « cours-verif » de .claude/launch.json
 *   node scripts/verifier-matieres.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.QUIZ_BASE ?? 'http://localhost:3000'
const CODE = process.env.NUXT_CODE_INSCRIPTION ?? 'code-de-classe'

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

async function inscrire(prefixe) {
  cookie = ''
  const pseudo = prefixe + '-' + Math.random().toString(36).slice(2, 8)
  const r = await api('/api/auth/register', { method: 'POST', body: { pseudo, motDePasse: 'motdepasse-de-verification', code: CODE } })
  if (r.statut >= 400) {
    console.log('\nInscription impossible : vérifier NUXT_CODE_INSCRIPTION.')
    process.exit(1)
  }
  return cookie
}

/** Les totaux du document de l'école, semestre par semestre (hors UE Entreprise). */
const TOTAUX = { 5: { ects: 20, heures: 360 }, 6: { ects: 20, heures: 360 }, 7: { ects: 20, heures: 303 }, 8: { ects: 16, heures: 327 }, 9: { ects: 20, heures: 450 } }

console.log('\n— Sans parcours')
const cookieA = await inscrire('matieres-a')
let session = (await api('/api/_auth/session')).corps
verifier('la session dit « pas de parcours »', session?.user?.parcours === null)
let notes = (await api('/api/notes')).corps
verifier('le tableau ne montre que le tronc commun', notes.semestres.map(s => s.semestre).join(',') === '5,6,10', notes.semestres.map(s => s.semestre).join(','))
let matieres = (await api('/api/matieres')).corps
verifier('aucune matière d\'un parcours dans la liste', matieres.every(m => m.parcours === null))
// Une coquille dans `programme:` ne lève rien : la matière passe hors
// programme sous son chemin. Chaque code déclaré par un cours doit donc
// retrouver sa ligne, et la ligne son cours.
const declares = readdirSync('content/cours', { recursive: true })
  .map(String)
  .filter(f => f.endsWith('index.md'))
  .map(f => ({ fichier: f, code: /^programme:\s*(\S+)\s*$/m.exec(readFileSync(join('content/cours', f), 'utf8'))?.[1] }))
  .filter(d => d.code)
const perdus = declares.filter(d => !matieres.some(m => m.code === d.code && m.cours))
verifier(`les ${declares.length} codes déclarés par les cours existent au programme`, declares.length > 0 && !perdus.length, perdus.map(d => `${d.fichier} → ${d.code}`).join(', '))
verifier('les cours du site sont reliés au programme',
  matieres.find(m => m.code === 's5-langage-fonctionnel')?.cours === '/cours/a1/mise-a-niveau-c'
  && matieres.find(m => m.code === 'remise-a-niveau-maths')?.cours === '/cours/a1/remise-a-niveau-maths')

console.log('\n— Dire qui l\'on est')
verifier('un profil sans nom est refusé', (await api('/api/compte/profil', { method: 'PUT', body: { prenom: 'Camille', nom: ' ', parcours: 'dl' } })).statut === 400)
await api('/api/compte/profil', { method: 'PUT', body: { prenom: '  Camille ', nom: 'Martin', parcours: 'sr' } })
session = (await api('/api/_auth/session')).corps
verifier('la session rapporte prénom, nom et parcours', session?.user?.prenom === 'Camille' && session.user.nom === 'Martin' && session.user.parcours === 'sr')

console.log('\n— Choisir son parcours')
verifier('un parcours inconnu est refusé', (await api('/api/compte/parcours', { method: 'PUT', body: { parcours: 'reseau' } })).statut === 400)
await api('/api/compte/parcours', { method: 'PUT', body: { parcours: 'dl' } })
session = (await api('/api/_auth/session')).corps
verifier('la session rapporte le parcours choisi', session?.user?.parcours === 'dl')
notes = (await api('/api/notes')).corps
verifier('le S7 apparaît, en DL seulement', notes.semestres.find(s => s.semestre === 7)?.ues.every(ue => ue.parcours === 'dl'))

for (const s of notes.semestres) {
  const t = TOTAUX[s.semestre]
  if (!t) continue
  const ues = s.ues.filter(ue => !ue.code.endsWith('EE'))
  const ects = ues.reduce((n, ue) => n + ue.ects, 0)
  const heures = ues.flatMap(ue => ue.matieres).reduce((n, m) => n + (m.heures ?? 0), 0)
  verifier(`S${s.semestre} : ${t.ects} ECTS et ${t.heures} h, comme le document`, ects === t.ects && heures === t.heures, `${ects} ECTS, ${heures} h`)
}

console.log('\n— Les notes')
const maths = notes.semestres[0].ues[0].matieres[0]
const sr = (await (async () => {
  const c = cookie
  await inscrire('matieres-sr')
  await api('/api/compte/parcours', { method: 'PUT', body: { parcours: 'sr' } })
  const n = (await api('/api/notes')).corps
  const cookieSr = cookie
  cookie = c
  return { matiere: n.semestres.find(s => s.semestre === 7).ues.find(ue => ue.parcours === 'sr').matieres[0], cookie: cookieSr }
})())
verifier('une note hors de 0–20 est refusée', (await api('/api/notes', { method: 'PUT', body: { matiere: maths.id, valeur: 21 } })).statut === 400)
verifier('une note dans une matière SR est refusée à un DL', (await api('/api/notes', { method: 'PUT', body: { matiere: sr.matiere.id, valeur: 12 } })).statut === 400)
await api('/api/notes', { method: 'PUT', body: { matiere: maths.id, valeur: 13.456 } })
notes = (await api('/api/notes')).corps
verifier('la note est retenue, au centième', notes.semestres[0].ues[0].matieres[0].note === 13.46)

cookie = sr.cookie
const vue = (await api('/api/notes')).corps
verifier('un autre compte ne la voit pas', vue.semestres[0].ues[0].matieres[0].note === null)

cookie = cookieA
await api('/api/notes', { method: 'PUT', body: { matiere: maths.id, valeur: null } })
notes = (await api('/api/notes')).corps
verifier('null l\'efface', notes.semestres[0].ues[0].matieres[0].note === null)

console.log('\n— Ajouter une matière')
// Un nom neuf à chaque passage : la base de vérification garde les précédents.
const suffixe = Math.random().toString(36).slice(2, 7)
let r = await api('/api/matieres', { method: 'POST', body: { intitule: `Atelier ${suffixe}` } })
verifier('une matière hors programme se crée', r.statut === 201 && r.corps.code === `libre-atelier-${suffixe}` && r.corps.ue === null, r.corps?.code)
r = await api('/api/matieres', { method: 'POST', body: { intitule: `  ATELIER   ${suffixe.toUpperCase()}` } })
verifier('le même nom, à la casse près, rend la même', r.statut === 200 && r.corps?.code === `libre-atelier-${suffixe}`)
r = await api('/api/matieres', { method: 'POST', body: { intitule: 'anglais' } })
verifier('un nom du programme rend la matière du programme', r.corps?.code === 's5-anglais', r.corps?.code)

console.log(echecs.length ? `\n${echecs.length} échec(s) : ${echecs.join(' ; ')}` : '\nTout est vert.')
process.exit(echecs.length ? 1 : 0)
