/**
 * Le contrôle du contenu, en une commande.
 *
 * Les défauts du contenu ne lèvent jamais rien : une question hors bloc
 * s'affiche et ne sert à rien, un `cours=` mal orthographié laisse un bouton
 * « Cours » qui n'ouvre rien, deux blocs au même titre partagent en silence la
 * progression de leurs questions, une bonne réponse « e » sur quatre
 * propositions rend la question impossible à réussir. Ce script cherche ces
 * pannes-là, une par une, dans l'arbre que le build a réellement produit — pas
 * dans la source, qu'un parseur peut lire autrement que nous.
 *
 * Il lit la base de contenu que `pnpm dev` ou `pnpm build` écrit
 * (`.data/content/contents.sqlite`) : lancer l'un des deux d'abord, après
 * chaque modification du contenu.
 *
 *   node scripts/verifier-contenu.mjs                       # tout le site
 *   node scripts/verifier-contenu.mjs /cours/a2/physique    # une matière, un chapitre
 *   node scripts/verifier-contenu.mjs --rendu               # + rendu contre comptage (serveur lancé)
 *
 * Sort en erreur s'il trouve une **erreur** ; les **avertissements** signalent
 * ce qui marche mais dessert l'élève — une question sans indice, par exemple.
 */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
// Le correcteur lui-même, et non une copie : Node lit son TypeScript tel quel.
import { corrigerCommande, erreurAttendue } from '../shared/utils/commandes.ts'

const BASE = process.env.QUIZ_BASE ?? 'http://localhost:3000'
const args = process.argv.slice(2)
const rendu = args.includes('--rendu')
const prefixe = args.find(a => a.startsWith('/')) ?? '/cours'

const BALISES_QUESTION = new Set(['exo-question', 'qcm-question', 'question'])
const BALISES_BLOC = new Set(['exercice', 'qcm'])
const LETTRES = ['a', 'b', 'c', 'd', 'e']

/**
 * La même fonction que `app/utils/cours.ts`, recopiée : ce script tourne sous
 * Node nu, sans le transpileur de Nuxt. Si elle diverge, le contrôle « deux
 * blocs au même titre » ment — d'où la comparaison avec le relevé du build
 * plus bas, qui la trahirait.
 */
function slugifier(texte) {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const canon = c => (c ?? '').replace(/\/+$/, '') || '/'

const erreurs = []
const avertissements = []
const erreur = (chemin, message) => erreurs.push(`${chemin} — ${message}`)
const avertir = (chemin, message) => avertissements.push(`${chemin} — ${message}`)

let db
try {
  db = new DatabaseSync('.data/content/contents.sqlite', { readOnly: true })
} catch {
  console.log('Base de contenu introuvable : lancer `pnpm dev` ou `pnpm build` d\'abord.')
  process.exit(2)
}

const pages = db.prepare('SELECT path, title, type, questions, blocs, sections, releve, body FROM _content_cours').all()
  .map(p => ({
    ...p,
    chemin: canon(p.path),
    blocs: JSON.parse(p.blocs ?? '{}'),
    sections: JSON.parse(p.sections ?? '{}'),
    releve: JSON.parse(p.releve ?? '[]'),
    corps: JSON.parse(p.body ?? '{}').value ?? []
  }))
const parChemin = new Map(pages.map(p => [p.chemin, p]))
const visees = pages.filter(p => p.chemin === prefixe || p.chemin.startsWith(prefixe + '/'))
if (!visees.length) {
  console.log(`Aucune page sous ${prefixe}.`)
  process.exit(2)
}

/** Le texte nu d'un nœud, pour nommer une question dans un message. */
function texte(noeud) {
  if (typeof noeud === 'string') return noeud
  if (!Array.isArray(noeud)) return ''
  if (noeud[0] === 'annotation') return noeud.slice(2).join('')
  if (noeud[0] === 'span' && noeud[1]?.className?.includes?.('katex-html')) return ''
  return noeud.slice(2).map(texte).join('')
}

function parcourir(noeuds, visite, parents = []) {
  if (!Array.isArray(noeuds)) return
  for (const n of noeuds) {
    if (!Array.isArray(n)) continue
    visite(n, parents)
    parcourir(n.slice(2), visite, [...parents, n])
  }
}

/** Les slots d'une question : `#a`, `#indice`… arrivent en `template v-slot:…`. */
function slotsDe(noeud) {
  const slots = new Set()
  for (const enfant of noeud.slice(2)) {
    if (!Array.isArray(enfant) || enfant[0] !== 'template') continue
    for (const cle of Object.keys(enfant[1] ?? {})) if (cle.startsWith('v-slot:')) slots.add(cle.slice(7))
  }
  return slots
}

const totaux = new Map()

for (const page of visees) {
  const c = page.chemin
  let questions = 0
  const identites = new Map()
  const blocsVus = new Map()
  const extraits = new Map()

  parcourir(page.corps, (n) => {
    if (n[0] === 'extrait-cours') {
      const { id, titre, source } = n[1] ?? {}
      if (!id || !titre) erreur(c, `extrait-cours sans id ou sans titre (${id ?? titre ?? '?'})`)
      else if (extraits.has(id)) erreur(c, `deux extrait-cours portent l'id « ${id} » : le bouton Cours n'ouvrira que le premier`)
      else extraits.set(id, { titre, source })
    }
  })

  parcourir(page.corps, (n, parents) => {
    const [balise, props = {}] = n
    if (BALISES_BLOC.has(balise)) {
      if (!props.titre) {
        erreur(c, `un bloc ${balise} sans titre : ses questions n'ont pas d'identité, donc pas de mémoire`)
        return
      }
      const slug = slugifier(props.titre)
      if (blocsVus.has(slug)) {
        erreur(c, `deux blocs ont le même titre une fois réduit (« ${props.titre} » et « ${blocsVus.get(slug)} ») : leurs questions partageraient la même progression`)
      }
      blocsVus.set(slug, props.titre)
    }

    if (balise === 'carte-lien' && props.to?.startsWith('/cours')) {
      const cible = parChemin.get(canon(props.to.split('#')[0]))
      if (!cible) erreur(c, `carte-lien vers une page qui n'existe pas : ${props.to}`)
      // La mention « 11 questions » d'une carte s'écrit à la main : elle ment
      // dès qu'on ajoute une question à la fiche visée.
      const annonce = /(\d+)\s+questions?\b/.exec(props.meta ?? '')
      if (cible && annonce && !/\bQCM\b/.test(props.meta) && Number(annonce[1]) !== (cible.questions ?? 0)) {
        avertir(c, `carte-lien vers ${props.to} : annonce « ${annonce[0]} », la fiche en porte ${cible.questions ?? 0}`)
      }
    }

    if (!BALISES_QUESTION.has(balise)) return
    questions += 1
    const bloc = [...parents].reverse().find(p => BALISES_BLOC.has(p[0]))
    const nom = `${props.label ?? '(sans repère)'} « ${texte(n).trim().slice(0, 50)}… »`
    if (!bloc || !bloc[1]?.titre) {
      erreur(c, `question hors bloc : ${nom} — elle s'affiche mais n'a ni mémoire, ni correction, ni place au quiz`)
      return
    }
    if (!props.label) {
      erreur(c, `question sans label dans « ${bloc[1].titre} » : ${nom}`)
      return
    }
    const identite = `${slugifier(bloc[1].titre)}#${props.label}`
    if (identites.has(identite)) erreur(c, `deux questions portent l'identité ${identite} : elles partageraient leur progression`)
    identites.set(identite, true)

    const slots = slotsDe(n)
    const lettres = LETTRES.filter(l => slots.has(l))
    if (lettres.length && lettres.some((l, i) => l !== LETTRES[i])) {
      erreur(c, `${identite} : propositions ${lettres.join(', ')} — il manque une lettre au milieu`)
    }
    if (props.bonne !== undefined) {
      if (!lettres.includes(props.bonne)) {
        erreur(c, `${identite} : bonne="${props.bonne}" ne désigne aucune proposition écrite (${lettres.join(', ') || 'aucune'}) — impossible à réussir`)
      }
      if (lettres.length < 2) erreur(c, `${identite} : une bonne réponse, mais moins de deux propositions`)
    } else if (lettres.length) {
      avertir(c, `${identite} : des propositions mais pas de bonne réponse — la question s'auto-évalue et sort du quiz`)
    }
    // Le quiz pose une question avec l'entête de son bloc, et rien d'autre :
    // un « dans l'exemple ci-dessus » qui vise un ::exemple du cours, posé
    // seul, renvoie à un exemple que l'élève n'a pas sous les yeux. Quand le
    // bloc a un entête, « ci-dessus » le désigne le plus souvent, et le quiz
    // le rappelle : on ne signale que les blocs sans entête.
    const enonce = n.slice(2).filter(e => !(Array.isArray(e) && e[0] === 'template')).map(texte).join(' ')
    const renvoi = /ci-dessus|plus haut|(exemple|tableau|programme|code) précédent/i.exec(enonce)
    const entete = bloc.slice(2).some(e => Array.isArray(e) && e[0] !== 'template' && !BALISES_QUESTION.has(e[0]) && texte(e).trim())
    if (renvoi && !entete) {
      avertir(c, `${identite} : l'énoncé renvoie « ${renvoi[0]} » hors de son bloc — posée seule au quiz, la question perd son contexte`)
    }
    if (!slots.has('solution')) avertir(c, `${identite} : pas de solution rédigée`)
    if (!slots.has('indice')) avertir(c, `${identite} : pas d'indice`)
    if (props.cours && !extraits.has(props.cours)) {
      erreur(c, `${identite} : cours="${props.cours}" ne désigne aucun extrait-cours de la page — le bouton Cours n'ouvre rien`)
    }
  })

  // Une commande à taper se corrige contre ses réponses admises : une réponse
  // qui ne se lit pas, ou une question qui porte aussi une lettre, rendrait la
  // question impossible à réussir sans rien afficher d'anormal.
  parcourir(page.corps, (n, parents) => {
    if (n[0] !== 'commande') return
    const props = n[1] ?? {}
    const question = [...parents].reverse().find(p => BALISES_QUESTION.has(p[0]))
    const nom = question ? `${slugifier([...parents].reverse().find(p => BALISES_BLOC.has(p[0]))?.[1]?.titre ?? '?')}#${question[1]?.label}` : 'commande hors question'
    let attendues
    try {
      attendues = JSON.parse(props[':attendues'] ?? '[]')
    } catch {
      erreur(c, `${nom} : les réponses admises ne se lisent pas`)
      return
    }
    const mode = props.mode ?? 'shell'
    if (!['shell', 'dockerfile', 'yaml'].includes(mode)) erreur(c, `${nom} : mode « ${mode} » inconnu`)
    if (!Array.isArray(attendues) || !attendues.length) erreur(c, `${nom} : aucune réponse admise — impossible à réussir`)
    for (const a of attendues) {
      const e = erreurAttendue(String(a), mode)
      if (e) erreur(c, `${nom} : la réponse admise « ${String(a).slice(0, 40)} » ne se lit pas (${e})`)
      else if (!corrigerCommande(String(a), [String(a)], mode).juste) erreur(c, `${nom} : « ${String(a).slice(0, 40)} » ne se reconnaît pas elle-même`)
    }
    if (!question) avertir(c, 'une commande hors question : elle se corrige, mais n\'a pas de mémoire')
    else if (question[0] !== 'exo-question') erreur(c, `${nom} : une commande ne se pose que dans une exo-question`)
    else if (question[1]?.bonne !== undefined) erreur(c, `${nom} : une commande à taper et une bonne lettre — la question ne sait pas laquelle croire`)
  })

  // Des cases à cocher sans bonnes réponses se réussissent en ne cochant rien,
  // et un numéro hors des propositions les rend impossibles : ni l'un ni
  // l'autre ne se voit à l'écran.
  parcourir(page.corps, (n, parents) => {
    if (n[0] !== 'cases-a-cocher') return
    const props = n[1] ?? {}
    const question = [...parents].reverse().find(p => BALISES_QUESTION.has(p[0]))
    const nom = question ? `${slugifier([...parents].reverse().find(p => BALISES_BLOC.has(p[0]))?.[1]?.titre ?? '?')}#${question[1]?.label}` : 'cases hors question'
    let propositions, bonnes
    try {
      propositions = JSON.parse(props[':propositions'] ?? '[]')
      bonnes = JSON.parse(props[':bonnes'] ?? '[]')
    } catch {
      erreur(c, `${nom} : les propositions ou les bonnes réponses ne se lisent pas`)
      return
    }
    if (!Array.isArray(propositions) || propositions.length < 2) erreur(c, `${nom} : moins de deux propositions à cocher`)
    if (!Array.isArray(bonnes) || !bonnes.length) erreur(c, `${nom} : aucune bonne réponse — la question se réussit sans rien cocher`)
    else for (const b of bonnes) {
      if (!Number.isInteger(b) || b < 1 || b > propositions.length) erreur(c, `${nom} : bonne réponse ${b} hors des propositions (1 à ${propositions.length})`)
    }
    if (!question) avertir(c, 'des cases à cocher hors question : elles se corrigent, mais n\'ont pas de mémoire')
    else if (question[0] !== 'exo-question') erreur(c, `${nom} : des cases à cocher ne se posent que dans une exo-question`)
    else if (question[1]?.bonne !== undefined) erreur(c, `${nom} : des cases à cocher et une bonne lettre — la question ne sait pas laquelle croire`)
  })

  // Les rappels de cours doivent viser une section qui existe : c'est leur
  // ancre qui range la question dans le plan du chapitre. Une ancre morte ne
  // casse rien à l'écran, et range la question sous un intitulé fabriqué.
  for (const [id, { source }] of extraits) {
    if (!source) {
      avertir(c, `extrait-cours « ${id} » sans source : ses questions se rangent dans la section où elles sont écrites`)
      continue
    }
    const [cible, ancre] = source.split('#')
    const visee = parChemin.get(canon(cible))
    if (!visee) erreur(c, `extrait-cours « ${id} » : source vers une page inexistante (${cible})`)
    else if (!ancre) avertir(c, `extrait-cours « ${id} » : source sans ancre — la question ne sera rangée dans aucune section`)
    else if (!visee.sections[ancre]) {
      erreur(c, `extrait-cours « ${id} » : l'ancre #${ancre} n'existe pas dans ${cible} (ancres : ${Object.keys(visee.sections).slice(0, 4).join(', ')}…)`)
    }
  }

  // Le build a compté et relevé de son côté : les trois chiffres doivent tomber
  // juste. Un écart dirait que ce script et le hook de nuxt.config.ts ne lisent
  // pas le même arbre.
  if ((page.questions ?? 0) !== questions) erreur(c, `le build compte ${page.questions} questions, l'arbre en porte ${questions}`)
  if (page.releve.length !== identites.size) {
    erreur(c, `le relevé du build porte ${page.releve.length} questions identifiables, ce script en trouve ${identites.size}`)
  }
  for (const q of page.releve) {
    if (!identites.has(`${q.bloc}#${q.label}`)) erreur(c, `slugifier diverge du build : ${q.bloc}#${q.label} introuvable`)
  }
  if (questions && !page.type) avertir(c, 'une page à questions sans type : pas de pastille, absente de la to-do')

  const { annee, matiere, chapitre } = niveaux(c)
  const cle = chapitre ?? matiere ?? annee ?? c
  const t = totaux.get(cle) ?? { fiches: 0, questions: 0, interrogeables: 0 }
  if (questions) t.fiches += 1
  t.questions += questions
  t.interrogeables += page.releve.filter(q => q.interrogeable).length
  totaux.set(cle, t)
}

function niveaux(chemin) {
  const s = chemin.split('/').filter(Boolean)
  const p = n => (s.length >= n ? '/' + s.slice(0, n).join('/') : null)
  return { annee: p(2), matiere: p(3), chapitre: p(4) }
}

// Chaque niveau se nomme par sa page d'index : sans elle, le catalogue affiche
// un intitulé fabriqué à partir du dossier.
for (const page of visees) {
  for (const niveau of Object.values(niveaux(page.chemin))) {
    if (niveau && niveau !== page.chemin && !parChemin.has(niveau)) {
      avertir(niveau, 'dossier sans index.md : il sera nommé d\'après son slug, sans icône ni rang')
    }
  }
}

// Le témoin du frontmatter : un « : » non protégé fait perdre au YAML tout ce
// qui suit, `type` compris, sans une erreur.
const ecrits = []
;(function lire(dossier) {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const f = join(dossier, e.name)
    if (e.isDirectory()) lire(f)
    else if (f.endsWith('.md') && /^type:/m.test(readFileSync(f, 'utf8').split(/^---$/m)[1] ?? '')) ecrits.push(f)
  }
})('content')
const types = pages.filter(p => p.type).length
if (types !== ecrits.length) erreur('frontmatter', `${ecrits.length} fichiers écrivent un type, ${types} l'ont dans la base : un frontmatter ne se lit plus (un « : » sans guillemets ?)`)

if (rendu) {
  for (const page of visees.filter(p => p.questions)) {
    const html = await (await fetch(BASE + page.path)).text()
    const n = (html.match(/class="[^"]*\bcours-question\b/g) ?? []).length
    if (n !== page.questions) erreur(page.chemin, `rendu : ${n} questions affichées pour ${page.questions} comptées — un bloc s'est replié dans un autre (voir docs/contenu.md, remark-mdc)`)
  }
}

console.log(`\n${prefixe}`)
for (const [cle, t] of [...totaux].sort()) {
  if (!t.questions) continue
  console.log(`  ${cle.slice(prefixe.length) || '.'}  ${t.fiches} fiche(s) · ${t.questions} questions · ${t.interrogeables} au quiz · ${t.questions - t.interrogeables} ouvertes`)
}
const total = [...totaux.values()].reduce((k, t) => ({ q: k.q + t.questions, i: k.i + t.interrogeables }), { q: 0, i: 0 })
console.log(`  total : ${total.q} questions, ${total.i} au quiz${rendu ? ', rendu vérifié' : ''}`)

if (avertissements.length) {
  console.log(`\n${avertissements.length} avertissement(s)`)
  for (const a of avertissements.slice(0, 40)) console.log('  · ' + a)
  if (avertissements.length > 40) console.log(`  … et ${avertissements.length - 40} autres`)
}
if (erreurs.length) {
  console.log(`\n${erreurs.length} ERREUR(S)`)
  for (const e of erreurs) console.log('  ✗ ' + e)
  process.exit(1)
}
console.log('\nAucune erreur.')
