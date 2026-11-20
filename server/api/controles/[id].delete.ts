/** Retirer un contrôle de l'agenda : son auteur ou l'administration. */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  const actuel = await lireControle(event, db, lecteur(event, db, uid), idControle(event))
  if (!actuel.modifiable) throw createError({ statusCode: 403, statusMessage: 'seul son auteur peut retirer ce contrôle' })
  db.prepare('DELETE FROM controle_classe WHERE id = ?').run(actuel.id)
  return { ok: true }
})
