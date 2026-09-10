import type { QuestionQuiz, SessionQuiz } from '~~/shared/types/quiz'

/**
 * Reprendre une séance : son état, et la question où elle s'était arrêtée.
 *
 * C'est aussi la route qui **répare**. Une question peut avoir disparu du
 * contenu depuis le tirage — une fiche remaniée, un exercice retiré — et la
 * séance resterait alors bloquée sur une place impossible à poser, avec un
 * indicateur de chargement qui ne s'arrête jamais : la panne silencieuse type.
 * On retire donc les places devenues introuvables au passage. Une lecture qui
 * écrit se justifie ici parce que l'alternative est une séance morte.
 */
export default defineEventHandler(async (event): Promise<{ session: SessionQuiz, question: QuestionQuiz | null }> => {
  const uid = await idUtilisateur(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'identifiant de séance invalide' })
  }

  const db = useBase()
  const trouvee = lireSession(db, uid, id)
  if (!trouvee) throw createError({ statusCode: 404, statusMessage: 'séance introuvable' })

  const { ligne, etat } = trouvee
  if (ligne.finie_le !== null) return { session: publier(ligne, etat), question: null }

  const banque = await chargerBanque(event)
  let posee = null
  let elaguees = 0

  while (etat.position < etat.entrees.length) {
    const entree = etat.entrees[etat.position]!
    const candidate = trouverEntree(banque, entree.question)
    posee = candidate ? await poserQuestion(event, banque, candidate, etat.position, !!entree.rejouee) : null
    if (posee) break
    etat.entrees.splice(etat.position, 1)
    elaguees += 1
  }

  if (elaguees) ecrireEtat(db, ligne, etat, Date.now())

  return { session: publier(ligne, etat), question: posee?.question ?? null }
})
