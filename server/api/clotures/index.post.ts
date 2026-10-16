/**
 * Clôt une matière, un chapitre ou une fiche.
 *
 * Idempotent : clore deux fois ne change rien et ne rajeunit pas la date. Le
 * chemin est confronté à la banque — un chemin qui ne désigne rien de clos
 * n'entre pas en base, sans quoi une faute de frappe laisserait une ligne
 * morte qui ne retire rien et qu'aucun écran ne saurait nommer.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)
  const corps = await readBody<{ chemin?: unknown }>(event)
  if (typeof corps?.chemin !== 'string' || !corps.chemin.startsWith('/')) {
    throw createError({ statusCode: 400, statusMessage: 'chemin manquant ou invalide' })
  }
  const chemin = cheminCanonique(corps.chemin)
  const banque = await chargerBanque(event)
  if (!natureDuChemin(banque, chemin)) {
    throw createError({ statusCode: 400, statusMessage: 'rien à clore à ce chemin' })
  }

  const resultat = useBase().prepare(`
    INSERT INTO cloture (utilisateur_id, chemin, close_le) VALUES (?, ?, ?)
    ON CONFLICT(utilisateur_id, chemin) DO NOTHING
  `).run(uid, chemin, Date.now())
  setResponseStatus(event, resultat.changes ? 201 : 200)
  return { chemin }
})
