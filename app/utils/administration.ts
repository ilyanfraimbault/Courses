/**
 * Ce que les tableaux de l'administration disent d'un compte, d'une date,
 * d'une proportion. Des écritures, pas des calculs : les chiffres arrivent
 * tout faits du serveur.
 */

/** « Chloé Martin », ou le pseudo tant que l'élève n'a pas dit son nom. */
export function nomDuCompte(u: { prenom: string | null, nom: string | null, pseudo: string }): string {
  const nom = [u.prenom, u.nom].filter(Boolean).join(' ')
  return nom || u.pseudo
}

/** Sans accents ni majuscules : chercher « chloe » trouve « Chloé ». */
export function replierTexte(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function proportion(n: number, sur: number): number {
  return sur ? Math.round(100 * n / sur) : 0
}

/** « 3 fiches », « 1 fiche » — le pluriel régulier suffit au vocabulaire de ces tableaux. */
export function accorder(n: number, mot: string, pluriel = `${mot}s`): string {
  return `${n} ${n > 1 ? pluriel : mot}`
}

const RELATIF = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
const UNITES: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400_000],
  ['month', 30 * 86_400_000],
  ['week', 7 * 86_400_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000]
]

/** « il y a 3 jours », par rapport à un « maintenant » figé par la page. */
export function depuisQuand(t: number | null, maintenant: number): string {
  if (!t) return 'jamais'
  const ecart = t - maintenant
  for (const [unite, ms] of UNITES) {
    if (Math.abs(ecart) >= ms) return RELATIF.format(Math.round(ecart / ms), unite)
  }
  return 'à l\'instant'
}

/** « 14 oct. 2026 » */
export function dateCourte(t: number): string {
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** « 14 oct. 2026, 18:42 » */
export function dateEtHeure(t: number): string {
  return new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** La couleur d'un score : ce qui passe, ce qui hésite, ce qui coince. */
export function couleurScore(part: number): 'success' | 'warning' | 'error' {
  return part >= 75 ? 'success' : part >= 50 ? 'warning' : 'error'
}
