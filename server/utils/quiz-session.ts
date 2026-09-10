import type { DatabaseSync } from 'node:sqlite'
import type { EtatPlace, FiltreQuiz, PlaceQuiz, SessionQuiz } from '~~/shared/types/quiz'

/**
 * Une place dans la file.
 *
 * `place` est le numéro de la place du **tirage initial** dont l'entrée
 * descend : quand une faute fait revenir une question similaire à la fin, la
 * nouvelle entrée garde ce numéro. C'est ce qui permet de dire « il reste six
 * places à acquérir sur quarante » alors que la file, elle, en compte
 * quarante-sept.
 */
export interface EntreeFile {
  question: string
  place: number
  etat: EtatPlace
  /** Lettre donnée, une fois la place traitée. */
  reponse?: string
  /** Vrai quand la banque était à sec et qu'on a reposé la même question. */
  rejouee?: boolean
}

export interface EtatFile {
  version: 1
  entrees: EntreeFile[]
  /** Rang de la question en cours. Égal à la longueur de la file, la séance est finie. */
  position: number
}

export interface LigneSession {
  id: number
  utilisateur_id: number
  filtre: string
  taille: number
  etat: string
  poses: number
  justes: number
  fautes: number
  commencee_le: number
  maj: number
  finie_le: number | null
}

/**
 * Relit un filtre stocké. Il vient de la base, donc de nous — mais il a pu être
 * écrit par une version antérieure, et une session illisible ne doit pas rendre
 * la page d'historique inutilisable.
 */
export function lireFiltre(json: string): FiltreQuiz {
  try {
    const brut = JSON.parse(json) as Partial<FiltreQuiz>
    return {
      themes: Array.isArray(brut?.themes) ? brut.themes.filter(t => typeof t === 'string') : [],
      notions: Array.isArray(brut?.notions) ? brut.notions.filter(n => typeof n === 'string') : []
    }
  } catch {
    return { themes: [], notions: [] }
  }
}

const ETATS: EtatPlace[] = ['attente', 'juste', 'manquee']

/** Relit une file stockée, en écartant ce qui n'a pas la forme attendue. */
export function lireEtat(json: string): EtatFile {
  try {
    const brut = JSON.parse(json) as Partial<EtatFile>
    const entrees = Array.isArray(brut?.entrees)
      ? brut.entrees.filter((e): e is EntreeFile =>
          !!e && typeof e.question === 'string' && typeof e.place === 'number' && ETATS.includes(e.etat))
      : []
    const position = typeof brut?.position === 'number' && brut.position >= 0
      ? Math.min(brut.position, entrees.length)
      : entrees.length
    return { version: 1, entrees, position }
  } catch {
    return { version: 1, entrees: [], position: 0 }
  }
}

/** L'état d'une session tel que le client a le droit de le connaître. */
export function publier(ligne: LigneSession, etat: EtatFile): SessionQuiz {
  const file: PlaceQuiz[] = etat.entrees.map(e => ({ etat: e.etat, place: e.place }))
  // Une place est acquise quand sa dernière entrée est juste : une place ratée
  // puis regagnée plus loin compte, une place ratée qui attend encore sa reprise
  // ne compte pas.
  const acquises = new Set(etat.entrees.filter(e => e.etat === 'juste').map(e => e.place)).size

  return {
    id: ligne.id,
    filtre: lireFiltre(ligne.filtre),
    taille: ligne.taille,
    acquises,
    poses: ligne.poses,
    justes: ligne.justes,
    fautes: ligne.fautes,
    position: etat.position,
    longueur: etat.entrees.length,
    finie: ligne.finie_le !== null || etat.position >= etat.entrees.length,
    commencee_le: ligne.commencee_le,
    maj: ligne.maj,
    file
  }
}

/** La session `id` du compte `uid`, ou null : jamais celle d'un autre. */
export function lireSession(db: DatabaseSync, uid: number, id: number): { ligne: LigneSession, etat: EtatFile } | null {
  const ligne = db.prepare(
    'SELECT * FROM quiz_session WHERE id = ? AND utilisateur_id = ?'
  ).get(id, uid) as unknown as LigneSession | undefined
  if (!ligne) return null
  return { ligne, etat: lireEtat(ligne.etat) }
}

/**
 * Écrit la file par **instantané**, comme la progression d'une fiche : le corps
 * décrit l'état complet, l'écriture remplace, et rejouer est sans effet.
 */
export function ecrireEtat(db: DatabaseSync, ligne: LigneSession, etat: EtatFile, maj: number) {
  const finie = etat.position >= etat.entrees.length
  db.prepare(`
    UPDATE quiz_session
    SET etat = ?, poses = ?, justes = ?, fautes = ?, maj = ?, finie_le = ?
    WHERE id = ?
  `).run(
    JSON.stringify(etat),
    ligne.poses,
    ligne.justes,
    ligne.fautes,
    maj,
    finie ? (ligne.finie_le ?? maj) : null,
    ligne.id
  )
  ligne.maj = maj
  ligne.finie_le = finie ? (ligne.finie_le ?? maj) : null
}
