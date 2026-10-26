/**
 * Ce qui se lit sans session : les fiches, et de quoi se connecter. Le reste
 * n'a de sens que connecté. Le middleware s'en sert pour garder les pages, la
 * déconnexion pour savoir si l'on peut rester où l'on est.
 */
const PUBLIQUES = ['/cours', '/connexion', '/inscription']

export function estPublique(chemin: string): boolean {
  return PUBLIQUES.some(p => chemin === p || chemin.startsWith(p + '/'))
}

export function estAdministration(chemin: string): boolean {
  return chemin === '/admin' || chemin.startsWith('/admin/')
}
