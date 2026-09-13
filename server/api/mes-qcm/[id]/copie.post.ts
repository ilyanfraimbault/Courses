import type { CorrectionQcmCompose } from '~~/shared/types/mes-qcm'
import type { CorrectionQuiz } from '~~/shared/types/quiz'

interface CorpsCopie {
  reponses?: unknown
  t?: unknown
}

/**
 * Corrige une copie de QCM composé.
 *
 * La correction a lieu **au serveur**, comme au quiz : les bonnes réponses ne
 * sont jamais parties avec les questions, et c'est ici qu'elles sont relues. La
 * même transaction tient les trois conséquences d'une copie rendue, parce
 * qu'elles décrivent le même événement :
 *
 * - la copie rejoint l'historique du QCM, plafonné à vingt-quatre ;
 * - une question juste est **cochée sur sa fiche** et éteint sa dette — le même
 *   report que le quiz, sans passer par l'instantané de `PUT /api/fiche`, qui
 *   effacerait le reste de la fiche que le QCM ne connaît pas ;
 * - une question ratée ou laissée blanche entre dans la dette. Une faute
 *   n'efface jamais rien.
 *
 * L'horodatage vient du client quand il en donne un : c'est ce qui rend un
 * double clic sur « Corriger » inoffensif. Une copie déjà enregistrée n'est pas
 * recomptée — ni ses fautes, ni ses reports.
 */
export default defineEventHandler(async (event): Promise<CorrectionQcmCompose> => {
  const uid = await idUtilisateur(event)
  const id = idDeRoute(event)
  const db = useBase()

  const ligne = lireQcmCompose(db, uid, id)
  if (!ligne) throw createError({ statusCode: 404, statusMessage: 'QCM introuvable' })

  const corps = await readBody<CorpsCopie>(event)
  const reponses = corps?.reponses && typeof corps.reponses === 'object'
    ? corps.reponses as Record<string, unknown>
    : {}
  const t = typeof corps?.t === 'number' && Number.isInteger(corps.t) && corps.t > 0 ? corps.t : Date.now()

  const banque = await chargerBanque(event)
  const { posees } = await poserQcm(event, banque, ligne)
  if (!posees.length) throw createError({ statusCode: 409, statusMessage: 'aucune question de ce QCM n\'existe plus' })

  const corrections: Record<string, CorrectionQuiz> = {}
  const justes: typeof posees = []
  const ratees: typeof posees = []

  for (const posee of posees) {
    const brute = reponses[posee.entree.id]
    const donnee = typeof brute === 'string' && brute ? brute : null
    if (donnee && !posee.lue.lettres.includes(donnee)) {
      throw createError({ statusCode: 400, statusMessage: 'une proposition n\'existe pas' })
    }
    const juste = donnee === posee.lue.bonne
    ;(juste ? justes : ratees).push(posee)
    corrections[posee.entree.id] = {
      juste,
      // Une question laissée blanche se lit comme un « je ne sais pas » : il
      // n'y a pas de mauvaise réponse à barrer, seulement une correction à lire.
      passee: donnee === null,
      bonne: posee.lue.bonne,
      donnee,
      indice: posee.lue.indice,
      solution: posee.lue.solution,
      extrait: posee.lue.extrait,
      reprise: null
    }
  }

  const copie = { t, justes: justes.length, total: posees.length, ratees: ratees.map(p => p.entree.id) }

  db.exec('BEGIN')
  try {
    const insertion = db.prepare(`
      INSERT INTO qcm_compose_copie (compose_id, t, justes, total, ratees)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(compose_id, t) DO NOTHING
    `).run(ligne.id, t, copie.justes, copie.total, JSON.stringify(copie.ratees))

    if (insertion.changes) {
      for (const p of justes) reporterSurLaFiche(db, uid, p.entree, p.lue.bonne, t)
      rattraperFautes(db, uid, justes.map(p => ({ chemin: p.entree.chemin, bloc: p.entree.bloc, label: p.entree.label })), t)
      enregistrerFautes(db, uid, ratees.map(p => ({ chemin: p.entree.chemin, bloc: p.entree.bloc, label: p.entree.label })), t)

      db.prepare(`
        DELETE FROM qcm_compose_copie
        WHERE compose_id = ? AND id NOT IN (
          SELECT id FROM qcm_compose_copie WHERE compose_id = ? ORDER BY t DESC LIMIT ?
        )
      `).run(ligne.id, ligne.id, MAX_COPIES)

      db.prepare('UPDATE qcm_compose SET maj = ? WHERE id = ?').run(Date.now(), ligne.id)
    }

    db.exec('COMMIT')
  } catch (erreur) {
    db.exec('ROLLBACK')
    throw erreur
  }

  setResponseStatus(event, 201)
  return { copie, corrections }
})
