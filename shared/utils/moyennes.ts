/**
 * Le calcul des moyennes, en un seul endroit.
 *
 * - **Une UE** : la moyenne de ses matières pondérée par leur coefficient.
 * - **Un semestre** : la moyenne de ses UE pondérée par leurs ECTS — l'UE
 *   Entreprise comprise, qui a sa propre case.
 *
 * Une moyenne ne porte que sur ce qui est **renseigné** : une UE dont on ne
 * connaît encore qu'une note a pour moyenne cette note, et un semestre ne
 * compte que les UE qui en ont une. C'est une moyenne provisoire, et l'écran le
 * dit en donnant la part renseignée. Une matière sans coefficient (DevOps,
 * séminaire créativité) n'entre dans aucun calcul.
 *
 * Aucun import : ce fichier sert au client comme au serveur.
 */

interface Pondere {
  valeur: number | null
  poids: number | null
}

/** La moyenne pondérée de ce qui a une valeur et un poids positif ; nulle s'il n'y a rien. */
export function moyennePonderee(elements: Pondere[]): number | null {
  let somme = 0
  let poids = 0
  for (const e of elements) {
    if (e.valeur === null || !e.poids || e.poids <= 0) continue
    somme += e.valeur * e.poids
    poids += e.poids
  }
  return poids ? somme / poids : null
}

export function moyenneUe(ue: { matieres: { note: number | null, coef: number | null }[] }): number | null {
  return moyennePonderee(ue.matieres.map(m => ({ valeur: m.note, poids: m.coef })))
}

export function moyenneSemestre(ues: { ects: number, matieres: { note: number | null, coef: number | null }[] }[]): number | null {
  return moyennePonderee(ues.map(ue => ({ valeur: moyenneUe(ue), poids: ue.ects })))
}

/**
 * Le semestre en cours : la promotion entre au S5 en septembre 2026, et chaque
 * semestre dure six mois.
 */
export function semestreCourant(maintenant = new Date()): number {
  const mois = (maintenant.getFullYear() - 2026) * 12 + maintenant.getMonth() - 8
  return Math.min(10, Math.max(5, 5 + Math.floor(mois / 6)))
}

/** « 12,35 » : deux décimales, à la française. */
export function ecrireMoyenne(valeur: number | null): string {
  return valeur === null ? '—' : valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
