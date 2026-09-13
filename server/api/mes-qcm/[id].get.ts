import type { QcmCompose } from '~~/shared/types/mes-qcm'

/**
 * Un QCM composé, prêt à être passé : ses questions relues dans les fiches, et
 * ses copies. Une seule requête, comme une fiche — la page n'a rien d'autre à
 * demander au montage.
 *
 * Aucune bonne réponse ne part ici : elles restent au serveur jusqu'à la copie
 * rendue, exactement comme au quiz.
 */
export default defineEventHandler(async (event): Promise<QcmCompose> => {
  const uid = await idUtilisateur(event)
  const id = idDeRoute(event)
  const db = useBase()

  const ligne = lireQcmCompose(db, uid, id)
  if (!ligne) throw createError({ statusCode: 404, statusMessage: 'QCM introuvable' })

  const banque = await chargerBanque(event)
  const { posees, manquantes } = await poserQcm(event, banque, ligne)
  const matiere = banque.matieres.get(ligne.matiere)

  return {
    id: ligne.id,
    titre: ligne.titre,
    matiere: ligne.matiere,
    matiereTitre: matiere?.titre ?? null,
    annee: matiere?.annee ?? null,
    manquantes,
    cree_le: ligne.cree_le,
    maj: ligne.maj,
    questions: posees.map(p => p.question),
    copies: lireCopies(db, ligne.id)
  }
})
