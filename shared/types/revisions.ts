/**
 * La révision espacée, matière par matière : ce qui revient aujourd'hui, ce qui
 * reviendra demain, et ce qui attend dans la dette. Voir `docs/revisions.md`.
 */
export interface RevisionsMatiere {
  /** Chemin de la matière. */
  cle: string
  titre: string
  annee: string | null
  icone: string | null
  /** Questions sues dont l'échéance tombe aujourd'hui ou est passée. */
  aRevoir: number
  /** Celles qui reviendront demain, en plus. */
  demain: number
  /** Toutes les questions sues de la matière, donc suivies par le calendrier. */
  suivies: number
  /** Questions ratées et pas encore retrouvées. */
  enDette: number
  /**
   * Questions jamais trouvées ni ratées : ce qui remplit la séance du jour
   * quand la dette et les révisions n'y suffisent pas.
   */
  nouvelles: number
  /** Le prochain jour où quelque chose revient, quand rien ne revient aujourd'hui. */
  prochaine: string | null
}

export interface Revisions {
  matieres: RevisionsMatiere[]
  /** Le jour qu'il est chez l'élève, « AAAA-MM-JJ ». */
  aujourdhui: string
}
