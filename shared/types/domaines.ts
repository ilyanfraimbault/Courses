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

export interface DomaineProgression {
  /**
   * « chapitre/identifiant-extrait », la clé que le filtre du quiz attend. Elle
   * est nulle pour les questions qui ne renvoient à aucun rappel de cours : on
   * les regroupe pour que le compte du chapitre tombe juste, mais le quiz ne
   * sait pas viser ce tas-là.
   */
  cle: string | null
  titre: string
  /** Questions du site rattachées à ce domaine, questions ouvertes comprises. */
  questions: number
  /** Celles qui ont fini par être trouvées, sur une fiche ou au quiz. */
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

export interface ChapitreProgression {
  /** Slug du chapitre : « trigonometrie ». */
  cle: string
  titre: string
  icone: string | null
  /** Chemin du sommaire du chapitre, quand il existe. */
  chemin: string | null
  questions: number
  acquises: number
  hesitantes: number
  interrogeables: number
  /** Ses domaines, le moins acquis d'abord : c'est là qu'on a quelque chose à faire. */
  domaines: DomaineProgression[]
}

export interface ProgressionDomaines {
  chapitres: ChapitreProgression[]
  total: {
    questions: number
    acquises: number
    hesitantes: number
    interrogeables: number
  }
}
