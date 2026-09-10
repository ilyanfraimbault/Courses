<script setup lang="ts">
import { useSortable, moveArrayElement } from '@vueuse/integrations/useSortable'

definePageMeta({ layout: 'cours' })

const { items, marquer, supprimer, reordonner } = useTodo()
const comptes = useComptesQuestions()
const fiches = useBlocsFiches()
const toast = useToast()

/** Dénominateur d'un item : les questions du bloc visé, ou celles de la fiche. */
function totalDe(chemin: string, bloc: string | null): number {
  if (!bloc) return comptes.value[chemin] ?? 0
  const fiche = fiches.value.find(f => f.chemin === chemin)
  return fiche?.blocs[bloc]?.questions ?? 0
}

function estTermine(item: typeof items.value[number]) {
  const total = totalDe(item.chemin, item.bloc)
  return !!item.fait_le || (total > 0 && item.reussies >= total)
}

const aFaire = computed(() => items.value.filter(i => !estTermine(i)))
const termines = computed(() => items.value.filter(estTermine))

const liste = useTemplateRef<HTMLElement>('liste')

// `useSortable` s'installe dans un `tryOnMounted` : au rendu serveur c'est un
// non-événement, la liste sort en HTML ordinaire et s'hydrate sans divergence.
// Pas de <ClientOnly>, donc pas de trou dans la page au chargement.
useSortable(liste, items, {
  handle: '.todo-poignee',
  animation: 150,
  onEnd: async (evt: { oldIndex?: number, newIndex?: number }) => {
    const { oldIndex, newIndex } = evt
    if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return
    // On laisse Sortable finir sa mutation du DOM avant de toucher au tableau
    // réactif, sinon Vue et Sortable se disputent les mêmes nœuds.
    await nextTick()
    moveArrayElement(items.value, oldIndex, newIndex)
    await nextTick()
    if (!await reordonner(items.value.map(i => i.id))) {
      toast.add({ title: 'Ordre non enregistré', description: 'La liste est revenue à son état précédent.', color: 'error' })
    }
  }
})

async function deplacer(id: number, sens: -1 | 1) {
  const ids = items.value.map(i => i.id)
  const i = ids.indexOf(id)
  const j = i + sens
  if (i < 0 || j < 0 || j >= ids.length) return
  ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
  if (!await reordonner(ids)) {
    toast.add({ title: 'Ordre non enregistré', color: 'error' })
  }
}

const catalogueOuvert = ref(false)

useSeoMeta({ title: 'Ma to-do' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Ma to-do"
      description="Ce que tu as décidé de reprendre, dans l'ordre que tu veux."
    />

    <UPageBody>
      <UButton
        :icon="catalogueOuvert ? 'i-lucide-chevron-down' : 'i-lucide-plus'"
        :label="catalogueOuvert ? 'Fermer le catalogue' : 'Ajouter des exercices, des QCM ou des fiches'"
        :color="catalogueOuvert ? 'neutral' : 'primary'"
        :variant="catalogueOuvert ? 'subtle' : 'solid'"
        size="lg"
        block
        @click="catalogueOuvert = !catalogueOuvert"
      />

      <div
        v-if="catalogueOuvert"
        class="mt-4 rounded-lg border border-default p-4"
      >
        <TodoCatalogue />
      </div>

      <p
        v-if="!items.length"
        class="mt-6 text-sm text-muted"
      >
        Rien pour l'instant. Ouvre le catalogue ci-dessus, ou clique sur
        <UIcon
          name="i-lucide-list-plus"
          class="inline size-4 align-text-bottom"
        />
        à côté d'un exercice depuis une fiche.
      </p>

      <ul
        v-else
        ref="liste"
        class="mt-6 flex list-none flex-col gap-2 ps-0"
      >
        <TodoLigne
          v-for="(item, index) in items"
          :key="item.id"
          :item="item"
          :total="totalDe(item.chemin, item.bloc)"
          :premier="index === 0"
          :dernier="index === items.length - 1"
          @marquer="marquer(item.id, $event)"
          @supprimer="supprimer(item.id)"
          @monter="deplacer(item.id, -1)"
          @descendre="deplacer(item.id, 1)"
        />
      </ul>

      <p
        v-if="items.length"
        class="mt-4 text-xs text-dimmed"
      >
        {{ aFaire.length }} à faire, {{ termines.length }} terminé{{ termines.length > 1 ? 's' : '' }}.
        Glisse par la poignée, ou utilise les flèches.
      </p>
    </UPageBody>
  </UPage>
</template>
