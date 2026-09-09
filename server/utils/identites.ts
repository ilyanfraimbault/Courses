/**
 * Une identité de question a la forme « /chemin/de/la/fiche#bloc#label ».
 * Le serveur l'éclate pour la ranger en trois colonnes, et la recompose pour la
 * rendre au client sous la forme exacte que les composants attendent.
 *
 * `slugifier` ne produit que [a-z0-9-] : un slug de bloc ne peut donc pas
 * contenir de « # », et découper sur le premier « # » après le chemin est sûr.
 */
export interface Identite {
  bloc: string
  label: string
}

export function decouperIdentite(chemin: string, identite: string): Identite | null {
  if (!identite.startsWith(chemin + '#')) return null
  const reste = identite.slice(chemin.length + 1)
  const i = reste.indexOf('#')
  if (i <= 0 || i === reste.length - 1) return null
  return { bloc: reste.slice(0, i), label: reste.slice(i + 1) }
}

export function composerIdentite(chemin: string, bloc: string, label: string): string {
  return `${chemin}#${bloc}#${label}`
}

/** Chemin de fiche sous sa forme canonique, sans barre oblique finale. */
export function cheminCanonique(chemin: string): string {
  return chemin.replace(/\/+$/, '') || '/'
}
