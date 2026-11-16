/**
 * Tout le site demande un compte, fiches comprises : ce sont les cours des
 * professeurs, partagés avec la classe et pas au delà. Le serveur refuse déjà
 * leur contenu sans session (`server/middleware/contenu.ts`) ; ce middleware
 * conduit à la connexion plutôt qu'à une page vide.
 *
 * Et un compte que l'administration n'a pas accepté ne voit que sa demande
 * d'accès : le serveur lui refuse le contenu comme les données.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (estPublique(to.path)) return

  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value) {
    // Depuis une page déjà affichée, on reste dessus : la fenêtre de connexion
    // s'ouvre, et la navigation reprend une fois connecté. Au premier
    // chargement, il n'y a pas de page en dessous — d'où la page de connexion.
    if (import.meta.client && !useNuxtApp().isHydrating) {
      useConnexion().exiger(() => navigateTo(to.fullPath), 'Connecte-toi pour ouvrir cette page.')
      return abortNavigation()
    }
    return navigateTo({ path: '/connexion', query: { suite: to.fullPath } })
  }

  // Un compte sans accès ne voit que sa demande. Depuis une page déjà
  // affichée, la fenêtre la montre par-dessus, comme la connexion.
  const accorde = user.value?.acces === 'accorde'
  if (to.path === PAGE_DEMANDE) {
    if (accorde) return navigateTo('/')
    return
  }
  if (!accorde) {
    if (import.meta.client && !useNuxtApp().isHydrating) {
      useConnexion().exiger(() => navigateTo(to.fullPath))
      return abortNavigation()
    }
    return navigateTo(PAGE_DEMANDE)
  }

  // Confort d'affichage seulement : c'est le serveur qui refuse les données
  // (`exigerAdministrateur`). Sans ce renvoi, la page s'ouvrirait vide.
  if (estAdministration(to.path) && !user.value?.admin) {
    return navigateTo('/')
  }
})
