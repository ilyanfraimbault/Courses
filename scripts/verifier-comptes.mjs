/**
 * Vérification de l'authentification multi-comptes et de l'isolation des
 * données entre utilisateurs. Demande un serveur en marche et une base vierge.
 *
 *   pnpm dev            # avec NUXT_CODE_INSCRIPTION=code-de-classe NUXT_ADMINISTRATEURS=alice
 *   node scripts/verifier-comptes.mjs
 */
const B = process.env.COURS_BASE ?? 'http://localhost:3000'
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
// Sans code, l'inscription crée un compte sans accès (voir plus bas) ; un code
// faux, lui, est refusé plutôt que pris pour une demande.
check('inscription avec un code faux → 403', (await alice('/api/auth/register', {
  method: 'POST', body: JSON.stringify({ pseudo: 'alice', motDePasse: 'motdepasse1', code: 'faux' })
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

// --- administration ----------------------------------------------------------
// Le serveur de vérification nomme « alice » administratrice
// (NUXT_ADMINISTRATEURS, dans la configuration `cours-verif`).
check('administration sans session → 401', (await anon('/api/admin/utilisateurs')).statut === 401)
check('administration hors de la liste → 403', (await bob('/api/admin/utilisateurs')).statut === 403)

const vue = await alice('/api/admin/utilisateurs')
const pseudos = (vue.corps?.utilisateurs ?? []).map(u => u.pseudo).sort()
check('administration → 200, tous les comptes', vue.statut === 200 && pseudos.join() === 'Alice,bob', pseudos.join())
const fiche = vue.corps?.utilisateurs?.find(u => u.pseudo === 'Alice')
check('le compte d\'alice porte ses réussites et son drapeau', fiche?.admin === true && fiche?.acquises === 2,
  JSON.stringify({ admin: fiche?.admin, acquises: fiche?.acquises }))
check('aucun détail de réponse ne sort', !JSON.stringify(vue.corps ?? {}).includes('"reponse"'))

check('la session d\'alice se lit administratrice', (await alice('/api/_auth/session')).corps?.user?.admin === true)
check('celle de bob, non', (await bob('/api/_auth/session')).corps?.user?.admin === false)

// --- accès sur demande -------------------------------------------------------
const carole = session()
const c = await carole('/api/auth/register', {
  method: 'POST', body: JSON.stringify({ pseudo: 'carole', motDePasse: 'motdepasse3' })
})
check('inscription sans code → 200, compte sans accès', c.statut === 200 && c.corps?.acces === 'aucun', JSON.stringify(c.corps))
check('sans accès, la session se lit « aucun »', (await carole('/api/_auth/session')).corps?.user?.acces === 'aucun')
check('sans accès, les données → 403', (await carole(`/api/fiche?chemin=${U}`)).statut === 403)
check('sans accès, l\'écriture → 403', (await carole('/api/fiche', {
  method: 'PUT', body: JSON.stringify({ chemin: U, total: 2, faites: { 'exercice-1#1.': 'a' } })
})).statut === 403)
// Le contenu est gardé comme les données : sans quoi s'inscrire sans code
// suffirait à lire tous les cours.
const DUMP = '/__nuxt_content/cours/sql_dump.txt'
check('sans session, le dump du contenu → 401', (await anon(DUMP)).statut === 401)
check('sans accès, le dump du contenu → 403', (await carole(DUMP)).statut === 403)
const pageSansAcces = await carole(U, { redirect: 'manual' })
check('sans accès, une fiche renvoie à la demande', pageSansAcces.statut === 302,
  `${pageSansAcces.statut}`)
check('le 403 garde la session', (await carole('/api/_auth/session')).corps?.user?.pseudo === 'carole')
check('demande avec un message trop long → 400', (await carole('/api/acces/demande', {
  method: 'POST', body: JSON.stringify({ message: 'x'.repeat(501) })
})).statut === 400)
const d = await carole('/api/acces/demande', { method: 'POST', body: JSON.stringify({ message: 'Carole, de la classe de 1re' }) })
check('demande d\'accès → 200', d.statut === 200 && d.corps?.acces === 'demande', JSON.stringify(d.corps))
check('la session se lit « demande »', (await carole('/api/_auth/session')).corps?.user?.acces === 'demande')
check('demande sans session → 401', (await anon('/api/acces/demande', { method: 'POST', body: '{}' })).statut === 401)

const vue2 = await alice('/api/admin/utilisateurs')
const fCarole = vue2.corps?.utilisateurs?.find(u => u.pseudo === 'carole')
check('l\'administration voit la demande et son message',
  fCarole?.acces === 'demande' && fCarole?.demandeMessage === 'Carole, de la classe de 1re' && typeof fCarole?.demandeLe === 'number',
  JSON.stringify(fCarole))

const idBob = vue2.corps?.utilisateurs?.find(u => u.pseudo === 'bob')?.id
check('décider hors de la liste → 403', (await bob('/api/admin/acces', {
  method: 'POST', body: JSON.stringify({ id: fCarole?.id, decision: 'accorder' })
})).statut === 403)
check('décider sans accès → 403', (await carole('/api/admin/acces', {
  method: 'POST', body: JSON.stringify({ id: fCarole?.id, decision: 'accorder' })
})).statut === 403)
check('décision invalide → 400', (await alice('/api/admin/acces', {
  method: 'POST', body: JSON.stringify({ id: fCarole?.id, decision: 'supprimer' })
})).statut === 400)
check('refuser un compte qui a accès → 404, rien n\'est supprimé', (await alice('/api/admin/acces', {
  method: 'POST', body: JSON.stringify({ id: idBob, decision: 'refuser' })
})).statut === 404 && (await bob(`/api/fiche?chemin=${U}`)).statut === 200)

check('accorder → 200', (await alice('/api/admin/acces', {
  method: 'POST', body: JSON.stringify({ id: fCarole?.id, decision: 'accorder' })
})).statut === 200)
check('l\'accès vaut dès la requête suivante, sans reconnexion', (await carole(`/api/fiche?chemin=${U}`)).statut === 200)
check('accordé, le dump du contenu → 200', (await carole(DUMP)).statut === 200)
check('la session se lit « accorde »', (await carole('/api/_auth/session')).corps?.user?.acces === 'accorde')

const dan = session()
await dan('/api/auth/register', { method: 'POST', body: JSON.stringify({ pseudo: 'dan', motDePasse: 'motdepasse4' }) })
await dan('/api/acces/demande', { method: 'POST', body: '{}' })
const idDan = (await alice('/api/admin/utilisateurs')).corps?.utilisateurs?.find(u => u.pseudo === 'dan')?.id
check('refuser → 200', (await alice('/api/admin/acces', {
  method: 'POST', body: JSON.stringify({ id: idDan, decision: 'refuser' })
})).statut === 200)
check('refusé, la session ne mène plus à rien → 401', (await dan('/api/acces/demande', { method: 'POST', body: '{}' })).statut === 401)
check('refusé, le pseudo redevient libre', (await session()('/api/auth/register', {
  method: 'POST', body: JSON.stringify({ pseudo: 'dan', motDePasse: 'motdepasse4' })
})).statut === 200)

console.log(JSON.stringify({ reussis: ok.length, echecs: ko.length, ok, ko }, null, 1))
process.exit(ko.length ? 1 : 0)
