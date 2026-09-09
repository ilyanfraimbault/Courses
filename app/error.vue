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

const { data: navigation } = await useAsyncData('navigation', () => queryCollectionNavigation('cours'))
const { data: files } = useLazyAsyncData('search', () => queryCollectionSearchSections('cours'), {
  server: false
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
