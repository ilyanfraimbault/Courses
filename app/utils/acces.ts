/**
 * Ce qui se lit sans session : de quoi se connecter, et rien d'autre. Les
 * fiches elles-mêmes demandent un compte — ce sont les cours des professeurs,
 * partagés avec la classe et pas au delà. Le middleware s'en sert pour garder
 * les pages, la déconnexion pour savoir si l'on peut rester où l'on est.
 *
 * C'est un confort de navigation : les données, elles, sont gardées au serveur
 * (`server/middleware/contenu.ts`).
 */
const PUBLIQUES = ['/connexion', '/inscription']

export function estPublique(chemin: string): boolean {
  return PUBLIQUES.some(p => chemin === p || chemin.startsWith(p + '/'))
}

/** La page où un compte sans accès demande à en avoir un. */
export const PAGE_DEMANDE = '/demande'

export function estAdministration(chemin: string): boolean {
  return chemin === '/admin' || chemin.startsWith('/admin/')
}
