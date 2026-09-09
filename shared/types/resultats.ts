/**
 * Le format d'export. Il est fait pour être relu par un humain ou par un
 * assistant, pas seulement réimporté : d'où les chemins en clair, les dates en
 * ISO, et les intitulés des fiches recopiés à côté de leur chemin.
 *
 * Il est repris tel quel du portfolio d'origine, à l'octet près : c'est ce qui
 * permet de réimporter ici un export produit là-bas.
 */
export const FORMAT_RESULTATS = 'resultats-cours'
export const VERSION_RESULTATS = 1

export interface QcmTentative {
  /** Horodatage de la copie rendue, en millisecondes. */
  t: number
  justes: number
  total: number
  /** Repères des questions ratées, sous leur forme affichée : « 12. ». */
  ratees: string[]
}

export interface FicheResultat {
  chemin: string
  titre?: string
  /** cours, exercices, entrainement ou qcm. */
  type?: string
  /** Nombre de questions de la fiche au moment de la dernière visite. */
  total: number
  reussies: number
  /** Repères des questions trouvées, sous la forme « bloc#label ». */
  questions: string[]
  /** Dernière modification, en ISO 8601. */
  maj: string
}

export interface QcmResultat {
  chemin: string
  titre?: string
  /** Slug du bloc, utile quand une page porte plusieurs QCM. */
  bloc: string
  tentatives: { date: string, justes: number, total: number, ratees: string[] }[]
}

export interface ResultatsExport {
  format: typeof FORMAT_RESULTATS
  version: number
  exporte_le: string
  fiches: FicheResultat[]
  qcm: QcmResultat[]
}

/** Ce qu'une fiche renvoie au client : sa progression et son historique de QCM. */
export interface DonneesFiche {
  chemin: string
  total: number
  /** Identité complète de question → lettre trouvée, « auto », ou « importe ». */
  faites: Record<string, string>
  /** Slug de bloc → tentatives, de la plus ancienne à la plus récente. */
  qcm: Record<string, QcmTentative[]>
}

export interface ResumeFiche {
  total: number
  reussies: number
  maj: number
}

export interface TodoItem {
  id: number
  chemin: string
  bloc: string | null
  titre: string
  type: string | null
  note: string | null
  fait_le: number | null
  cree_le: number
  /** Questions trouvées sur la cible, calculé côté serveur. */
  reussies: number
}
