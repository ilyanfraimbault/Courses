/**
 * Vérification manuelle du mode quiz, de bout en bout.
 *
 * Elle crée deux comptes jetables, joue une séance jusqu'au bout en se trompant
 * exprès, et regarde ce que la file devient. On ne vérifie pas un substitut :
 * les questions posées sont de vraies questions du contenu, et la reprise qui
 * revient à la fin est réellement demandée au serveur.
 *
 * Elle n'est pas dans la CI : elle a besoin d'un serveur qui tourne et d'une
 * base réelle, et son rôle est d'être relancée quand on touche à la banque, au
 * tirage ou aux routes du quiz.
 *
 *   pnpm dev            # dans un terminal, avec .env en place
 *   node scripts/verifier-quiz.mjs
 *
 * `QUIZ_BASE` change l'adresse visée, pour la lancer contre un build de
 * production plutôt que contre le serveur de développement.
 */
const BASE = process.env.QUIZ_BASE ?? 'http://localhost:3000'
const CODE = process.env.NUXT_CODE_INSCRIPTION ?? 'code-de-classe'

// La matière et le chapitre que visent les contrôles ciblés. Un chapitre se
// désigne par son chemin depuis que le site porte plusieurs matières : deux
// d'entre elles pourraient avoir chacune leur « trigonometrie ».
const MATIERE = '/cours/a1/remise-a-niveau-maths'
const TRIGO = MATIERE + '/trigonometrie'

// Le compte de référence de la banque. Il suit le contenu : 432 avec les sept
// QCM de contenu, 312 depuis le retrait des QCM 1 à 6 et de leurs 120 questions.
const BANQUE = 312

/** Toutes les sections du catalogue, toutes matières confondues. */
const sectionsDe = catalogue => catalogue.matieres.flatMap(m => m.themes).flatMap(t => t.sections)

let cookie = ''
const echecs = []

function verifier(nom, condition, detail = '') {
  console.log(`${condition ? '  ok  ' : ' ÉCHEC'} ${nom}${detail ? ' — ' + detail : ''}`)
  if (!condition) echecs.push(nom)
}

/** Tout le texte d'un fragment minimark, pour pouvoir y chercher un mot. */
function texteDe(noeuds) {
  if (typeof noeuds === 'string') return noeuds
  if (!Array.isArray(noeuds)) return ''
  return noeuds.map(texteDe).join(' ')
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

const pseudo = 'quiz-' + Math.random().toString(36).slice(2, 8)

console.log('\n— Compte jetable')
let r = await api('/api/auth/register', { method: 'POST', body: { pseudo, motDePasse: 'motdepasse-de-verification', code: CODE } })
verifier('inscription', r.statut === 200 || r.statut === 201, 'statut ' + r.statut)
if (r.statut >= 400) {
  console.log('\nInscription impossible : vérifier NUXT_CODE_INSCRIPTION.')
  process.exit(1)
}

console.log('\n— Catalogue')
r = await api('/api/quiz/catalogue')
const catalogue = r.corps
verifier('catalogue servi', r.statut === 200)
verifier(`la banque porte ${BANQUE} questions`, catalogue.total === BANQUE, 'total = ' + catalogue.total)
verifier('les matières couvrent toute la banque',
  catalogue.matieres.reduce((n, m) => n + m.questions, 0) === catalogue.total,
  catalogue.matieres.map(m => `${m.titre} (${m.questions})`).join(', '))
const maths = catalogue.matieres.find(m => m.cle === MATIERE)
verifier('la matière porte son année', !!maths?.annee, maths?.annee ?? 'introuvable')
const themes = catalogue.matieres.flatMap(m => m.themes)
verifier('quatre chapitres', maths?.themes.length === 4,
  (maths?.themes ?? []).map(t => `${t.titre} (${t.questions})`).join(', '))
verifier('les chapitres couvrent toute leur matière',
  catalogue.matieres.every(m => m.themes.reduce((n, t) => n + t.questions, 0) === m.questions))
verifier('un chapitre se désigne par son chemin',
  themes.every(t => t.cle.startsWith('/cours/')), themes[0]?.cle)
const sections = themes.flatMap(t => t.sections)
verifier('les sections portent un nom lisible',
  sections.length >= 20 && sections.every(s => s.titre && !s.titre.includes('#')),
  sections.length + ' sections')
// L'invariant qui a motivé le passage au plan du cours : la somme des cases
// d'un chapitre fait le compte du chapitre. Un chiffre qui ne s'additionne pas
// est pire qu'un chiffre absent — c'est ce que faisaient les anciennes
// pastilles, qui laissaient 48 des 77 questions de trigonométrie hors de toute
// case.
verifier('les sections couvrent chaque chapitre sans reste',
  themes.every(t => t.sections.reduce((n, s) => n + s.questions, 0) === t.questions),
  themes.map(t => `${t.titre} ${t.sections.reduce((n, s) => n + s.questions, 0)}/${t.questions}`).join(', '))
verifier('aucun intitulé de section en double dans un chapitre',
  themes.every(t => new Set(t.sections.map(s => s.titre)).size === t.sections.length))

console.log('\n— Une séance sur un seul chapitre')
r = await api('/api/quiz/session', { method: 'POST', body: { matiere: MATIERE, themes: [TRIGO], taille: 10 } })
verifier('séance créée', r.statut === 201, 'statut ' + r.statut)
let session = r.corps.session
const premiere = r.corps.question
verifier('dix places tirées', session.taille === 10 && session.file.length === 10)
verifier('la bonne réponse ne part pas avec la question', !JSON.stringify(premiere).includes('"bonne"'))

const tirees = []
for (let p = 0; p < session.taille; p++) {
  const q = await api(`/api/quiz/session/${session.id}/question?position=${p}`)
  tirees.push(q.corps.question)
}
verifier('les dix places sont dans le chapitre demandé', tirees.every(q => q.theme === TRIGO))
verifier('les questions nomment leur matière', tirees.every(q => q.matiereTitre === maths?.titre), tirees[0]?.matiereTitre)
verifier('aucun doublon dans le tirage', new Set(tirees.map(q => q.id)).size === tirees.length)

console.log('\n— On répond à la première question')
r = await api(`/api/quiz/session/${session.id}/reponse`, { method: 'POST', body: { position: 0, lettre: premiere.lettres[0] } })
verifier('réponse acceptée', r.statut === 200, 'statut ' + r.statut)
const correction = r.corps.correction
session = r.corps.session
verifier('la correction porte la solution rédigée', Array.isArray(correction.solution) && correction.solution.length > 0)
// Toutes les questions ne visent pas un rappel de cours — quarante-huit des
// quatre cent douze n'en ont pas. Ce qui doit tenir, c'est l'équivalence : une
// question qui annonce une notion doit rendre l'extrait correspondant, et
// l'affirmer sur la seule première question tirée rendrait le contrôle
// dépendant du hasard.
verifier(
  'une question qui annonce une notion rend son rappel de cours',
  !premiere.notionTitre || correction.extrait?.titre === premiere.notionTitre,
  premiere.notionTitre ? `${premiere.notionTitre} → ${correction.extrait?.titre ?? 'aucun'}` : 'cette question ne vise aucun rappel')
verifier('le verdict correspond à la lettre donnée', correction.juste === (correction.donnee === correction.bonne))

if (correction.juste) {
  verifier('une réponse juste n\'allonge pas la file', session.longueur === 10)
  verifier('la place est acquise', session.acquises === 1)
} else {
  verifier('une faute allonge la file', session.longueur === 11, 'longueur = ' + session.longueur)
  verifier('la place manquée revient à la fin', session.file.at(-1).place === 1)
  const reprise = await api(`/api/quiz/session/${session.id}/question?position=10`)
  verifier('la reprise n\'est pas la question ratée', reprise.corps.question.id !== premiere.id)
  verifier('la reprise reste dans le chapitre', reprise.corps.question.theme === TRIGO)
}

r = await api(`/api/quiz/session/${session.id}/reponse`, { method: 'POST', body: { position: 0, lettre: premiere.lettres[0] } })
verifier('répondre deux fois à la même place rend une 409', r.statut === 409, 'statut ' + r.statut)

console.log('\n— « Je ne sais pas »')
// C'est une réponse et non une échappatoire : la place doit revenir à la fin de
// la file exactement comme après une faute, et la correction partir quand même.
// Le contrôle porte sur la file, parce que c'est là que se jouerait la
// tricherie — une place passée qui resterait acquise viderait la séance.
const avantPassage = { longueur: session.longueur, poses: session.poses, fautes: session.fautes, place: session.file[session.position].place }
const posee = (await api(`/api/quiz/session/${session.id}/question?position=${session.position}`)).corps.question
r = await api(`/api/quiz/session/${session.id}/reponse`, { method: 'POST', body: { position: posee.position, passee: true } })
verifier('une question se passe sans lettre', r.statut === 200, 'statut ' + r.statut)
if (r.statut === 200) {
  const passee = r.corps.correction
  session = r.corps.session
  verifier('la question passée n\'est pas comptée juste', passee.juste === false && passee.passee === true)
  verifier('aucune réponse n\'est inventée', passee.donnee === null)
  verifier('la bonne réponse est révélée', typeof passee.bonne === 'string' && passee.bonne.length > 0)
  verifier('la correction part avec le verdict',
    Array.isArray(passee.solution) && passee.solution.length > 0)
  verifier('la place passée revient à la fin',
    session.longueur === avantPassage.longueur + 1 && session.file.at(-1).place === avantPassage.place,
    `longueur ${avantPassage.longueur} → ${session.longueur}, place ${session.file.at(-1).place}`)
  verifier('la reprise est annoncée', passee.reprise !== null)
  verifier('une question passée compte comme posée et manquée',
    session.poses === avantPassage.poses + 1 && session.fautes === avantPassage.fautes + 1)
}
r = await api(`/api/quiz/session/${session.id}/reponse`, { method: 'POST', body: { position: session.position } })
verifier('une réponse sans lettre ni aveu est refusée', r.statut === 400, 'statut ' + r.statut)

console.log('\n— On va au bout, en se trompant')
// On répond toujours « la première proposition » : les places tombent juste
// quand la bonne lettre est la première, et les autres reviennent. C'est le
// pire cas raisonnable, et il doit finir.
const vues = new Set(tirees.map(q => q.id))
let tours = 0
while (tours++ < 300) {
  const etat = await api(`/api/quiz/session/${session.id}`)
  session = etat.corps.session
  if (session.finie || !etat.corps.question) break
  const avant = session.longueur
  const rep = await api(`/api/quiz/session/${session.id}/reponse`, {
    method: 'POST',
    body: { position: etat.corps.question.position, lettre: etat.corps.question.lettres[0] }
  })
  if (rep.statut !== 200) {
    verifier('réponse acceptée en cours de séance', false, 'statut ' + rep.statut)
    break
  }
  session = rep.corps.session
  if (session.longueur > avant) {
    const ajoutee = await api(`/api/quiz/session/${session.id}/question?position=${avant}`)
    const q = ajoutee.corps.question
    if (q) {
      if (vues.has(q.id) && !q.rejouee) echecs.push('question déjà vue réintroduite sans le dire')
      vues.add(q.id)
    }
  }
}
verifier('la séance finit par se terminer', session.finie === true,
  `${session.poses} questions posées pour ${session.taille} places`)
verifier('toutes les places sont acquises', session.acquises === session.taille, `${session.acquises} / ${session.taille}`)
verifier('jamais deux fois la même question sans le dire', !echecs.includes('question déjà vue réintroduite sans le dire'))

console.log('\n— Historique')
r = await api('/api/quiz/historique')
verifier('la séance est dans l\'historique', r.corps.sessions.some(s => s.id === session.id))
verifier('aucune séance en cours', r.corps.encours === null)
verifier('« ce qui résiste » est renseigné',
  session.fautes === 0 || r.corps.resistent.length > 0, r.corps.resistent.length + ' sections')
verifier('les sections résistantes portent leur nom du contenu',
  r.corps.resistent.every(s => s.titre && !s.titre.includes('#')), r.corps.resistent[0]?.titre ?? '—')
verifier('ce qui résiste compte des questions en dette',
  r.corps.resistent.every(s => s.enDette > 0 && s.fautes >= s.enDette))

console.log('\n— L\'énoncé commun du bloc')
// « Donner l'affixe du vecteur M₂M₄ » est insoluble sans les coordonnées, qui
// sont écrites une fois en tête de l'exercice. La section « Points, vecteurs et
// affixes » ne vit que dans des blocs qui portent un tel énoncé : le contrôle
// est donc franc, pas statistique.
const affixes = sections.find(s => /affixes/i.test(s.titre))
if (!affixes) {
  verifier('la section des affixes existe au catalogue', false, 'introuvable')
} else {
  r = await api('/api/quiz/session', { method: 'POST', body: { sections: [affixes.cle], taille: 5 } })
  const seance = r.corps.session
  const posees = []
  for (let p = 0; p < seance.taille; p++) {
    const q = await api(`/api/quiz/session/${seance.id}/question?position=${p}`)
    posees.push(q.corps.question)
  }
  // Un énoncé commun est une propriété du **bloc**, pas de la question : toutes
  // les questions d'un même exercice le rendent, ou aucune.
  const parBloc = new Map()
  for (const q of posees) {
    const cle = `${q.fiche.chemin}#${q.fiche.bloc}`
    parBloc.set(cle, [...(parBloc.get(cle) ?? []), q])
  }
  verifier('un énoncé commun vaut pour tout son bloc',
    [...parBloc.values()].every(l => new Set(l.map(q => texteDe(q.enonceBloc))).size === 1),
    `${parBloc.size} blocs`)
  // Les exercices de cette section ouvrent tous sur une figure ou un repère.
  // Un QCM, lui, n'a pas d'énoncé commun : chacune de ses questions porte le
  // sien en entier, et c'est très bien ainsi.
  verifier('les exercices de la section rendent leur énoncé commun',
    posees.filter(q => q.nature === 'exercice').every(q => q.enonceBloc?.length),
    `${posees.filter(q => q.enonceBloc).length} / ${posees.length}, le reste étant des questions de QCM`)
  const texte = posees.map(q => texteDe(q.enonceBloc)).join(' ')
  verifier('l\'énoncé rappelle les données que la question suppose',
    /M_1|figure|repère/.test(texte), texte.slice(0, 90).replace(/\s+/g, ' ') + '…')
}

// Et sur un large tirage, la proportion doit rester dans la bande attendue.
//
// Attention au chiffre de référence : 160 des 432 questions à choix vivent sous
// un énoncé rappelé, soit 37 % de la **banque** — mais un tirage n'en est pas un
// échantillon uniforme. Il s'étale par notion, et les fiches d'entraînement,
// riches en petites notions, y pèsent bien plus que leur part ; les QCM, dont
// les blocs n'ont aucun préambule, aussi. Mesuré sur trois tirages de soixante :
// 17, 20 et 23 %. La bande est donc large et centrée là-dessus. Zéro dirait que
// le relevé est cassé, cent qu'il ramasse ce qui ne lui appartient pas — dont
// les entêtes marquées « introduction ».
r = await api('/api/quiz/session', { method: 'POST', body: { taille: 60 } })
const large = r.corps.session
let avecEnonce = 0
for (let p = 0; p < large.taille; p++) {
  const q = await api(`/api/quiz/session/${large.id}/question?position=${p}`)
  if (q.corps.question?.enonceBloc?.length) avecEnonce += 1
}
const part = Math.round(100 * avecEnonce / large.taille)
verifier('la part de questions à énoncé commun reste plausible',
  part >= 10 && part <= 45, `${part} % sur ${large.taille} tirées`)

// L'autre sens : un bloc qui déclare `entete="introduction"` ne doit rien
// rappeler. Les cinq paliers de la fiche d'entraînement de trigonométrie sont
// tous marqués ainsi ; on tire large dans ce chapitre et on les regarde.
r = await api('/api/quiz/session', { method: 'POST', body: { themes: [TRIGO], taille: 60 } })
const trigo = r.corps.session
const paliers = []
for (let p = 0; p < trigo.taille; p++) {
  const q = await api(`/api/quiz/session/${trigo.id}/question?position=${p}`)
  const item = q.corps.question
  if (item?.fiche.chemin.endsWith('/trigonometrie/entrainement') && item.fiche.blocTitre.startsWith('Palier ')) {
    paliers.push(item)
  }
}
// Non-vacuité affirmée séparément : un contrôle qui ne regarde rien passe
// toujours, et c'est la pire façon d'avoir l'air vert.
verifier('des questions de palier ont bien été tirées', paliers.length > 0, `${paliers.length} tirées`)
verifier('une entête « introduction » n\'est pas rappelée au-dessus des questions',
  paliers.every(q => !q.enonceBloc),
  `${paliers.filter(q => q.enonceBloc).length} en rappellent une`)

console.log('\n— Report sur la fiche')
// Une question gagnée au quiz doit se retrouver cochée dans son exercice. On
// répond jusqu'à en trouver une juste, puis on interroge la fiche elle-même.
r = await api('/api/quiz/session', { method: 'POST', body: { taille: 40 } })
const report = r.corps.session
let gagnee = null
for (let tour = 0; tour < 40 && !gagnee; tour++) {
  const etat = await api(`/api/quiz/session/${report.id}`)
  const q = etat.corps.question
  if (!q) break
  for (const lettre of q.lettres) {
    const rep = await api(`/api/quiz/session/${report.id}/reponse`, {
      method: 'POST', body: { position: q.position, lettre }
    })
    if (rep.statut !== 200) break
    if (rep.corps.correction.juste) gagnee = q
    break
  }
}
if (!gagnee) {
  verifier('une question a fini par tomber juste', false)
} else {
  const fiche = await api(`/api/fiche?chemin=${gagnee.fiche.chemin}`)
  verifier('la question gagnée est cochée sur sa fiche',
    Object.prototype.hasOwnProperty.call(fiche.corps.faites, gagnee.id), gagnee.id)
  verifier('la fiche connaît son dénominateur, pas zéro',
    fiche.corps.total > 0, `total = ${fiche.corps.total}`)
  const resume = await api('/api/progression/resume')
  const ligne = resume.corps[gagnee.fiche.chemin]
  verifier('le tableau de bord voit la réussite',
    !!ligne && ligne.reussies >= 1 && ligne.total >= ligne.reussies,
    ligne ? `${ligne.reussies} / ${ligne.total}` : 'aucune ligne')
}

console.log('\n— L\'ordre des propositions')
// La bonne réponse d'un exercice donné finit par se retenir comme « c'est la
// c ». Le serveur brasse donc l'ordre des propositions, place par place, et de
// façon déterministe : deux lectures d'une même place doivent donner le même
// ordre — sinon il changerait sous les doigts entre la lecture et le clic — et
// sur soixante questions l'ordre de la fiche ne peut pas être conservé partout.
r = await api('/api/quiz/session', { method: 'POST', body: { taille: 60 } })
const brassage = r.corps.session
let melangees = 0
let memeOrdre = true
for (let p = 0; p < brassage.taille; p++) {
  const un = await api(`/api/quiz/session/${brassage.id}/question?position=${p}`)
  const deux = await api(`/api/quiz/session/${brassage.id}/question?position=${p}`)
  const lettres = un.corps.question.lettres
  if (JSON.stringify(lettres) !== JSON.stringify(deux.corps.question.lettres)) memeOrdre = false
  if (JSON.stringify(lettres) !== JSON.stringify([...lettres].sort())) melangees += 1
}
verifier('deux lectures d\'une même place donnent le même ordre', memeOrdre)
verifier('l\'ordre des propositions est brassé',
  melangees >= brassage.taille / 3,
  `${melangees} / ${brassage.taille} questions dans un autre ordre que la fiche`)

console.log('\n— La mémoire des fautes')
// Une faute commise sur une fiche ne passait nulle part : elle mourait dans le
// navigateur. Elle est maintenant une dette, et c'est elle qui donne son
// contenu à « ce que j'ai raté ».
let cat = (await api('/api/quiz/catalogue')).corps
const vierge = sectionsDe(cat).find(x => x.ratees === 0 && x.questions >= 2)
if (!vierge) {
  verifier('une section sans dette existe pour le contrôle', false, 'aucune')
} else {
  r = await api('/api/quiz/session', { method: 'POST', body: { sections: [vierge.cle], taille: 5 } })
  const cible = r.corps.question
  await api(`/api/quiz/session/${r.corps.session.id}`, { method: 'DELETE' })

  r = await api('/api/fautes', {
    method: 'POST',
    body: { chemin: cible.fiche.chemin, questions: [cible.id] }
  })
  verifier('une faute d\'exercice est acceptée', r.statut === 201, 'statut ' + r.statut)

  cat = (await api('/api/quiz/catalogue')).corps
  const apres = sectionsDe(cat).find(x => x.cle === vierge.cle)
  verifier('la faute apparaît au catalogue, dans sa section',
    apres.ratees === 1, `${apres.ratees} à revoir dans « ${apres.titre} »`)

  r = await api('/api/quiz/session', {
    method: 'POST',
    body: { sections: [vierge.cle], erreurs: true, taille: 5 }
  })
  verifier('« ce que j\'ai raté » ne tire que la dette',
    r.statut === 201 && r.corps.session.taille === 1 && r.corps.question.id === cible.id,
    `${r.corps.session?.taille} place(s)`)

  const dette = r.corps.session
  let retrouvee = false
  for (const lettre of cible.lettres) {
    const etat = await api(`/api/quiz/session/${dette.id}`)
    if (!etat.corps.question) break
    const rep = await api(`/api/quiz/session/${dette.id}/reponse`, {
      method: 'POST',
      body: { position: etat.corps.question.position, lettre }
    })
    if (rep.statut === 200 && rep.corps.correction.juste) {
      retrouvee = true
      break
    }
  }
  verifier('la question finit par tomber juste', retrouvee)
  cat = (await api('/api/quiz/catalogue')).corps
  verifier('la retrouver éteint la dette',
    sectionsDe(cat).find(x => x.cle === vierge.cle).ratees === 0)

  // Le même mécanisme depuis une copie de QCM : les questions ratées d'une
  // tentative entrent dans la dette sans que le client ait rien à faire de plus.
  const [, bloc, label] = cible.id.split('#')
  r = await api('/api/qcm/tentative', {
    method: 'POST',
    body: { chemin: cible.fiche.chemin, bloc, justes: 0, total: 1, ratees: [label] }
  })
  verifier('une copie de QCM est acceptée', r.statut === 201, 'statut ' + r.statut)
  cat = (await api('/api/quiz/catalogue')).corps
  verifier('les ratées d\'un QCM entrent dans la dette',
    sectionsDe(cat).find(x => x.cle === vierge.cle).ratees === 1)
}

console.log('\n— Mes QCM')
// Un QCM composé emprunte ses questions aux fiches. On en compose un par tirage,
// on le relit, on rend une copie blanche puis une copie à moitié juste, et on
// regarde ce qu'elles ont laissé là où ça compte : sur les fiches et dans la
// dette. Le serveur corrige ; le script ne connaît les bonnes réponses que par
// la première correction, comme quelqu'un qui aurait lu son corrigé.
r = await api('/api/mes-qcm/tirage', { method: 'POST', body: { matiere: MATIERE, themes: [TRIGO], taille: 6 } })
const proposees = r.corps ?? []
verifier('le tirage propose le nombre demandé', r.statut === 200 && proposees.length === 6, 'statut ' + r.statut)
verifier('le tirage reste dans le chapitre demandé', proposees.every(q => q.theme === TRIGO))
r = await api('/api/mes-qcm/tirage', {
  method: 'POST',
  body: { matiere: MATIERE, themes: [TRIGO], taille: 6, exclues: proposees.map(q => q.id) }
})
verifier('un second tirage ne repropose rien de ce qui est retenu',
  r.statut === 200 && r.corps.every(q => !proposees.some(p => p.id === q.id)))
r = await api('/api/mes-qcm/tirage', { method: 'POST', body: { taille: 6 } })
verifier('un tirage sans matière est refusé', r.statut === 400, 'statut ' + r.statut)

r = await api('/api/mes-qcm/candidates?matiere=' + encodeURIComponent(MATIERE))
verifier('le choix à la main voit toute la matière', r.statut === 200 && r.corps.length === maths?.questions,
  `${r.corps?.length} / ${maths?.questions}`)

r = await api('/api/mes-qcm/apercu?id=' + encodeURIComponent(proposees[0]?.id ?? ''))
verifier('l\'aperçu rend l\'énoncé sans la bonne réponse',
  r.statut === 200 && Array.isArray(r.corps.enonce) && !JSON.stringify(r.corps).includes('"bonne"'))

r = await api('/api/mes-qcm', { method: 'POST', body: { titre: '   ', matiere: MATIERE, questions: [proposees[0]?.id] } })
verifier('un QCM sans titre est refusé', r.statut === 400, 'statut ' + r.statut)
r = await api('/api/mes-qcm', { method: 'POST', body: { titre: 'Inconnue', matiere: MATIERE, questions: ['/cours/nulle-part#bloc#1.'] } })
verifier('une question inconnue du contenu est refusée', r.statut === 400, 'statut ' + r.statut)

r = await api('/api/mes-qcm', {
  method: 'POST',
  body: { titre: 'Contrôle de vérification', matiere: MATIERE, questions: [...proposees.map(q => q.id), proposees[0]?.id] }
})
verifier('le QCM est créé', r.statut === 201 && Number.isInteger(r.corps?.id), 'statut ' + r.statut)
const idQcm = r.corps?.id

r = await api(`/api/mes-qcm/${idQcm}`)
const compose = r.corps
verifier('le QCM rend ses questions dans l\'ordre choisi, sans doublon',
  compose?.questions?.map(q => q.id).join('|') === proposees.map(q => q.id).join('|'))
verifier('aucune bonne réponse ne part avec le QCM', !JSON.stringify(compose).includes('"bonne"'))
verifier('chaque question porte sa référence à la fiche',
  compose?.questions?.every(q => q.fiche.chemin.startsWith(TRIGO) && q.fiche.blocTitre && q.label))
const relu = (await api(`/api/mes-qcm/${idQcm}`)).corps
verifier('l\'ordre des propositions ne change pas d\'une ouverture à l\'autre',
  JSON.stringify(relu?.questions?.map(q => q.lettres)) === JSON.stringify(compose?.questions?.map(q => q.lettres)))

const t1 = Date.now()
r = await api(`/api/mes-qcm/${idQcm}/copie`, { method: 'POST', body: { reponses: {}, t: t1 } })
verifier('une copie blanche est corrigée, zéro juste', r.statut === 201 && r.corps.copie.justes === 0 && r.corps.copie.total === 6,
  `${r.corps?.copie?.justes} / ${r.corps?.copie?.total}`)
const corrections = r.corps?.corrections ?? {}
verifier('la correction révèle bonne réponse et solution, sans rien inventer',
  Object.values(corrections).length === 6
  && Object.values(corrections).every(c => c.bonne && c.passee && c.donnee === null && Array.isArray(c.solution)))
await api(`/api/mes-qcm/${idQcm}/copie`, { method: 'POST', body: { reponses: {}, t: t1 } })
verifier('rendre deux fois la même copie ne l\'enregistre qu\'une fois',
  (await api(`/api/mes-qcm/${idQcm}`)).corps?.copies?.length === 1)

const dettes = async () => new Map(((await api('/api/mes-qcm/candidates?matiere=' + encodeURIComponent(MATIERE))).corps ?? [])
  .map(c => [c.id, c.enDette]))
let enDette = await dettes()
verifier('les questions laissées blanches entrent dans la dette', proposees.every(p => enDette.get(p.id) === true))

const moitie = Object.fromEntries(proposees.slice(0, 3).map(p => [p.id, corrections[p.id]?.bonne]))
r = await api(`/api/mes-qcm/${idQcm}/copie`, { method: 'POST', body: { reponses: moitie, t: t1 + 1 } })
verifier('une copie à moitié juste compte trois justes', r.statut === 201 && r.corps.copie.justes === 3,
  `${r.corps?.copie?.justes} / ${r.corps?.copie?.total}`)
const cochee = await api(`/api/fiche?chemin=${encodeURIComponent(proposees[0].chemin)}`)
verifier('une question juste est cochée sur sa fiche',
  Object.prototype.hasOwnProperty.call(cochee.corps?.faites ?? {}, proposees[0].id), proposees[0].id)
verifier('la fiche garde son dénominateur', cochee.corps?.total > 0, `total = ${cochee.corps?.total}`)
enDette = await dettes()
verifier('une question juste éteint sa dette, une ratée la garde',
  enDette.get(proposees[0].id) === false && enDette.get(proposees[5].id) === true)

r = await api(`/api/mes-qcm/${idQcm}/copie`, { method: 'POST', body: { reponses: { [proposees[0].id]: 'z' }, t: t1 + 2 } })
verifier('une proposition qui n\'existe pas est refusée', r.statut === 400, 'statut ' + r.statut)

r = await api('/api/mes-qcm')
const resumeQcm = r.corps?.find(q => q.id === idQcm)
verifier('la liste résume le dernier passage', resumeQcm?.derniere?.justes === 3 && resumeQcm?.copies === 2,
  `${resumeQcm?.derniere?.justes} justes, ${resumeQcm?.copies} copies`)
r = await api(`/api/mes-qcm/${idQcm}`, { method: 'PATCH', body: { titre: 'Contrôle renommé' } })
verifier('un QCM se renomme', r.statut === 200 && (await api(`/api/mes-qcm/${idQcm}`)).corps?.titre === 'Contrôle renommé')

console.log('\n— Cadrage par utilisateur')
const cookieA = cookie
cookie = ''
await api('/api/auth/register', {
  method: 'POST',
  body: { pseudo: pseudo + '-b', motDePasse: 'motdepasse-de-verification', code: CODE }
})
r = await api(`/api/quiz/session/${session.id}`)
verifier('la séance d\'un autre compte est introuvable', r.statut === 404, 'statut ' + r.statut)
r = await api(`/api/mes-qcm/${idQcm}`)
verifier('le QCM composé d\'un autre compte est introuvable', r.statut === 404, 'statut ' + r.statut)
r = await api(`/api/mes-qcm/${idQcm}/copie`, { method: 'POST', body: { reponses: {} } })
verifier('on ne rend pas de copie sur le QCM d\'un autre', r.statut === 404, 'statut ' + r.statut)
r = await api(`/api/mes-qcm/${idQcm}`, { method: 'DELETE' })
verifier('on ne supprime pas le QCM d\'un autre', r.statut === 404, 'statut ' + r.statut)
r = await api('/api/mes-qcm')
verifier('la liste d\'un compte neuf est vide', r.statut === 200 && r.corps.length === 0)
r = await api('/api/quiz/historique')
verifier('historique vierge pour un compte neuf', r.corps.sessions.length === 0)
cookie = cookieA

const anonyme = await fetch(BASE + '/api/quiz/catalogue')
verifier('le catalogue exige une session', anonyme.status === 401, 'statut ' + anonyme.status)

console.log('\n— Filtres')
const section = sections.slice().sort((a, b) => b.questions - a.questions)[0]
r = await api('/api/quiz/session', { method: 'POST', body: { sections: [section.cle], taille: 5 } })
verifier('séance sur une seule section', r.statut === 201 && r.corps.question.sectionTitre === section.titre,
  `${section.titre} — ${r.corps.session?.taille} places`)
// Le lien venu de « Mes domaines » : le catalogue n'affiche plus les points de
// cours, mais il les porte toujours sous leur section. Sans eux, le bouton
// « m'interroger là-dessus » de cette page ouvrirait une séance sur tout le
// programme sans rien dire.
const point = sections.flatMap(sec => sec.notions).sort((a, b) => b.questions - a.questions)[0]
if (!point) {
  verifier('le catalogue porte les points de cours', false, 'aucun')
} else {
  r = await api('/api/quiz/session', { method: 'POST', body: { notions: [point.cle], taille: 5 } })
  const surLePoint = []
  for (let p = 0; p < (r.corps.session?.taille ?? 0); p++) {
    const q = await api(`/api/quiz/session/${r.corps.session.id}/question?position=${p}`)
    surLePoint.push(q.corps.question)
  }
  verifier('une séance sur un point de cours ne pose que lui',
    r.statut === 201 && surLePoint.length > 0 && surLePoint.every(q => q.notionTitre === point.titre),
    `${point.titre} — ${r.corps.session?.taille} places`)
}

r = await api('/api/quiz/session', { method: 'POST', body: { themes: ['inexistant'], taille: 10 } })
verifier('un filtre sans question est refusé', r.statut === 400, 'statut ' + r.statut)
r = await api('/api/quiz/session', { method: 'POST', body: { taille: 999 } })
verifier('une taille hors bornes est refusée', r.statut === 400, 'statut ' + r.statut)

console.log('\n— Étalement du tirage')
r = await api('/api/quiz/session', { method: 'POST', body: { taille: 40 } })
const grande = r.corps.session
const repartition = {}
for (let p = 0; p < grande.taille; p++) {
  const q = await api(`/api/quiz/session/${grande.id}/question?position=${p}`)
  repartition[q.corps.question.theme] = (repartition[q.corps.question.theme] ?? 0) + 1
}
console.log('       ' + JSON.stringify(repartition))
verifier('les quatre chapitres sont représentés', Object.keys(repartition).length === 4)
verifier('aucun chapitre n\'écrase les autres', Math.max(...Object.values(repartition)) <= 14)

console.log(`\n${echecs.length ? '✗ ' + echecs.length + ' échec(s) : ' + echecs.join(', ') : '✓ tout est passé'}`)
process.exit(echecs.length ? 1 : 0)
