interface CorpsOrdre {
  ids?: unknown
}

/**
 * Réordonne la liste entière. On réécrit tous les rangs dans une transaction
 * plutôt que d'insérer un rang fractionnaire entre deux voisins : la liste tient
 * en quelques dizaines de lignes, c'est trivialement correct, et ça supprime la
 * renormalisation périodique qu'exigerait un rang flottant.
 *
 * Un ensemble d'identifiants qui ne correspond pas exactement à celui de la base
 * est rejeté : un client désynchronisé ne doit pas pouvoir laisser la liste à
 * moitié réordonnée.
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const c = await readBody<CorpsOrdre>(event)
  if (!Array.isArray(c?.ids) || c.ids.some(i => !Number.isInteger(i))) {
    throw createError({ statusCode: 400, statusMessage: 'ids doit être un tableau d\'entiers' })
  }
  const ids = c.ids as number[]

  const db = useBase()
  const connus = (db.prepare('SELECT id FROM todo').all() as { id: number }[]).map(r => r.id)

  if (ids.length !== connus.length || new Set(ids).size !== ids.length
    || !connus.every(id => ids.includes(id))) {
    throw createError({ statusCode: 400, statusMessage: 'la liste ne correspond pas à celle en base' })
  }

  db.exec('BEGIN')
  try {
    const majRang = db.prepare('UPDATE todo SET rang = ? WHERE id = ?')
    ids.forEach((id, index) => majRang.run(index + 1, id))
    db.exec('COMMIT')
  } catch (erreur) {
    db.exec('ROLLBACK')
    throw erreur
  }

  return { ok: true }
})
