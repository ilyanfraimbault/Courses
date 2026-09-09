/**
 * Ouvre la base au démarrage du serveur plutôt qu'à la première requête : une
 * migration qui échoue doit faire tomber le conteneur tout de suite, pas rendre
 * une 500 à la première personne qui ouvre une fiche.
 */
export default defineNitroPlugin(() => {
  useBase()
})
