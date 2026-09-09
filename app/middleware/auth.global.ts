/**
 * Les fiches restent lisibles sans session : c'est le statu quo du portfolio, et
 * surtout ça garde leur HTML **identique pour tous**, donc cacheable, et sans
 * aucun risque de fuite de données par le cache.
 *
 * Le tableau de bord, lui, n'a de sens que connecté.
 */
const PUBLIQUES = ['/cours', '/connexion']

export default defineNuxtRouteMiddleware((to) => {
  const publique = PUBLIQUES.some(p => to.path === p || to.path.startsWith(p + '/'))
  if (publique) return

  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo({ path: '/connexion', query: { suite: to.fullPath } })
  }
})
