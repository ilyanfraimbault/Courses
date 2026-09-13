/**
 * La progression rangée par **domaine** — le point de cours — plutôt que par
 * fiche.
 *
 * Une fiche est un contenant : « Exercices de trigonométrie », c'est un fichier,
 * pas un sujet. Ce dont on veut savoir si on le tient, c'est « le cercle
 * trigonométrique », « le module d'un complexe », « la dérivée d'un quotient ».
 * Ces sujets existent déjà dans le contenu — ce sont les rappels de cours que
 * les questions visent — et le relevé du build les porte question par question.
 *
 * Deux avancées se distinguent ici, et c'est tout l'intérêt de la vue :
 * une question trouvée du premier coup et une question trouvée après s'être
 * trompé comptent toutes les deux, mais ne disent pas la même chose.
 */

/** Ce que toute ligne de la page sait compter, du domaine à la matière. */
export interface CompteProgression {
  /** Questions rattachées, questions ouvertes comprises. */
  questions: number
  /** Celles qui ont fini par être trouvées, sur une fiche, au quiz ou dans un QCM. */
  acquises: number
  /**
   * Parmi les acquises, celles qui ont coûté au moins une faute — au quiz ou
   * dans un QCM. C'est le seul écart qu'on sache mesurer entre « su » et
   * « retrouvé ».
   */
  hesitantes: number
  /** Celles que le quiz sait poser : à zéro, proposer une séance serait mentir. */
  interrogeables: number
}

export interface DomaineProgression extends CompteProgression {
  /**
   * « /chemin/du/chapitre#identifiant-extrait », la clé que le filtre du quiz
   * attend. Elle est nulle pour les questions qui ne renvoient à aucun rappel de
   * cours : on les regroupe pour que le compte du chapitre tombe juste, mais le
   * quiz ne sait pas viser ce tas-là.
   */
  cle: string | null
  titre: string
}

export interface ChapitreProgression extends CompteProgression {
  /** Chemin du chapitre : « /cours/a1/remise-a-niveau-maths/trigonometrie ». */
  cle: string
  titre: string
  icone: string | null
  /** Chemin du sommaire du chapitre, quand il existe. */
  chemin: string | null
  /** Ses domaines, le moins acquis d'abord : c'est là qu'on a quelque chose à faire. */
  domaines: DomaineProgression[]
}

/** Une matière et ses chapitres : on ne mêle pas la progression de deux cours. */
export interface MatiereProgression extends CompteProgression {
  /** Chemin de la matière : « /cours/a1/remise-a-niveau-maths ». */
  cle: string
  titre: string
  /** Intitulé de l'année qui la porte. */
  annee: string | null
  icone: string | null
  chemin: string | null
  chapitres: ChapitreProgression[]
}

export interface ProgressionDomaines {
  matieres: MatiereProgression[]
  total: CompteProgression
}
