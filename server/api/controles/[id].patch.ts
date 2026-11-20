/**
 * Retoucher un contrôle : sa date a bougé, son programme s'est précisé.
 *
 * Réservé à son auteur et à l'administration, vérifié en base. Le corps est
 * le contrôle entier, comme à la création : un formulaire envoie tout ce qu'il
 * montre, et un programme écrit à moitié n'aurait pas de sens.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  const l = lecteur(event, db, uid)
  const actuel = await lireControle(event, db, l, idControle(event))
  if (!actuel.modifiable) throw createError({ statusCode: 403, statusMessage: 'seul son auteur peut changer ce contrôle' })

  const corps = await readBody<Record<string, unknown>>(event) ?? {}
  const jour = jourControle(corps.jour)
  const { matiere, parcours } = matiereEtParcours(await lireMatieres(event, db), l, corps.matiere, corps.parcours)
  const titre = titreControle(corps.titre, matiere)
  const programme = programmeControle(matiere, corps.programme)
  const precisions = precisionsControle(corps.precisions)

  db.prepare(`
    UPDATE controle_classe SET titre = ?, matiere = ?, jour = ?, parcours = ?, programme = ?, precisions = ?, maj = ?
    WHERE id = ?
  `).run(titre, matiere.code, jour, parcours, JSON.stringify(programme), precisions, Date.now(), actuel.id)
  return { ok: true }
})
