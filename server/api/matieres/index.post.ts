import type { MatiereSite } from '~~/shared/types/matieres'
import { slugifier } from '~~/app/utils/cours'

/**
 * Ajouter une matière que le programme ne connaît pas, depuis la liste de
 * « planifier un contrôle ».
 *
 * Elle est hors programme : commune, sans UE ni coefficient. Une matière du
 * même nom qui existe déjà — à la casse et aux accents près — est rendue telle
 * quelle plutôt que dupliquée : deux élèves qui tapent « Anglais » ne doivent
 * pas créer deux matières.
 */
export default defineEventHandler(async (event): Promise<MatiereSite> => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  const corps = await readBody<{ intitule?: unknown }>(event)
  const intitule = typeof corps?.intitule === 'string' ? corps.intitule.trim().replace(/\s+/g, ' ') : ''
  if (intitule.length < 2 || intitule.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'un intitulé de 2 à 80 caractères' })
  }

  const voir = visiblePour(parcoursDuCompte(db, uid))
  const cle = slugifier(intitule)
  if (!cle) throw createError({ statusCode: 400, statusMessage: 'intitulé invalide' })
  const existante = (await lireMatieres(event, db)).find(m => voir(m) && slugifier(m.intitule) === cle)
  if (existante) return existante

  const code = `libre-${cle}`
  db.prepare(`
    INSERT INTO matiere (code, intitule, ue_id, coef, heures, ordre, cree_par, cree_le)
    VALUES (?, ?, NULL, NULL, NULL, 0, ?, ?)
    ON CONFLICT (code) DO NOTHING
  `).run(code, intitule, uid, Date.now())
  const creee = (await lireMatieres(event, db)).find(m => m.code === code)
  if (!creee) throw createError({ statusCode: 500, statusMessage: 'la matière n\'a pas pu être créée' })
  setResponseStatus(event, 201)
  return creee
})
