interface CorpsFautes {
  chemin?: unknown
  questions?: unknown
}

/** Une page en porte 87 au plus ; au-delà, ce n'est plus une fiche qui écrit. */
const MAX_QUESTIONS = 200

/**
 * Enregistre des fautes commises sur une fiche.
 *
 * C'est le seul endroit du site qui écrive un **événement** plutôt qu'un
 * instantané, et c'est délibéré. `PUT /api/fiche` décrit l'état complet des
 * questions trouvées : y glisser les fautes obligerait la page à connaître
 * toutes celles du passé pour ne pas les effacer, ce qu'elle ne sait pas — elle
 * ne connaît que celles qu'on vient de faire sous ses yeux.
 *
 * Une faute ne s'annule donc jamais par ce chemin. Elle s'éteint en retrouvant
 * la question, où que ce soit : sur la fiche, dans un QCM ou au quiz. Voir
 * `server/utils/fautes.ts`.
 *
 * Le corps ne porte que des identités « chemin#bloc#label » de la fiche
 * annoncée : une identité étrangère est un défaut du client, pas une écriture à
 * valider à moitié.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)

  const corps = await readBody<CorpsFautes>(event)
  if (typeof corps?.chemin !== 'string' || !corps.chemin.startsWith('/')) {
    throw createError({ statusCode: 400, statusMessage: 'chemin manquant ou invalide' })
  }
  if (!Array.isArray(corps.questions)) {
    throw createError({ statusCode: 400, statusMessage: 'questions manquant ou invalide' })
  }
  if (corps.questions.length > MAX_QUESTIONS) {
    throw createError({ statusCode: 400, statusMessage: 'trop de questions dans un seul envoi' })
  }

  const chemin = cheminCanonique(corps.chemin)
  const cibles: CibleFaute[] = []
  for (const identite of corps.questions) {
    if (typeof identite !== 'string') continue
    const decoupee = decouperIdentite(chemin, identite)
    if (!decoupee) {
      throw createError({ statusCode: 400, statusMessage: `identité étrangère à la fiche : ${identite}` })
    }
    cibles.push({ chemin, ...decoupee })
  }

  const maj = Date.now()
  enregistrerFautes(useBase(), uid, cibles, maj)

  setResponseStatus(event, 201)
  return { maj }
})
