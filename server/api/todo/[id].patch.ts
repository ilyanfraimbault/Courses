interface CorpsMaj {
  fait?: unknown
  note?: unknown
  titre?: unknown
}

export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'identifiant invalide' })
  }

  const c = await readBody<CorpsMaj>(event)
  const db = useBase()

  // On vérifie l'appartenance en même temps que l'existence : sans le cadre
  // par utilisateur, un identifiant deviné suffirait à modifier la liste d'un autre.
  if (!db.prepare('SELECT 1 FROM todo WHERE id = ? AND utilisateur_id = ?').get(id, uid)) {
    throw createError({ statusCode: 404, statusMessage: 'item introuvable' })
  }

  if (typeof c?.fait === 'boolean') {
    db.prepare('UPDATE todo SET fait_le = ? WHERE id = ? AND utilisateur_id = ?').run(c.fait ? Date.now() : null, id, uid)
  }
  if (typeof c?.note === 'string') {
    db.prepare('UPDATE todo SET note = ? WHERE id = ? AND utilisateur_id = ?').run(c.note.trim() || null, id, uid)
  }
  if (typeof c?.titre === 'string' && c.titre.trim()) {
    db.prepare('UPDATE todo SET titre = ? WHERE id = ? AND utilisateur_id = ?').run(c.titre.trim(), id, uid)
  }

  return lireTodo(db, uid, id)
})
