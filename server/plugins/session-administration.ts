/**
 * Le navigateur apprend s'il parle à l'administrateur à chaque lecture de la
 * session, et non à la connexion : une session scellée ne se réécrit pas, et un
 * drapeau figé dedans survivrait au retrait du rôle — ou manquerait à qui vient
 * de le recevoir, jusqu'à sa prochaine connexion.
 *
 * Ce drapeau n'ouvre rien : il affiche une entrée de menu. Les données, elles,
 * sont gardées par `exigerAdministrateur`, route par route.
 */
export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', (session, event) => {
    const id = session.user?.id
    if (typeof id !== 'number') return
    session.user!.admin = estAdministrateur(event, useBase(), id)
  })
})
