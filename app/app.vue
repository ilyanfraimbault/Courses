<script setup lang="ts">
import { fr } from '@nuxt/ui/locale'

const { seo } = useAppConfig()

// L'arbre complet, tel quel. La barre latérale n'en montre qu'une matière à la
// fois (voir `useSommaire`) ; la recherche et les fils d'Ariane, eux, ont besoin
// de tout.
// Sans session, le serveur refuse le contenu (`server/middleware/contenu.ts`) :
// on ne demande rien plutôt que d'essuyer un 401, et la connexion relance la
// lecture.
const { loggedIn } = useUserSession()
const { data: navigationBrute } = await useAsyncData('navigation', () => loggedIn.value ? queryCollectionNavigation('cours') : Promise.resolve([]), {
  watch: [loggedIn]
})
const navigation = computed(() => navigationBrute.value ?? [])

const { data: files } = useLazyAsyncData('search', () => loggedIn.value ? queryCollectionSearchSections('cours') : Promise.resolve([]), {
  server: false,
  watch: [loggedIn]
})

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'fr'
  }
})

useSeoMeta({
  titleTemplate: `%s — ${seo?.siteName}`,
  ogSiteName: seo?.siteName,
  // Le site n'a pas vocation à être indexé : c'est un cahier de révisions.
  robots: 'noindex, nofollow, noarchive'
})

provide('navigation', navigation)
</script>

<template>
  <UApp :locale="fr">
    <NuxtLoadingIndicator />

    <AppHeader />

    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>

    <AppFooter />

    <ConnexionModale />

    <ClientOnly>
      <LazyUContentSearch
        :files="files"
        :navigation="navigation"
      />
    </ClientOnly>
  </UApp>
</template>
