export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'identifiant invalide' })
  }

  useBase().prepare('DELETE FROM todo WHERE id = ? AND utilisateur_id = ?').run(id, uid)
  return { ok: true }
})
