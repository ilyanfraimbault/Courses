import type { QuestionQuiz } from '~~/shared/types/quiz'

/**
 * La question qui occupe le rang `position` de la file.
 *
 * Elle sert au **préchargement** : dès qu'une question s'affiche, le client
 * demande la suivante, si bien que le bouton « Question suivante » n'attend
 * jamais le réseau. Le rang qui suit est connu d'avance, y compris quand on se
 * trompe : une faute allonge la file par la fin, elle ne décale rien.
 *
 * Le seul cas où le préchargement se trompe est celui de la dernière question
 * de la file — il ne trouve rien, et la faute qui suit crée justement l'entrée
 * qu'il n'a pas vue. D'où la règle côté client : un préchargement vide ne
 * s'utilise pas, il se refait.
 */
export default defineEventHandler(async (event): Promise<{ position: number, question: QuestionQuiz | null }> => {
  const uid = await idUtilisateur(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'identifiant de séance invalide' })
  }

  const position = Number(getQuery(event).position)
  if (!Number.isInteger(position) || position < 0) {
    throw createError({ statusCode: 400, statusMessage: 'position invalide' })
  }

  const trouvee = lireSession(useBase(), uid, id)
  if (!trouvee) throw createError({ statusCode: 404, statusMessage: 'séance introuvable' })

  const entree = trouvee.etat.entrees[position]
  if (!entree) return { position, question: null }

  const banque = await chargerBanque(event)
  const candidate = trouverEntree(banque, entree.question)
  const posee = candidate ? await poserQuestion(event, banque, candidate, position, !!entree.rejouee) : null

  return { position, question: posee?.question ?? null }
})
