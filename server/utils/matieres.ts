import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import type { MatiereSite, Parcours } from '~~/shared/types/matieres'
import { estParcours } from '~~/shared/types/matieres'
import { niveauxDuChemin } from '~~/shared/utils/niveaux'

/**
 * Les matières du site : la table `matiere`, reliée au cours.
 *
 * Le lien va **du cours vers la table** : la page d'index d'une matière écrit
 * le code qu'elle enseigne (`programme:` en frontmatter). Un camarade qui
 * apporte un cours n'a donc qu'un fichier à écrire, sans toucher à la base ;
 * et une matière du cours qui ne nomme aucun code reste visible, hors
 * programme, sous son chemin — elle n'attend pas qu'on l'inscrive pour exister.
 */

interface LigneMatiere {
  code: string
  intitule: string
  semestre: number | null
  ue: string | null
  parcours: string | null
  coef: number | null
  cree_par: number | null
}

interface PageMatiere {
  path: string
  title: string
  programme?: string | null
}

/** Les pages d'index de matière, et le code de programme que chacune déclare. */
async function pagesDeMatiere(event: H3Event): Promise<PageMatiere[]> {
  const pages = await collectionCours(event).select('path', 'title', 'programme').all() as unknown as PageMatiere[]
  return pages
    .map(p => ({ ...p, path: cheminCanonique(p.path) }))
    .filter(p => niveauxDuChemin(p.path).matiere === p.path)
}

export async function lireMatieres(event: H3Event, db: DatabaseSync): Promise<MatiereSite[]> {
  const lignes = db.prepare(`
    SELECT m.code, m.intitule, u.semestre, u.code AS ue, u.parcours, m.coef, m.cree_par
    FROM matiere m LEFT JOIN ue u ON u.id = m.ue_id
    ORDER BY u.semestre IS NULL, u.semestre, u.ordre, m.ordre, m.intitule
  `).all() as unknown as LigneMatiere[]

  const pages = await pagesDeMatiere(event)
  const coursParCode = new Map<string, string>()
  for (const p of pages) if (p.programme) coursParCode.set(p.programme, p.path)

  const matieres: MatiereSite[] = lignes.map(l => ({
    code: l.code,
    intitule: l.intitule,
    semestre: l.semestre,
    ue: l.ue,
    parcours: estParcours(l.parcours) ? l.parcours : null,
    coef: l.coef,
    cours: coursParCode.get(l.code) ?? null,
    ajoutee: l.cree_par !== null
  }))

  // Un cours qui ne nomme aucune matière connue : hors programme, commun, et
  // désigné par son chemin.
  const connus = new Set(lignes.map(l => l.code))
  for (const p of pages) {
    if (p.programme && connus.has(p.programme)) continue
    matieres.push({ code: p.path, intitule: p.title, semestre: null, ue: null, parcours: null, coef: null, cours: p.path, ajoutee: false })
  }
  return matieres
}

/** Prénom, nom et parcours du compte, relus en base. */
export function profilDuCompte(db: DatabaseSync, uid: number): { prenom: string | null, nom: string | null, parcours: Parcours | null } {
  const ligne = db.prepare('SELECT prenom, nom, parcours FROM utilisateur WHERE id = ?').get(uid) as { prenom: string | null, nom: string | null, parcours: string | null } | undefined
  return { prenom: ligne?.prenom ?? null, nom: ligne?.nom ?? null, parcours: estParcours(ligne?.parcours) ? ligne!.parcours as Parcours : null }
}

/** Le parcours du compte, relu en base : jamais celui qu'annoncerait la requête. */
export function parcoursDuCompte(db: DatabaseSync, uid: number): Parcours | null {
  const ligne = db.prepare('SELECT parcours FROM utilisateur WHERE id = ?').get(uid) as { parcours: string | null } | undefined
  return estParcours(ligne?.parcours) ? ligne!.parcours as Parcours : null
}

/**
 * Ce qu'un compte voit : les matières communes, et celles de son parcours.
 * Sans parcours choisi, il ne voit que le tronc commun.
 */
export function visiblePour(parcours: Parcours | null) {
  return (m: { parcours: Parcours | null }) => m.parcours === null || m.parcours === parcours
}

/** Les chemins de cours d'une autre parcours que le sien : à retirer des listes. */
export async function coursMasques(event: H3Event, db: DatabaseSync, parcours: Parcours | null): Promise<Set<string>> {
  const voir = visiblePour(parcours)
  return new Set((await lireMatieres(event, db)).filter(m => m.cours && !voir(m)).map(m => m.cours!))
}
