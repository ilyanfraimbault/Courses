import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import type { Controle } from '~~/shared/types/controles'
import { estParcours, type MatiereSite, type Parcours } from '~~/shared/types/matieres'
import { debutDuJour, decalerJour, ecartJours, fuseauValide, jourDe, jourValide } from '~~/shared/utils/jours'

/**
 * Les contrôles : l'agenda de la classe. Voir `docs/controles.md`.
 *
 * Un contrôle est une date, une matière, et ceux qu'il concerne — toute la
 * classe, ou un parcours. N'importe quel élève en pose un, pour tous ; seuls
 * son auteur et l'administration le changent ou le retirent. Il ne calcule
 * rien : pas de feuille de route, pas de séance. Le programme, quand on le
 * connaît, n'est qu'une liste de chemins du cours — chapitres, fiches,
 * exercices — dont les intitulés se relisent dans le contenu.
 *
 * C'est la seule donnée du site qu'un compte lit au delà de la sienne. Ce qui
 * la garde : le parcours, relu en base, décide de ce qu'on voit ; l'auteur, lu
 * en base, décide de ce qu'on change. Rien ne vient du corps de la requête.
 */

/** « Aujourd'hui » chez l'élève, et les instants qui le bornent. */
export function maintenantPour(event: H3Event): { aujourdhui: string, debut: number, fin: number } {
  const fuseau = fuseauValide(getQuery(event).fuseau)
  const aujourdhui = jourDe(Date.now(), fuseau)
  return { aujourdhui, debut: debutDuJour(aujourdhui, fuseau), fin: debutDuJour(decalerJour(aujourdhui, 1), fuseau) }
}

interface LigneControle {
  id: number
  auteur_id: number | null
  auteur: string | null
  titre: string
  matiere: string
  jour: string
  parcours: string | null
  programme: string
  precisions: string | null
}

const SELECTION = `
  SELECT c.id, c.auteur_id, u.pseudo AS auteur, c.titre, c.matiere, c.jour, c.parcours, c.programme, c.precisions
  FROM controle_classe c LEFT JOIN utilisateur u ON u.id = c.auteur_id
`

function lireListe(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Ce qu'un compte voit d'un contrôle, et s'il peut le changer. */
export interface Lecteur {
  uid: number
  parcours: Parcours | null
  admin: boolean
}

export function lecteur(event: H3Event, db: DatabaseSync, uid: number): Lecteur {
  return { uid, parcours: parcoursDuCompte(db, uid), admin: estAdministrateur(event, db, uid) }
}

/** Un contrôle pour tous, ou pour le parcours du lecteur. L'administration voit tout. */
function concerne(l: Lecteur, parcours: string | null) {
  return l.admin || parcours === null || parcours === l.parcours
}

/**
 * Ce que le lecteur voit : ce qui le concerne, et toujours ce qu'il a posé lui-même
 * — un DL qui planifie le TP des SR, ou qui change de parcours ensuite, ne doit
 * pas perdre de vue un contrôle qu'il est seul à pouvoir corriger.
 */
function visible(l: Lecteur, ligne: LigneControle) {
  return concerne(l, ligne.parcours) || (ligne.auteur_id !== null && ligne.auteur_id === l.uid)
}

function presenter(ligne: LigneControle, l: Lecteur, matieres: Map<string, MatiereSite>, aujourdhui: string): Controle {
  const matiere = matieres.get(ligne.matiere)
  return {
    id: ligne.id,
    titre: ligne.titre,
    matiere: ligne.matiere,
    matiereTitre: matiere?.intitule ?? null,
    cours: matiere?.cours ?? null,
    jour: ligne.jour,
    joursRestants: ecartJours(aujourdhui, ligne.jour),
    parcours: estParcours(ligne.parcours) ? ligne.parcours : null,
    programme: lireListe(ligne.programme),
    precisions: ligne.precisions,
    auteur: ligne.auteur,
    modifiable: l.admin || (ligne.auteur_id !== null && ligne.auteur_id === l.uid)
  }
}

export async function listerControles(event: H3Event, db: DatabaseSync, l: Lecteur): Promise<Controle[]> {
  const { aujourdhui } = maintenantPour(event)
  const matieres = new Map((await lireMatieres(event, db)).map(m => [m.code, m]))
  return (db.prepare(`${SELECTION} ORDER BY c.jour, c.id`).all() as unknown as LigneControle[])
    .filter(c => visible(l, c))
    .map(c => presenter(c, l, matieres, aujourdhui))
}

/** Un contrôle que le lecteur a le droit de voir, sinon 404 : ce qu'on ne voit pas n'existe pas. */
export async function lireControle(event: H3Event, db: DatabaseSync, l: Lecteur, id: number): Promise<Controle> {
  const ligne = db.prepare(`${SELECTION} WHERE c.id = ?`).get(id) as LigneControle | undefined
  if (!ligne || !visible(l, ligne)) throw createError({ statusCode: 404, statusMessage: 'contrôle introuvable' })
  const { aujourdhui } = maintenantPour(event)
  const matieres = new Map((await lireMatieres(event, db)).map(m => [m.code, m]))
  return presenter(ligne, l, matieres, aujourdhui)
}

export function idControle(event: H3Event): number {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'identifiant invalide' })
  return id
}

/**
 * L'intitulé est facultatif : « Contrôle — Ethical hacking » suffit le plus
 * souvent, et l'élève qui planifie n'a que la date et la matière en tête.
 */
export function titreControle(valeur: unknown, matiere: MatiereSite): string {
  if (valeur !== undefined && valeur !== null && typeof valeur !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'intitulé invalide' })
  }
  const titre = (valeur ?? '').trim().replace(/\s+/g, ' ') || `Contrôle — ${matiere.intitule}`
  if (titre.length > 120) throw createError({ statusCode: 400, statusMessage: 'intitulé trop long (120 caractères au plus)' })
  return titre
}

export function jourControle(valeur: unknown): string {
  if (!jourValide(valeur)) throw createError({ statusCode: 400, statusMessage: 'date invalide' })
  return valeur
}

export function precisionsControle(valeur: unknown): string | null {
  if (valeur === null || valeur === undefined) return null
  if (typeof valeur !== 'string') throw createError({ statusCode: 400, statusMessage: 'précisions invalides' })
  const texte = valeur.trim()
  if (texte.length > 2000) throw createError({ statusCode: 400, statusMessage: 'précisions trop longues (2000 caractères au plus)' })
  return texte || null
}

/**
 * La matière, et à qui le contrôle s'adresse.
 *
 * Une matière d'un parcours ne concerne que lui : le contrôle prend son
 * parcours, quoi qu'on demande. Une matière commune laisse le choix — tout le
 * monde, ou un seul parcours quand les groupes passent à des dates différentes.
 * On ne pose pas de contrôle dans une matière qu'on ne voit pas.
 */
export function matiereEtParcours(matieres: MatiereSite[], l: Lecteur, codeMatiere: unknown, parcours: unknown): { matiere: MatiereSite, parcours: Parcours | null } {
  const matiere = matieres.find(m => m.code === codeMatiere)
  if (!matiere || !concerne(l, matiere.parcours)) throw createError({ statusCode: 400, statusMessage: 'matière inconnue' })
  if (matiere.parcours) return { matiere, parcours: matiere.parcours }
  if (parcours === null || parcours === undefined) return { matiere, parcours: null }
  if (!estParcours(parcours)) throw createError({ statusCode: 400, statusMessage: 'parcours inconnu' })
  return { matiere, parcours }
}

/**
 * Le programme : des chemins du cours de la matière, et rien d'autre.
 *
 * Un chemin hors de la matière est refusé — un contrôle ne mélange pas deux
 * cours. On ne vérifie pas plus finement qu'il existe : le contenu bouge, et un
 * exercice renommé doit laisser le contrôle lisible, pas le rendre invalide.
 */
export function programmeControle(matiere: MatiereSite, valeur: unknown): string[] {
  if (valeur === null || valeur === undefined) return []
  if (!Array.isArray(valeur) || valeur.some(v => typeof v !== 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'programme invalide' })
  }
  const chemins = [...new Set(valeur as string[])]
  if (chemins.length > 200) throw createError({ statusCode: 400, statusMessage: 'programme trop long' })
  if (chemins.length && !matiere.cours) throw createError({ statusCode: 400, statusMessage: 'cette matière n\'a pas de cours sur le site' })
  // Le chemin du cours lui-même veut dire « toute la matière ».
  const prefixe = `${matiere.cours}/`
  if (chemins.some(c => c !== matiere.cours && !c.startsWith(prefixe))) {
    throw createError({ statusCode: 400, statusMessage: 'le programme sort de la matière' })
  }
  return chemins
}
