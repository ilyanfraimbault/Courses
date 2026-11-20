import type { ActiviteMatiere } from './activite'
import type { Parcours } from './matieres'

/**
 * Ce que l'administration voit des comptes : ce que chacun a **fait**, jusqu'à
 * l'exercice — combien de questions trouvées ou ratées, où, quand, et ses
 * séances de quiz et copies de QCM avec leur score. Jamais ce qu'il a
 * **répondu** : ni la réponse retenue d'une question trouvée, ni le code écrit
 * sous une question, ni ses notes. De quoi savoir qui avance, sur quoi, et qui
 * a décroché, sans relire la copie de personne.
 */

export interface MatiereAdministration {
  cle: string
  titre: string
  annee: string | null
  icone: string | null
  chemin: string | null
  /** Questions relevées au build pour la matière : le dénominateur de chaque barre. */
  questions: number
}

export interface UtilisateurAdministration {
  id: number
  pseudo: string
  /** Ce que l'élève a dit de lui au premier passage ; nuls tant qu'il ne l'a pas dit. */
  prenom: string | null
  nom: string | null
  parcours: Parcours | null
  admin: boolean
  /** « aucun » : rien demandé encore ; « demande » : attend une décision. */
  acces: 'aucun' | 'demande' | 'accorde'
  /** La dernière demande d'accès, et ce que l'élève y a dit de lui. */
  demandeLe: number | null
  demandeMessage: string | null
  inscritLe: number
  /** La trace la plus récente, toutes tables confondues. Nulle pour un compte jamais servi. */
  derniereActivite: number | null
  /** Questions trouvées qui existent encore dans le contenu. */
  acquises: number
  /** Les mêmes, trouvées pour la première fois ces sept derniers jours : qui avance en ce moment. */
  acquisesSemaine: number
  /** Même compte, matière par matière, indexé par chemin de matière. */
  parMatiere: Record<string, number>
  fichesOuvertes: number
  /** Questions ratées dont la dette court toujours. */
  enDette: number
  /** Toutes les fautes, rattrapées comprises : ce qui a coûté, pas ce qui reste. */
  fautes: number
  quiz: { seances: number, reponses: number, justes: number }
  qcm: { copies: number, composes: number }
  /** Contrôles posés dans l'agenda de la classe. */
  controles: number
  todo: { total: number, faites: number }
}

export interface VueAdministration {
  /** Toutes les questions identifiables du site. */
  questions: number
  matieres: MatiereAdministration[]
  utilisateurs: UtilisateurAdministration[]
}

/**
 * Une ligne de l'arbre de progression d'un compte : matière, chapitre, fiche
 * ou exercice. L'arbre est rangé comme le cours, par l'endroit où vit la
 * question — un exercice est sous sa fiche, sa fiche sous son chapitre.
 */
export interface LigneProgressionAdmin {
  /** Chemin du niveau, ou « chemin#bloc » pour un exercice : unique dans l'arbre. */
  cle: string
  niveau: 'matiere' | 'chapitre' | 'fiche' | 'exercice'
  titre: string
  /** Où l'ouvrir sur le site, nul quand le niveau n'a pas de page. */
  lien: string | null
  /** Questions relevées au build. */
  questions: number
  /** Celles que le compte a trouvées. */
  trouvees: number
  /** Toutes les fautes, rattrapées comprises. */
  fautes: number
  /** Questions dont la dette court toujours. */
  enDette: number
  /** Le dernier geste sur une question du niveau, toutes sources confondues. */
  derniere: number | null
  enfants?: LigneProgressionAdmin[]
}

/** Un jour travaillé, et ce qui s'y est passé. */
export interface JourAdmin {
  /** « AAAA-MM-JJ », dans le fuseau de qui regarde. */
  jour: string
  /** Questions distinctes touchées ce jour-là. */
  questions: number
  /** Réponses justes et fausses, une question pouvant en porter plusieurs. */
  justes: number
  fautes: number
  matieres: ActiviteMatiere[]
}

/** Une séance de quiz ou une copie de QCM. */
export interface SeanceAdmin {
  /** Unique parmi les séances du compte. */
  cle: string
  type: 'quiz' | 'qcm' | 'qcm-compose'
  titre: string
  /** La matière, ou la fiche d'un QCM de contenu. */
  detail: string | null
  lien: string | null
  /** Début de la séance, ou instant de la copie. */
  t: number
  justes: number
  /** Questions posées — une place ratée se repose et compte deux fois. */
  total: number
  /** Quiz seulement : la taille demandée, et la fin s'il est fini. */
  taille: number | null
  finieLe: number | null
}

export interface ClotureAdmin {
  chemin: string
  titre: string
  nature: 'matiere' | 'chapitre' | 'fiche'
  closeLe: number
}

export interface ControlePoseAdmin {
  id: number
  titre: string
  matiere: string
  jour: string
  parcours: Parcours | null
}

export interface DetailUtilisateurAdministration {
  id: number
  progression: LigneProgressionAdmin[]
  /** Les jours travaillés, du plus récent au plus ancien. */
  jours: JourAdmin[]
  /** Séances de quiz et copies de QCM, de la plus récente à la plus ancienne. */
  seances: SeanceAdmin[]
  clotures: ClotureAdmin[]
  controles: ControlePoseAdmin[]
  /** Combien de moyennes saisies : le nombre, jamais les notes. */
  notesSaisies: number
}
