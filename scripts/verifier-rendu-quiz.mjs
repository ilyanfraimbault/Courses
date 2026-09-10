/**
 * Vérification du **rendu** du mode quiz, dans un vrai navigateur.
 *
 * Le rendu du quiz ne se vérifie pas au `curl` : la page ne charge rien au rendu
 * serveur, et l'énoncé n'existe qu'après le montage. Et il ne se vérifie pas non
 * plus « à l'œil » : ce qu'il faut compter, ce sont les formules effectivement
 * produites — c'est exactement le témoin qui a démasqué la régression de
 * `remark-mdc` (voir docs/contenu.md).
 *
 * Playwright n'est pas une dépendance du projet, qui n'a pas de tests
 * automatisés par décision. Le script va le chercher là où il est installé :
 *
 *   npm i -g playwright && playwright install chromium
 *   pnpm dev
 *   node scripts/verifier-rendu-quiz.mjs
 *
 * `QUIZ_BASE` change l'adresse visée. `PLAYWRIGHT_MODULE` donne le chemin du
 * module quand il est installé globalement : `import()` ne suit pas `NODE_PATH`,
 * et un `npm i -g` n'est donc pas résolvable autrement.
 */
const BASE = process.env.QUIZ_BASE ?? 'http://localhost:3000'
const CODE = process.env.NUXT_CODE_INSCRIPTION ?? 'code-de-classe'

let chromium
for (const module of [process.env.PLAYWRIGHT_MODULE, 'playwright'].filter(Boolean)) {
  try {
    ({ chromium } = await import(module))
    break
  } catch {
    // On essaie la source suivante.
  }
}
if (!chromium) {
  console.error('Playwright est introuvable. `npm i -g playwright && playwright install chromium`,')
  console.error('puis relancer avec PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs.')
  process.exit(2)
}

const echecs = []
function verifier(nom, condition, detail = '') {
  console.log(`${condition ? '  ok  ' : ' ÉCHEC'} ${nom}${detail ? ' — ' + detail : ''}`)
  if (!condition) echecs.push(nom)
}

const navigateur = await chromium.launch()
const page = await navigateur.newPage({ viewport: { width: 1280, height: 1100 } })
page.on('pageerror', (e) => {
  echecs.push('erreur JS : ' + e.message)
  console.log('   [erreur JS]', e.message)
})
page.on('console', (m) => {
  // Une divergence d'hydratation ne casse rien à l'œil et casse tout à l'usage :
  // elle vaut un échec, pas un haussement d'épaules.
  if (m.type() === 'error' && m.text().includes('Hydration')) {
    echecs.push('divergence d\'hydratation')
    console.log('   [console]', m.text())
  }
})

console.log('\n— Compte jetable')
const pseudo = 'rendu-' + Math.random().toString(36).slice(2, 8)
await page.goto(BASE + '/inscription')
// La page est servie avant d'être hydratée, et en développement l'écart se
// compte en secondes : un `fill` qui arrive trop tôt écrit dans le DOM sans que
// Vue le voie, et le bouton reste désactivé pour toujours. On remplit donc
// jusqu'à ce que le formulaire réponde, plutôt que d'attendre un délai fixe
// qu'une machine plus lente démentira.
const inscrire = page.getByRole('button', { name: /créer|inscrire/i }).first()
for (let essai = 0; essai < 20 && !(await inscrire.isEnabled()); essai++) {
  await page.getByPlaceholder('Pseudo').fill(pseudo)
  await page.getByPlaceholder('Mot de passe').fill('motdepasse-de-verification')
  await page.getByPlaceholder('Code d\'inscription').fill(CODE)
  await page.waitForTimeout(500)
}
await inscrire.click()
await page.waitForURL(u => !u.pathname.includes('inscription'), { timeout: 20000 })
verifier('compte créé et connecté', true, page.url())

console.log('\n— Page de préparation')
await page.goto(BASE + '/quiz')
await page.locator('[role="checkbox"]').first().waitFor({ timeout: 30000 })
const deplier = page.getByRole('button', { name: /^Détailler le plan de/ })
verifier('les chapitres sont proposés', await deplier.count() === 4)
verifier('le tamis des erreurs est proposé',
  await page.getByRole('checkbox', { name: /ce que j'ai raté/i }).count() === 1)
const casesAvant = await page.locator('[role="checkbox"]').count()
await deplier.first().click()
await page.waitForTimeout(300)
verifier('le plan du chapitre se détaille',
  await page.locator('[role="checkbox"]').count() > casesAvant,
  `${casesAvant} → ${await page.locator('[role="checkbox"]').count()} cases`)
await page.getByRole('button', { name: 'Commencer la séance' }).click()
await page.waitForURL(/\/quiz\/\d+/, { timeout: 20000 })

console.log('\n— Rendu de la question')
await page.locator('.cours-enonce p, .cours-enonce .katex').first().waitFor({ timeout: 20000 })
await page.waitForTimeout(400)
const enonce = (await page.locator('.cours-enonce').first().innerText()).trim()
verifier('l\'énoncé est rendu', enonce.length > 10, JSON.stringify(enonce.slice(0, 60)))
verifier('les formules de l\'énoncé sont rendues', await page.locator('.cours-enonce .katex').count() > 0)
verifier('les propositions sont affichées', await page.locator('[role="radiogroup"] [role="radio"]').count() >= 2)
verifier('les formules des propositions sont rendues', await page.locator('[role="radio"] .katex').count() > 0)

console.log('\n— Correction')
await page.locator('[role="radiogroup"] [role="radio"]').first().click()
await page.getByRole('button', { name: /Question suivante|Voir le bilan/ }).waitFor({ timeout: 20000 })
const carte = await page.locator('.cours-body').last().innerText()
verifier('le verdict s\'affiche', /Juste\.|Raté :/.test(carte), carte.split('\n')[0])

if (/Raté :/.test(carte)) {
  const solution = page.locator('.cours-panel-solution').first()
  const corpsSolution = solution.locator('.cours-panel-body').first()
  const texteSolution = (await corpsSolution.innerText()).trim()
  const formulesSolution = await corpsSolution.locator('.katex').count()
  // Une correction peut n'être qu'une formule, et KaTeX la rend dans des nœuds
  // qu'`innerText` ne restitue pas : compter les caractères déclarerait alors
  // vide un panneau déplié et rempli. Le témoin est « visible et porteur de
  // quelque chose » — du texte ou une formule.
  verifier('la correction est dépliée d\'office sur une faute',
    await solution.isVisible() && (texteSolution.length > 40 || formulesSolution > 0),
    `${texteSolution.length} caractères, ${formulesSolution} formule(s)`)
  verifier('les formules de la correction sont rendues',
    await page.locator('.cours-panel-solution .katex').count() > 0)
  verifier('la reprise est annoncée', /revient à la fin/.test(carte))
  const bouton = page.getByRole('button', { name: 'Le rappel de cours' })
  if (await bouton.count()) {
    await bouton.click()
    await page.waitForTimeout(700)
    verifier('le rappel de cours s\'ouvre et est rendu',
      (await page.locator('[role="dialog"]').first().innerText()).length > 40)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  }
} else {
  verifier('la correction reste repliée sur une réussite',
    await page.getByRole('button', { name: 'Voir la correction' }).count() > 0)
}

console.log('\n— Enchaînement et clavier')
const avant = await page.locator('.cours-enonce').first().innerText()
await page.getByRole('button', { name: /Question suivante|Voir le bilan/ }).click()
await page.waitForTimeout(2000)
const apres = await page.locator('.cours-enonce').first().innerText()
verifier('la question change', avant !== apres, JSON.stringify(apres.slice(0, 50)))
verifier('la question suivante est rendue en entier',
  await page.locator('.cours-enonce .katex, [role="radio"] .katex').count() > 0)
await page.keyboard.press('a')
await page.waitForTimeout(1500)
verifier('la touche « a » coche la première proposition',
  await page.getByRole('button', { name: /Question suivante|Voir le bilan/ }).count() > 0)
await page.keyboard.press('Enter')
await page.waitForTimeout(1500)
verifier('la touche Entrée enchaîne',
  (await page.locator('.cours-enonce').first().innerText()) !== apres)

console.log('\n— L\'énoncé commun du bloc')
// On ouvre une séance sur la section du plan complexe, dont les exercices
// portent tous un énoncé commun : la question « Donner l'affixe du vecteur
// M₂M₄ » n'a de sens qu'avec les coordonnées écrites en tête de l'exercice.
await page.setViewportSize({ width: 1280, height: 1100 })
const seance = await page.evaluate(async () => {
  const j = async (u, o) => (await fetch(u, { headers: { 'content-type': 'application/json' }, ...o })).json()
  const catalogue = await j('/api/quiz/catalogue')
  const section = catalogue.themes.flatMap(t => t.sections).find(s => /affixes/i.test(s.titre))
  if (!section) return null
  const { session } = await j('/api/quiz/session', {
    method: 'POST', body: JSON.stringify({ sections: [section.cle], taille: 5 })
  })
  // La section mélange des exercices, qui ouvrent sur une figure, et des
  // questions de QCM, qui portent leur énoncé en entier. On avance jusqu'à la
  // première qui ait un énoncé commun — c'est elle qu'on est venu regarder.
  for (let i = 0; i < 5; i++) {
    const etat = await j('/api/quiz/session/' + session.id)
    if (!etat.question || etat.question.enonceBloc?.length) break
    await j('/api/quiz/session/' + session.id + '/reponse', {
      method: 'POST',
      body: JSON.stringify({ position: etat.question.position, lettre: etat.question.lettres[0] })
    })
  }
  return session.id
})
if (!seance) {
  verifier('la section des affixes existe au catalogue', false)
} else {
  await page.goto(BASE + '/quiz/' + seance)
  await page.locator('.cours-quiz-chapeau').first().waitFor({ timeout: 20000 })
  // Le cadre du chapô paraît avant son contenu : le corps est rendu par
  // `ContentRenderer`, puis KaTeX repasse dessus. Lire à un délai fixe attrape
  // le titre du bloc et rien d'autre, une fois sur deux.
  await page.waitForFunction(
    () => (document.querySelector('.cours-quiz-chapeau .cours-panel-body')?.textContent ?? '').trim().length > 20,
    null,
    { timeout: 20000 })
  const chapeau = (await page.locator('.cours-quiz-chapeau').first().innerText()).trim()
  verifier('l\'énoncé commun s\'affiche au-dessus de la question',
    /repère|figure|M/.test(chapeau), JSON.stringify(chapeau.slice(0, 70)))
  verifier('il est rendu, formules comprises',
    await page.locator('.cours-quiz-chapeau .katex').count() > 0)
  // La question doit rester ce qu'on voit d'abord : plus grande que son chapô.
  const tailles = await page.evaluate(() => {
    const px = s => parseFloat(getComputedStyle(s).fontSize)
    return {
      chapeau: px(document.querySelector('.cours-quiz-chapeau')),
      question: px(document.querySelector('.cours-enonce'))
    }
  })
  verifier('la question reste plus grande que son énoncé rappelé',
    tailles.question > tailles.chapeau, `${tailles.question}px contre ${tailles.chapeau}px`)
  await page.screenshot({ path: 'quiz-enonce-commun.png', fullPage: true })
}

console.log('\n— Une question gagnée est cochée sur sa fiche')
// C'est la demande, et elle se vérifie sur la fiche, pas en base : on gagne une
// question au quiz, puis on ouvre l'exercice d'où elle vient.
const gagnee = await page.evaluate(async () => {
  const j = async (u, o) => (await fetch(u, { headers: { 'content-type': 'application/json' }, ...o })).json()
  const { session } = await j('/api/quiz/session', { method: 'POST', body: JSON.stringify({ taille: 40 }) })
  for (let i = 0; i < 40; i++) {
    const etat = await j(`/api/quiz/session/${session.id}`)
    if (!etat.question) break
    const rep = await j(`/api/quiz/session/${session.id}/reponse`, {
      method: 'POST',
      body: JSON.stringify({ position: etat.question.position, lettre: etat.question.lettres[0] })
    })
    // On attend une question d'**exercice** : sur une page de QCM, une question
    // trouvée ne s'affiche pas en vert dans un `.cours-question` — c'est un
    // autre composant — et le contrôle échouerait sur la forme de la page,
    // jamais sur le report qu'on cherche à vérifier.
    if (rep.correction?.juste && etat.question.nature === 'exercice') {
      return { chemin: etat.question.fiche.chemin, label: etat.question.label }
    }
  }
  return null
})
if (!gagnee) {
  verifier('une question a fini par tomber juste', false)
} else {
  await page.goto(BASE + gagnee.chemin)
  await page.locator('.cours-question').first().waitFor({ timeout: 20000 })
  // La progression est lue au montage, jamais au rendu serveur : on attend
  // qu'elle arrive plutôt que de lire trop tôt un « 0 / N » qui n'a rien à dire.
  await page.locator('.cours-question.border-success').first().waitFor({ timeout: 20000 })
  const compteur = await page.getByText(/questions? trouvées?/).first().innerText()
  verifier('la fiche compte la question gagnée au quiz',
    /\b([1-9]\d*) \/ \d+/.test(compteur), `${compteur.replace(/\s+/g, ' ')} — question ${gagnee.label}`)
  verifier('la question apparaît acquise dans son exercice',
    await page.locator('.cours-question.border-success').count() >= 1)
  await page.screenshot({ path: 'quiz-report-fiche.png', fullPage: false })
}

console.log('\n— Largeur téléphone')
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(500)
const debordement = await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth)
verifier('pas de débordement horizontal', debordement <= 1, debordement + ' px')

console.log('\n— Bilan de fin de séance')
await page.setViewportSize({ width: 1280, height: 1100 })
const bilan = await page.evaluate(async () => {
  const j = async (u, o) => (await fetch(u, { headers: { 'content-type': 'application/json' }, ...o })).json()
  const { session } = await j('/api/quiz/session', { method: 'POST', body: JSON.stringify({ taille: 5 }) })
  let etat = session
  for (let i = 0; i < 300 && !etat.finie; i++) {
    const q = await j(`/api/quiz/session/${session.id}/question?position=${etat.position}`)
    if (!q.question) break
    const r = await j(`/api/quiz/session/${session.id}/reponse`, {
      method: 'POST',
      body: JSON.stringify({ position: etat.position, lettre: q.question.lettres[0] })
    })
    etat = r.session
  }
  return { id: session.id, poses: etat.poses, taille: etat.taille }
})
await page.goto(BASE + '/quiz/' + bilan.id)
await page.getByRole('heading', { name: 'Séance terminée' }).waitFor({ timeout: 20000 })
verifier('le bilan s\'affiche', true, `${bilan.poses} questions posées pour ${bilan.taille} places`)

await navigateur.close()
console.log(`\n${echecs.length ? '✗ ' + echecs.length + ' échec(s) : ' + echecs.join(', ') : '✓ tout est passé'}`)
process.exit(echecs.length ? 1 : 0)
