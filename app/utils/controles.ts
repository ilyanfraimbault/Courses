/**
 * Ce que les pages des contrôles disent d'une date.
 *
 * Les jours arrivent du serveur en « AAAA-MM-JJ » et le compte à rebours déjà
 * calculé dans le fuseau de l'élève : ici, on ne fait que les écrire en
 * français. Rien n'est recalculé avec l'horloge du navigateur, sans quoi la
 * page et le serveur pourraient ne pas être d'accord sur « demain ».
 */

/** Le fuseau du navigateur, que le serveur utilise pour savoir quel jour il est chez l'élève. */
export function fuseauLocal(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris'
  } catch {
    return 'Europe/Paris'
  }
}

/** « 2026-10-14 » lu comme un jour de calendrier, à midi UTC pour qu'aucun fuseau ne le fasse glisser. */
function commeDate(jour: string): Date {
  return new Date(`${jour}T12:00:00Z`)
}

/** « mardi 14 octobre » */
export function jourLong(jour: string): string {
  return commeDate(jour).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

/** « mar. 14 oct. » */
export function jourCourt(jour: string): string {
  return commeDate(jour).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** « dans 12 jours », « demain », « aujourd'hui », « il y a 3 jours ». */
export function echeance(joursRestants: number): string {
  if (joursRestants === 0) return 'aujourd\'hui'
  if (joursRestants === 1) return 'demain'
  if (joursRestants === -1) return 'hier'
  if (joursRestants > 1) return `dans ${joursRestants} jours`
  return `il y a ${-joursRestants} jours`
}

/** La part sue d'un programme, en pour cent entier. */
export function partSue(etat: { questions: number, sues: number }): number {
  return etat.questions ? Math.round(100 * etat.sues / etat.questions) : 0
}

/**
 * Ce que la journée demande, en une phrase. Elle sert la liste des contrôles
 * et le tableau de bord, qui n'ont la place que pour une ligne.
 */
export function consigneDuJour(c: {
  joursRestants: number
  etat: { questions: number, sues: number, dette: number }
  aujourdhui: { jour: { parts: unknown[], blanc: boolean, dette: boolean }, questions: number, gagnees: number } | null
}): string {
  const a = c.aujourdhui
  if (!a) return c.joursRestants < 0 ? 'Passé' : 'Rien de prévu'
  if (a.jour.parts.length) {
    const restent = Math.max(0, a.questions - a.gagnees)
    return restent
      ? `${restent} question${restent > 1 ? 's' : ''} à apprendre aujourd'hui`
      : 'Journée faite — de quoi prendre de l\'avance'
  }
  if (a.jour.blanc) return 'Examen blanc aujourd\'hui'
  if (a.jour.dette && c.etat.dette) return `${c.etat.dette} question${c.etat.dette > 1 ? 's' : ''} à retrouver`
  if (c.joursRestants === 0) return 'C\'est aujourd\'hui'
  if (c.etat.sues === c.etat.questions) return 'Programme su'
  return 'Journée libre'
}

/** Les segments d'une barre de préparation : ce qui est su, puis ce qui est en dette. */
export function segmentsControle(etat: { sues: number, dette: number }, avecIntitules = false) {
  return [
    { value: etat.sues, color: 'success' as const, label: avecIntitules ? 'Su' : undefined },
    {
      value: etat.dette,
      color: 'error' as const,
      label: avecIntitules ? 'Raté, à retrouver' : undefined,
      // Deux teintes qui se touchent se lisent comme une seule : un liseré de la
      // couleur du fond les sépare, comme sur « Mes domaines ».
      ui: etat.sues ? { segment: 'border-s-2 border-(--ui-bg)' } : undefined
    }
  ]
}
