<script setup lang="ts">
import { fr } from '@nuxt/ui/locale'

const { seo } = useAppConfig()
const route = useRoute()

// L'arbre complet, tel quel. La barre latérale n'en montre qu'une matière à la
// fois (voir `useSommaire`) ; la recherche et les fils d'Ariane, eux, ont besoin
// de tout.
// Sans session ou sans accès, le serveur refuse le contenu
// (`server/middleware/contenu.ts`) : on ne demande rien plutôt que d'essuyer un
// 401 ou un 403, et l'accès obtenu relance la lecture.
const autorise = useAccesAccorde()
const { data: navigationBrute } = await useAsyncData('navigation', () => autorise.value ? queryCollectionNavigation('cours') : Promise.resolve([]), {
  watch: [autorise]
})
const navigation = computed(() => navigationBrute.value ?? [])

const { data: files } = useLazyAsyncData('search', () => autorise.value ? queryCollectionSearchSections('cours') : Promise.resolve([]), {
  server: false,
  watch: [autorise]
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

    <!-- L'accueil tient dans l'écran, sans défiler : le pied de page n'y a pas sa place. -->
    <AppFooter v-if="route.path !== '/'" />

    <ConnexionModale />
    <ProfilFenetre />

    <ClientOnly>
      <LazyUContentSearch
        :files="files"
        :navigation="navigation"
      />
    </ClientOnly>
  </UApp>
</template>
