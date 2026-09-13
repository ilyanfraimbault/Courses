<script setup lang="ts">
import type { MatiereCatalogue } from '~~/shared/types/quiz'

/**
 * Le choix de la matière, premier geste du quiz comme de la composition d'un
 * QCM. Une matière seule s'affiche quand même : c'est ce qui dit, noir sur
 * blanc, de quel cours viennent les questions.
 */
defineProps<{
  matieres: MatiereCatalogue[]
}>()

const choisie = defineModel<string | null>({ required: true })
</script>

<template>
  <div
    class="grid gap-2 sm:grid-cols-2"
    role="radiogroup"
    aria-label="Matière"
  >
    <button
      v-for="matiere in matieres"
      :key="matiere.cle"
      type="button"
      role="radio"
      :aria-checked="choisie === matiere.cle"
      class="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors"
      :class="choisie === matiere.cle ? 'border-primary bg-primary/5' : 'border-default hover:border-primary/60'"
      @click="choisie = matiere.cle"
    >
      <UIcon
        :name="matiere.icone || 'i-lucide-book-open'"
        class="size-5 shrink-0"
        :class="choisie === matiere.cle ? 'text-primary' : 'text-dimmed'"
      />
      <span class="min-w-0 flex-1">
        <span
          v-if="matiere.annee"
          class="block text-xs text-dimmed"
        >{{ matiere.annee }}</span>
        <span class="block truncate text-sm font-medium text-highlighted">{{ matiere.titre }}</span>
      </span>
      <span class="shrink-0 text-xs text-muted tabular-nums">
        {{ matiere.questions }} question{{ matiere.questions > 1 ? 's' : '' }}
      </span>
    </button>
  </div>
</template>
