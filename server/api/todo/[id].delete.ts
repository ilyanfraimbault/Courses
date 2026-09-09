export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'identifiant invalide' })
  }

  useBase().prepare('DELETE FROM todo WHERE id = ?').run(id)
  return { ok: true }
})
