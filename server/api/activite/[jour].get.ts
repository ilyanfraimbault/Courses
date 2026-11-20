import type { ActiviteJour } from '~~/shared/types/activite'
import { debutDuJour, decalerJour, fuseauValide, jourValide } from '~~/shared/utils/jours'

/**
 * Ce qu'on a travaillé tel jour : matières, chapitres, fiches et exercices,
 * avec le nombre de questions touchées à chaque niveau.
 *
 * La journée commence à minuit **chez l'élève** (`?fuseau=`), comme les points
 * du calendrier qui y mènent.
 */
export default defineEventHandler(async (event): Promise<ActiviteJour> => {
  const uid = await idUtilisateur(event)
  const jour = getRouterParam(event, 'jour')
  if (!jourValide(jour)) throw createError({ statusCode: 400, statusMessage: 'Jour invalide' })
  const fuseau = fuseauValide(getQuery(event).fuseau)
  const banque = await chargerBanque(event)
  const debut = debutDuJour(jour, fuseau)
  const fin = debutDuJour(decalerJour(jour, 1), fuseau)
  return { jour, matieres: activiteEntre(useBase(), uid, banque, debut, fin) }
})
