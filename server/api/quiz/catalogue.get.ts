import type { CatalogueQuiz } from '~~/shared/types/quiz'

/**
 * Sur quoi on peut se faire interroger : les chapitres, et dans chacun les
 * sections du cours.
 *
 * Le découpage vient du contenu et n'appartient à personne. Les **comptes de
 * questions ratées**, eux, appartiennent au compte connecté : c'est ce qui
 * permet d'écrire « 12 en dette » à côté d'un chapitre avant même d'avoir
 * choisi quoi que ce soit. La route exigeait déjà une session — le quiz tout
 * entier est derrière la connexion — et elle n'est lue qu'au montage, jamais au
 * rendu serveur, comme toute donnée d'utilisateur ici.
 */
export default defineEventHandler(async (event): Promise<CatalogueQuiz> => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  const banque = await chargerBanque(event)
  // Les révisions du jour et le neuf se comptent case par case pour que la
  // séance du jour puisse se restreindre à quelques chapitres en sachant ce
  // qu'elle y trouvera. `?fuseau=` : la journée est celle de l'élève, comme
  // partout.
  return composerCatalogue(
    banque,
    questionsEnDette(db, uid),
    questionsARevoir(db, uid, banque, maintenantPour(event).fin),
    cheminsClos(db, uid),
    questionsTrouvees(db, uid)
  )
})
