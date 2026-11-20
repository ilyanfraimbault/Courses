import type { DetailUtilisateurAdministration } from '~~/shared/types/administration'
import { fuseauValide } from '~~/shared/utils/jours'

/**
 * Le détail d'un compte, lu quand l'administration déplie sa ligne : l'arbre
 * de sa progression jusqu'à l'exercice, ses jours de travail, ses séances de
 * quiz et ses copies de QCM, ce qu'il a clos et les contrôles qu'il a posés.
 *
 * À part de la liste parce qu'il relit **toute** l'histoire du compte : le
 * faire pour chaque ligne du tableau ferait grandir la liste avec le nombre
 * d'inscrits. `?fuseau=` : les jours se découpent chez qui regarde.
 */
export default defineEventHandler(async (event): Promise<DetailUtilisateurAdministration> => {
  await exigerAdministrateur(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Compte invalide' })

  const db = useBase()
  const compte = db.prepare('SELECT id FROM utilisateur WHERE id = ?').get(id)
  if (!compte) throw createError({ statusCode: 404, statusMessage: 'Aucun compte' })

  const banque = await chargerBanque(event)
  const masquees = await coursMasques(event, db, parcoursDuCompte(db, id))
  return detailDuCompte(db, id, banque, fuseauValide(getQuery(event).fuseau), masquees)
})
