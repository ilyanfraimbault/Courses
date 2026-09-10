import { randomBytes } from 'node:crypto'

let factice: Promise<string> | null = null

/**
 * Une empreinte scrypt valide dont personne ne connaît l'antécédent.
 *
 * Elle sert à faire travailler la vérification même quand le pseudo est
 * inconnu : sans elle, une connexion sur un compte inexistant répondrait
 * beaucoup plus vite que sur un compte réel, et ce simple écart de temps
 * donnerait la liste des pseudos existants à qui prendrait la peine de mesurer.
 *
 * Elle est calculée une fois, à la première connexion ratée, à partir d'une
 * valeur aléatoire — et non écrite en dur, une empreinte figée dans le code
 * n'ayant aucune garantie d'être un scrypt bien formé.
 */
export function empreinteFactice(): Promise<string> {
  factice ??= hashPassword(randomBytes(32).toString('base64'))
  return factice
}
