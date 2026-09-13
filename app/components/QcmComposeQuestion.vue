<script setup lang="ts">
import type { CorrectionQuiz, QuestionQuiz } from '~~/shared/types/quiz'

/**
 * Une question d'un QCM composé.
 *
 * Même habillage qu'une question de fiche (`QuestionCadre`), mais le contenu
 * arrive en fragments relus au serveur, et la bonne réponse avec la copie
 * corrigée. Deux ajouts, qui tiennent à ce qu'elle est sortie de sa fiche :
 *
 * - **l'énoncé commun de son bloc**, rappelé au-dessus d'elle. « Donner l'affixe
 *   du vecteur M₂M₄ » est insoluble sans les coordonnées écrites en tête de
 *   l'exercice ;
 * - **sa référence**, écrite en clair : la fiche, l'exercice, le repère. Un QCM
 *   composé ne recopie rien, et le dire est ce qui permet d'aller relire la
 *   question chez elle.
 */
const props = defineProps<{
  question: QuestionQuiz
  /** Lettre cochée, ou null. */
  choisi: string | null
  /** Absente tant que la copie n'est pas rendue. */
  correction: CorrectionQuiz | null
  /** Ratée au passage précédent de ce QCM. */
  rateeAvant?: boolean
}>()

const emit = defineEmits<{ choisir: [lettre: string | null] }>()

const indiceOuvert = ref(false)
const solutionOuverte = ref(false)
const coursOuvert = ref(false)

const corrige = computed(() => !!props.correction)

// Les propositions sont brassées pour ce QCM : l'écran les repère par leur rang
// affiché, jamais par la lettre de la fiche.
const etiquettes = computed(() => reperesQuiz(props.question.lettres))
const repere = (lettre: string | null) => (lettre ? etiquettes.value[lettre] ?? lettre : null)

const verdict = computed(() => (props.correction ? (props.correction.juste ? 'juste' : 'faux') : null))
const errones = computed(() => {
  const c = props.correction
  return c && !c.juste && c.donnee ? [c.donnee] : []
})

function choisir(lettre: string) {
  if (corrige.value) return
  // Recliquer sa réponse la retire : on peut laisser une question blanche.
  emit('choisir', props.choisi === lettre ? null : lettre)
}

// Recommencer referme ce que la correction avait déplié.
watch(corrige, (c) => {
  if (!c) {
    indiceOuvert.value = false
    solutionOuverte.value = false
    coursOuvert.value = false
  }
})

const grandEcran = useMediaQuery('(min-width: 48rem)')

// Le contenu d'un tiroir est téléporté dans <body>, hors de `.cours-body` : sans
// ce report de classe, les formules en bloc ne seraient plus défilables.
const uiTiroir = computed(() => ({
  content: grandEcran.value ? 'cours-body w-full max-w-xl' : 'cours-body max-h-[85vh]'
}))
</script>

<template>
  <QuestionCadre
    v-model:indice-ouvert="indiceOuvert"
    v-model:solution-ouverte="solutionOuverte"
    :ancre="`question-${question.position + 1}`"
    :label="`${question.position + 1}.`"
    :verdict="verdict"
    :aide="corrige"
    :indice="!!correction?.indice"
    :solution="!!correction?.solution"
    :cours="!!correction?.extrait"
    @cours="coursOuvert = true"
  >
    <template #entete>
      <p class="mt-0 mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dimmed">
        <UIcon
          name="i-lucide-file-text"
          class="size-3.5 shrink-0"
        />
        <ULink
          :to="question.fiche.chemin"
          target="_blank"
          class="hover:text-primary"
          :title="`Ouvrir « ${question.fiche.titre} » dans un nouvel onglet`"
        >
          {{ question.fiche.titre }} › {{ question.fiche.blocTitre }}, question {{ question.label }}
        </ULink>
        <span v-if="question.sectionTitre">· {{ question.sectionTitre }}</span>
      </p>

      <div
        v-if="question.enonceBloc"
        class="cours-quiz-chapeau mb-3"
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
    </template>

    <QuizRendu :noeuds="question.enonce" />

    <template #choix>
      <ChoixReponses
        :lettres="question.lettres"
        :etiquettes="etiquettes"
        :bonne="correction?.bonne ?? ''"
        :choisi="choisi"
        :errones="errones"
        :revele="corrige"
        :fige="corrige"
        :intitule="`Propositions de la question ${question.position + 1}`"
        @choisir="choisir"
      >
        <template #default="{ lettre }">
          <QuizRendu :noeuds="question.choix[lettre] ?? null" />
        </template>
      </ChoixReponses>
    </template>

    <template #message>
      <p
        v-if="correction && !correction.juste"
        class="mt-3 mb-0 text-sm text-muted"
      >
        <template v-if="correction.passee">
          Aucune réponse donnée. La bonne était la <strong class="text-highlighted uppercase">{{ repere(correction.bonne) }}</strong>.
        </template>
        <template v-else>
          Réponse attendue : la <strong class="text-highlighted uppercase">{{ repere(correction.bonne) }}</strong>.
        </template>
        <template v-if="rateeAvant">
          <br>
          <span class="text-error">Déjà ratée au passage précédent</span> — ouvre le cours plutôt que la solution.
        </template>
      </p>
      <p
        v-else-if="correction && rateeAvant"
        class="mt-3 mb-0 text-sm text-muted"
      >
        <span class="text-success">Ratée au passage précédent, juste aujourd'hui.</span>
      </p>
    </template>

    <template #apres>
      <UDrawer
        v-if="correction?.extrait"
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
    </template>

    <template #indice>
      <QuizRendu :noeuds="correction?.indice ?? null" />
    </template>

    <template #solution>
      <QuizRendu :noeuds="correction?.solution ?? null" />
    </template>
  </QuestionCadre>
</template>
