<script setup lang="ts">
import type { CorrectionQuiz, QuestionQuiz } from '~~/shared/types/quiz'

const props = defineProps<{
  question: QuestionQuiz
  /** Lettre cochée, y compris pendant l'envoi. */
  choisi: string | null
  /** Absente tant qu'on n'a pas répondu : c'est elle qui découvre la réponse. */
  correction: CorrectionQuiz | null
  /** Vrai pendant l'aller-retour de correction. */
  envoi: boolean
  /** Rang affiché, « question 12 ». */
  numero: number
}>()

const emit = defineEmits<{ choisir: [lettre: string] }>()

const corrige = computed(() => !!props.correction)

/** Les lettres déjà fausses : ici, il n'y en a qu'une, celle qu'on vient de donner. */
const errones = computed(() =>
  props.correction && !props.correction.juste ? [props.correction.donnee] : [])

function choisir(lettre: string) {
  if (corrige.value || props.envoi) return
  emit('choisir', lettre)
}

/**
 * Le clavier : les chiffres et les lettres cochent une proposition.
 *
 * Une séance de quarante questions se fait au clavier ou ne se fait pas — et
 * `a`, `b`, `c` sont exactement les repères affichés à côté des propositions,
 * donc rien à apprendre.
 */
function auClavier(evenement: KeyboardEvent) {
  if (corrige.value || props.envoi) return
  if (evenement.metaKey || evenement.ctrlKey || evenement.altKey) return
  const touche = evenement.key.toLowerCase()
  const parChiffre = /^[1-9]$/.test(touche) ? props.question.lettres[Number(touche) - 1] : null
  const lettre = parChiffre ?? (props.question.lettres.includes(touche) ? touche : null)
  if (!lettre) return
  evenement.preventDefault()
  choisir(lettre)
}

// `useEventListener` ne s'attache que côté client et se détache au démontage :
// la carte suivante ne se retrouve donc pas avec deux écouteurs.
useEventListener(document, 'keydown', auClavier)
</script>

<template>
  <div class="cours-body">
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <UBadge
        color="neutral"
        variant="subtle"
        size="sm"
        class="tabular-nums"
        :label="`Question ${numero}`"
      />
      <UBadge
        v-if="question.themeTitre"
        color="primary"
        variant="subtle"
        size="sm"
        :label="question.themeTitre"
      />
      <UBadge
        v-if="question.notionTitre"
        color="neutral"
        variant="soft"
        size="sm"
        class="max-w-full truncate"
        :label="question.notionTitre"
      />
      <UBadge
        v-if="question.rejouee"
        color="warning"
        variant="subtle"
        size="sm"
        icon="i-lucide-rotate-ccw"
        label="Déjà vue — la banque du filtre est épuisée"
      />
    </div>

    <div class="cours-enonce mt-5 text-lg sm:text-xl text-highlighted">
      <QuizRendu :noeuds="question.enonce" />
    </div>

    <ChoixReponses
      class="mt-6"
      :lettres="question.lettres"
      :bonne="correction?.bonne ?? ''"
      :choisi="choisi"
      :errones="errones"
      :revele="corrige"
      :fige="corrige"
      :intitule="`Propositions de la question ${numero}`"
      @choisir="choisir"
    >
      <template #default="{ lettre }">
        <QuizRendu :noeuds="question.choix[lettre] ?? null" />
      </template>
    </ChoixReponses>

    <p
      v-if="!corrige"
      class="mt-4 mb-0 text-xs text-dimmed"
    >
      <template v-if="envoi">
        Correction en cours…
      </template>
      <template v-else>
        Au clavier : {{ question.lettres.join(', ') }} ou 1 à {{ question.lettres.length }}.
      </template>
    </p>
  </div>
</template>
