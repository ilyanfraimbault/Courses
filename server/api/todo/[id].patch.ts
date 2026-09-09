interface CorpsMaj {
  fait?: unknown
  note?: unknown
  titre?: unknown
}

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'identifiant invalide' })
  }

  const c = await readBody<CorpsMaj>(event)
  const db = useBase()

  if (!db.prepare('SELECT 1 FROM todo WHERE id = ?').get(id)) {
    throw createError({ statusCode: 404, statusMessage: 'item introuvable' })
  }

  if (typeof c?.fait === 'boolean') {
    db.prepare('UPDATE todo SET fait_le = ? WHERE id = ?').run(c.fait ? Date.now() : null, id)
  }
  if (typeof c?.note === 'string') {
    db.prepare('UPDATE todo SET note = ? WHERE id = ?').run(c.note.trim() || null, id)
  }
  if (typeof c?.titre === 'string' && c.titre.trim()) {
    db.prepare('UPDATE todo SET titre = ? WHERE id = ?').run(c.titre.trim(), id)
  }

  return lireTodo(db, id)
})
