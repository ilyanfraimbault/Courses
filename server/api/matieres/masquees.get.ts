/**
 * Les chemins de cours de l'autre parcours, que le sommaire ne montre pas.
 * Ils restent ouvrables par leur adresse : le dépôt est public, ce n'est pas
 * un secret — c'est du bruit qu'on retire.
 */
export default defineEventHandler(async (event): Promise<string[]> => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  return [...await coursMasques(event, db, parcoursDuCompte(db, uid))]
})
