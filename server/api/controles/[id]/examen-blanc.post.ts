/**
 * Compose l'examen blanc d'un contrôle : un QCM composé tiré dans son programme.
 *
 * Le tirage **n'a pas de rang**, contrairement à celui du quiz. Une séance
 * soigne — elle pose d'abord la dette, puis le neuf —, un examen blanc mesure :
 * il doit ressembler au contrôle, donc couvrir le programme à parts égales sans
 * choisir ce qu'on sait le moins. L'étalement par chapitre et par point de cours
 * du tirage suffit à cela.
 *
 * Le QCM rejoint « Mes QCM » et s'y corrige comme les autres : copie au serveur,
 * questions justes cochées sur leur fiche, ratées dans la dette. En composer un
 * second remplace le lien du contrôle, pas le premier QCM, qui garde ses copies.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  const ligne = lireControle(db, uid, idControle(event))
  if (!ligne) throw createError({ statusCode: 404, statusMessage: 'contrôle introuvable' })

  const banque = await chargerBanque(event)
  const { entrees } = entreesDuProgramme(banque, ligne.matiere, lireProgramme(ligne.programme))
  if (!entrees.length) throw createError({ statusCode: 400, statusMessage: 'le programme ne porte aucune question' })

  const tirees = tirer(entrees, Math.min(TAILLE_BLANC, entrees.length))
  const maintenant = Date.now()

  db.exec('BEGIN')
  try {
    const resultat = db.prepare(`
      INSERT INTO qcm_compose (utilisateur_id, titre, matiere, questions, cree_le, maj)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uid, `Examen blanc — ${ligne.titre}`.slice(0, TITRE_MAX), ligne.matiere,
      JSON.stringify(tirees.map(e => e.id)), maintenant, maintenant)
    const id = Number(resultat.lastInsertRowid)
    db.prepare('UPDATE controle SET examen_blanc = ?, maj = ? WHERE id = ?').run(id, maintenant, ligne.id)
    db.exec('COMMIT')
    setResponseStatus(event, 201)
    return { id }
  } catch (erreur) {
    db.exec('ROLLBACK')
    throw erreur
  }
})
