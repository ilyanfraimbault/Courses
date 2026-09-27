import type { DatabaseSync } from 'node:sqlite'
import type { Banque } from './quiz-banque.ts'

/**
 * La révision espacée : une question sue revient au bout d'un jour, puis de
 * trois, de sept, de seize… tant qu'on la retrouve. Une faute la fait
 * retomber au début. Voir `docs/revisions.md`.
 *
 * **Aucune table ne la retient.** L'échéance d'une question se **déduit** de ce
 * que le site sait déjà : la date où elle a été trouvée (`reussite`), la
 * dernière faute et la date où elle a été rattrapée (`faute`), chaque réponse
 * du quiz (`quiz_reponse`), chaque copie de QCM (`qcm_tentative`,
 * `qcm_compose_copie`). Un calendrier de révision stocké aurait demandé un
 * événement de plus à chaque bonne réponse, sur chaque écran — et la première
 * route qui aurait oublié de l'écrire l'aurait désaccordé en silence. Celui-ci
 * ne peut pas diverger de l'histoire : il **est** l'histoire, relue.
 */

const MS_JOUR = 24 * 60 * 60 * 1000

/**
 * Les intervalles, en jours, palier par palier. Le premier rappel vient le
 * lendemain : c'est lui qui décide si une question est apprise ou seulement
 * reconnue. Au-delà de trois mois, une question sue n'a plus besoin du site.
 */
export const INTERVALLES = [1, 3, 7, 16, 35, 90]

/**
 * Une bonne réponse ne fait monter d'un palier que si elle arrive après au
 * moins la moitié de l'intervalle en cours. Réussir trois fois la même
 * question dans la même séance ne prouve pas qu'on la saura dans un mois — la
 * file du quiz repose justement ce qu'on vient de voir.
 */
const PART_MINIMALE = 0.5

interface Evenement {
  t: number
  juste: boolean
}

/** Où en est une question dans la révision espacée. */
export interface EtatRevision {
  /** Indice dans `INTERVALLES`. */
  palier: number
  /** La dernière bonne réponse qui a compté. */
  derniere: number
  /** Quand la reposer. */
  echeance: number
}

function lireListe(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Toute l'histoire du compte, question par question.
 *
 * Deux sources ne disent pas tout, et c'est assumé. `faute` ne garde que la
 * **dernière** faute — mais c'est la seule qui compte : une faute remet la
 * question au début, ce qui la précédait ne pèse plus. Et une fiche n'écrit
 * que la **première** réussite : une question déjà cochée ne se repasse pas sur
 * sa fiche, c'est au quiz et dans les QCM qu'elle se révise.
 */
export function lireHistorique(db: DatabaseSync, uid: number, banque: Banque): Map<string, Evenement[]> {
  const histoire = new Map<string, Evenement[]>()
  const ajouter = (id: string, t: number, juste: boolean) => {
    const liste = histoire.get(id) ?? []
    liste.push({ t, juste })
    histoire.set(id, liste)
  }

  for (const l of db.prepare('SELECT chemin, bloc, label, premiere FROM reussite WHERE utilisateur_id = ?')
    .all(uid) as unknown as { chemin: string, bloc: string, label: string, premiere: number }[]) {
    ajouter(composerIdentite(l.chemin, l.bloc, l.label), l.premiere, true)
  }

  for (const l of db.prepare('SELECT chemin, bloc, label, derniere, rattrapee FROM faute WHERE utilisateur_id = ?')
    .all(uid) as unknown as { chemin: string, bloc: string, label: string, derniere: number, rattrapee: number | null }[]) {
    const id = composerIdentite(l.chemin, l.bloc, l.label)
    ajouter(id, l.derniere, false)
    if (l.rattrapee !== null) ajouter(id, l.rattrapee, true)
  }

  for (const l of db.prepare(`
    SELECT r.question AS question, r.juste AS juste, r.t AS t
    FROM quiz_reponse r JOIN quiz_session s ON s.id = r.session_id
    WHERE s.utilisateur_id = ?
  `).all(uid) as unknown as { question: string, juste: number, t: number }[]) {
    ajouter(l.question, l.t, l.juste === 1)
  }

  for (const l of db.prepare(`
    SELECT q.questions AS questions, c.ratees AS ratees, c.t AS t
    FROM qcm_compose_copie c JOIN qcm_compose q ON q.id = c.compose_id
    WHERE q.utilisateur_id = ?
  `).all(uid) as unknown as { questions: string, ratees: string, t: number }[]) {
    const ratees = new Set(lireListe(l.ratees))
    for (const id of lireListe(l.questions)) ajouter(id, l.t, !ratees.has(id))
  }

  // Un QCM de contenu ne retient que les repères de ses questions ratées : les
  // justes sont les autres questions du bloc, telles que le contenu les porte.
  const parBloc = new Map<string, string[]>()
  for (const e of banque.entrees) {
    const cle = `${e.chemin}#${e.bloc}`
    parBloc.set(cle, [...(parBloc.get(cle) ?? []), e.label])
  }
  for (const l of db.prepare('SELECT chemin, bloc, t, ratees FROM qcm_tentative WHERE utilisateur_id = ?')
    .all(uid) as unknown as { chemin: string, bloc: string, t: number, ratees: string }[]) {
    const ratees = new Set(lireListe(l.ratees))
    for (const label of parBloc.get(`${l.chemin}#${l.bloc}`) ?? []) {
      ajouter(composerIdentite(l.chemin, l.bloc, label), l.t, !ratees.has(label))
    }
  }

  return histoire
}

/**
 * Rejoue l'histoire d'une question et dit quand la reposer.
 *
 * Nulle quand la question n'est pas dans la révision : jamais trouvée, ou
 * ratée en dernier — elle est alors en dette, et c'est la dette qui s'en
 * occupe, pas le calendrier.
 */
export function planifier(evenements: Evenement[]): EtatRevision | null {
  let palier = -1
  let derniere = 0
  for (const e of [...evenements].sort((a, b) => a.t - b.t || Number(a.juste) - Number(b.juste))) {
    if (!e.juste) {
      palier = -1
      continue
    }
    if (palier < 0) {
      palier = 0
      derniere = e.t
    } else if (e.t - derniere >= PART_MINIMALE * INTERVALLES[palier]! * MS_JOUR) {
      palier = Math.min(palier + 1, INTERVALLES.length - 1)
      derniere = e.t
    }
  }
  if (palier < 0) return null
  return { palier, derniere, echeance: derniere + INTERVALLES[palier]! * MS_JOUR }
}

/** L'état de révision de chaque question sue du compte. */
export function etatsRevision(db: DatabaseSync, uid: number, banque: Banque): Map<string, EtatRevision> {
  const etats = new Map<string, EtatRevision>()
  for (const [id, evenements] of lireHistorique(db, uid, banque)) {
    const etat = planifier(evenements)
    if (etat) etats.set(id, etat)
  }
  return etats
}

/** Les questions dont l'échéance tombe avant `limite` — la fin de la journée de l'élève. */
export function questionsARevoir(db: DatabaseSync, uid: number, banque: Banque, limite: number): Set<string> {
  const dues = new Set<string>()
  for (const [id, etat] of etatsRevision(db, uid, banque)) if (etat.echeance < limite) dues.add(id)
  return dues
}
