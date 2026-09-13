import type { ApercuQuestion } from '~~/shared/types/mes-qcm'

/**
 * L'énoncé d'une question, pour la lire avant de la mettre dans un QCM.
 *
 * Énoncé commun du bloc compris : c'est lui qui dit si « Donner l'affixe du
 * vecteur M₂M₄ » a sa place dans le QCM qu'on compose. La bonne réponse, elle,
 * ne part pas — l'aperçu servirait sinon de corrigé à qui passe le QCM ensuite.
 */
export default defineEventHandler(async (event): Promise<ApercuQuestion> => {
  await idUtilisateur(event)
  const { id } = getQuery(event)
  if (typeof id !== 'string' || !id) throw createError({ statusCode: 400, statusMessage: 'identité de question attendue' })

  const banque = await chargerBanque(event)
  const entree = banque.interrogeables.find(e => e.id === id)
  if (!entree) throw createError({ statusCode: 404, statusMessage: 'question introuvable' })

  const lue = await lireQuestion(event, entree)
  if (!lue) throw createError({ statusCode: 404, statusMessage: 'question introuvable dans sa fiche' })

  return { enonceBloc: lue.enonceBloc, enonce: lue.enonce, lettres: lue.lettres, choix: lue.choix }
})
