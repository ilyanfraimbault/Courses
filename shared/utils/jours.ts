/**
 * Des jours de calendrier, pas des instants.
 *
 * Un contrôle a lieu **le mardi 14 octobre**, pas à 1 760 400 000 000 ms : sa
 * date s'écrit « 2026-10-14 » et se compare comme telle. La ramener à un instant
 * la ferait glisser d'un jour selon le fuseau de qui la lit — le serveur tourne
 * en UTC, l'élève vit à Paris, et « demain » ne tombe pas à la même heure pour
 * les deux.
 *
 * Le seul endroit où un instant redevient nécessaire est « ce qui a été gagné
 * aujourd'hui » : les dates de la base sont des millisecondes, et il faut savoir
 * à quelle milliseconde commence la journée **de l'élève**. D'où `debutDuJour`,
 * qui prend le fuseau en argument au lieu de supposer celui du serveur.
 *
 * Aucun import : ce fichier sert au client comme au serveur.
 */

const MS_JOUR = 24 * 60 * 60 * 1000

/** Le fuseau par défaut, celui du site : un cahier de révisions tenu en France. */
export const FUSEAU_DEFAUT = 'Europe/Paris'

const FORMAT_JOUR = /^(\d{4})-(\d{2})-(\d{2})$/

/** Vrai pour une date de calendrier réelle : « 2026-02-30 » ne passe pas. */
export function jourValide(jour: unknown): jour is string {
  if (typeof jour !== 'string') return false
  const m = FORMAT_JOUR.exec(jour)
  if (!m) return false
  const [a, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(a, mo - 1, j))
  return d.getUTCFullYear() === a && d.getUTCMonth() === mo - 1 && d.getUTCDate() === j
}

/** Le fuseau demandé s'il existe, sinon celui du site. */
export function fuseauValide(fuseau: unknown): string {
  if (typeof fuseau !== 'string' || !fuseau) return FUSEAU_DEFAUT
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau })
    return fuseau
  } catch {
    return FUSEAU_DEFAUT
  }
}

/** Le jour qu'il est, dans ce fuseau, à l'instant `t`. */
export function jourDe(t: number, fuseau: string): string {
  // « en-CA » écrit ses dates en AAAA-MM-JJ : c'est le seul format de
  // calendrier qu'Intl rende directement sous la forme qu'on stocke.
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(t))
}

function minuitUtc(jour: string): number {
  const [a, m, j] = jour.split('-').map(Number)
  return Date.UTC(a!, m! - 1, j!)
}

/** Nombre de jours de `de` à `a` : 1 pour demain, négatif pour hier. */
export function ecartJours(de: string, a: string): number {
  return Math.round((minuitUtc(a) - minuitUtc(de)) / MS_JOUR)
}

/** Le jour `n` jours après `jour`. */
export function decalerJour(jour: string, n: number): string {
  return new Date(minuitUtc(jour) + n * MS_JOUR).toISOString().slice(0, 10)
}

/** L'écart entre l'heure du fuseau et l'heure universelle à l'instant `t`, en ms. */
function decalageFuseau(t: number, fuseau: string): number {
  const parties = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: fuseau,
      hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric'
    }).formatToParts(new Date(t)).map(p => [p.type, p.value]))
  const local = Date.UTC(
    Number(parties.year), Number(parties.month) - 1, Number(parties.day),
    Number(parties.hour), Number(parties.minute), Number(parties.second))
  return local - Math.floor(t / 1000) * 1000
}

/**
 * L'instant où commence `jour` dans ce fuseau.
 *
 * Deux passes, parce que le décalage dépend de l'instant qu'on cherche : un jour
 * de changement d'heure, minuit n'est pas à la même distance de l'UTC que midi.
 */
export function debutDuJour(jour: string, fuseau: string): number {
  const naif = minuitUtc(jour)
  const approche = naif - decalageFuseau(naif, fuseau)
  return naif - decalageFuseau(approche, fuseau)
}
