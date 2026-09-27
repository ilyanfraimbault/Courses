import type { DatabaseSync } from 'node:sqlite'
import type { H3Event } from 'h3'
import type {
  Controle, EtatControle, ExamenBlancControle, JourControle, ProgrammeControle, ResumeControle, SectionControle
} from '~~/shared/types/controles'
import { debutDuJour, decalerJour, ecartJours, fuseauValide, jourDe, jourValide } from '~~/shared/utils/jours'
import type { Banque, EntreeBanque } from './quiz-banque.ts'

/**
 * Les contrôles, côté serveur. Voir `docs/controles.md`.
 *
 * Un contrôle ne stocke que sa date, sa matière et son programme. L'état de
 * préparation et la feuille de route se recalculent à chaque lecture depuis la
 * mémoire commune — `reussite` et `faute` —, si bien qu'une question gagnée sur
 * une fiche, au quiz ou dans un QCM fait avancer tous les contrôles qui la
 * couvrent, sans que personne ait à les prévenir.
 */

export const TITRE_CONTROLE_MAX = 120

/**
 * Ce qu'une journée d'apprentissage demande au moins. En deçà, étaler serait
 * contre-productif : trois questions par jour pendant trois semaines, c'est
 * trois semaines à se remettre dans le sujet. On préfère finir tôt et garder de
 * la marge, que la dette et l'examen blanc viendront remplir.
 */
export const QUOTA_MIN = 10

/** Taille d'un examen blanc : de quoi couvrir un programme sans devenir une épreuve de fond. */
export const TAILLE_BLANC = 20

export interface LigneControle {
  id: number
  utilisateur_id: number
  titre: string
  matiere: string
  jour: string
  programme: string
  examen_blanc: number | null
  note: number | null
  bareme: number | null
  cree_le: number
  maj: number
}

/** Le contrôle `id` du compte `uid`, ou null : jamais celui d'un autre. */
export function lireControle(db: DatabaseSync, uid: number, id: number): LigneControle | null {
  const ligne = db.prepare('SELECT * FROM controle WHERE id = ? AND utilisateur_id = ?')
    .get(id, uid) as unknown as LigneControle | undefined
  return ligne ?? null
}

/** Un programme stocké, relu sans confiance : une ligne illisible vaut « toute la matière ». */
export function lireProgramme(json: string): ProgrammeControle {
  const chaines = (valeur: unknown) =>
    Array.isArray(valeur) ? valeur.filter((v): v is string => typeof v === 'string') : []
  try {
    const brut = JSON.parse(json) as Partial<ProgrammeControle>
    return { themes: chaines(brut?.themes), sections: chaines(brut?.sections) }
  } catch {
    return { themes: [], sections: [] }
  }
}

/** Les chapitres et les sections qu'une matière porte aujourd'hui, dans la nomenclature du quiz. */
function partiesDe(banque: Banque, matiere: string) {
  const themes = new Set<string>()
  const sections = new Set<string>()
  for (const e of banque.interrogeables) {
    if (e.matiere !== matiere) continue
    if (e.theme) themes.add(e.theme)
    sections.add(cleSection(e))
  }
  return { themes, sections }
}

/**
 * Un programme reçu du client, vérifié contre le contenu.
 *
 * Une partie inconnue est refusée : un programme qui annonce un chapitre que le
 * site ne connaît pas mentirait sur ce qui sera révisé. Une section déjà
 * couverte par son chapitre coché est écartée — elle y est déjà, et la garder
 * ferait un programme qui se contredit à l'œil.
 */
export function programmeValide(banque: Banque, matiere: string, themes: unknown, sections: unknown): ProgrammeControle {
  const liste = (v: unknown) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x))] : []
  const connues = partiesDe(banque, matiere)
  const t = liste(themes)
  const s = liste(sections)
  const inconnues = [...t.filter(x => !connues.themes.has(x)), ...s.filter(x => !connues.sections.has(x))]
  if (inconnues.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `${inconnues.length} partie${inconnues.length > 1 ? 's' : ''} du programme hors de la matière`
    })
  }
  const coches = new Set(t)
  return { themes: t, sections: s.filter(x => !estDansUnTheme(banque, x, coches)) }
}

/** Vrai quand la section `cle` appartient à l'un des chapitres cochés. */
function estDansUnTheme(banque: Banque, cle: string, themes: Set<string>): boolean {
  const e = banque.interrogeables.find(q => cleSection(q) === cle)
  return !!e?.theme && themes.has(e.theme)
}

/**
 * Les questions du programme, et les parties qui ont disparu du contenu.
 *
 * Seules les questions que le quiz sait poser comptent : un contrôle promet des
 * séances, et annoncer « 30 questions à apprendre » dont six ne se corrigent pas
 * toutes seules ferait une journée qui ne finit jamais. C'est la règle du
 * catalogue du quiz, pour la même raison.
 *
 * Un programme dont **toutes** les parties ont disparu ne retombe pas sur la
 * matière entière — ce que ferait un filtre vide. Il ne couvre plus rien, et
 * l'écran le dit.
 */
export function entreesDuProgramme(banque: Banque, matiere: string, programme: ProgrammeControle) {
  const connues = partiesDe(banque, matiere)
  const themes = programme.themes.filter(t => connues.themes.has(t))
  const sections = programme.sections.filter(s => connues.sections.has(s))
  const manquantes = programme.themes.length - themes.length + programme.sections.length - sections.length
  const avait = programme.themes.length + programme.sections.length
  if (avait && !themes.length && !sections.length) return { entrees: [] as EntreeBanque[], manquantes }
  return { entrees: filtrer(banque.interrogeables, { matiere, themes, sections, notions: [] }), manquantes }
}

/**
 * Ce que le compte sait, lu une fois par requête : la liste des contrôles en
 * évalue plusieurs, et chacun relirait sinon les mêmes tables.
 */
export interface Memoire {
  /** Identité → date de la première réussite. */
  trouvees: Map<string, number>
  enDette: Set<string>
  /** Identité → date où sa dette a été éteinte, pour les questions retrouvées. */
  rattrapees: Map<string, number>
}

export function lireMemoire(db: DatabaseSync, uid: number): Memoire {
  const trouvees = new Map<string, number>()
  for (const l of db.prepare('SELECT chemin, bloc, label, premiere FROM reussite WHERE utilisateur_id = ?')
    .all(uid) as unknown as { chemin: string, bloc: string, label: string, premiere: number }[]) {
    trouvees.set(composerIdentite(l.chemin, l.bloc, l.label), l.premiere)
  }
  const enDette = new Set<string>()
  const rattrapees = new Map<string, number>()
  for (const l of db.prepare('SELECT chemin, bloc, label, rattrapee FROM faute WHERE utilisateur_id = ?')
    .all(uid) as unknown as { chemin: string, bloc: string, label: string, rattrapee: number | null }[]) {
    const id = composerIdentite(l.chemin, l.bloc, l.label)
    if (l.rattrapee === null) enDette.add(id)
    else rattrapees.set(id, l.rattrapee)
  }
  return { trouvees, enDette, rattrapees }
}

/** Sue : trouvée un jour, et pas ratée depuis. */
function sue(m: Memoire, id: string) {
  return m.trouvees.has(id) && !m.enDette.has(id)
}

/** Devenue sue aujourd'hui : trouvée pour la première fois, ou sortie de la dette depuis ce matin. */
function gagneeDepuis(m: Memoire, id: string, debut: number) {
  return sue(m, id) && ((m.trouvees.get(id) ?? 0) >= debut || (m.rattrapees.get(id) ?? 0) >= debut)
}

function etatDe(entrees: EntreeBanque[], m: Memoire): EtatControle {
  let sues = 0
  let dette = 0
  for (const e of entrees) {
    if (m.enDette.has(e.id)) dette += 1
    else if (m.trouvees.has(e.id)) sues += 1
  }
  return { questions: entrees.length, sues, dette }
}

/** Les sections du programme, dans l'ordre du cours : chapitre après chapitre, plan après plan. */
function sectionsDe(banque: Banque, entrees: EntreeBanque[], m: Memoire, debut: number): SectionControle[] {
  const parCle = new Map<string, { s: SectionControle, ordreTheme: number, ordre: number }>()
  for (const e of entrees) {
    const cle = cleSection(e)
    const chapitre = e.theme ? banque.chapitres.get(e.theme) : undefined
    const courant = parCle.get(cle) ?? {
      s: {
        cle,
        titre: e.section ? e.sectionTitre ?? cle : 'Le reste du chapitre',
        theme: e.theme,
        themeTitre: chapitre?.titre ?? null,
        questions: 0,
        sues: 0,
        dette: 0,
        gagneesAujourdhui: 0,
        restantesCeMatin: 0
      },
      ordreTheme: chapitre?.ordre ?? 999,
      ordre: e.section ? e.sectionOrdre : 1000
    }
    const s = courant.s
    s.questions += 1
    if (m.enDette.has(e.id)) s.dette += 1
    else if (m.trouvees.has(e.id)) s.sues += 1
    const gagnee = gagneeDepuis(m, e.id, debut)
    if (gagnee) s.gagneesAujourdhui += 1
    if (gagnee || !sue(m, e.id)) s.restantesCeMatin += 1
    parCle.set(cle, courant)
  }
  return [...parCle.values()]
    .sort((a, b) => a.ordreTheme - b.ordreTheme
      || (a.s.theme ?? '').localeCompare(b.s.theme ?? '')
      || a.ordre - b.ordre
      || a.s.titre.localeCompare(b.s.titre, 'fr'))
    .map(x => x.s)
}

/**
 * La feuille de route, d'aujourd'hui au jour J.
 *
 * Les derniers jours ont un rôle fixe, les autres apprennent :
 *
 * - **J-2 : l'examen blanc.** Assez tôt pour que ses fautes aient un jour
 *   entier pour être reprises, assez tard pour mesurer ce qu'on saura vraiment ;
 * - **J-1 et J : la dette.** Rien de neuf la veille — on consolide ;
 * - **avant : le programme**, découpé en journées dans l'ordre du cours.
 *
 * Quand le temps manque, les rôles se tassent : à J-2, on apprend aujourd'hui
 * et l'examen blanc passe la veille ; à J-1, examen blanc et dette le même jour.
 *
 * Le découpage se fait sur ce qu'il restait **ce matin**, pas sur ce qu'il reste
 * maintenant : sans quoi finir sa journée ferait glisser celle de demain dans
 * celle-ci, et la journée ne finirait jamais. Une journée manquée se rattrape
 * toute seule — le lendemain, le reste se redécoupe sur les jours qui restent.
 *
 * Le nombre de journées est choisi pour qu'elles portent en moyenne au moins
 * `QUOTA_MIN` questions : un programme court se finit tôt, et les jours libérés
 * restent de la marge.
 */
export function feuilleDeRoute(aujourdhui: string, jour: string, sections: SectionControle[]): JourControle[] {
  const n = ecartJours(aujourdhui, jour)
  if (n < 0) return []

  const jours: JourControle[] = Array.from({ length: n + 1 }, (_, k) => ({
    jour: decalerJour(aujourdhui, k),
    rang: n - k,
    parts: [],
    questions: 0,
    blanc: false,
    dette: false
  }))
  const auRang = (rang: number) => jours[n - rang]!

  let apprentissage: number
  if (n >= 3) {
    apprentissage = n - 2
    auRang(2).blanc = true
    auRang(1).dette = true
  } else if (n === 2) {
    apprentissage = 1
    auRang(1).blanc = true
    auRang(1).dette = true
  } else {
    apprentissage = 0
    if (n === 1) {
      auRang(1).blanc = true
      auRang(1).dette = true
    }
  }
  auRang(0).dette = true

  const aApprendre = sections.filter(s => s.restantesCeMatin > 0)
  const total = aApprendre.reduce((k, s) => k + s.restantesCeMatin, 0)
  if (!apprentissage || !total) return jours

  const utiles = Math.min(apprentissage, Math.max(1, Math.ceil(total / QUOTA_MIN)))
  decouper(aApprendre.map(s => s.restantesCeMatin), utiles).forEach((morceaux, k) => {
    const jour = jours[k]!
    jour.parts = morceaux.map(m => ({ cle: aApprendre[m.index]!.cle, questions: m.questions }))
    jour.questions = morceaux.reduce((n, m) => n + m.questions, 0)
  })
  return jours
}

/** En deçà, un morceau de section ne vaut pas une journée entamée : il rejoint son voisin. */
export const MORCEAU_MIN = 3

/**
 * Découpe une suite de sections en `n` journées consécutives, aussi égales que
 * possible, dans l'ordre du cours.
 *
 * Une section peut **s'étaler sur plusieurs jours**. Il le faut : le cours de
 * fonctions en porte une de 53 questions et une de 45, et les garder entières
 * ferait une journée de cinquante questions au milieu de journées de dix. Un
 * premier découpage, qui plaçait chaque section entière dans la part où tombait
 * son milieu, rendait sur la trigonométrie 8 · 12 · 6 · 10 · 9 · 3 · 15.
 *
 * Chaque coupure vise une part égale **de ce qui reste**, pas du total : une
 * journée qui a débordé est compensée par les suivantes au lieu de décaler tout
 * le reste. Une coupure qui laisserait un morceau de moins de `MORCEAU_MIN`
 * questions glisse au bord de la section — « une question du radian, puis on
 * passe au cercle » n'aide personne.
 *
 * Rend, pour chaque journée, les morceaux de sections qu'elle porte : l'indice
 * de la section et le nombre de ses questions prévues ce jour-là.
 */
export function decouper(charges: number[], n: number): { index: number, questions: number }[][] {
  const total = charges.reduce((k, c) => k + c, 0)
  if (!total || n <= 0) return []

  const debuts: number[] = []
  let cumul = 0
  for (const c of charges) {
    debuts.push(cumul)
    cumul += c
  }

  // Les coupures, en questions depuis le début du programme.
  const coupures = [0]
  for (let j = 1; j < n; j++) {
    const precedente = coupures.at(-1)!
    let coupure = precedente + Math.round((total - precedente) / (n - j + 1))
    const i = debuts.findLastIndex(d => d < coupure)
    if (i >= 0) {
      const gauche = coupure - debuts[i]!
      const droite = debuts[i]! + charges[i]! - coupure
      if (droite > 0 && Math.min(gauche, droite) < MORCEAU_MIN) {
        coupure = gauche < droite ? debuts[i]! : debuts[i]! + charges[i]!
      }
    }
    // Une coupure qui ne fait pas avancer — tout a glissé au même bord — fond
    // deux journées en une : il y aura un jour de marge de plus.
    if (coupure > precedente && coupure < total) coupures.push(coupure)
  }
  coupures.push(total)

  const journees: { index: number, questions: number }[][] = []
  for (let j = 0; j + 1 < coupures.length; j++) {
    const [de, a] = [coupures[j]!, coupures[j + 1]!]
    const morceaux: { index: number, questions: number }[] = []
    charges.forEach((c, i) => {
      const recouvre = Math.min(a, debuts[i]! + c) - Math.max(de, debuts[i]!)
      if (recouvre > 0) morceaux.push({ index: i, questions: recouvre })
    })
    journees.push(morceaux)
  }
  return journees
}

/** Le dernier examen blanc du contrôle, s'il existe encore. */
function examenBlanc(db: DatabaseSync, banque: Banque, ligne: LigneControle): ExamenBlancControle | null {
  if (ligne.examen_blanc === null) return null
  const qcm = lireQcmCompose(db, ligne.utilisateur_id, ligne.examen_blanc)
  if (!qcm) return null
  const derniere = db.prepare(
    'SELECT t, justes, total FROM qcm_compose_copie WHERE compose_id = ? ORDER BY t DESC LIMIT 1'
  ).get(qcm.id) as unknown as { t: number, justes: number, total: number } | undefined
  return {
    id: qcm.id,
    questions: entreesDuQcm(banque, lireListeJson(qcm.questions)).length,
    derniere: derniere ?? null
  }
}

/**
 * Le moment présent, vu par l'élève : le jour qu'il est chez lui, et les
 * instants où ce jour commence et finit. Le fuseau vient de `?fuseau=` ; sans
 * lui, celui du site.
 */
export function maintenantPour(event: H3Event): { aujourdhui: string, debut: number, fin: number } {
  const fuseau = fuseauValide(getQuery(event).fuseau)
  const aujourdhui = jourDe(Date.now(), fuseau)
  return { aujourdhui, debut: debutDuJour(aujourdhui, fuseau), fin: debutDuJour(decalerJour(aujourdhui, 1), fuseau) }
}

/**
 * Un contrôle, évalué. Le résumé sert la liste ; le détail ajoute les sections,
 * la feuille de route et l'examen blanc.
 */
export function evaluerControle(
  db: DatabaseSync,
  banque: Banque,
  ligne: LigneControle,
  memoire: Memoire,
  moment: { aujourdhui: string, debut: number }
): Controle {
  const programme = lireProgramme(ligne.programme)
  const { entrees, manquantes } = entreesDuProgramme(banque, ligne.matiere, programme)
  const sections = sectionsDe(banque, entrees, memoire, moment.debut)
  const feuille = feuilleDeRoute(moment.aujourdhui, ligne.jour, sections)
  const matiere = banque.matieres.get(ligne.matiere)

  const premier = feuille[0]
  let aujourdhui: Controle['aujourdhui'] = null
  if (premier) {
    // Ce qui a été gagné aujourd'hui dans les sections du jour compte pour la
    // journée, jusqu'à sa charge : une section étalée sur deux jours avance
    // d'abord celui-ci, et le surplus sera déduit de demain au prochain matin.
    const cles = new Set(premier.parts.map(p => p.cle))
    const gagnees = sections.filter(s => cles.has(s.cle)).reduce((k, s) => k + s.gagneesAujourdhui, 0)
    aujourdhui = { jour: premier, questions: premier.questions, gagnees: Math.min(gagnees, premier.questions) }
  }

  return {
    id: ligne.id,
    titre: ligne.titre,
    matiere: ligne.matiere,
    matiereTitre: matiere?.titre ?? null,
    annee: matiere?.annee ?? null,
    jour: ligne.jour,
    joursRestants: ecartJours(moment.aujourdhui, ligne.jour),
    etat: etatDe(entrees, memoire),
    aujourdhui,
    note: ligne.note,
    bareme: ligne.bareme,
    programme,
    manquantes,
    sections,
    feuille,
    examenBlanc: examenBlanc(db, banque, ligne),
    tailleBlanc: Math.min(TAILLE_BLANC, entrees.length)
  }
}

/** Le résumé d'un contrôle, pour la liste : sans le détail des sections ni la feuille de route. */
export function resumerControle(c: Controle): ResumeControle {
  const { programme: _p, manquantes: _m, sections: _s, feuille: _f, examenBlanc: _e, tailleBlanc: _t, ...resume } = c
  return resume
}

/** L'identifiant numérique d'une route `[id]`, ou une 400. */
export function idControle(event: H3Event): number {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'identifiant de contrôle invalide' })
  }
  return id
}

/** Un titre nettoyé, ou une 400. */
export function titreControle(valeur: unknown): string {
  const titre = typeof valeur === 'string' ? valeur.replace(/\s+/g, ' ').trim() : ''
  if (!titre || titre.length > TITRE_CONTROLE_MAX) {
    throw createError({ statusCode: 400, statusMessage: `titre attendu, ${TITRE_CONTROLE_MAX} caractères au plus` })
  }
  return titre
}

/** Une date de contrôle, ou une 400. Les bornes écartent la faute de frappe, pas le passé : on peut noter un contrôle déjà rendu. */
export function jourControle(valeur: unknown): string {
  if (!jourValide(valeur) || valeur < '2000-01-01' || valeur > '2100-12-31') {
    throw createError({ statusCode: 400, statusMessage: 'date attendue, au format AAAA-MM-JJ' })
  }
  return valeur
}

/** Une note ou un barème : un nombre positif, ou rien. */
export function nombreOuRien(valeur: unknown, nom: string): number | null {
  if (valeur === null) return null
  const n = Number(valeur)
  if (typeof valeur !== 'number' || !Number.isFinite(n) || n < 0 || n > 1000) {
    throw createError({ statusCode: 400, statusMessage: `${nom} attendu : un nombre positif, ou null` })
  }
  return n
}
