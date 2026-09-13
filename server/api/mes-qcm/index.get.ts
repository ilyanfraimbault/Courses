import type { ResumeQcmCompose } from '~~/shared/types/mes-qcm'
import type { LigneQcmCompose } from '../../utils/mes-qcm.ts'

/**
 * Les QCM composés du compte, le plus récemment touché d'abord. L'écran les
 * range par matière : la liste, elle, reste plate.
 */
export default defineEventHandler(async (event): Promise<ResumeQcmCompose[]> => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  const banque = await chargerBanque(event)

  const lignes = db.prepare('SELECT * FROM qcm_compose WHERE utilisateur_id = ? ORDER BY maj DESC')
    .all(uid) as unknown as LigneQcmCompose[]

  return lignes.map(ligne => resumerQcm(db, banque, ligne))
})
