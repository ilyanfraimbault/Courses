/**
 * Vérification manuelle des contrôles, de bout en bout.
 *
 * Elle déclare un contrôle sur un vrai chapitre, lit sa feuille de route et en
 * contrôle l'arithmétique — chaque section à apprendre tombe dans une et une
 * seule journée, les derniers jours tiennent leur rôle —, puis elle apprend,
 * rate, compose l'examen blanc, déplace la date, et regarde tout se recalculer.
 * Deux comptes, pour que l'isolation soit vérifiée et non supposée.
 *
 * Comme les autres, elle a besoin d'un serveur qui tourne et d'une base réelle :
 *
 *   pnpm dev            # ou la configuration « cours-verif » de .claude/launch.json
 *   node scripts/verifier-controles.mjs
 */
const BASE = process.env.QUIZ_BASE ?? 'http://localhost:3000'
const CODE = process.env.NUXT_CODE_INSCRIPTION ?? 'code-de-classe'
const FUSEAU = 'Europe/Paris'

const MATIERE = '/cours/a1/remise-a-niveau-maths'
const TRIGO = MATIERE + '/trigonometrie'

/** Les constantes du serveur, recopiées : si elles changent, ce script doit le savoir. */
const QUOTA_MIN = 10
const MORCEAU_MIN = 3
const TAILLE_BLANC = 20

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

/** Le jour qu'il est à Paris, décalé de `n` jours — le calcul que le serveur fait de son côté. */
function jourDans(n) {
  const aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date())
  const d = new Date(aujourdhui + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const lire = id => api(`/api/controles/${id}?fuseau=${encodeURIComponent(FUSEAU)}`)

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

/** Toutes les questions d'une séance, place par place. */
async function questionsDe(session) {
  const questions = []
  for (let p = 0; p < session.taille; p++) {
    questions.push((await api(`/api/quiz/session/${session.id}/question?position=${p}`)).corps.question)
  }
  return questions
}

console.log('\n— Deux comptes jetables')
const cookieB = await inscrire('controle-b')
const cookieA = await inscrire('controle-a')
verifier('inscriptions', !!cookieA && !!cookieB && cookieA !== cookieB)

const catalogue = (await api('/api/quiz/catalogue')).corps
const maths = catalogue.matieres.find(m => m.cle === MATIERE)
const trigo = maths?.themes.find(t => t.cle === TRIGO)
verifier('le chapitre visé existe', !!trigo, `${trigo?.questions} questions`)

console.log('\n— Déclarer un contrôle')
let r = await api('/api/controles', { method: 'POST', body: { titre: 'X', matiere: MATIERE, jour: '2026-02-30', themes: [], sections: [] } })
verifier('une date qui n\'existe pas est refusée', r.statut === 400, r.corps?.statusMessage)
r = await api('/api/controles', { method: 'POST', body: { titre: 'X', matiere: MATIERE, jour: jourDans(3), themes: ['/cours/a1/autre/chapitre'], sections: [] } })
verifier('un chapitre hors de la matière est refusé', r.statut === 400, r.corps?.statusMessage)
r = await api('/api/controles', { method: 'POST', body: { titre: '  ', matiere: MATIERE, jour: jourDans(3), themes: [], sections: [] } })
verifier('un titre vide est refusé', r.statut === 400)
r = await api('/api/controles', { method: 'POST', body: { titre: 'X', matiere: '/cours/a1/inconnue', jour: jourDans(3), themes: [], sections: [] } })
verifier('une matière inconnue est refusée', r.statut === 400)

// Une section de trigonométrie cochée en plus du chapitre : elle y est déjà, le
// serveur doit l'écarter plutôt que de la compter deux fois.
const sectionTrigo = trigo.sections[0].cle
r = await api('/api/controles', {
  method: 'POST',
  body: { titre: 'Contrôle de trigonométrie', matiere: MATIERE, jour: jourDans(10), themes: [TRIGO], sections: [sectionTrigo] }
})
verifier('contrôle créé', r.statut === 201, 'statut ' + r.statut)
const id = r.corps.id

let c = (await lire(id)).corps
verifier('la section déjà couverte par son chapitre est écartée', c.programme.sections.length === 0, JSON.stringify(c.programme))
verifier('le programme compte le chapitre', c.etat.questions === trigo.questions, `${c.etat.questions} / ${trigo.questions}`)
verifier('les sections font le compte du programme',
  c.sections.reduce((n, s) => n + s.questions, 0) === c.etat.questions)
verifier('rien n\'est su sur un compte neuf', c.etat.sues === 0 && c.etat.dette === 0)
verifier('dix jours restants', c.joursRestants === 10, String(c.joursRestants))

console.log('\n— La feuille de route')
verifier('onze journées, d\'aujourd\'hui au jour J', c.feuille.length === 11, String(c.feuille.length))
verifier('les rangs descendent jusqu\'à zéro', c.feuille.every((j, k) => j.rang === 10 - k))
const auRang = n => c.feuille.find(j => j.rang === n)
verifier('J-2 : examen blanc', auRang(2).blanc && !auRang(2).parts.length)
verifier('J-1 : la dette, rien de neuf', auRang(1).dette && !auRang(1).blanc && !auRang(1).parts.length)
verifier('J : la dette, rien de neuf', auRang(0).dette && !auRang(0).parts.length)
const morceaux = c.feuille.flatMap(j => j.parts)
const parSection = new Map()
for (const m of morceaux) parSection.set(m.cle, (parSection.get(m.cle) ?? 0) + m.questions)
verifier('chaque section est planifiée en entier, ni plus ni moins',
  c.sections.every(s => parSection.get(s.cle) === s.restantesCeMatin),
  `${parSection.size} sections planifiées sur ${c.sections.length}`)
const rangs = morceaux.map(m => c.sections.findIndex(s => s.cle === m.cle))
verifier('l\'ordre du cours est gardé', rangs.every((r, k) => k === 0 || r >= rangs[k - 1]))
const coupees = [...new Set(morceaux.map(m => m.cle))].filter(cle => morceaux.filter(m => m.cle === cle).length > 1)
verifier('une section coupée ne laisse pas de miette',
  morceaux.filter(m => coupees.includes(m.cle)).every(m => m.questions >= MORCEAU_MIN),
  `${coupees.length} section(s) étalée(s) sur plusieurs jours`)
const journees = c.feuille.filter(j => j.parts.length)
const utiles = Math.min(8, Math.max(1, Math.ceil(c.etat.questions / QUOTA_MIN)))
verifier('les journées d\'apprentissage se suivent depuis aujourd\'hui',
  journees.every((j, k) => j === c.feuille[k]), journees.map(j => j.rang).join(','))
verifier('pas plus de journées que le quota n\'en demande', journees.length <= utiles, `${journees.length} ≤ ${utiles}`)
const charge = journees.map(j => j.questions)
verifier('la charge d\'une journée est la somme de ses morceaux',
  journees.every(j => j.questions === j.parts.reduce((n, p) => n + p.questions, 0)))
console.log('       charge par journée :', charge.join(' · '))
verifier('les journées sont équilibrées', Math.max(...charge) - Math.min(...charge) <= 2 * MORCEAU_MIN,
  `écart ${Math.max(...charge) - Math.min(...charge)}`)
verifier('aujourd\'hui annonce la charge de sa journée', c.aujourdhui.questions === charge[0] && c.aujourdhui.gagnees === 0)

console.log('\n— La séance du jour')
const duJour = new Set(c.aujourdhui.jour.parts.map(p => p.cle))
r = await api('/api/quiz/session', {
  method: 'POST',
  body: { matiere: MATIERE, sections: [...duJour], nonAcquises: true, taille: Math.max(5, charge[0]) }
})
verifier('séance ouverte', r.statut === 201, 'statut ' + r.statut)
let posees = await questionsDe(r.corps.session)
const sectionDe = new Map()
for (const s of c.sections) sectionDe.set(s.cle, s)
verifier('elle ne pose que les sections du jour',
  posees.every(q => [...duJour].some(cle => sectionDe.get(cle).titre === q.sectionTitre)),
  posees.map(q => q.sectionTitre).filter((v, i, t) => t.indexOf(v) === i).join(' · '))

// On apprend trois questions « sur la fiche » — le serveur ne vérifie pas la
// lettre d'un instantané, et c'est la mémoire qu'on veut voir bouger.
const apprises = posees.slice(0, 3)
const chemin = apprises[0].fiche.chemin
const memeFiche = apprises.filter(q => q.fiche.chemin === chemin)
r = await api('/api/fiche', {
  method: 'PUT',
  body: { chemin, total: 50, faites: Object.fromEntries(memeFiche.map(q => [q.id, 'a'])) }
})
verifier('questions apprises sur la fiche', r.statut === 200, `${memeFiche.length} question(s)`)

const avant = c
c = (await lire(id)).corps
verifier('le programme les compte comme sues', c.etat.sues === memeFiche.length, `${c.etat.sues}`)
verifier('la journée les compte comme gagnées', c.aujourdhui.gagnees === memeFiche.length, `${c.aujourdhui.gagnees}`)
verifier('la journée ne glisse pas : mêmes morceaux, même charge',
  JSON.stringify(c.aujourdhui.jour.parts) === JSON.stringify(avant.aujourdhui.jour.parts)
  && c.aujourdhui.questions === avant.aujourdhui.questions)

r = await api('/api/quiz/session', {
  method: 'POST',
  body: { matiere: MATIERE, sections: [...duJour], nonAcquises: true, taille: 60 }
})
posees = await questionsDe(r.corps.session)
const sues = new Set(memeFiche.map(q => q.id))
verifier('une nouvelle séance du jour ne repose pas ce qui est su', posees.every(q => !sues.has(q.id)),
  `${posees.length} posées`)
const manquent = c.sections.filter(s => duJour.has(s.cle)).reduce((n, s) => n + s.questions - s.sues, 0)
verifier('elle pose tout ce qui manque dans ces sections', posees.length === Math.min(60, manquent),
  `${posees.length} = ${manquent}`)

console.log('\n— Une faute')
r = await api('/api/fautes', { method: 'POST', body: { chemin, questions: [memeFiche[0].id] } })
verifier('faute enregistrée', r.statut === 201)
c = (await lire(id)).corps
verifier('la question ratée passe en dette', c.etat.dette === 1 && c.etat.sues === memeFiche.length - 1,
  `sues ${c.etat.sues}, dette ${c.etat.dette}`)
verifier('elle n\'est plus gagnée aujourd\'hui', c.aujourdhui.gagnees === memeFiche.length - 1)
r = await api('/api/quiz/session', { method: 'POST', body: { matiere: MATIERE, themes: [TRIGO], erreurs: true, taille: 5 } })
verifier('la séance de dette du programme la pose', r.statut === 201 && r.corps.question?.id === memeFiche[0].id)

console.log('\n— L\'examen blanc')
r = await api(`/api/controles/${id}/examen-blanc`, { method: 'POST' })
verifier('examen blanc composé', r.statut === 201, 'statut ' + r.statut)
const qcm = (await api(`/api/mes-qcm/${r.corps.id}`)).corps
verifier(`${TAILLE_BLANC} questions, toutes dans le programme`,
  qcm.questions.length === Math.min(TAILLE_BLANC, c.etat.questions) && qcm.questions.every(q => q.theme === TRIGO),
  `${qcm.questions.length} questions`)
verifier('aucune bonne réponse ne part avec lui', !JSON.stringify(qcm).includes('"bonne"'))
c = (await lire(id)).corps
verifier('le contrôle le retrouve', c.examenBlanc?.id === qcm.id && c.examenBlanc.derniere === null)

console.log('\n— Le temps qui presse')
await api(`/api/controles/${id}`, { method: 'PATCH', body: { jour: jourDans(2) } })
c = (await lire(id)).corps
verifier('à J-2 : tout s\'apprend aujourd\'hui', c.feuille[0].questions === c.sections.reduce((n, s) => n + s.restantesCeMatin, 0))
verifier('à J-2 : examen blanc et dette la veille', c.feuille[1].blanc && c.feuille[1].dette)
await api(`/api/controles/${id}`, { method: 'PATCH', body: { jour: jourDans(1) } })
c = (await lire(id)).corps
verifier('à J-1 : examen blanc et dette aujourd\'hui, rien de neuf',
  c.feuille[0].blanc && c.feuille[0].dette && !c.feuille[0].parts.length)
await api(`/api/controles/${id}`, { method: 'PATCH', body: { jour: jourDans(-3), note: 14.5, bareme: 20 } })
c = (await lire(id)).corps
verifier('une fois passé : ni feuille de route ni journée', c.joursRestants === -3 && !c.feuille.length && c.aujourdhui === null)
verifier('la note est gardée', c.note === 14.5 && c.bareme === 20)
r = await api(`/api/controles/${id}`, { method: 'PATCH', body: { themes: [TRIGO] } })
verifier('un programme à moitié envoyé est refusé', r.statut === 400)
r = await api(`/api/controles/${id}`, { method: 'PATCH', body: { note: -2 } })
verifier('une note négative est refusée', r.statut === 400)

console.log('\n— Cadrage par utilisateur')
cookie = cookieB
verifier('B ne voit pas le contrôle de A', (await lire(id)).statut === 404)
verifier('la liste de B est vide', (await api('/api/controles')).corps.length === 0)
verifier('B ne peut pas le modifier', (await api(`/api/controles/${id}`, { method: 'PATCH', body: { titre: 'volé' } })).statut === 404)
verifier('B ne peut pas le supprimer', (await api(`/api/controles/${id}`, { method: 'DELETE' })).statut === 404)
verifier('B ne peut pas y composer d\'examen blanc', (await api(`/api/controles/${id}/examen-blanc`, { method: 'POST' })).statut === 404)

cookie = cookieA
const liste = (await api('/api/controles')).corps
verifier('la liste de A le porte', liste.length === 1 && liste[0].id === id && !('sections' in liste[0]))
r = await api(`/api/controles/${id}`, { method: 'DELETE' })
verifier('A le supprime', r.statut === 200)
verifier('son examen blanc reste dans « Mes QCM »', (await api(`/api/mes-qcm/${qcm.id}`)).statut === 200)

console.log(echecs.length ? `\n${echecs.length} échec(s) : ${echecs.join(' ; ')}` : '\nTout est vert.')
process.exit(echecs.length ? 1 : 0)
