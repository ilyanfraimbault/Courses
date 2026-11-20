/**
 * Planifier un contrôle : il apparaît dans le calendrier de tous ceux qu'il
 * concerne. Tout est vérifié ici — la matière existe et le compte la voit, le
 * programme reste dans son cours.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  const l = lecteur(event, db, uid)
  const corps = await readBody<Record<string, unknown>>(event) ?? {}

  const jour = jourControle(corps.jour)
  const { matiere, parcours } = matiereEtParcours(await lireMatieres(event, db), l, corps.matiere, corps.parcours)
  const titre = titreControle(corps.titre, matiere)
  const programme = programmeControle(matiere, corps.programme)
  const precisions = precisionsControle(corps.precisions)

  const maintenant = Date.now()
  const resultat = db.prepare(`
    INSERT INTO controle_classe (auteur_id, titre, matiere, jour, parcours, programme, precisions, cree_le, maj)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uid, titre, matiere.code, jour, parcours, JSON.stringify(programme), precisions, maintenant, maintenant)

  setResponseStatus(event, 201)
  return { id: Number(resultat.lastInsertRowid) }
})
