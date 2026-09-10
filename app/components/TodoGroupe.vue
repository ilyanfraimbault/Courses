<script setup lang="ts">
import { useSortable, moveArrayElement } from '@vueuse/integrations/useSortable'
import type { TodoItem } from '~~/shared/types/resultats'

const props = defineProps<{
  chapitre: string
  items: TodoItem[]
  /** Dénominateur d'une cible, venu du comptage fait au build. */
  total: (chemin: string, bloc: string | null) => number
  /** D'où vient l'item : « Fonctions usuelles › Exercices ». */
  situation: (chemin: string, bloc: string | null) => string
  termine: (item: TodoItem) => boolean
}>()

const emit = defineEmits<{
  marquer: [id: number, fait: boolean]
  supprimer: [id: number]
  /** Le nouvel ordre des items **de ce groupe**. */
  reordonner: [ids: number[]]
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
  onEnd: async (evt: { oldIndex?: number, newIndex?: number }) => {
    const { oldIndex, newIndex } = evt
    if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return
    // On laisse Sortable finir sa mutation du DOM avant de toucher au tableau
    // réactif, sinon Vue et Sortable se disputent les mêmes nœuds.
    await nextTick()
    moveArrayElement(locaux.value, oldIndex, newIndex)
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
    <div class="flex items-baseline justify-between gap-2">
      <h2 class="text-sm font-semibold text-highlighted">
        {{ chapitre }}
      </h2>
      <span class="shrink-0 text-xs text-dimmed tabular-nums">
        {{ restants }} à faire sur {{ items.length }}
      </span>
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
