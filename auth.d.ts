declare module '#auth-utils' {
  interface User {
    /** Identifiant en base : c'est lui qui cadre toutes les requêtes de données. */
    id: number
    pseudo: string
  }
}

export {}
