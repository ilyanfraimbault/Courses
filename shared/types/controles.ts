/**
 * Les contrôles : une date, une matière, un programme — et de quoi arriver prêt.
 *
 * Un contrôle n'a pas de questions à lui, pas plus qu'un QCM composé. Il retient
 * **ce sur quoi il porte**, dans la nomenclature du quiz (chapitres et sections
 * du cours), et tout le reste se recalcule à chaque lecture : ce qui est su, ce
 * qui est en dette, ce qu'il reste à voir et comment l'étaler d'ici au jour J.
 * Voir `docs/controles.md`.
 */

/** Ce sur quoi porte un contrôle. Rien de coché : toute la matière. */
export interface ProgrammeControle {
  themes: string[]
  sections: string[]
}

/**
 * Où en est un ensemble de questions, vu depuis le contrôle.
 *
 * Trois états qui ne se chevauchent pas, et dont la somme fait `questions` :
 * - **sues** — trouvées un jour, et pas ratées depuis ;
 * - **dette** — ratées quelque part, et pas encore retrouvées ;
 * - le reste — jamais trouvées.
 */
export interface EtatControle {
  questions: number
  sues: number
  dette: number
}

/** Une section du programme, telle que la feuille de route la manipule. */
export interface SectionControle extends EtatControle {
  /** La clé de la section dans le filtre du quiz : « /chemin/de/la/page#ancre ». */
  cle: string
  titre: string
  /** Chemin du chapitre, et son intitulé. */
  theme: string | null
  themeTitre: string | null
  /** Questions devenues sues aujourd'hui : ce qui fait avancer la journée. */
  gagneesAujourdhui: number
  /**
   * Ce qu'il restait à apprendre ce matin : le reste d'aujourd'hui, plus ce qui
   * a été gagné depuis. La feuille de route se découpe sur ce chiffre, pour que
   * finir sa journée ne fasse pas glisser celle de demain dans celle-ci.
   */
  restantesCeMatin: number
}

/**
 * Un morceau de section prévu pour une journée. Une grosse section s'étale sur
 * plusieurs jours : `questions` dit la part de celui-ci.
 */
export interface PartJour {
  cle: string
  questions: number
}

/** Un jour de la feuille de route. */
export interface JourControle {
  /** « 2026-10-14 » */
  jour: string
  /** Jours restant avant le contrôle ce jour-là : 3 pour « J-3 ». */
  rang: number
  /** Ce qu'il y a à apprendre ce jour-là, dans l'ordre du cours. */
  parts: PartJour[]
  /** La charge de la journée : la somme de ses morceaux. */
  questions: number
  /** Le jour de l'examen blanc. */
  blanc: boolean
  /** Le jour où l'on solde la dette : la veille, et le jour même. */
  dette: boolean
}

/** Le dernier examen blanc, tel que la page du contrôle le résume. */
export interface ExamenBlancControle {
  /** Le QCM composé qui le porte : il se passe dans « Mes QCM ». */
  id: number
  questions: number
  derniere: { t: number, justes: number, total: number } | null
}

/** Un contrôle tel que la liste le résume. */
export interface ResumeControle {
  id: number
  titre: string
  matiere: string
  matiereTitre: string | null
  annee: string | null
  jour: string
  /** Jours avant le contrôle : 0 le jour même, négatif une fois passé. */
  joursRestants: number
  etat: EtatControle
  /**
   * Ce que la journée demande, et ce qu'elle a déjà rendu. Nul quand il n'y a
   * rien à faire aujourd'hui : contrôle passé, ou programme déjà su.
   */
  aujourdhui: { jour: JourControle, questions: number, gagnees: number } | null
  note: number | null
  bareme: number | null
}

/** Un contrôle ouvert : son programme, son état et sa feuille de route. */
export interface Controle extends ResumeControle {
  programme: ProgrammeControle
  /** Parties du programme que le contenu ne porte plus : elles ne comptent plus. */
  manquantes: number
  /** Les sections du programme, dans l'ordre du cours. */
  sections: SectionControle[]
  /** Aujourd'hui compris, jusqu'au jour J. Vide une fois le contrôle passé. */
  feuille: JourControle[]
  examenBlanc: ExamenBlancControle | null
  /** Taille d'un examen blanc composé maintenant. */
  tailleBlanc: number
}

/** Ce que le formulaire d'un contrôle envoie, à la création comme à la retouche. */
export interface ValeursControle {
  titre: string
  matiere: string | null
  jour: string
  themes: string[]
  sections: string[]
}
