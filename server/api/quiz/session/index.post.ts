import type { FiltreQuiz, QuestionQuiz, SessionQuiz } from '~~/shared/types/quiz'
import type { EtatFile, LigneSession } from '../../../utils/quiz-session.ts'

interface CorpsSession {
  matiere?: unknown
  themes?: unknown
  sections?: unknown
  notions?: unknown
  erreurs?: unknown
  nonAcquises?: unknown
  aRevoir?: unknown
  taille?: unknown
}

function listeDeChaines(valeur: unknown): string[] {
  return Array.isArray(valeur) ? [...new Set(valeur.filter((v): v is string => typeof v === 'string' && !!v))] : []
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
    // La matière cadre tout le reste. L'écran la fixe toujours ; une requête qui
    // l'omet garde le site entier pour cadre, comme avant qu'il y en ait deux.
    matiere: typeof corps?.matiere === 'string' && corps.matiere ? corps.matiere : null,
    themes: listeDeChaines(corps?.themes),
    sections: listeDeChaines(corps?.sections),
    // Un point de cours précis, tel que « Mes domaines » le désigne par lien.
    notions: listeDeChaines(corps?.notions),
    erreurs: corps?.erreurs === true,
    nonAcquises: corps?.nonAcquises === true,
    aRevoir: corps?.aRevoir === true
  }

  const demandee = Number(corps?.taille)
  if (!Number.isInteger(demandee) || demandee < TAILLE_MIN || demandee > TAILLE_MAX) {
    throw createError({ statusCode: 400, statusMessage: `taille attendue entre ${TAILLE_MIN} et ${TAILLE_MAX}` })
  }

  const db = useBase()
  const banque = await chargerBanque(event)
  const enDette = questionsEnDette(db, uid)
  const trouvees = filtre.nonAcquises ? questionsTrouvees(db, uid) : undefined
  // L'échéance se compte jusqu'à la fin de la journée **de l'élève** : le
  // client passe son fuseau en adresse, comme pour les contrôles.
  const aRevoir = filtre.aRevoir ? questionsARevoir(db, uid, banque, maintenantPour(event).fin) : undefined
  const candidats = filtrer(banque.interrogeables, filtre, enDette, trouvees, aRevoir)
  if (!candidats.length) {
    throw createError({
      statusCode: 400,
      statusMessage: filtre.erreurs
        ? 'aucune question ratée ne correspond à cette sélection'
        : filtre.nonAcquises
          ? 'tout est déjà su dans cette sélection'
          : filtre.aRevoir
            ? 'rien à revoir aujourd\'hui dans cette sélection'
            : 'aucune question ne correspond à cette sélection'
    })
  }

  // Demander plus de questions que le filtre n'en contient n'est pas une erreur :
  // on en donne autant qu'il y en a, et la taille de la séance le dit.
  const tirees = tirer(candidats, Math.min(demandee, candidats.length), rangDuTirage(db, uid, enDette))

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
