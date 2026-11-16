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
  }
}

export {}
