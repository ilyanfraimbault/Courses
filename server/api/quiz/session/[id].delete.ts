/**
 * Clôt une séance en cours.
 *
 * On la **clôt**, on ne l'efface pas : ses réponses disent ce qui résiste, et
 * c'est justement d'une séance abandonnée en cours de route qu'on l'apprend le
 * mieux. L'historique la montre pour ce qu'elle est — moins de places acquises
 * que de places tirées.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'identifiant de séance invalide' })
  }

  const db = useBase()
  const resultat = db.prepare(
    'UPDATE quiz_session SET finie_le = ?, maj = ? WHERE id = ? AND utilisateur_id = ? AND finie_le IS NULL'
  ).run(Date.now(), Date.now(), id, uid)

  if (!resultat.changes) {
    // Déjà close, ou jamais existé : dans les deux cas il n'y a rien à faire, et
    // rien à signaler comme une erreur.
    const existe = db.prepare('SELECT 1 FROM quiz_session WHERE id = ? AND utilisateur_id = ?').get(id, uid)
    if (!existe) throw createError({ statusCode: 404, statusMessage: 'séance introuvable' })
  }

  return { ok: true }
})
