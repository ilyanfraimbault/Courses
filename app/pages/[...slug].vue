<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'
import { findPageHeadline } from '@nuxt/content/utils'
import { withoutTrailingSlash } from 'ufo'
import type { NatureCloture } from '~~/shared/types/clotures'
import { niveauxDuChemin } from '~~/shared/utils/niveaux'

definePageMeta({
  layout: 'cours'
})

const route = useRoute()
const { toc } = useAppConfig()
const navigation = inject<Ref<ContentNavigationItem[]>>('navigation')

// Même canonicalisation que `cheminCanonique` : sans elle, le chemin stocké en
// mémoire ne correspondrait plus et une même fiche aurait deux progressions.
const routePath = computed(() => withoutTrailingSlash(route.path))

const { data: page } = await useAsyncData(routePath.value, () =>
  queryCollection('cours').path(routePath.value).first()
)
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page non trouvée', fatal: true })
}

const { data: surround } = await useAsyncData(`${routePath.value}-surround`, () => {
  return queryCollectionItemSurroundings('cours', routePath.value, {
    fields: ['description']
  })
})

const { openAll, closeAll } = provideCoursReveal()
provideCoursExtraits()

// Une seule requête par fiche, dont se servent la progression et les frises des
// blocs de QCM. On passe le résultat à `provideProgression` plutôt que de le
// laisser l'injecter : `inject` ne voit pas ce que le même composant fournit.
const donneesFiche = provideDonneesFiche(routePath)

// Les blocs de questions de la page — exercices comme QCM — viennent s'y compter :
// c'est ce total qui alimente la barre ci-dessous et celle des cartes de lien.
const { total: totalQuestions, reussies, pourcentage, oublierProgression } = provideProgression(routePath, donneesFiche)

// Cours, exercices du TD et fiche d'entraînement ne se lisent pas de la même
// façon : la pastille rappelle sur quelle sorte de page on vient d'arriver.
const typeInfo = computed(() => coursTypeInfo(page.value?.type))

const headline = computed(() => findPageHeadline(navigation?.value, page.value?.path))

// Toute fiche peut entrer dans une to-do, y compris une page de cours : « lire
// le cours avant les exercices » est une tâche comme une autre. Seuls les
// sommaires en sont exclus — ils n'ont pas de `type`.
const ciblableEnTodo = computed(() => !!page.value?.type)

/**
 * Ce que cette page permet de clore : sa matière ou son chapitre quand elle en
 * est l'index, elle-même quand c'est une fiche qui porte des questions. Une
 * année, un formulaire sans question n'ont rien à retirer d'une séance.
 */
const natureCloture = computed<NatureCloture | null>(() => {
  const niveaux = niveauxDuChemin(routePath.value)
  if (routePath.value === niveaux.matiere) return 'matiere'
  if (routePath.value === niveaux.chapitre) return 'chapitre'
  if (page.value?.type && (page.value.questions ?? 0) > 0) return 'fiche'
  return null
})

const planifier = ref(false)

useSeoMeta({
  title: page.value.title,
  description: page.value.description
})
</script>

<template>
  <UPage v-if="page">
    <UPageHeader
      :title="page.title"
      :description="page.description"
      :headline="headline"
    >
      <template
        v-if="typeInfo"
        #headline
      >
        <UBadge
          :color="typeInfo.couleur"
          variant="subtle"
          size="md"
          :icon="typeInfo.icone"
          :label="typeInfo.label"
        />
      </template>
    </UPageHeader>

    <!-- La clôture est une donnée du compte : elle ne s'affiche qu'au client,
         une fois lue. Le HTML servi reste le même pour tout le monde. -->
    <ClientOnly v-if="natureCloture">
      <ClotureBouton
        class="mt-6"
        :chemin="routePath"
        :nature="natureCloture"
        forme="bandeau"
      />
      <div
        v-if="natureCloture !== 'fiche'"
        class="mt-4 flex justify-end gap-2"
      >
        <!-- Un contrôle se planifie depuis sa matière : elle est déjà choisie. -->
        <template v-if="natureCloture === 'matiere'">
          <UButton
            icon="i-lucide-calendar-plus"
            label="Planifier un contrôle"
            color="neutral"
            variant="subtle"
            size="sm"
            @click="planifier = true"
          />
          <ControlePlanifier
            v-model:open="planifier"
            :matiere="page.programme ?? routePath"
            @enregistre="id => navigateTo(`/controles/${id}`)"
          />
        </template>
        <ClotureBouton
          :chemin="routePath"
          :nature="natureCloture"
          forme="bouton"
        />
      </div>
    </ClientOnly>

    <div
      v-if="totalQuestions || page.interactif"
      class="mt-6 flex flex-col gap-3"
    >
      <div v-if="totalQuestions">
        <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span class="text-sm text-muted">
            <span class="font-medium text-highlighted tabular-nums">{{ reussies }} / {{ totalQuestions }}</span>
            question{{ totalQuestions > 1 ? 's' : '' }} trouvée{{ totalQuestions > 1 ? 's' : '' }}
          </span>
          <div class="flex items-center gap-1">
            <TodoBouton
              v-if="ciblableEnTodo"
              :chemin="routePath"
              :titre="page.title"
              :type="page.type"
            />
            <ClientOnly v-if="natureCloture === 'fiche'">
              <ClotureBouton
                :chemin="routePath"
                nature="fiche"
                forme="bouton"
              />
            </ClientOnly>
            <UButton
              v-if="reussies"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-eraser"
              label="Repartir de zéro"
              @click="oublierProgression"
            />
          </div>
        </div>
        <UProgress
          class="mt-2"
          size="xs"
          :color="pourcentage === 100 ? 'success' : 'primary'"
          :model-value="reussies"
          :max="totalQuestions"
        />
      </div>

      <div
        v-if="page.interactif"
        class="flex flex-wrap items-center gap-2"
      >
        <UButton
          size="xs"
          color="neutral"
          variant="outline"
          icon="i-lucide-eye"
          label="Tout afficher"
          @click="openAll"
        />
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-eye-off"
          label="Tout masquer"
          @click="closeAll"
        />
      </div>
    </div>

    <UPageBody class="cours-body">
      <ContentRenderer
        v-if="page.body"
        :value="page"
      />

      <USeparator v-if="surround?.length" />

      <UContentSurround :surround="surround" />
    </UPageBody>

    <template
      v-if="page?.body?.toc?.links?.length"
      #right
    >
      <UContentToc
        :title="toc?.title"
        :links="page.body?.toc?.links"
        highlight
      />
    </template>
  </UPage>
</template>
