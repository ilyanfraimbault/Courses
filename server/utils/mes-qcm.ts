import type { DatabaseSync } from 'node:sqlite'
import type { H3Event } from 'h3'
import type { CopieQcmCompose, QuestionCandidate, ResumeQcmCompose } from '~~/shared/types/mes-qcm'
import type { QuestionQuiz } from '~~/shared/types/quiz'
import type { Banque, CachePages, EntreeBanque, QuestionLue } from './quiz-banque.ts'

/**
 * Les QCM composés, côté serveur. Voir `docs/mes-qcm.md`.
 *
 * Un QCM composé ne retient que des identités de questions. Tout le reste —
 * énoncés, propositions, bonne réponse, correction — est relu dans les fiches à
 * chaque ouverture, par les mêmes fonctions que le quiz : c'est ce qui garantit
 * qu'une question corrigée dans son cours l'est partout où elle est posée.
 */

/** Bornes d'un QCM composé : les mêmes que celles d'une séance de quiz. */
export const QCM_MIN = 1
export const QCM_MAX = TAILLE_MAX

/** Au-delà, l'historique n'apprend plus rien — la règle des QCM de contenu. */
export const MAX_COPIES = 24

export const TITRE_MAX = 120

export interface LigneQcmCompose {
  id: number
  utilisateur_id: number
  titre: string
  matiere: string
  questions: string
  cree_le: number
  maj: number
}

/** Une liste JSON de chaînes, ou une liste vide : une ligne illisible ne bloque pas la page. */
export function lireListeJson(json: string): string[] {
  try {
    const valeur: unknown = JSON.parse(json)
    return Array.isArray(valeur) ? valeur.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/** Le QCM `id` du compte `uid`, ou null : jamais celui d'un autre. */
export function lireQcmCompose(db: DatabaseSync, uid: number, id: number): LigneQcmCompose | null {
  const ligne = db.prepare('SELECT * FROM qcm_compose WHERE id = ? AND utilisateur_id = ?')
    .get(id, uid) as unknown as LigneQcmCompose | undefined
  return ligne ?? null
}

/** Les copies d'un QCM, de la plus ancienne à la plus récente. */
export function lireCopies(db: DatabaseSync, composeId: number): CopieQcmCompose[] {
  const lignes = db.prepare(
    'SELECT t, justes, total, ratees FROM qcm_compose_copie WHERE compose_id = ? ORDER BY t ASC'
  ).all(composeId) as unknown as { t: number, justes: number, total: number, ratees: string }[]
  return lignes.map(l => ({ t: l.t, justes: l.justes, total: l.total, ratees: lireListeJson(l.ratees) }))
}

/**
 * Les questions d'un QCM que le contenu porte encore, et qu'on sait poser.
 *
 * Une question disparue du contenu — renommée, supprimée — n'est pas une erreur
 * : elle sort du QCM sans le rendre inutilisable, et l'écran dit combien. C'est
 * le même contrat que le quiz, qui retire de sa file une place devenue
 * introuvable.
 */
export function entreesDuQcm(banque: Banque, identites: string[]): EntreeBanque[] {
  const parId = new Map(banque.interrogeables.map(e => [e.id, e]))
  return identites.map(id => parId.get(id)).filter((e): e is EntreeBanque => !!e)
}

export function resumerQcm(db: DatabaseSync, banque: Banque, ligne: LigneQcmCompose): ResumeQcmCompose {
  const identites = lireListeJson(ligne.questions)
  const presentes = entreesDuQcm(banque, identites).length
  const derniere = db.prepare(
    'SELECT t, justes, total, ratees FROM qcm_compose_copie WHERE compose_id = ? ORDER BY t DESC LIMIT 1'
  ).get(ligne.id) as unknown as { t: number, justes: number, total: number, ratees: string } | undefined
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM qcm_compose_copie WHERE compose_id = ?')
    .get(ligne.id) as unknown as { n: number }
  const matiere = banque.matieres.get(ligne.matiere)

  return {
    id: ligne.id,
    titre: ligne.titre,
    matiere: ligne.matiere,
    matiereTitre: matiere?.titre ?? null,
    annee: matiere?.annee ?? null,
    questions: presentes,
    manquantes: identites.length - presentes,
    cree_le: ligne.cree_le,
    maj: ligne.maj,
    copies: n,
    derniere: derniere
      ? { t: derniere.t, justes: derniere.justes, total: derniere.total, ratees: lireListeJson(derniere.ratees) }
      : null
  }
}

export interface QuestionPosee {
  entree: EntreeBanque
  question: QuestionQuiz
  lue: QuestionLue
}

/**
 * Relit toutes les questions d'un QCM dans leurs fiches.
 *
 * Les propositions sont brassées avec une graine **propre au QCM** : l'ordre est
 * stable d'une ouverture à l'autre — c'est une page fixe, on doit pouvoir la
 * refaire et comparer —, mais ce n'est pas celui de la fiche, où la bonne
 * réponse finirait par se retenir comme « la c ».
 *
 * Les fiches lues sont partagées entre les questions le temps de la requête :
 * vingt questions prises dans trois fiches ne désérialisent que trois arbres.
 */
export async function poserQcm(event: H3Event, banque: Banque, ligne: LigneQcmCompose): Promise<{ posees: QuestionPosee[], manquantes: number }> {
  const identites = lireListeJson(ligne.questions)
  const entrees = entreesDuQcm(banque, identites)
  const cache: CachePages = new Map()

  const lues = await Promise.all(entrees.map((entree, position) =>
    poserQuestion(event, banque, entree, position, false, `qcm-compose:${ligne.id}`, cache)
      .then(posee => (posee ? { entree, ...posee } : null))))

  const posees = lues
    .filter((p): p is QuestionPosee => !!p)
    // Le rang affiché suit ce qui est effectivement posé : une question
    // disparue ne laisse pas de trou dans la numérotation.
    .map((p, rang) => ({ ...p, question: { ...p.question, position: rang } }))

  return { posees, manquantes: identites.length - posees.length }
}

/** Une question telle qu'on la propose à la composition. */
export function candidate(banque: Banque, entree: EntreeBanque, enDette: Set<string>): QuestionCandidate {
  return {
    id: entree.id,
    chemin: entree.chemin,
    ficheTitre: entree.ficheTitre,
    blocTitre: entree.blocTitre,
    label: entree.label,
    theme: entree.theme,
    themeTitre: entree.theme ? banque.chapitres.get(entree.theme)?.titre ?? null : null,
    section: entree.section,
    sectionTitre: entree.sectionTitre,
    enDette: enDette.has(entree.id)
  }
}

/** L'identifiant numérique d'une route `[id]`, ou une 400. */
export function idDeRoute(event: H3Event): number {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'identifiant de QCM invalide' })
  }
  return id
}

/** Un titre de QCM nettoyé, ou une 400 : c'est ce qui nomme la page, il ne peut pas être vide. */
export function titreValide(valeur: unknown): string {
  const titre = typeof valeur === 'string' ? valeur.replace(/\s+/g, ' ').trim() : ''
  if (!titre || titre.length > TITRE_MAX) {
    throw createError({ statusCode: 400, statusMessage: `titre attendu, ${TITRE_MAX} caractères au plus` })
  }
  return titre
}
