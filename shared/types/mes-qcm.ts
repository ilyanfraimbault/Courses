import type { CorrectionQuiz, FiltreQuiz, FragmentContenu, QuestionQuiz } from './quiz'

/**
 * Les QCM composés : une liste de questions choisies dans les fiches, rangée sur
 * le compte de qui l'a composée, et qui se passe comme un QCM de contenu — on
 * répond à tout, puis on rend la copie.
 *
 * Comme le quiz, un QCM composé **n'a pas de questions à lui** : il ne retient
 * que leurs identités, et relit énoncés, propositions et corrections dans les
 * fiches à chaque ouverture. Voir `docs/mes-qcm.md`.
 */

/** Une copie rendue. Les questions ratées sont des identités complètes. */
export interface CopieQcmCompose {
  t: number
  justes: number
  total: number
  ratees: string[]
}

/** Un QCM tel que la liste « Mes QCM » le résume. */
export interface ResumeQcmCompose {
  id: number
  titre: string
  /** Chemin de la matière. */
  matiere: string
  matiereTitre: string | null
  /** Intitulé de l'année de la matière. */
  annee: string | null
  /** Questions du QCM que le contenu porte encore. */
  questions: number
  /** Questions disparues du contenu depuis la composition : elles ne sont plus posées. */
  manquantes: number
  cree_le: number
  maj: number
  copies: number
  derniere: CopieQcmCompose | null
}

/** Un QCM prêt à être passé. Aucune bonne réponse n'y figure. */
export interface QcmCompose extends Omit<ResumeQcmCompose, 'questions' | 'copies' | 'derniere'> {
  /**
   * Les questions, dans l'ordre du QCM. Même forme qu'au quiz — énoncé du bloc
   * compris, sans lequel une question sortie de son exercice devient insoluble —
   * et `position` y est le rang de la question dans le QCM.
   */
  questions: QuestionQuiz[]
  /** Les copies rendues, de la plus ancienne à la plus récente. */
  copies: CopieQcmCompose[]
}

/** Ce que rend la correction d'une copie. */
export interface CorrectionQcmCompose {
  copie: CopieQcmCompose
  /** Identité de question → sa correction, verdict compris. */
  corrections: Record<string, CorrectionQuiz>
}

/**
 * Une question proposée à la composition : de quoi la reconnaître et la
 * classer, pas de quoi la poser. L'énoncé se demande à part, question par
 * question, quand on veut le lire avant de la prendre.
 */
export interface QuestionCandidate {
  id: string
  chemin: string
  ficheTitre: string
  blocTitre: string
  label: string
  theme: string | null
  themeTitre: string | null
  section: string | null
  sectionTitre: string | null
  /** Ratée quelque part et pas encore retrouvée. */
  enDette: boolean
}

/** L'aperçu d'une question, pour la lire avant de la prendre. */
export interface ApercuQuestion {
  enonceBloc: FragmentContenu | null
  enonce: FragmentContenu
  lettres: string[]
  choix: Record<string, FragmentContenu>
}

/** Ce qu'on envoie pour tirer des questions à la manière du quiz. */
export interface DemandeTirage extends FiltreQuiz {
  taille: number
  /** Identités déjà retenues, que le tirage ne doit pas reproposer. */
  exclues?: string[]
}
