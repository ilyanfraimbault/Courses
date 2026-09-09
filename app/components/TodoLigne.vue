<script setup lang="ts">
import type { TodoItem } from '~~/shared/types/resultats'

const props = defineProps<{
  item: TodoItem
  /** Dénominateur, venu du comptage fait au build. */
  total: number
  premier: boolean
  dernier: boolean
}>()

const emit = defineEmits<{
  marquer: [fait: boolean]
  supprimer: []
  monter: []
  descendre: []
}>()

const typeInfo = computed(() => coursTypeInfo(props.item.type))

// Un QCM se coche à la main, un exercice se coche tout seul : on considère un
// item terminé si toutes ses questions sont trouvées, même sans clic.
const termine = computed(() => !!props.item.fait_le || (props.total > 0 && props.item.reussies >= props.total))

const lien = computed(() => props.item.bloc ? `${props.item.chemin}#${props.item.bloc}` : props.item.chemin)

/** Le chapitre d'où vient l'item, pour situer « Exercice 3 » sans ambiguïté. */
const contexte = computed(() => props.item.chemin.split('/').filter(Boolean).slice(-2).join(' / '))
</script>

<template>
  <li
    class="todo-ligne flex items-center gap-2 rounded-lg border border-default bg-elevated/20 px-2 py-2 sm:px-3"
    :class="termine ? 'opacity-60' : ''"
  >
    <UIcon
      name="i-lucide-grip-vertical"
      class="todo-poignee size-4 shrink-0 cursor-grab text-dimmed"
      aria-hidden="true"
    />

    <UCheckbox
      :model-value="termine"
      :aria-label="`Marquer « ${item.titre} » comme fait`"
      class="shrink-0"
      @update:model-value="emit('marquer', !!$event)"
    />

    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <UBadge
          v-if="typeInfo"
          :color="typeInfo.couleur"
          variant="subtle"
          size="sm"
          class="shrink-0"
          :icon="typeInfo.icone"
          :label="typeInfo.label"
        />
        <ULink
          :to="lien"
          class="truncate font-medium text-highlighted hover:text-primary"
          :class="termine ? 'line-through' : ''"
        >
          {{ item.titre }}
        </ULink>
      </div>
      <p class="mt-0.5 truncate text-xs text-dimmed">
        {{ contexte }}
      </p>
    </div>

    <div
      v-if="total"
      class="hidden w-28 shrink-0 sm:block"
    >
      <UProgress
        size="xs"
        :color="item.reussies >= total ? 'success' : 'primary'"
        :model-value="Math.min(item.reussies, total)"
        :max="total"
      />
      <p class="mt-1 text-right text-xs text-muted tabular-nums">
        {{ Math.min(item.reussies, total) }} / {{ total }}
      </p>
    </div>

    <!-- Repli au clavier et au doigt : le glisser seul exclurait la navigation
         clavier, et sur mobile il se bat avec le défilement de la page. -->
    <div class="flex shrink-0 items-center">
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-chevron-up"
        aria-label="Monter"
        :disabled="premier"
        @click="emit('monter')"
      />
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-chevron-down"
        aria-label="Descendre"
        :disabled="dernier"
        @click="emit('descendre')"
      />
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        aria-label="Retirer de la to-do"
        @click="emit('supprimer')"
      />
    </div>
  </li>
</template>
