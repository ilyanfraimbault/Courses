declare module '#auth-utils' {
  interface User {
    /** Identifiant en base : c'est lui qui cadre toutes les requêtes de données. */
    id: number
    pseudo: string
    /**
     * Posé à chaque lecture de la session (`server/plugins/session-administration.ts`),
     * jamais scellé dedans. Il n'ouvre rien : il affiche l'entrée de menu.
     */
    admin?: boolean
    /**
     * Posé de même à chaque lecture. Seul « accorde » ouvre les pages de travail ;
     * les deux autres ne mènent qu'à la demande d'accès.
     */
    acces?: 'aucun' | 'demande' | 'accorde'
    /**
     * Posé de même à chaque lecture : le parcours choisi, nul tant qu'il ne
     * l'est pas — et c'est ce nul qui ouvre la fenêtre de choix. Il choisit ce
     * que la page montre ; le serveur relit le sien en base.
     */
    parcours?: 'dl' | 'sr' | null
    /** Posés de même : ce que l'élève a dit de lui au premier passage. */
    prenom?: string | null
    nom?: string | null
  }
}

export {}
