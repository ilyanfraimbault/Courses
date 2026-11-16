/**
 * Les fiches restent lisibles sans session : c'est le statu quo du portfolio, et
 * surtout ça garde leur HTML **identique pour tous**, donc cacheable, et sans
 * aucun risque de fuite de données par le cache. Y répondre, en revanche,
 * demande un compte — c'est la question qui le réclame, au clic (`useConnexion`).
 *
 * Le tableau de bord, lui, n'a de sens que connecté — et avec un compte que
 * l'administration a accepté.
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
