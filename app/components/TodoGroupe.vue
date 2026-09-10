<script setup lang="ts">
import { useSortable } from '@vueuse/integrations/useSortable'
import type { TodoItem } from '~~/shared/types/resultats'

const props = defineProps<{
  chapitre: string
  items: TodoItem[]
  /** Dénominateur d'une cible, venu du comptage fait au build. */
  total: (chemin: string, bloc: string | null) => number
  /** D'où vient l'item : « Fonctions usuelles › Exercices ». */
  situation: (chemin: string, bloc: string | null) => string
  termine: (item: TodoItem) => boolean
  premier: boolean
  dernier: boolean
}>()

const emit = defineEmits<{
  marquer: [id: number, fait: boolean]
  supprimer: [id: number]
  /** Le nouvel ordre des items **de ce groupe**. */
  reordonner: [ids: number[]]
  /** Déplacer le chapitre entier, d'un cran vers le haut ou vers le bas. */
  deplacer: [sens: -1 | 1]
}>()

// Une copie locale, que Sortable a le droit de remuer. L'ordre d'ensemble est
// recomposé par le parent : un chapitre ne se réordonne que chez lui, puisque
// c'est le contenu de l'item — et non un choix — qui décide de son groupe.
const locaux = ref<TodoItem[]>([...props.items])
watch(() => props.items, (v) => {
  locaux.value = [...v]
}, { deep: true })

const liste = useTemplateRef<HTMLElement>('liste')

useSortable(liste, locaux, {
  handle: '.todo-poignee',
  animation: 150,
  // Voir ma-to-do.vue : on ne veut pas dépendre de l'ordre de montage.
  watchElement: true,
  // `useSortable` réordonne déjà `locaux` par son `onUpdate` par défaut, avant
  // d'appeler `onEnd`. Le refaire ici déplacerait l'élément une seconde fois :
  // au sein d'une liste, les deux mouvements s'annulent et rien ne bouge. On se
  // contente donc de lire l'ordre obtenu.
  onEnd: async (evt: { oldIndex?: number, newIndex?: number }) => {
    const { oldIndex, newIndex } = evt
    if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return
    await nextTick()
    emit('reordonner', locaux.value.map(i => i.id))
  }
})

function deplacer(id: number, sens: -1 | 1) {
  const ids = locaux.value.map(i => i.id)
  const i = ids.indexOf(id)
  const j = i + sens
  if (i < 0 || j < 0 || j >= ids.length) return
  ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
  emit('reordonner', ids)
}

const restants = computed(() => props.items.filter(i => !props.termine(i)).length)
</script>

<template>
  <section>
    <div class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <UIcon
          name="i-lucide-grip-vertical"
          class="groupe-poignee size-4 shrink-0 cursor-grab text-dimmed"
          aria-hidden="true"
        />
        <h2 class="truncate text-sm font-semibold text-highlighted">
          {{ chapitre }}
        </h2>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <span class="text-xs text-dimmed tabular-nums">
          {{ restants }} à faire sur {{ items.length }}
        </span>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-chevron-up"
          aria-label="Monter le chapitre"
          :disabled="premier"
          @click="emit('deplacer', -1)"
        />
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-chevron-down"
          aria-label="Descendre le chapitre"
          :disabled="dernier"
          @click="emit('deplacer', 1)"
        />
      </div>
    </div>

    <ul
      ref="liste"
      class="mt-2 flex list-none flex-col gap-2 ps-0"
    >
      <TodoLigne
        v-for="(item, index) in locaux"
        :key="item.id"
        :item="item"
        :total="total(item.chemin, item.bloc)"
        :situation="situation(item.chemin, item.bloc)"
        :premier="index === 0"
        :dernier="index === locaux.length - 1"
        @marquer="emit('marquer', item.id, $event)"
        @supprimer="emit('supprimer', item.id)"
        @monter="deplacer(item.id, -1)"
        @descendre="deplacer(item.id, 1)"
      />
    </ul>
  </section>
</template>
