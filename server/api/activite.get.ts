import { fuseauValide } from '~~/shared/utils/jours'

/**
 * Les jours où l'élève a travaillé, pour les points du calendrier de l'accueil.
 *
 * Des jours et non des comptes : le détail d'un jour se lit à part
 * (`/api/activite/:jour`), à la demande. `?fuseau=` : le jour se lit chez
 * l'élève, pas dans l'UTC du serveur.
 */
export default defineEventHandler(async (event): Promise<{ jours: string[] }> => {
  const uid = await idUtilisateur(event)
  const banque = await chargerBanque(event)
  const fuseau = fuseauValide(getQuery(event).fuseau)
  return { jours: joursTravailles(useBase(), uid, banque, fuseau) }
})
