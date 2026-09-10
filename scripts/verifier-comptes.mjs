/**
 * Vérification de l'authentification multi-comptes et de l'isolation des
 * données entre utilisateurs. Demande un serveur en marche et une base vierge.
 *
 *   pnpm dev
 *   node scripts/verifier-comptes.mjs
 */
const B = 'http://localhost:3000'
const U = '/cours/a1/remise-a-niveau-maths/fonctions-usuelles/exercices'
const CODE = 'code-de-classe'
const ok = []
const ko = []
const check = (nom, cond, detail = '') => (cond ? ok : ko).push(`${cond ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)

function session() {
  let cookie = ''
  return async function req(chemin, opts = {}) {
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
      // pas de corps JSON : le statut suffit
    }
    return { statut: r.status, corps }
  }
}

const alice = session()
const bob = session()
const anon = session()

// --- inscription -----------------------------------------------------------
check('inscription sans code → 403', (await alice('/api/auth/register', {
  method: 'POST', body: JSON.stringify({ pseudo: 'alice', motDePasse: 'motdepasse1' })
})).statut === 403)

check('mot de passe trop court → 400', (await alice('/api/auth/register', {
  method: 'POST', body: JSON.stringify({ pseudo: 'alice', motDePasse: 'court', code: CODE })
})).statut === 400)

check('pseudo invalide → 400', (await alice('/api/auth/register', {
  method: 'POST', body: JSON.stringify({ pseudo: 'a', motDePasse: 'motdepasse1', code: CODE })
})).statut === 400)

const a = await alice('/api/auth/register', {
  method: 'POST', body: JSON.stringify({ pseudo: 'Alice', motDePasse: 'motdepasse1', code: CODE })
})
check('inscription valide → 200', a.statut === 200, JSON.stringify(a.corps))

const doublon = await bob('/api/auth/register', {
  method: 'POST', body: JSON.stringify({ pseudo: 'alice', motDePasse: 'motdepasse2', code: CODE })
})
check('pseudo déjà pris, casse différente → 409', doublon.statut === 409, JSON.stringify(doublon.corps))

const b = await bob('/api/auth/register', {
  method: 'POST', body: JSON.stringify({ pseudo: 'bob', motDePasse: 'motdepasse2', code: CODE })
})
check('second compte → 200', b.statut === 200)

// --- isolation des données -------------------------------------------------
const faitesA = { [`${U}#exercice-1#1.`]: 'c', [`${U}#exercice-1#2.`]: 'a' }
await alice('/api/fiche', { method: 'PUT', body: JSON.stringify({ chemin: U, total: 40, faites: faitesA }) })

const faitesB = { [`${U}#exercice-3#1.`]: 'auto' }
await bob('/api/fiche', { method: 'PUT', body: JSON.stringify({ chemin: U, total: 40, faites: faitesB }) })

const vueA = await alice(`/api/fiche?chemin=${U}`)
const vueB = await bob(`/api/fiche?chemin=${U}`)
check('Alice voit ses 2 questions', Object.keys(vueA.corps.faites).length === 2, JSON.stringify(Object.keys(vueA.corps.faites)))
check('Bob voit la sienne, pas celles d\'Alice', Object.keys(vueB.corps.faites).length === 1, JSON.stringify(Object.keys(vueB.corps.faites)))
check('les deux progressions coexistent', JSON.stringify(vueA.corps.faites) !== JSON.stringify(vueB.corps.faites))

// L'instantané d'Alice ne doit pas élaguer les réussites de Bob
await alice('/api/fiche', { method: 'PUT', body: JSON.stringify({ chemin: U, total: 40, faites: faitesA }) })
check('un instantané n\'élague que son propre compte',
  Object.keys((await bob(`/api/fiche?chemin=${U}`)).corps.faites).length === 1)

// --- to-do -----------------------------------------------------------------
await alice('/api/todo', { method: 'POST', body: JSON.stringify({ chemin: U, bloc: 'exercice-1', titre: 'Exercice 1' }) })
const todoA = await alice('/api/todo')
const todoB = await bob('/api/todo')
check('to-do d\'Alice : 1 item', todoA.corps.length === 1)
check('to-do de Bob : vide', todoB.corps.length === 0, JSON.stringify(todoB.corps))

// Bob ne doit pas pouvoir toucher l'item d'Alice
const idA = todoA.corps[0].id
check('Bob ne peut pas modifier l\'item d\'Alice → 404',
  (await bob(`/api/todo/${idA}`, { method: 'PATCH', body: JSON.stringify({ fait: true }) })).statut === 404)
await bob(`/api/todo/${idA}`, { method: 'DELETE' })
check('Bob ne peut pas supprimer l\'item d\'Alice',
  (await alice('/api/todo')).corps.length === 1)

// --- résumé et export ------------------------------------------------------
const resA = await alice('/api/progression/resume')
const resB = await bob('/api/progression/resume')
check('résumé d\'Alice : 2 réussies', resA.corps[U]?.reussies === 2, JSON.stringify(resA.corps[U]))
check('résumé de Bob : 1 réussie', resB.corps[U]?.reussies === 1, JSON.stringify(resB.corps[U]))

const expA = await alice('/api/resultats/export')
check('export d\'Alice ne contient que ses questions',
  JSON.stringify(expA.corps.fiches[0]?.questions) === JSON.stringify(['exercice-1#1.', 'exercice-1#2.']),
  JSON.stringify(expA.corps.fiches[0]?.questions))

// --- connexion -------------------------------------------------------------
const alice2 = session()
check('connexion avec le bon mot de passe → 200',
  (await alice2('/api/auth/login', { method: 'POST', body: JSON.stringify({ pseudo: 'alice', motDePasse: 'motdepasse1' }) })).statut === 200)
check('connexion insensible à la casse du pseudo',
  Object.keys((await alice2(`/api/fiche?chemin=${U}`)).corps.faites).length === 2)

const mauvais = await session()('/api/auth/login', { method: 'POST', body: JSON.stringify({ pseudo: 'alice', motDePasse: 'faux' }) })
check('mauvais mot de passe → 401', mauvais.statut === 401)
const inconnu = await session()('/api/auth/login', { method: 'POST', body: JSON.stringify({ pseudo: 'personne', motDePasse: 'faux' }) })
check('compte inconnu → 401 (même message)', inconnu.statut === 401
&& inconnu.corps?.statusMessage === mauvais.corps?.statusMessage,
`${inconnu.corps?.statusMessage} / ${mauvais.corps?.statusMessage}`)

check('les données restent inaccessibles sans session', (await anon('/api/fiche?chemin=' + U)).statut === 401)

console.log(JSON.stringify({ reussis: ok.length, echecs: ko.length, ok, ko }, null, 1))
process.exit(ko.length ? 1 : 0)
