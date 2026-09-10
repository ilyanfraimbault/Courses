import type { CatalogueQuiz } from '~~/shared/types/quiz'

/**
 * Sur quoi on peut se faire interroger : les chapitres, et dans chacun les
 * points de cours précis.
 *
 * Rien ici n'appartient à personne — c'est le contenu, pas des données — mais la
 * route exige quand même une session : le quiz tout entier est derrière la
 * connexion, et une porte entrouverte sur le côté ne sert qu'à surprendre plus
 * tard.
 */
export default defineEventHandler(async (event): Promise<CatalogueQuiz> => {
  await idUtilisateur(event)
  return composerCatalogue(await chargerBanque(event))
})
