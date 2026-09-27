interface CorpsModification {
  titre?: unknown
  jour?: unknown
  themes?: unknown
  sections?: unknown
  note?: unknown
  bareme?: unknown
}

/**
 * Modifie un contrôle : titre, date, programme, et la note une fois rendue.
 *
 * Contrairement à un QCM composé, un contrôle se retouche librement. Il n'a pas
 * de copies dont les notes deviendraient incomparables : son état se recalcule
 * à chaque lecture, et un programme qui change — le professeur a ajouté un
 * chapitre — doit pouvoir changer ici aussi. La matière, elle, ne bouge pas :
 * un contrôle d'une autre matière est un autre contrôle.
 *
 * Programme : `themes` et `sections` vont ensemble. Envoyer l'un sans l'autre
 * laisserait un programme à moitié écrit.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  const ligne = lireControle(db, uid, idControle(event))
  if (!ligne) throw createError({ statusCode: 404, statusMessage: 'contrôle introuvable' })

  const corps = await readBody<CorpsModification>(event) ?? {}
  const champs: Record<string, string | number | null> = {}

  if ('titre' in corps) champs.titre = titreControle(corps.titre)
  if ('jour' in corps) champs.jour = jourControle(corps.jour)
  if ('themes' in corps || 'sections' in corps) {
    if (!('themes' in corps && 'sections' in corps)) {
      throw createError({ statusCode: 400, statusMessage: 'un programme s\'envoie entier : themes et sections' })
    }
    const banque = await chargerBanque(event)
    champs.programme = JSON.stringify(programmeValide(banque, ligne.matiere, corps.themes, corps.sections))
  }
  if ('note' in corps) champs.note = nombreOuRien(corps.note, 'note')
  if ('bareme' in corps) champs.bareme = nombreOuRien(corps.bareme, 'barème')

  const noms = Object.keys(champs)
  if (!noms.length) throw createError({ statusCode: 400, statusMessage: 'rien à modifier' })

  // Les noms de colonnes viennent de la liste ci-dessus, jamais du corps reçu.
  db.prepare(`UPDATE controle SET ${noms.map(n => `${n} = ?`).join(', ')}, maj = ? WHERE id = ? AND utilisateur_id = ?`)
    .run(...noms.map(n => champs[n]!), Date.now(), ligne.id, uid)
  return { ok: true }
})
