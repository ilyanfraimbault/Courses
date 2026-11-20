import type { Parcours } from './matieres'

/**
 * Les contrôles : l'agenda de la classe.
 *
 * Un contrôle est une date dans une matière, pour toute la classe ou pour un
 * parcours. Le programme, s'il est connu, désigne des chemins du cours —
 * chapitres, fiches, ou « /fiche#bloc » pour un exercice. Voir
 * `docs/controles.md`.
 */
export interface Controle {
  id: number
  titre: string
  /** Code de la matière (« s5-ethical-hacking »). */
  matiere: string
  matiereTitre: string | null
  /** Le chemin du cours de la matière, quand il y en a un sur le site. */
  cours: string | null
  /** « 2026-10-14 » */
  jour: string
  /** Jours avant le contrôle, dans le fuseau de l'élève : 0 le jour même, négatif une fois passé. */
  joursRestants: number
  /** Nul : toute la classe. */
  parcours: Parcours | null
  programme: string[]
  precisions: string | null
  /** Pseudo de qui l'a posé. */
  auteur: string | null
  /** Vrai pour son auteur et pour l'administration. */
  modifiable: boolean
}

/** Ce que le formulaire envoie, à la création comme à la retouche. */
export interface ValeursControle {
  titre: string
  matiere: string
  jour: string
  parcours: Parcours | null
  programme: string[]
  precisions: string | null
}
