<script setup lang="ts">
/**
 * Des réponses à écrire, champ par champ — ce qu'on fait sur une copie quand on
 * calcule une adresse de réseau, une diffusion ou un nombre d'interfaces.
 *
 * Un choix entre quatre adresses se résout souvent sans calcul : la seule
 * proposition qui finit par un multiple du pas, la seule qui tombe dans la
 * plage… Écrire l'adresse oblige à poser le masque, ce qui était l'exercice.
 *
 * Posé dans une `exo-question` sans `bonne`, il rend son verdict à la question,
 * qui l'écrit en base comme n'importe quelle réponse ; seul, il se corrige pour
 * lui-même, sans mémoire. Même contrat que la table de vérité.
 */
interface Champ {
  /** Ce qu'on demande : « Adresse de diffusion ». */
  libelle: string
  /** La réponse attendue, ou la liste des écritures acceptées. */
  attendu: string | string[]
  /** Le gabarit grisé dans le champ vide : « x.x.x.x ». */
  aide?: string
}

const props = defineProps<{
  champs: Champ[]
}>()

// Relie chaque libellé à son champ ; rien à voir avec l'identité d'une question.
const prefixe = useId()

const question = useQuestionRemplie()
question?.inscrire()

const OCTETS = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/\d{1,2})?$/

/*
 * Deux écritures d'une même réponse ne doivent pas valoir une faute : les
 * espaces et la casse ne comptent pas, et un octet s'écrit sans ses zéros de
 * tête — « 192.168.010.064 » est la même adresse que « 192.168.10.64 ».
 */
function normaliser(texte: string): string {
  const brut = String(texte).toLowerCase().replace(/\s+/g, '')
  const ip = brut.match(OCTETS)
  if (!ip) return brut
  return [1, 2, 3, 4].map(k => String(Number(ip[k]))).join('.') + (ip[5] ? `/${Number(ip[5].slice(1))}` : '')
}

const champs = computed(() => (props.champs ?? []).map((c) => {
  const liste = (Array.isArray(c.attendu) ? c.attendu : [c.attendu]).map(String)
  return { ...c, affiche: liste[0] ?? '', acceptes: new Set(liste.map(normaliser)) }
}))

const saisie = ref<string[]>([])
const fausses = ref<Set<number>>(new Set())
const vides = ref(0)
const justeIci = ref(false)

const trouvee = computed(() => question?.trouvee.value ?? justeIci.value)

function valeur(i: number): string {
  if (trouvee.value) return champs.value[i]!.affiche
  return saisie.value[i] ?? ''
}

function poser(i: number, v: string) {
  if (trouvee.value) return
  const suite = [...saisie.value]
  suite[i] = v
  saisie.value = suite
  // Corriger un champ efface sa marque : le rouge dit « ce champ-ci était
  // faux », pas « tu t'es trompé un jour ici ».
  if (fausses.value.has(i)) {
    const reste = new Set(fausses.value)
    reste.delete(i)
    fausses.value = reste
  }
}

function verifier() {
  if (trouvee.value) return
  const manquants = champs.value.filter((_, i) => !(saisie.value[i] ?? '').trim())
  vides.value = manquants.length
  if (manquants.length) return
  const erreurs = new Set<number>()
  champs.value.forEach((c, i) => {
    if (!c.acceptes.has(normaliser(saisie.value[i] ?? ''))) erreurs.add(i)
  })
  fausses.value = erreurs
  if (question) question.verifier(erreurs.size === 0)
  else justeIci.value = erreurs.size === 0
}

function effacer() {
  saisie.value = []
  fausses.value = new Set()
  vides.value = 0
}

function habillage(i: number) {
  if (trouvee.value) return 'text-success font-semibold'
  if (fausses.value.has(i)) return 'text-error font-semibold'
  return ''
}
</script>

<template>
  <div class="champs-reponse my-3">
    <div class="grid gap-x-3 gap-y-2 sm:grid-cols-[max-content_minmax(0,16rem)] sm:items-center">
      <template
        v-for="(champ, i) in champs"
        :key="i"
      >
        <label
          :for="`${prefixe}-${i}`"
          class="text-sm text-muted"
        >{{ champ.libelle }}</label>
        <UInput
          :id="`${prefixe}-${i}`"
          :model-value="valeur(i)"
          :placeholder="champ.aide"
          :disabled="trouvee"
          :color="fausses.has(i) ? 'error' : trouvee ? 'success' : 'primary'"
          :highlight="fausses.has(i) || trouvee"
          :ui="{ base: `font-mono ${habillage(i)}` }"
          autocomplete="off"
          spellcheck="false"
          class="w-full"
          @update:model-value="poser(i, String($event ?? ''))"
          @keydown.enter.prevent="verifier"
        />
      </template>
    </div>

    <div
      v-if="!trouvee"
      class="mt-3 flex flex-wrap items-center gap-2"
    >
      <UButton
        size="xs"
        icon="i-lucide-check-check"
        label="Vérifier"
        @click="verifier"
      />
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-eraser"
        label="Effacer"
        @click="effacer"
      />
      <span
        v-if="vides"
        class="text-sm text-muted"
      >
        Encore {{ vides }} champ{{ vides > 1 ? 's' : '' }} à remplir.
      </span>
      <span
        v-else-if="!question && fausses.size"
        class="text-sm text-error"
      >
        {{ fausses.size }} réponse{{ fausses.size > 1 ? 's' : '' }} fausse{{ fausses.size > 1 ? 's' : '' }}.
      </span>
    </div>
    <p
      v-else
      class="mt-2 mb-0 text-sm text-success"
    >
      Tout est juste.
    </p>
  </div>
</template>
