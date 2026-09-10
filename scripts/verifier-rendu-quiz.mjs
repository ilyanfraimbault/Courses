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
await page.getByPlaceholder('Pseudo').fill(pseudo)
await page.getByPlaceholder('Mot de passe').fill('motdepasse-de-verification')
await page.getByPlaceholder('Code d\'inscription').fill(CODE)
await page.getByRole('button', { name: /créer|inscrire/i }).first().click()
await page.waitForURL(u => !u.pathname.includes('inscription'), { timeout: 20000 })
verifier('compte créé et connecté', true, page.url())

console.log('\n— Page de préparation')
await page.goto(BASE + '/quiz')
await page.locator('[role="checkbox"]').first().waitFor({ timeout: 30000 })
verifier('les chapitres sont proposés', await page.locator('[role="checkbox"]').count() === 4)
await page.locator('[role="checkbox"]').first().locator('..').getByRole('button').last().click()
await page.waitForTimeout(300)
verifier('les notions se détaillent', await page.getByRole('button', { name: /·/ }).count() > 3)
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
  verifier('la correction est dépliée d\'office sur une faute',
    (await page.locator('.cours-panel-solution').first().innerText()).length > 40)
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
