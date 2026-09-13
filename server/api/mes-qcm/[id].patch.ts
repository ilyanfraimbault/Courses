/** Renomme un QCM composé. Ses questions, elles, ne se modifient pas : on en compose un autre. */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)
  const id = idDeRoute(event)
  const titre = titreValide((await readBody<{ titre?: unknown }>(event))?.titre)

  const resultat = useBase().prepare('UPDATE qcm_compose SET titre = ?, maj = ? WHERE id = ? AND utilisateur_id = ?')
    .run(titre, Date.now(), id, uid)
  if (!resultat.changes) throw createError({ statusCode: 404, statusMessage: 'QCM introuvable' })

  return { ok: true, titre }
})
