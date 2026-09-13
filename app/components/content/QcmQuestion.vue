<script setup lang="ts">
const props = defineProps<{
  /** Repère affiché devant l'énoncé, par exemple « 12. ». */
  label?: string
  /** Lettre de la bonne réponse : « a », « b », « c » ou « d ». */
  bonne: string
  /** Identifiant de l'extrait de cours à déployer après correction. */
  cours?: string
}>()

const slots = useSlots()

const LETTRES = ['a', 'b', 'c', 'd', 'e'] as const

// Une question peut n'avoir que trois propositions : on ne rend que les slots fournis.
const choixPossibles = computed(() => LETTRES.filter(l => !!slots[l]))

const uid = useId()
const choisi = ref<string | null>(null)
const indiceOuvert = ref(false)
const solutionOuverte = ref(false)

const qcm = useQcm()
const extraits = useCoursExtraits()
const progression = useProgression()
const bloc = useBloc()
const route = useRoute()

// La question compte dans la progression de la fiche, comme celle d'un exercice.
// La relation est à sens unique : le QCM écrit ce qu'il a réussi, mais ne relit
// jamais cette mémoire — sinon la copie arriverait pré-remplie et ne voudrait
// plus rien dire.
const identite = computed(() => identiteQuestion(route.path, bloc?.slug.value ?? null, props.label))

const corrige = computed(() => qcm?.corrige.value ?? false)
const juste = computed(() => choisi.value === props.bonne)

// Ce que le passage précédent disait de cette question précise : une erreur qui
// revient ne se traite pas comme une étourderie, et un point regagné mérite
// d'être vu là où il a été perdu.
const rateeAvant = computed(() =>
  !!props.label && !!qcm?.ratesPrecedents.value.includes(props.label))

onMounted(() => {
  qcm?.enregistrer({ id: uid, label: props.label, bonne: props.bonne })
  progression?.declarer(identite.value)
  bloc?.ajouter(identite.value)
})
onBeforeUnmount(() => {
  qcm?.oublier(uid)
  progression?.oublier(identite.value)
  bloc?.retirer(identite.value)
})

// Le conteneur remet les réponses à zéro en sortant du mode corrigé : la question
// suit le mouvement plutôt que de garder un choix orphelin, et referme l'aide
// qu'elle avait dépliée. Une question déjà gagnée le reste en revanche :
// recommencer un QCM ne défait pas la progression.
watch(corrige, (actif) => {
  if (!actif) {
    choisi.value = null
    indiceOuvert.value = false
    solutionOuverte.value = false
    return
  }
  if (juste.value && choisi.value) progression?.reussir(identite.value, choisi.value)
})

function choisir(lettre: string) {
  if (corrige.value) return
  // Recliquer sa propre réponse la retire, ce qui permet de laisser une question blanche.
  choisi.value = choisi.value === lettre ? null : lettre
  qcm?.repondre(uid, choisi.value)
}

const verdict = computed(() => (corrige.value ? (juste.value ? 'juste' : 'faux') : null))

// Une fois la copie rendue, la lettre donnée reste barrée si elle était fausse.
const errones = computed(() => (corrige.value && choisi.value && !juste.value ? [choisi.value] : []))
</script>

<template>
  <QuestionCadre
    v-model:indice-ouvert="indiceOuvert"
    v-model:solution-ouverte="solutionOuverte"
    :ancre="uid"
    :label="label"
    :verdict="verdict"
    :aide="corrige"
    :indice="!!slots.indice"
    :solution="!!slots.solution"
    :cours="!!cours"
    @cours="cours && extraits?.ouvrir(cours)"
  >
    <slot />

    <template #choix>
      <ChoixReponses
        :lettres="choixPossibles"
        :bonne="bonne"
        :choisi="choisi"
        :errones="errones"
        :revele="corrige"
        :fige="corrige"
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
        v-if="corrige && !juste"
        class="mt-3 mb-0 text-sm text-muted"
      >
        <template v-if="choisi === null">
          Aucune réponse donnée. La bonne était la <strong class="text-highlighted uppercase">{{ bonne }}</strong>.
        </template>
        <template v-else>
          Réponse attendue : la <strong class="text-highlighted uppercase">{{ bonne }}</strong>.
        </template>
        <template v-if="rateeAvant">
          <br>
          <span class="text-error">Déjà ratée au passage précédent</span> — ouvre le cours plutôt que la solution.
        </template>
      </p>
      <p
        v-else-if="corrige && rateeAvant"
        class="mt-3 mb-0 text-sm text-muted"
      >
        <span class="text-success">Ratée au passage précédent, juste aujourd'hui.</span>
      </p>
    </template>

    <template
      v-if="slots.indice"
      #indice
    >
      <slot name="indice" />
    </template>

    <template
      v-if="slots.solution"
      #solution
    >
      <slot name="solution" />
    </template>
  </QuestionCadre>
</template>
