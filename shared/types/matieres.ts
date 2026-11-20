/**
 * Les matières du programme de l'école, les parcours, et les notes.
 * Voir `docs/matieres.md`.
 */

/** Le parcours choisi à partir du S7 : développement logiciel, ou systèmes et réseaux. */
export type Parcours = 'dl' | 'sr'

export const PARCOURS: Record<Parcours, { court: string, long: string }> = {
  dl: { court: 'DL', long: 'Développement logiciel' },
  sr: { court: 'SR', long: 'Systèmes et réseaux' }
}

export function estParcours(valeur: unknown): valeur is Parcours {
  return valeur === 'dl' || valeur === 'sr'
}

/** Une matière telle que le site la connaît : au programme, hors programme, ou ajoutée par un élève. */
export interface MatiereSite {
  /** L'identité de la matière : « s5-ethical-hacking ». */
  code: string
  intitule: string
  semestre: number | null
  /** « 5.5 ASSI », nul hors programme. */
  ue: string | null
  /** Nul : commune aux deux parcours. */
  parcours: Parcours | null
  coef: number | null
  /** Le chemin de son cours sur le site, quand il y en a un. */
  cours: string | null
  /** Vrai pour une matière ajoutée depuis le site. */
  ajoutee: boolean
}

export interface MatiereNotee {
  id: number
  code: string
  intitule: string
  coef: number | null
  heures: number | null
  /** Sur 20, nulle tant que rien n'est saisi. */
  note: number | null
}

export interface UeNotee {
  code: string
  intitule: string
  ects: number
  parcours: Parcours | null
  matieres: MatiereNotee[]
}

export interface SemestreNote {
  semestre: number
  ues: UeNotee[]
}

export interface MesNotes {
  parcours: Parcours | null
  semestres: SemestreNote[]
}
