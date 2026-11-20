import type { MatiereSite } from '~~/shared/types/matieres'

/**
 * Les matières que le compte voit : le tronc commun et son parcours. C'est la
 * liste que propose « planifier un contrôle ».
 */
export default defineEventHandler(async (event): Promise<MatiereSite[]> => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  return (await lireMatieres(event, db)).filter(visiblePour(parcoursDuCompte(db, uid)))
})
