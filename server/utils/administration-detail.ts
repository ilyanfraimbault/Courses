import type { DatabaseSync } from 'node:sqlite'
import type {
  ClotureAdmin, ControlePoseAdmin, DetailUtilisateurAdministration, JourAdmin, LigneProgressionAdmin, SeanceAdmin
} from '~~/shared/types/administration'
import type { FiltreQuiz } from '~~/shared/types/quiz'
import { estParcours } from '~~/shared/types/matieres'
import { niveauxDuChemin } from '~~/shared/utils/niveaux'
import type { Banque, EntreeBanque } from './quiz-banque.ts'

/**
 * Le détail d'un compte, tel que l'administration le déplie : ce qu'il a fait,
 * jusqu'à l'exercice, et quand. Voir `shared/types/administration.ts` pour ce
 * qu'on montre et ce qu'on tait.
 *
 * Tout se déduit de la même histoire que la révision espacée et l'agenda de
 * l'accueil (`lireHistorique`) : aucune table de plus, et rien qui puisse
 * contredire ce que l'élève voit chez lui.
 */

/** Lecture tolérante d'un JSON stocké : une ligne abîmée ne fait pas tomber la page. */
function lireJson<T>(texte: string, defaut: T): T {
  try {
    return JSON.parse(texte) as T
  } catch {
    return defaut
  }
}

interface EtatQuestion {
  trouvee: boolean
  fautes: number
  enDette: boolean
  derniere: number | null
}

type Noeud = LigneProgressionAdmin & { ordre: number, sous: Map<string, Noeud> }

function noeud(cle: string, niveau: LigneProgressionAdmin['niveau'], titre: string, lien: string | null, ordre: number): Noeud {
  return { cle, niveau, titre, lien, questions: 0, trouvees: 0, fautes: 0, enDette: 0, derniere: null, ordre, sous: new Map() }
}

function cumuler(n: Noeud, etat: EtatQuestion | undefined) {
  n.questions += 1
  if (!etat) return
  if (etat.trouvee) n.trouvees += 1
  n.fautes += etat.fautes
  if (etat.enDette) n.enDette += 1
  if (etat.derniere !== null && (n.derniere === null || etat.derniere > n.derniere)) n.derniere = etat.derniere
}

const parChemin = (a: Noeud, b: Noeud) => a.ordre - b.ordre || a.cle.localeCompare(b.cle, 'fr', { numeric: true })

function figer(sous: Map<string, Noeud>, trier: (a: Noeud, b: Noeud) => number): LigneProgressionAdmin[] {
  return [...sous.values()].sort(trier).map(({ ordre: _ordre, sous: enfants, ...ligne }) => {
    const suite = figer(enfants, ligne.niveau === 'fiche' ? (a, b) => a.ordre - b.ordre : parChemin)
    return suite.length ? { ...ligne, enfants: suite } : ligne
  })
}

/**
 * L'arbre matière › chapitre › fiche › exercice, rangé par l'endroit où vit
 * chaque question. Les dénominateurs sont ceux du relevé du build, et une
 * réussite dont la question a quitté le contenu ne compte plus — comme dans
 * le tableau, dont la colonne « trouvées » doit retomber sur la somme de cet
 * arbre.
 *
 * Une matière de l'autre parcours n'apparaît que si le compte y a fait
 * quelque chose : sinon ce ne serait qu'une ligne vide de plus.
 */
function arbreDeProgression(banque: Banque, etats: Map<string, EtatQuestion>, masquees: Set<string>): LigneProgressionAdmin[] {
  const racine = new Map<string, Noeud>()

  banque.entrees.forEach((e, rang) => {
    const place = niveauxDuChemin(e.chemin)
    const cleMatiere = place.matiere ?? e.matiere ?? 'divers'
    const metaMatiere = banque.matieres.get(cleMatiere)
    let matiere = racine.get(cleMatiere)
    if (!matiere) {
      matiere = noeud(cleMatiere, 'matiere', metaMatiere?.titre ?? nomDuChemin(cleMatiere), metaMatiere?.chemin ?? place.matiere, metaMatiere?.ordre ?? 999)
      racine.set(cleMatiere, matiere)
    }

    // Une fiche posée à même la matière n'a pas de chapitre : le quatrième
    // segment de son chemin est alors la fiche elle-même.
    let parent = matiere
    if (place.chapitre && place.chapitre !== e.chemin) {
      const metaChapitre = banque.chapitres.get(place.chapitre)
      let chapitre = matiere.sous.get(place.chapitre)
      if (!chapitre) {
        chapitre = noeud(place.chapitre, 'chapitre', metaChapitre?.titre ?? nomDuChemin(place.chapitre), metaChapitre?.chemin ?? null, metaChapitre?.ordre ?? 999)
        matiere.sous.set(place.chapitre, chapitre)
      }
      parent = chapitre
    }

    let fiche = parent.sous.get(e.chemin)
    if (!fiche) {
      fiche = noeud(e.chemin, 'fiche', e.ficheTitre, e.chemin, 999)
      parent.sous.set(e.chemin, fiche)
    }

    const cleExercice = `${e.chemin}#${e.bloc}`
    let exercice = fiche.sous.get(cleExercice)
    if (!exercice) {
      // Le rang de la première question du bloc : les exercices restent dans
      // l'ordre de la fiche, que le relevé du build suit.
      exercice = noeud(cleExercice, 'exercice', e.blocTitre, e.chemin, rang)
      fiche.sous.set(cleExercice, exercice)
    }

    const etat = etats.get(e.id)
    for (const n of new Set([matiere, parent, fiche, exercice])) cumuler(n, etat)
  })

  for (const [cle, m] of racine) {
    if (masquees.has(cle) && m.trouvees + m.fautes === 0 && m.derniere === null) racine.delete(cle)
  }
  return figer(racine, parChemin)
}

/** Les jours travaillés, du plus récent au plus ancien, et ce qui s'y est passé. */
function joursDeTravail(histoire: ReturnType<typeof lireHistorique>, banque: Banque, fuseau: string): JourAdmin[] {
  const format = new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' })
  const parJour = new Map<string, { ids: Set<string>, justes: number, fautes: number }>()
  for (const [id, evenements] of histoire) {
    for (const ev of evenements) {
      const jour = format.format(new Date(ev.t))
      const j = parJour.get(jour) ?? { ids: new Set(), justes: 0, fautes: 0 }
      j.ids.add(id)
      if (ev.juste) j.justes += 1
      else j.fautes += 1
      parJour.set(jour, j)
    }
  }
  const parId = new Map(banque.entrees.map(e => [e.id, e]))
  return [...parJour].sort(([a], [b]) => b.localeCompare(a)).map(([jour, j]) => ({
    jour,
    questions: j.ids.size,
    justes: j.justes,
    fautes: j.fautes,
    matieres: rangerActivite(j.ids, banque, parId)
  }))
}

/** Les chapitres d'une séance de quiz, nommés : « Trigonométrie, Complexes et 2 autres ». */
function resumerThemes(themes: string[], banque: Banque): string | null {
  if (!themes.length) return null
  const noms = themes.map(t => banque.chapitres.get(t)?.titre ?? nomDuChemin(t))
  return noms.length > 2 ? `${noms.slice(0, 2).join(', ')} et ${noms.length - 2} autre${noms.length > 3 ? 's' : ''}` : noms.join(', ')
}

function seancesDuCompte(db: DatabaseSync, uid: number, banque: Banque): SeanceAdmin[] {
  const seances: SeanceAdmin[] = []
  const titreMatiere = (chemin: string | null | undefined) => (chemin ? banque.matieres.get(chemin)?.titre ?? nomDuChemin(chemin) : null)

  for (const l of db.prepare(`
    SELECT id, filtre, taille, poses, justes, commencee_le, finie_le FROM quiz_session WHERE utilisateur_id = ?
  `).all(uid) as unknown as { id: number, filtre: string, taille: number, poses: number, justes: number, commencee_le: number, finie_le: number | null }[]) {
    const filtre = lireJson<Partial<FiltreQuiz>>(l.filtre, {})
    const portee = [
      titreMatiere(filtre.matiere),
      resumerThemes(Array.isArray(filtre.themes) ? filtre.themes : [], banque),
      filtre.erreurs ? 'dette seulement' : null
    ].filter(Boolean).join(' · ')
    seances.push({
      cle: `quiz:${l.id}`,
      type: 'quiz',
      titre: 'Quiz',
      detail: portee || null,
      lien: null,
      t: l.commencee_le,
      justes: l.justes,
      total: l.poses,
      taille: l.taille,
      finieLe: l.finie_le
    })
  }

  const blocs = new Map<string, EntreeBanque>()
  for (const e of banque.entrees) if (!blocs.has(`${e.chemin}#${e.bloc}`)) blocs.set(`${e.chemin}#${e.bloc}`, e)

  for (const l of db.prepare(`
    SELECT id, chemin, bloc, t, justes, total FROM qcm_tentative WHERE utilisateur_id = ?
  `).all(uid) as unknown as { id: number, chemin: string, bloc: string, t: number, justes: number, total: number }[]) {
    const e = blocs.get(`${l.chemin}#${l.bloc}`)
    seances.push({
      cle: `qcm:${l.id}`,
      type: 'qcm',
      titre: e?.blocTitre ?? nomDuChemin(l.bloc),
      detail: e?.ficheTitre ?? nomDuChemin(l.chemin),
      lien: l.chemin,
      t: l.t,
      justes: l.justes,
      total: l.total,
      taille: null,
      finieLe: null
    })
  }

  // Un QCM composé vit sur le compte de son auteur : son adresse ne s'ouvre
  // que pour lui, d'où l'absence de lien.
  for (const l of db.prepare(`
    SELECT c.id, q.titre, q.matiere, c.t, c.justes, c.total
    FROM qcm_compose_copie c JOIN qcm_compose q ON q.id = c.compose_id
    WHERE q.utilisateur_id = ?
  `).all(uid) as unknown as { id: number, titre: string, matiere: string, t: number, justes: number, total: number }[]) {
    seances.push({
      cle: `compose:${l.id}`,
      type: 'qcm-compose',
      titre: l.titre,
      detail: titreMatiere(l.matiere),
      lien: null,
      t: l.t,
      justes: l.justes,
      total: l.total,
      taille: null,
      finieLe: null
    })
  }

  return seances.sort((a, b) => b.t - a.t)
}

export function detailDuCompte(db: DatabaseSync, uid: number, banque: Banque, fuseau: string, masquees: Set<string>): DetailUtilisateurAdministration {
  const histoire = lireHistorique(db, uid, banque)

  const etats = new Map<string, EtatQuestion>()
  const etat = (id: string) => {
    let e = etats.get(id)
    if (!e) {
      e = { trouvee: false, fautes: 0, enDette: false, derniere: null }
      etats.set(id, e)
    }
    return e
  }
  for (const l of db.prepare('SELECT chemin, bloc, label FROM reussite WHERE utilisateur_id = ?')
    .all(uid) as unknown as { chemin: string, bloc: string, label: string }[]) {
    etat(composerIdentite(l.chemin, l.bloc, l.label)).trouvee = true
  }
  for (const l of db.prepare('SELECT chemin, bloc, label, compte, rattrapee FROM faute WHERE utilisateur_id = ?')
    .all(uid) as unknown as { chemin: string, bloc: string, label: string, compte: number, rattrapee: number | null }[]) {
    const e = etat(composerIdentite(l.chemin, l.bloc, l.label))
    e.fautes = l.compte
    e.enDette = l.rattrapee === null
  }
  for (const [id, evenements] of histoire) {
    const e = etat(id)
    for (const ev of evenements) if (e.derniere === null || ev.t > e.derniere) e.derniere = ev.t
  }

  const clotures: ClotureAdmin[] = []
  for (const l of db.prepare('SELECT chemin, close_le FROM cloture WHERE utilisateur_id = ? ORDER BY close_le DESC')
    .all(uid) as unknown as { chemin: string, close_le: number }[]) {
    const nature = natureDuChemin(banque, l.chemin)
    if (nature) clotures.push({ chemin: l.chemin, titre: nature.titre, nature: nature.nature, closeLe: l.close_le })
  }

  const controles: ControlePoseAdmin[] = (db.prepare(`
    SELECT c.id, c.titre, COALESCE(m.intitule, c.matiere) AS matiere, c.jour, c.parcours
    FROM controle_classe c LEFT JOIN matiere m ON m.code = c.matiere
    WHERE c.auteur_id = ? ORDER BY c.jour DESC
  `).all(uid) as unknown as { id: number, titre: string, matiere: string, jour: string, parcours: string | null }[])
    .map(l => ({ ...l, parcours: estParcours(l.parcours) ? l.parcours : null }))

  const { n: notesSaisies } = db.prepare('SELECT COUNT(*) AS n FROM note WHERE utilisateur_id = ?').get(uid) as { n: number }

  return {
    id: uid,
    progression: arbreDeProgression(banque, etats, masquees),
    jours: joursDeTravail(histoire, banque, fuseau),
    seances: seancesDuCompte(db, uid, banque),
    clotures,
    controles,
    notesSaisies
  }
}
