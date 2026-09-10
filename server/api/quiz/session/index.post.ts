import type { FiltreQuiz, QuestionQuiz, SessionQuiz } from '~~/shared/types/quiz'
import type { RangCandidat } from '../../../utils/quiz-banque.ts'
import type { EtatFile, LigneSession } from '../../../utils/quiz-session.ts'

interface CorpsSession {
  themes?: unknown
  sections?: unknown
  notions?: unknown
  erreurs?: unknown
  taille?: unknown
}

function listeDeChaines(valeur: unknown): string[] {
  return Array.isArray(valeur) ? [...new Set(valeur.filter((v): v is string => typeof v === 'string' && !!v))] : []
}

/**
 * Le rang de chaque candidat au tirage, du plus urgent au moins utile.
 *
 * C'est ce qui empêche une banque de quatre cent trente-deux questions de
 * reposer avant-hier ce qu'on a vu hier. Quatre paliers :
 *
 * 0. **en dette** — ratée quelque part et pas encore retrouvée depuis ;
 * 1. **jamais posée au quiz** — du neuf, tant qu'il en reste ;
 * 2. **posée il y a plus de deux semaines** — le temps d'oublier ;
 * 3. **posée récemment** — en dernier recours, faute de mieux dans la sélection.
 *
 * Le tri n'a lieu qu'**à l'intérieur** d'un point de cours : l'étalement du
 * tirage sur les chapitres et les notions reste premier, sans quoi une séance
 * de vingt questions se réduirait aux vingt dettes du même chapitre.
 */
function rangDe(db: ReturnType<typeof useBase>, uid: number, enDette: Set<string>): RangCandidat {
  const vues = new Map<string, number>()
  const lignes = db.prepare(`
    SELECT r.question AS question, MAX(r.t) AS t
    FROM quiz_reponse r
    JOIN quiz_session s ON s.id = r.session_id
    WHERE s.utilisateur_id = ?
    GROUP BY r.question
  `).all(uid) as unknown as { question: string, t: number }[]
  for (const l of lignes) vues.set(l.question, l.t)

  const maintenant = Date.now()
  return (entree) => {
    if (enDette.has(entree.id)) return 0
    const vue = vues.get(entree.id)
    if (vue === undefined) return 1
    return maintenant - vue > REPOS ? 2 : 3
  }
}

/**
 * Ouvre une séance : on tire les places une fois pour toutes, et la file part
 * avec elles.
 *
 * Le tirage a lieu **ici**, à l'ouverture, et non question par question : c'est
 * ce qui donne un dénominateur honnête — « douze acquises sur quarante » veut
 * dire quelque chose parce que les quarante existent déjà — et ce qui permet de
 * reprendre la séance ailleurs sans la retirer au hasard.
 */
export default defineEventHandler(async (event): Promise<{ session: SessionQuiz, question: QuestionQuiz | null }> => {
  const uid = await idUtilisateur(event)

  const corps = await readBody<CorpsSession>(event)
  const filtre: FiltreQuiz = {
    themes: listeDeChaines(corps?.themes),
    sections: listeDeChaines(corps?.sections),
    // Un point de cours précis, tel que « Mes domaines » le désigne par lien.
    notions: listeDeChaines(corps?.notions),
    erreurs: corps?.erreurs === true
  }

  const demandee = Number(corps?.taille)
  if (!Number.isInteger(demandee) || demandee < TAILLE_MIN || demandee > TAILLE_MAX) {
    throw createError({ statusCode: 400, statusMessage: `taille attendue entre ${TAILLE_MIN} et ${TAILLE_MAX}` })
  }

  const db = useBase()
  const banque = await chargerBanque(event)
  const enDette = questionsEnDette(db, uid)
  const candidats = filtrer(banque.interrogeables, filtre, enDette)
  if (!candidats.length) {
    throw createError({
      statusCode: 400,
      statusMessage: filtre.erreurs
        ? 'aucune question ratée ne correspond à cette sélection'
        : 'aucune question ne correspond à cette sélection'
    })
  }

  // Demander plus de questions que le filtre n'en contient n'est pas une erreur :
  // on en donne autant qu'il y en a, et la taille de la séance le dit.
  const tirees = tirer(candidats, Math.min(demandee, candidats.length), rangDe(db, uid, enDette))

  const etat: EtatFile = {
    version: 1,
    entrees: tirees.map((e, i) => ({ question: e.id, place: i + 1, etat: 'attente' as const })),
    position: 0
  }

  const maintenant = Date.now()
  const resultat = db.prepare(`
    INSERT INTO quiz_session (utilisateur_id, filtre, taille, etat, poses, justes, fautes, commencee_le, maj, finie_le)
    VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?, NULL)
  `).run(uid, JSON.stringify(filtre), tirees.length, JSON.stringify(etat), maintenant, maintenant)

  const ligne: LigneSession = {
    id: Number(resultat.lastInsertRowid),
    utilisateur_id: uid,
    filtre: JSON.stringify(filtre),
    taille: tirees.length,
    etat: JSON.stringify(etat),
    poses: 0,
    justes: 0,
    fautes: 0,
    commencee_le: maintenant,
    maj: maintenant,
    finie_le: null
  }

  const premiere = trouverEntree(banque, etat.entrees[0]!.question)
  const posee = premiere ? await poserQuestion(event, banque, premiere, 0, false, `${ligne.id}:0`) : null

  setResponseStatus(event, 201)
  return { session: publier(ligne, etat), question: posee?.question ?? null }
})
