/**
 * Ce qu'on a travaillé un jour donné, rangé comme le cours : matière, chapitre,
 * fiche, exercice. Un sommaire, pas un relevé : chaque niveau dit combien de
 * questions il a vu passer ce jour-là, et rien de ce qui a été répondu.
 */

export interface ActiviteExercice {
  /** Slug du bloc, seconde pièce de l'identité des questions. */
  bloc: string
  titre: string
  questions: number
}

export interface ActiviteFiche {
  chemin: string
  titre: string
  questions: number
  exercices: ActiviteExercice[]
}

export interface ActiviteChapitre {
  /** Nul quand la fiche n'est pas rangée dans un chapitre. */
  chemin: string | null
  titre: string
  questions: number
  fiches: ActiviteFiche[]
}

export interface ActiviteMatiere {
  /** Nul pour ce que le contenu ne porte plus. */
  chemin: string | null
  titre: string
  questions: number
  chapitres: ActiviteChapitre[]
}

export interface ActiviteJour {
  jour: string
  matieres: ActiviteMatiere[]
}
