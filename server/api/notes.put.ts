/**
 * Saisir la moyenne d'une matière — une seule, rien d'autre.
 *
 * Comme le code écrit sous une question (`reponse-ecrite.put.ts`) : la page
 * envoie la case qu'on vient de taper, et seulement elle. Un tableau envoyé
 * entier écraserait, depuis un onglet resté ouvert, une note saisie ailleurs
 * depuis. `valeur: null` efface la note.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  const corps = await readBody<{ matiere?: unknown, valeur?: unknown }>(event)

  const id = Number(corps?.matiere)
  const ligne = Number.isInteger(id)
    ? db.prepare('SELECT m.id, u.parcours FROM matiere m JOIN ue u ON u.id = m.ue_id WHERE m.id = ?').get(id) as { id: number, parcours: string | null } | undefined
    : undefined
  const parcours = parcoursDuCompte(db, uid)
  if (!ligne || (ligne.parcours !== null && ligne.parcours !== parcours)) {
    throw createError({ statusCode: 400, statusMessage: 'matière inconnue' })
  }

  if (corps?.valeur === null) {
    db.prepare('DELETE FROM note WHERE utilisateur_id = ? AND matiere_id = ?').run(uid, ligne.id)
    return { ok: true }
  }
  const valeur = typeof corps?.valeur === 'number' ? corps.valeur : Number.NaN
  if (!Number.isFinite(valeur) || valeur < 0 || valeur > 20) {
    throw createError({ statusCode: 400, statusMessage: 'une note entre 0 et 20' })
  }
  db.prepare(`
    INSERT INTO note (utilisateur_id, matiere_id, valeur, maj) VALUES (?, ?, ?, ?)
    ON CONFLICT (utilisateur_id, matiere_id) DO UPDATE SET valeur = excluded.valeur, maj = excluded.maj
  `).run(uid, ligne.id, Math.round(valeur * 100) / 100, Date.now())
  return { ok: true }
})
