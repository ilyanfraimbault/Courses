interface CorpsTentative {
  chemin?: unknown
  bloc?: unknown
  t?: unknown
  justes?: unknown
  total?: unknown
  ratees?: unknown
}

/** Au-delà, l'historique n'apprend plus rien et la frise devient illisible. */
const MAX_TENTATIVES = 24

/**
 * Enregistre une copie rendue. Écriture par événement, sans temporisation :
 * rendre une copie est une action rare, unique et explicite.
 *
 * Le plafond est appliqué **ici** et non côté client, pour que la règle vive à
 * un seul endroit. L'unicité (chemin, bloc, t) rend un double-clic sur
 * « Corriger » inoffensif.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)

  const c = await readBody<CorpsTentative>(event)
  if (typeof c?.chemin !== 'string' || !c.chemin.startsWith('/')) {
    throw createError({ statusCode: 400, statusMessage: 'chemin manquant ou invalide' })
  }
  if (typeof c.bloc !== 'string' || !c.bloc) {
    throw createError({ statusCode: 400, statusMessage: 'bloc manquant' })
  }
  if (typeof c.justes !== 'number' || typeof c.total !== 'number') {
    throw createError({ statusCode: 400, statusMessage: 'justes et total sont requis' })
  }
  const ratees = Array.isArray(c.ratees) ? c.ratees.filter(r => typeof r === 'string') : []
  const t = typeof c.t === 'number' && c.t > 0 ? c.t : Date.now()
  const chemin = cheminCanonique(c.chemin)

  const db = useBase()
  db.exec('BEGIN')
  try {
    db.prepare(`
      INSERT INTO qcm_tentative (utilisateur_id, chemin, bloc, t, justes, total, ratees)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(utilisateur_id, chemin, bloc, t) DO NOTHING
    `).run(uid, chemin, c.bloc, t, c.justes, c.total, JSON.stringify(ratees))

    db.prepare(`
      DELETE FROM qcm_tentative
      WHERE utilisateur_id = ? AND chemin = ? AND bloc = ? AND id NOT IN (
        SELECT id FROM qcm_tentative
        WHERE utilisateur_id = ? AND chemin = ? AND bloc = ? ORDER BY t DESC LIMIT ?
      )
    `).run(uid, chemin, c.bloc, uid, chemin, c.bloc, MAX_TENTATIVES)

    db.exec('COMMIT')
  } catch (erreur) {
    db.exec('ROLLBACK')
    throw erreur
  }

  setResponseStatus(event, 201)
  return { ok: true }
})
