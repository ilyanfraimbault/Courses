import type { ResumeControle } from '~~/shared/types/controles'

/**
 * Les contrôles du compte, évalués : ceux qui viennent d'abord, du plus proche
 * au plus lointain, puis ceux qui sont passés, du plus récent au plus ancien.
 *
 * `?fuseau=` dit où vit l'élève. « Dans deux jours » et « ce qui a été gagné
 * aujourd'hui » se comptent dans son calendrier, pas dans celui du serveur.
 */
export default defineEventHandler(async (event): Promise<ResumeControle[]> => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  const banque = await chargerBanque(event)
  const memoire = lireMemoire(db, uid)
  const moment = maintenantPour(event)

  const lignes = db.prepare('SELECT * FROM controle WHERE utilisateur_id = ?').all(uid) as unknown as LigneControle[]
  const controles = lignes.map(l => resumerControle(evaluerControle(db, banque, l, memoire, moment)))

  const aVenir = controles.filter(c => c.joursRestants >= 0).sort((a, b) => a.jour.localeCompare(b.jour) || a.id - b.id)
  const passes = controles.filter(c => c.joursRestants < 0).sort((a, b) => b.jour.localeCompare(a.jour) || b.id - a.id)
  return [...aVenir, ...passes]
})
