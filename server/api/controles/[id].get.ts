import type { Controle } from '~~/shared/types/controles'

export default defineEventHandler(async (event): Promise<Controle> => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  return lireControle(event, db, lecteur(event, db, uid), idControle(event))
})
