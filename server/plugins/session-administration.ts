/**
 * Le navigateur apprend s'il parle à l'administrateur, si son compte a accès
 * et qui il est — prénom, nom, parcours —, à chaque lecture de la session, et non à la connexion : une session
 * scellée ne se réécrit pas, et un drapeau figé dedans survivrait au retrait du
 * rôle — ou manquerait à qui vient de recevoir l'accès, jusqu'à sa prochaine
 * connexion.
 *
 * Ces drapeaux n'ouvrent rien : ils choisissent ce que la page affiche. Les
 * données, elles, sont gardées par `idUtilisateur` et `exigerAdministrateur`,
 * route par route.
 */
export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', (session, event) => {
    const id = session.user?.id
    if (typeof id !== 'number') return
    const db = useBase()
    session.user!.acces = accesDuCompte(db, id) ?? 'aucun'
    session.user!.admin = estAdministrateur(event, db, id)
    const profil = profilDuCompte(db, id)
    session.user!.parcours = profil.parcours
    session.user!.prenom = profil.prenom
    session.user!.nom = profil.nom
  })
})
