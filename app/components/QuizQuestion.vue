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

/**
 * Les propositions arrivent dans l'ordre où le serveur veut les poser, qui
 * n'est pas celui de la fiche. L'écran les repère donc par leur **position** —
 * a, b, c dans l'ordre affiché — et c'est ce repère que le clavier désigne.
 */
const etiquettes = computed(() => reperesQuiz(props.question.lettres))
const reperes = computed(() => props.question.lettres.map(l => etiquettes.value[l] ?? l))

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
  // Chiffres et lettres désignent tous deux un **rang** : « b » coche la
  // deuxième proposition affichée, quelle que soit la lettre qu'elle porte dans
  // la fiche. C'est ce que l'œil voit, donc ce que la main attend.
  const rang = /^[1-9]$/.test(touche) ? Number(touche) - 1 : reperes.value.indexOf(touche)
  const lettre = rang >= 0 ? props.question.lettres[rang] ?? null : null
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
        v-if="question.sectionTitre || question.notionTitre"
        color="neutral"
        variant="soft"
        size="sm"
        class="max-w-full truncate"
        :label="question.sectionTitre ?? question.notionTitre!"
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

    <!-- L'énoncé commun du bloc, quand il y en a un. Il s'affiche en entier et
         sans repli : un énoncé qu'il faut déplier pour lire est exactement le
         défaut qu'on corrige ici. Le traitement reste secondaire — plus petit,
         en retrait — pour que la question demeure ce qu'on voit d'abord. -->
    <div
      v-if="question.enonceBloc"
      class="cours-quiz-chapeau mt-5"
    >
      <p class="cours-panel-title text-dimmed!">
        <UIcon
          name="i-lucide-text-quote"
          class="size-4 shrink-0"
        />
        <span>{{ question.fiche.blocTitre }}</span>
      </p>
      <div class="cours-panel-body text-sm text-muted">
        <QuizRendu :noeuds="question.enonceBloc" />
      </div>
    </div>

    <div
      class="cours-enonce text-lg sm:text-xl text-highlighted"
      :class="question.enonceBloc ? 'mt-4' : 'mt-5'"
    >
      <QuizRendu :noeuds="question.enonce" />
    </div>

    <ChoixReponses
      class="mt-6"
      :lettres="question.lettres"
      :etiquettes="etiquettes"
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
        Au clavier : {{ reperes.join(', ') }} ou 1 à {{ reperes.length }}.
      </template>
    </p>
  </div>
</template>
