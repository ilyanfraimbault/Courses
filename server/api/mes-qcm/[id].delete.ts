/**
 * Supprime un QCM composé et ses copies.
 *
 * Ce qu'il a fait gagner reste : les questions trouvées sont cochées sur leurs
 * fiches et les fautes vivent dans la dette, qui n'appartiennent ni l'une ni
 * l'autre au QCM. Supprimer un QCM ne défait pas ce qu'on a appris en le passant.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)
  const id = idDeRoute(event)

  const resultat = useBase().prepare('DELETE FROM qcm_compose WHERE id = ? AND utilisateur_id = ?').run(id, uid)
  if (!resultat.changes) throw createError({ statusCode: 404, statusMessage: 'QCM introuvable' })

  return { ok: true }
})
