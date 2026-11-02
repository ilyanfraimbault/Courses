/**
 * Ce que l'administration voit des comptes : des **comptes**, jamais le détail
 * des réponses. Combien de questions trouvées, où, et quand on est passé pour
 * la dernière fois — de quoi savoir qui avance et qui a décroché, sans relire
 * la copie de personne.
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
  admin: boolean
  inscritLe: number
  /** La trace la plus récente, toutes tables confondues. Nulle pour un compte jamais servi. */
  derniereActivite: number | null
  /** Questions trouvées qui existent encore dans le contenu. */
  acquises: number
  /** Même compte, matière par matière, indexé par chemin de matière. */
  parMatiere: Record<string, number>
  fichesOuvertes: number
  /** Questions ratées dont la dette court toujours. */
  enDette: number
  /** Toutes les fautes, rattrapées comprises : ce qui a coûté, pas ce qui reste. */
  fautes: number
  quiz: { seances: number, reponses: number, justes: number }
  qcm: { copies: number, composes: number }
  controles: number
  todo: { total: number, faites: number }
}

export interface VueAdministration {
  /** Toutes les questions identifiables du site. */
  questions: number
  matieres: MatiereAdministration[]
  utilisateurs: UtilisateurAdministration[]
}
