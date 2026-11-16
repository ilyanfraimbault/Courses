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

// Sans session ou sans accès, le serveur refuse le contenu
// (`server/middleware/contenu.ts`) : on ne demande rien plutôt que d'essuyer un
// 401 ou un 403, et l'accès obtenu relance la lecture.
const autorise = useAccesAccorde()
const { data: navigation } = await useAsyncData('navigation', () => autorise.value ? queryCollectionNavigation('cours') : Promise.resolve([]), {
  watch: [autorise]
})
const { data: files } = useLazyAsyncData('search', () => autorise.value ? queryCollectionSearchSections('cours') : Promise.resolve([]), {
  server: false,
  watch: [autorise]
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
