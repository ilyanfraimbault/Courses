<script setup lang="ts">
import type { CatalogueQuiz, FiltreQuiz } from '~~/shared/types/quiz'

const props = defineProps<{
  catalogue: CatalogueQuiz
  modelValue: FiltreQuiz
}>()

const emit = defineEmits<{ 'update:modelValue': [filtre: FiltreQuiz] }>()

const deplies = ref<string[]>([])

function estDeplie(cle: string) {
  return deplies.value.includes(cle)
}

function deplier(cle: string) {
  deplies.value = estDeplie(cle) ? deplies.value.filter(c => c !== cle) : [...deplies.value, cle]
}

function basculerTheme(cle: string) {
  const themes = props.modelValue.themes.includes(cle)
    ? props.modelValue.themes.filter(t => t !== cle)
    : [...props.modelValue.themes, cle]
  // Cocher un chapitre rend inutiles les notions qu'on y avait choisies : elles
  // sont déjà dedans, et les laisser ferait un filtre qui se contredit à l'œil.
  const notions = themes.includes(cle)
    ? props.modelValue.notions.filter(n => !n.startsWith(`${cle}/`))
    : props.modelValue.notions
  emit('update:modelValue', { themes, notions })
}

function basculerNotion(cleNotion: string) {
  const notions = props.modelValue.notions.includes(cleNotion)
    ? props.modelValue.notions.filter(n => n !== cleNotion)
    : [...props.modelValue.notions, cleNotion]
  emit('update:modelValue', { themes: props.modelValue.themes, notions })
}

function tout() {
  emit('update:modelValue', { themes: [], notions: [] })
}

const rienDeCoche = computed(() => !props.modelValue.themes.length && !props.modelValue.notions.length)

/**
 * Combien de questions le filtre retient. Le compte suit exactement la règle du
 * serveur — chapitres et notions **s'additionnent** — parce qu'un compte qui
 * dirait autre chose que ce qui sera tiré serait pire que pas de compte.
 */
const disponibles = computed(() => {
  if (rienDeCoche.value) return props.catalogue.total
  let total = 0
  for (const theme of props.catalogue.themes) {
    if (props.modelValue.themes.includes(theme.cle)) {
      total += theme.questions
      continue
    }
    for (const notion of theme.notions) {
      if (props.modelValue.notions.includes(notion.cle)) total += notion.questions
    }
  }
  return total
})

defineExpose({ disponibles })
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="m-0 text-sm text-muted">
        <template v-if="rienDeCoche">
          Rien de coché : la séance pioche dans
          <strong class="text-highlighted tabular-nums">{{ catalogue.total }}</strong> questions,
          tout le programme confondu.
        </template>
        <template v-else>
          <strong class="text-highlighted tabular-nums">{{ disponibles }}</strong>
          question{{ disponibles > 1 ? 's' : '' }} dans la sélection.
        </template>
      </p>
      <UButton
        v-if="!rienDeCoche"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-eraser"
        label="Tout le programme"
        @click="tout"
      />
    </div>

    <div class="mt-3 flex flex-col gap-2">
      <div
        v-for="theme in catalogue.themes"
        :key="theme.cle"
        class="rounded-lg border transition-colors"
        :class="modelValue.themes.includes(theme.cle) ? 'border-primary bg-primary/5' : 'border-default'"
      >
        <div class="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left"
            role="checkbox"
            :aria-checked="modelValue.themes.includes(theme.cle)"
            @click="basculerTheme(theme.cle)"
          >
            <UIcon
              :name="modelValue.themes.includes(theme.cle) ? 'i-lucide-square-check-big' : 'i-lucide-square'"
              class="size-4 shrink-0"
              :class="modelValue.themes.includes(theme.cle) ? 'text-primary' : 'text-dimmed'"
            />
            <UIcon
              v-if="theme.icone"
              :name="theme.icone"
              class="size-4 shrink-0 text-primary"
            />
            <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ theme.titre }}</span>
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
              class="shrink-0 tabular-nums"
              :label="String(theme.questions)"
            />
          </button>
          <UButton
            v-if="theme.notions.length"
            size="xs"
            color="neutral"
            variant="ghost"
            :icon="estDeplie(theme.cle) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            :aria-expanded="estDeplie(theme.cle)"
            :aria-label="`Détailler les notions de ${theme.titre}`"
            @click="deplier(theme.cle)"
          />
        </div>

        <div
          v-if="estDeplie(theme.cle)"
          class="border-t border-default px-3 py-3"
        >
          <p
            v-if="modelValue.themes.includes(theme.cle)"
            class="mt-0 mb-2 text-xs text-muted"
          >
            Le chapitre entier est pris, notions comprises. Décoche-le pour n'en garder que quelques-unes.
          </p>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-for="notion in theme.notions"
              :key="notion.cle"
              size="xs"
              :color="modelValue.notions.includes(notion.cle) ? 'primary' : 'neutral'"
              :variant="modelValue.notions.includes(notion.cle) ? 'solid' : 'outline'"
              :disabled="modelValue.themes.includes(theme.cle)"
              :label="`${notion.titre} · ${notion.questions}`"
              @click="basculerNotion(notion.cle)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
