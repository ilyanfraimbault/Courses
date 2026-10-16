/** Ce qu'on peut clore. Une année ne se clôt pas : on clôt ses matières. */
export type NatureCloture = 'matiere' | 'chapitre' | 'fiche'

/** Une clôture, telle que l'écran la nomme. Voir `docs/clotures.md`. */
export interface Cloture {
  chemin: string
  nature: NatureCloture
  titre: string
  /** Le chemin de la matière, pour ranger les clôtures d'un écran à l'autre. */
  matiere: string | null
  close_le: number
}
