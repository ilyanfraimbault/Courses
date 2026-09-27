<script setup lang="ts">
import type { CatalogueQuiz } from '~~/shared/types/quiz'
import type { ValeursControle } from '~~/shared/types/controles'

definePageMeta({ layout: 'cours' })

/** Le catalogue du quiz donne le plan du cours sur lequel on coche le programme. */
const { data: catalogue } = await useLazyFetch<CatalogueQuiz>('/api/quiz/catalogue', { server: false })

const route = useRoute()
const enCours = ref(false)
const erreur = ref<string | null>(null)

/**
 * Les valeurs de départ, une fois le catalogue connu : la matière passée en
 * adresse si elle existe, la première du sommaire sinon, et une date dans une
 * semaine — la plus fréquente pour un contrôle qu'on vient d'apprendre.
 */
const initial = computed<ValeursControle | null>(() => {
  const c = catalogue.value
  if (!c) return null
  const demandee = typeof route.query.matiere === 'string' ? route.query.matiere : null
  const matiere = c.matieres.find(m => m.cle === demandee)?.cle ?? c.matieres[0]?.cle ?? null
  const dansUneSemaine = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const jour = `${dansUneSemaine.getFullYear()}-${String(dansUneSemaine.getMonth() + 1).padStart(2, '0')}-${String(dansUneSemaine.getDate()).padStart(2, '0')}`
  return { titre: '', matiere, jour, themes: [], sections: [] }
})

async function creer(valeurs: ValeursControle) {
  enCours.value = true
  erreur.value = null
  try {
    const { id } = await $fetch<{ id: number }>('/api/controles', { method: 'POST', body: valeurs })
    await navigateTo(`/mes-controles/${id}`)
  } catch (e) {
    erreur.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Le contrôle n\'a pas pu être créé.'
    enCours.value = false
  }
}

useSeoMeta({ title: 'Nouveau contrôle' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Nouveau contrôle"
      description="Une date et un programme. Le site en tire une feuille de route jusqu'au jour J : ce qu'il reste à apprendre, découpé en journées dans l'ordre du cours, un examen blanc l'avant-veille et la dette à solder la veille."
    >
      <template #headline>
        <UButton
          to="/mes-controles"
          icon="i-lucide-arrow-left"
          label="Mes contrôles"
          color="neutral"
          variant="link"
          class="px-0"
        />
      </template>
    </UPageHeader>

    <UPageBody>
      <ControleFormulaire
        v-if="catalogue && initial"
        :matieres="catalogue.matieres"
        :initial="initial"
        libelle="Créer le contrôle"
        :en-cours="enCours"
        :erreur="erreur"
        @valider="creer"
      />
      <div
        v-else
        class="flex flex-col gap-3"
      >
        <USkeleton class="h-10 w-full" />
        <USkeleton class="h-40 w-full" />
      </div>
    </UPageBody>
  </UPage>
</template>
