<script setup lang="ts">
import type { CorrectionQuiz, QuestionQuiz } from '~~/shared/types/quiz'

const props = defineProps<{
  correction: CorrectionQuiz
  question: QuestionQuiz
}>()

const coursOuvert = ref(false)

// Sur une faute, la solution est déjà là : c'est ce qu'on est venu chercher.
// Sur une réussite elle reste repliée — la lire à chaque fois transformerait une
// séance de quarante questions en séance de lecture.
const solutionOuverte = ref(!props.correction.juste)

// « Je ne sais pas » demande tout, y compris l'indice : c'est la seule fois où
// l'indice a encore quelque chose à apprendre, puisqu'on n'a pas cherché avec.
// Après une faute il reste replié — on l'a déjà eu sous les yeux.
const indiceOuvert = ref(props.correction.passee)

// Le verdict nomme les propositions comme l'écran les a montrées, et non par
// les lettres de la fiche : le quiz en a brassé l'ordre.
const etiquettes = computed(() => reperesQuiz(props.question.lettres))
const donnee = computed(() => {
  const lettre = props.correction.donnee
  return lettre ? etiquettes.value[lettre] ?? lettre : null
})
const bonne = computed(() => etiquettes.value[props.correction.bonne] ?? props.correction.bonne)

const grandEcran = useMediaQuery('(min-width: 48rem)')

// Le contenu d'un tiroir est téléporté dans <body>, hors de `.cours-body` : sans
// ce report de classe, les formules en bloc ne seraient plus défilables.
const uiTiroir = computed(() => ({
  content: grandEcran.value ? 'cours-body cours-tiroir-ajuste' : 'cours-body max-h-[85vh]'
}))
</script>

<template>
  <div class="cours-body mt-6">
    <div
      class="rounded-lg border px-4 py-3"
      :class="correction.juste
        ? 'border-success bg-success/10'
        : correction.passee
          ? 'border-warning bg-warning/10'
          : 'border-error bg-error/10'"
    >
      <p class="m-0 flex items-start gap-2 font-medium text-highlighted">
        <UIcon
          :name="correction.juste
            ? 'i-lucide-circle-check'
            : correction.passee ? 'i-lucide-circle-help' : 'i-lucide-circle-x'"
          class="mt-0.5 size-5 shrink-0"
          :class="correction.juste
            ? 'text-success'
            : correction.passee ? 'text-warning' : 'text-error'"
        />
        <span v-if="correction.juste">Juste.</span>
        <span v-else-if="correction.passee">
          Passée : la réponse était la <strong class="uppercase">{{ bonne }}</strong>.
        </span>
        <span v-else>
          Raté : tu as répondu <strong class="uppercase">{{ donnee }}</strong>,
          la bonne réponse était la <strong class="uppercase">{{ bonne }}</strong>.
        </span>
      </p>

      <p
        v-if="correction.reprise"
        class="mt-2 mb-0 text-sm text-muted"
      >
        <template v-if="correction.reprise.rejouee">
          Cette question revient <strong class="text-highlighted">à la fin</strong> :
          il ne reste plus de question voisine dans la sélection.
        </template>
        <template v-else>
          Une <strong class="text-highlighted">autre</strong> question revient à la fin
          <template v-if="correction.reprise.notionTitre">
            sur « {{ correction.reprise.notionTitre }} »
          </template>
          — la séance ne se termine pas tant que cette place n'est pas acquise.
        </template>
      </p>
    </div>

    <div class="mt-3 flex flex-wrap gap-2">
      <UButton
        v-if="correction.solution"
        size="xs"
        color="primary"
        variant="soft"
        :icon="solutionOuverte ? 'i-lucide-eye-off' : 'i-lucide-eye'"
        :label="solutionOuverte ? 'Masquer la correction' : 'Voir la correction'"
        :aria-expanded="solutionOuverte"
        @click="solutionOuverte = !solutionOuverte"
      />
      <UButton
        v-if="correction.indice"
        size="xs"
        color="warning"
        variant="soft"
        :icon="indiceOuvert ? 'i-lucide-lightbulb-off' : 'i-lucide-lightbulb'"
        :label="indiceOuvert ? 'Masquer l\'indice' : 'L\'indice qu\'il fallait suivre'"
        :aria-expanded="indiceOuvert"
        @click="indiceOuvert = !indiceOuvert"
      />
      <UButton
        v-if="correction.extrait"
        size="xs"
        :color="correction.passee ? 'primary' : 'neutral'"
        :variant="correction.passee ? 'solid' : 'subtle'"
        icon="i-lucide-book-open-text"
        label="Le rappel de cours"
        @click="coursOuvert = true"
      />
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-file-text"
        trailing-icon="i-lucide-arrow-up-right"
        target="_blank"
        :to="question.fiche.chemin"
        :label="question.fiche.blocTitre"
        :title="`Ouvrir « ${question.fiche.titre} » dans un nouvel onglet`"
      />
    </div>

    <Transition name="cours-reveal">
      <div
        v-show="indiceOuvert && correction.indice"
        class="cours-panel cours-panel-indice"
      >
        <p class="cours-panel-title">
          <UIcon
            name="i-lucide-lightbulb"
            class="size-4 shrink-0"
          />
          <span>Indice</span>
        </p>
        <div class="cours-panel-body">
          <QuizRendu :noeuds="correction.indice" />
        </div>
      </div>
    </Transition>

    <Transition name="cours-reveal">
      <div
        v-show="solutionOuverte && correction.solution"
        class="cours-panel cours-panel-solution"
      >
        <p class="cours-panel-title">
          <UIcon
            name="i-lucide-circle-check"
            class="size-4 shrink-0"
          />
          <span>Correction</span>
        </p>
        <div class="cours-panel-body">
          <QuizRendu :noeuds="correction.solution" />
        </div>
      </div>
    </Transition>

    <UDrawer
      v-if="correction.extrait"
      v-model:open="coursOuvert"
      :direction="grandEcran ? 'right' : 'bottom'"
      :title="correction.extrait.titre"
      :handle="!grandEcran"
      :ui="uiTiroir"
    >
      <template #body>
        <div class="cours-panel-body cours-overlay-corps">
          <QuizRendu :noeuds="correction.extrait.corps" />
        </div>
      </template>

      <template #footer>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-if="correction.extrait.source"
            :to="correction.extrait.source"
            target="_blank"
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-book-open-text"
            trailing-icon="i-lucide-arrow-up-right"
            label="Lire la section complète dans le cours"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            label="Fermer"
            @click="coursOuvert = false"
          />
        </div>
      </template>
    </UDrawer>
  </div>
</template>
