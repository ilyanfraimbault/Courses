<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'
import { fr } from '@nuxt/ui/locale'

const { seo } = useAppConfig()

const { data: navigationBrute } = await useAsyncData('navigation', () => queryCollectionNavigation('cours'))

/**
 * Supprime les niveaux de l'arborescence qui n'apprennent rien.
 *
 * Le contenu s'étage en « Cours › Première année › Remise à niveau en maths ›
 * Chapitre › Page ». Les trois premiers niveaux n'ont, aujourd'hui, qu'un seul
 * descendant chacun : ils coûtent trois crans d'indentation, au point que
 * « Remise à niveau en… » et « Entraîneme… » ne tiennent plus dans la colonne.
 *
 * Attention à la forme de l'arbre : un dossier porte **deux** enfants, sa propre
 * page d'index — de même chemin que lui — et le niveau suivant. Compter les
 * enfants sans écarter cet auto-lien fait croire à un embranchement là où il n'y
 * en a pas.
 *
 * Rien n'est supprimé en dur : dès qu'une seconde année ou une seconde matière
 * existera, le niveau correspondant aura deux vrais enfants et reparaîtra de
 * lui-même.
 */
function aplatirChaines(noeuds: ContentNavigationItem[]): ContentNavigationItem[] {
  if (noeuds.length !== 1) return noeuds

  let noeud = noeuds[0]
  while (noeud?.children?.length) {
    const vrais = noeud.children.filter(enfant => enfant.path !== noeud!.path)
    if (vrais.length !== 1 || !vrais[0]?.children?.length) break
    noeud = vrais[0]
  }

  return noeud?.children?.length ? noeud.children : noeuds
}

const navigation = computed(() => aplatirChaines(navigationBrute.value ?? []))

const { data: files } = useLazyAsyncData('search', () => queryCollectionSearchSections('cours'), {
  server: false
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

    <ClientOnly>
      <LazyUContentSearch
        :files="files"
        :navigation="navigation"
      />
    </ClientOnly>
  </UApp>
</template>
