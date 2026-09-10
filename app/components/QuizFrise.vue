<script setup lang="ts">
import type { SessionQuiz } from '~~/shared/types/quiz'

const props = defineProps<{ session: SessionQuiz }>()

/**
 * La file, une case par question.
 *
 * Elle s'allonge sous les yeux : chaque faute ajoute une case à la fin, et c'est
 * exactement ce qu'il faut voir — la séance ne se termine pas au bout de
 * quarante questions, elle se termine quand les quarante places sont acquises.
 */
const cases = computed(() => props.session.file.map((place, i) => ({
  cle: i,
  place: place.place,
  courante: i === props.session.position && !props.session.finie,
  etat: place.etat
})))

const COULEURS: Record<string, string> = {
  juste: 'bg-success',
  manquee: 'bg-error',
  attente: 'bg-elevated'
}
</script>

<template>
  <div
    class="flex flex-wrap gap-1"
    role="img"
    :aria-label="`${session.acquises} places acquises sur ${session.taille}, ${session.longueur} questions dans la file`"
  >
    <span
      v-for="c in cases"
      :key="c.cle"
      class="h-1.5 w-4 rounded-full transition-colors"
      :class="[COULEURS[c.etat], c.courante && 'ring-2 ring-primary ring-offset-1 ring-offset-default']"
      :title="`Place ${c.place} — ${c.etat === 'juste' ? 'acquise' : c.etat === 'manquee' ? 'manquée, elle revient plus loin' : 'à venir'}`"
    />
  </div>
</template>
