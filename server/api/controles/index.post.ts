interface CorpsControle {
  titre?: unknown
  matiere?: unknown
  jour?: unknown
  themes?: unknown
  sections?: unknown
}

/**
 * Déclare un contrôle : un titre, une matière, une date, un programme.
 *
 * Tout est vérifié ici. Le programme se désigne dans la nomenclature du quiz —
 * chapitres et sections du cours — et chacune de ses parties doit exister dans
 * la matière : un contrôle ne mélange pas deux cours, pas plus qu'une séance.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)
  const corps = await readBody<CorpsControle>(event)

  const titre = titreControle(corps?.titre)
  const jour = jourControle(corps?.jour)
  const banque = await chargerBanque(event)
  const matiere = typeof corps?.matiere === 'string' ? corps.matiere : ''
  if (!banque.matieres.has(matiere)) {
    throw createError({ statusCode: 400, statusMessage: 'matière inconnue' })
  }
  const programme = programmeValide(banque, matiere, corps?.themes, corps?.sections)

  const maintenant = Date.now()
  const resultat = useBase().prepare(`
    INSERT INTO controle (utilisateur_id, titre, matiere, jour, programme, examen_blanc, note, bareme, cree_le, maj)
    VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)
  `).run(uid, titre, matiere, jour, JSON.stringify(programme), maintenant, maintenant)

  setResponseStatus(event, 201)
  return { id: Number(resultat.lastInsertRowid) }
})
