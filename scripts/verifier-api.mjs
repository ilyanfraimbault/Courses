/**
 * Vérification manuelle de la couche serveur, de bout en bout.
 *
 * Elle n'est pas dans la CI : elle a besoin d'un serveur qui tourne et d'une
 * base réelle, et son rôle est d'être relancée quand on touche au schéma ou aux
 * routes — pas à chaque commit.
 *
 *   pnpm dev            # dans un terminal, avec .env en place
 *   node scripts/verifier-api.mjs
 *
 * Elle écrit dans la base de développement. Attention : elle finit par vider la
 * fiche d'exercices qu'elle utilise.
 */
const B = 'http://localhost:3000'
const CHEMIN = '/cours/a1/remise-a-niveau-maths/fonctions-usuelles/exercices'
const id = (bloc, label) => `${CHEMIN}#${bloc}#${label}`
let cookie = ''
const ok = [], ko = []
const check = (nom, cond, detail = '') => (cond ? ok : ko).push(`${cond ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)

async function req(chemin, opts = {}) {
  const r = await fetch(B + chemin, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...opts.headers }
  })
  const sc = r.headers.getSetCookie?.() ?? []
  if (sc.length) cookie = sc.map(c => c.split(';')[0]).join('; ')
  let corps = null
  try {
    corps = await r.json()
  } catch {
    // réponse sans corps JSON : le statut suffit
  }
  return { statut: r.status, corps }
}

const co = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ motDePasse: 'test-local' }) })
check('connexion avec le bon mot de passe → 200', co.statut === 200, JSON.stringify(co.corps))
if (co.statut !== 200) {
  console.log(JSON.stringify({ ok, ko }, null, 1))
  process.exit(1)
}

// PUT puis GET : aller-retour fidèle
const faites = { [id('exercice-1', '1.')]: 'c', [id('exercice-1', '2.')]: 'a', [id('exercice-3', '1.')]: 'auto' }
const p = await req('/api/fiche', { method: 'PUT', body: JSON.stringify({ chemin: CHEMIN, total: 40, faites }) })
check('PUT /api/fiche → 200', p.statut === 200)

const g = await req(`/api/fiche?chemin=${CHEMIN}`)
check('GET rend le même objet', JSON.stringify(g.corps.faites) === JSON.stringify(faites), JSON.stringify(g.corps.faites))
check('GET rend le total', g.corps.total === 40)

// Élagage : rejouer sans une question la supprime
const moins = { ...faites }
delete moins[id('exercice-1', '2.')]
await req('/api/fiche', { method: 'PUT', body: JSON.stringify({ chemin: CHEMIN, total: 40, faites: moins }) })
const g2 = await req(`/api/fiche?chemin=${CHEMIN}`)
check('élagage : la question retirée disparaît', Object.keys(g2.corps.faites).length === 2, JSON.stringify(g2.corps.faites))

// Identité étrangère rejetée
const mauvais = await req('/api/fiche', { method: 'PUT', body: JSON.stringify({ chemin: CHEMIN, total: 40, faites: { '/autre/fiche#b#1.': 'a' } }) })
check('identité étrangère → 400', mauvais.statut === 400)

// QCM : tentative + plafond
for (let i = 0; i < 3; i++) {
  await req('/api/qcm/tentative', { method: 'POST', body: JSON.stringify({ chemin: CHEMIN, bloc: 'qcm-1', t: 1000 + i, justes: 10 + i, total: 20, ratees: ['3.', '7.'] }) })
}
// doublon exact : ne doit rien ajouter
await req('/api/qcm/tentative', { method: 'POST', body: JSON.stringify({ chemin: CHEMIN, bloc: 'qcm-1', t: 1000, justes: 10, total: 20, ratees: [] }) })
const g3 = await req(`/api/fiche?chemin=${CHEMIN}`)
check('3 tentatives enregistrées, doublon ignoré', g3.corps.qcm['qcm-1']?.length === 3, JSON.stringify(g3.corps.qcm['qcm-1']?.length))
check('tentatives triées par date croissante', g3.corps.qcm['qcm-1']?.[0].t === 1000)

// Plafond à 24
for (let i = 0; i < 30; i++) {
  await req('/api/qcm/tentative', { method: 'POST', body: JSON.stringify({ chemin: CHEMIN, bloc: 'qcm-2', t: 5000 + i, justes: i, total: 20, ratees: [] }) })
}
const g4 = await req(`/api/fiche?chemin=${CHEMIN}`)
check('plafond serveur à 24 tentatives', g4.corps.qcm['qcm-2']?.length === 24, String(g4.corps.qcm['qcm-2']?.length))

// Résumé
const r = await req('/api/progression/resume')
check('résumé : 2 réussies sur 40', r.corps[CHEMIN]?.reussies === 2 && r.corps[CHEMIN]?.total === 40, JSON.stringify(r.corps[CHEMIN]))

// Export
const e = await req('/api/resultats/export')
check('export : format et version', e.corps.format === 'resultats-cours' && e.corps.version === 1)
check('export : questions en bloc#label', JSON.stringify(e.corps.fiches[0]?.questions) === JSON.stringify(['exercice-1#1.', 'exercice-3#1.']), JSON.stringify(e.corps.fiches[0]?.questions))
check('export : maj en ISO', typeof e.corps.fiches[0]?.maj === 'string' && e.corps.fiches[0].maj.includes('T'))

// To-do
const t1 = await req('/api/todo', { method: 'POST', body: JSON.stringify({ chemin: CHEMIN, bloc: 'exercice-1', titre: 'Exercice 1', type: 'exercices' }) })
check('ajout to-do bloc → 201', t1.statut === 201)
check('to-do : reussies calculé côté serveur', t1.corps.reussies === 1, JSON.stringify(t1.corps))
const t1bis = await req('/api/todo', { method: 'POST', body: JSON.stringify({ chemin: CHEMIN, bloc: 'exercice-1', titre: 'Exercice 1' }) })
check('ré-ajout de la même cible → 200 idempotent', t1bis.statut === 200 && t1bis.corps.id === t1.corps.id)
const t2 = await req('/api/todo', { method: 'POST', body: JSON.stringify({ chemin: CHEMIN, titre: 'Toute la fiche', type: 'exercices' }) })
check('ajout to-do fiche entière (bloc null) → 201', t2.statut === 201 && t2.corps.bloc === null)
check('fiche entière : reussies = 2', t2.corps.reussies === 2, String(t2.corps.reussies))

const ordre = await req('/api/todo/ordre', { method: 'PUT', body: JSON.stringify({ ids: [t2.corps.id, t1.corps.id] }) })
check('réordonnancement → 200', ordre.statut === 200)
const liste = await req('/api/todo')
check('ordre appliqué', liste.corps[0].id === t2.corps.id, JSON.stringify(liste.corps.map(i => i.id)))
const mauvaisOrdre = await req('/api/todo/ordre', { method: 'PUT', body: JSON.stringify({ ids: [t1.corps.id] }) })
check('liste incomplète → 400', mauvaisOrdre.statut === 400)

const suppr = await req(`/api/todo/${t1.corps.id}`, { method: 'DELETE' })
check('suppression to-do → 200', suppr.statut === 200)

// Remise à zéro d'une fiche
await req(`/api/fiche?chemin=${CHEMIN}`, { method: 'DELETE' })
const g5 = await req(`/api/fiche?chemin=${CHEMIN}`)
check('« repartir de zéro » vide la fiche', Object.keys(g5.corps.faites).length === 0)

console.log(JSON.stringify({ reussis: ok.length, echecs: ko.length, ok, ko }, null, 1))
process.exit(ko.length ? 1 : 0)
