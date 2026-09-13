<script setup lang="ts">
const props = defineProps<{
  /** Numéro affiché devant l'énoncé, par exemple « 1. ». */
  label?: string
  /** Identifiant de l'extrait de cours à déployer, s'il y en a un. */
  cours?: string
  /**
   * Lettre attendue. Sa présence fait de la question un choix corrigé sur-le-champ ;
   * son absence laisse la question ouverte, à s'auto-évaluer après lecture de la
   * solution — ce qui reste le seul régime tenable pour une démonstration ou un
   * tableau de variations.
   */
  bonne?: string
}>()

const slots = useSlots()

const hasIndice = computed(() => !!slots.indice)
const hasExemple = computed(() => !!slots.exemple)
const hasSolution = computed(() => !!slots.solution)

const LETTRES = ['a', 'b', 'c', 'd', 'e'] as const

// Une question peut n'avoir que trois propositions : on ne rend que les slots fournis.
const choixPossibles = computed(() => LETTRES.filter(l => !!slots[l]))
const aChoix = computed(() => !!props.bonne && choixPossibles.value.length > 0)

const indiceOuvert = ref(false)
const solutionOuverte = ref(false)
// L'auto-évaluation ne s'ouvre qu'une fois la solution lue : se noter avant
// reviendrait à se noter à l'aveugle.
const solutionLue = ref(false)

const extraits = useCoursExtraits()
const reveal = useCoursReveal()
const progression = useProgression()
const bloc = useBloc()
const route = useRoute()

const identite = computed(() => identiteQuestion(route.path, bloc?.slug.value ?? null, props.label))

// Ce que la mémoire sait de cette question : la lettre trouvée, ou « auto » si
// elle s'est auto-évaluée juste.
const memoire = computed(() => progression?.memoire(identite.value) ?? null)
const trouve = computed(() => memoire.value !== null)

const choisi = ref<string | null>(null)
const errones = ref<string[]>([])

// Une fois la question trouvée, c'est la mémoire qui fait foi : au rechargement
// de la page, la bonne lettre se rallume sans qu'on ait eu à recliquer.
const affiche = computed(() => (trouve.value ? memoire.value : choisi.value))

onMounted(() => {
  progression?.declarer(identite.value)
  bloc?.ajouter(identite.value)
})
onBeforeUnmount(() => {
  progression?.oublier(identite.value)
  bloc?.retirer(identite.value)
})

function choisir(lettre: string) {
  if (trouve.value) return
  choisi.value = lettre
  if (lettre === props.bonne) {
    progression?.reussir(identite.value, lettre)
    return
  }
  // Une seule faute par question et par visite, quel que soit le nombre de
  // mauvaises lettres essayées : c'est la question qui n'est pas sue, pas chaque
  // clic. Les suivantes ne rajoutent rien à ce que la première a déjà dit.
  if (!errones.value.length) progression?.rater(identite.value)
  if (!errones.value.includes(lettre)) errones.value = [...errones.value, lettre]
  // Se tromper n'ouvre pas la réponse : ça ouvre la piste, et on recommence.
  if (hasIndice.value) indiceOuvert.value = true
}

function seNoter(juste: boolean) {
  if (juste) progression?.reussir(identite.value, 'auto')
  else progression?.annuler(identite.value)
}

watch(solutionOuverte, (ouverte) => {
  if (ouverte) solutionLue.value = true
})

// « Tout afficher / tout masquer », en tête des pages qui le proposent. Les
// compteurs laissent à chaque question son état entre deux commandes globales.
if (reveal) {
  watch(reveal.openTick, () => {
    indiceOuvert.value = hasIndice.value
    solutionOuverte.value = hasSolution.value
  })
  watch(reveal.closeTick, () => {
    indiceOuvert.value = false
    solutionOuverte.value = false
  })
}
</script>

<template>
  <QuestionCadre
    v-model:indice-ouvert="indiceOuvert"
    v-model:solution-ouverte="solutionOuverte"
    :label="label"
    :verdict="trouve ? 'juste' : null"
    :indice="hasIndice"
    :exemple="hasExemple"
    :solution="hasSolution"
    :cours="!!cours"
    @cours="cours && extraits?.ouvrir(cours)"
  >
    <slot />

    <template
      v-if="aChoix"
      #choix
    >
      <ChoixReponses
        :lettres="choixPossibles"
        :bonne="bonne!"
        :choisi="affiche"
        :errones="errones"
        :revele="trouve"
        :fige="trouve"
        :intitule="label ? `Propositions de la question ${label}` : undefined"
        @choisir="choisir"
      >
        <template #default="{ lettre }">
          <slot :name="lettre" />
        </template>
      </ChoixReponses>
    </template>

    <template #message>
      <p
        v-if="aChoix && !trouve && errones.length"
        class="mt-3 mb-0 text-sm text-muted"
      >
        Ce n'est pas ça.
        <template v-if="hasIndice">
          L'indice est ouvert : relis-le, puis retente — autant de fois qu'il faudra.
        </template>
        <template v-else>
          Retente : rien ne limite le nombre d'essais.
        </template>
      </p>
    </template>

    <!-- Question ouverte : rien à cocher, donc on se note soi-même, mais
         seulement une fois la solution lue. -->
    <template
      v-if="!aChoix && solutionLue"
      #apres
    >
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <template v-if="trouve">
          <span class="text-sm text-success">Comptée comme réussie.</span>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-undo-2"
            label="Me dédire"
            @click="seNoter(false)"
          />
        </template>
        <template v-else>
          <span class="text-sm text-muted">Après lecture :</span>
          <UButton
            size="xs"
            color="success"
            variant="soft"
            icon="i-lucide-check"
            label="J'avais bon"
            @click="seNoter(true)"
          />
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-x"
            label="J'avais faux"
            @click="seNoter(false)"
          />
        </template>
      </div>
    </template>

    <template
      v-if="hasIndice"
      #indice
    >
      <slot name="indice" />
    </template>

    <template
      v-if="hasExemple"
      #exemple
    >
      <slot name="exemple" />
    </template>

    <template
      v-if="hasSolution"
      #solution
    >
      <p
        v-if="aChoix && affiche"
        class="text-sm text-muted"
      >
        Ta réponse : la <strong class="text-highlighted uppercase">{{ affiche }}</strong>.
        <template v-if="affiche !== bonne">
          La bonne est la <strong class="text-highlighted uppercase">{{ bonne }}</strong>.
        </template>
      </p>
      <slot name="solution" />
    </template>
  </QuestionCadre>
</template>
