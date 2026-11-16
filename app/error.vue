<script setup lang="ts">
import { fr } from '@nuxt/ui/locale'
import type { NuxtError } from '#app'

defineProps<{
  error: NuxtError
}>()

useHead({
  htmlAttrs: {
    lang: 'fr'
  }
})

useSeoMeta({
  title: 'Page introuvable',
  description: 'Cette page n\'existe pas ou a été déplacée.'
})

// Sans session, le serveur refuse le contenu (`server/middleware/contenu.ts`) :
// on ne demande rien plutôt que d'essuyer un 401, et la connexion relance la
// lecture.
const { loggedIn } = useUserSession()
const { data: navigation } = await useAsyncData('navigation', () => loggedIn.value ? queryCollectionNavigation('cours') : Promise.resolve([]), {
  watch: [loggedIn]
})
const { data: files } = useLazyAsyncData('search', () => loggedIn.value ? queryCollectionSearchSections('cours') : Promise.resolve([]), {
  server: false,
  watch: [loggedIn]
})

provide('navigation', navigation)
</script>

<template>
  <UApp :locale="fr">
    <AppHeader />

    <UError :error="error" />

    <AppFooter />

    <ClientOnly>
      <LazyUContentSearch
        :files="files"
        :navigation="navigation"
      />
    </ClientOnly>
  </UApp>
</template>
