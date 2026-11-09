<script setup lang="ts">
/**
 * La mémoire d'un programme, à remplir case par case — le tableau « Valeurs /
 * Adresses » que le cours de C dessine à chaque exemple.
 *
 * Choisir entre quatre états de la mémoire recopiés en ligne ne se relit pas,
 * et dispense de dérouler le programme, qui était l'exercice : on écrit ce que
 * contient chaque case une fois la dernière ligne exécutée, comme au tableau.
 *
 * Posé dans une `exo-question` sans `bonne`, il rend son verdict à la question,
 * qui l'écrit en base comme n'importe quelle réponse ; seul, il se corrige pour
 * lui-même, sans mémoire. Même contrat que la table de vérité.
 */
interface CaseMemoire {
  /** Le nom de ce qui occupe la case : `i`, `tab[2]`, `iptr`. */
  variable?: string
  /** La première adresse : `0xff150`, ou `Octet 1`. */
  adresse: string
  /** Le nombre d'octets occupés : les adresses suivantes s'en déduisent. */
  octets?: number
  /** La valeur attendue, ou la liste des écritures acceptées. */
  attendu: string | number | (string | number)[]
  /** Case fournie, déjà remplie : pour ne faire écrire que ce qui compte. */
  donnee?: boolean
}

const props = defineProps<{
  cases: CaseMemoire[]
  /** Ce que représente l'instantané : « Après la ligne 4 ». */
  titre?: string
}>()

const prefixe = useId()
const question = useQuestionRemplie()
const connexion = useConnexion()
question?.inscrire('memoire')

/*
 * Les adresses suivantes se calculent au lieu de s'écrire : quatre lignes
 * recopiées à la main pour un pointeur, c'est une faute de frappe qui attend.
 * `0xff150` sur deux octets donne `0xff150`, `0xff151` ; `Octet 3` sur deux
 * octets donne `Octet 3`, `Octet 4`.
 */
function adresses(depart: string, n: number): string[] {
  const hexa = depart.match(/^0x([0-9a-f]+)$/i)
  if (hexa) {
    const base = Number.parseInt(hexa[1]!, 16)
    return Array.from({ length: n }, (_, k) => `0x${(base + k).toString(16)}`)
  }
  const numero = depart.match(/^(.*?)(\d+)$/)
  if (numero) return Array.from({ length: n }, (_, k) => `${numero[1]}${Number(numero[2]) + k}`)
  return [depart]
}

/*
 * Deux écritures d'une même valeur ne valent pas une faute : la casse et les
 * espaces ne comptent pas (`0xFF150` est `0xff150`). Le reste — un caractère
 * écrit `'o'` ou `111` — s'énumère dans `attendu`.
 */
function normaliser(texte: string): string {
  return String(texte).toLowerCase().replace(/\s+/g, '')
}

const cases = computed(() => (props.cases ?? []).map((c) => {
  const liste = (Array.isArray(c.attendu) ? c.attendu : [c.attendu]).map(String)
  return {
    ...c,
    lignes: adresses(String(c.adresse), Math.max(1, c.octets ?? 1)),
    affiche: liste[0] ?? '',
    acceptes: new Set(liste.map(normaliser))
  }
}))

const aVariables = computed(() => cases.value.some(c => c.variable))

const saisie = ref<string[]>([])
const fausses = ref<Set<number>>(new Set())
const vides = ref(0)
const justeIci = ref(false)

const trouvee = computed(() => question?.trouvee.value ?? justeIci.value)

function valeur(i: number): string {
  const c = cases.value[i]!
  if (c.donnee || trouvee.value) return c.affiche
  return saisie.value[i] ?? ''
}

function poser(i: number, v: string) {
  if (trouvee.value) return
  const suite = [...saisie.value]
  suite[i] = v
  saisie.value = suite
  if (fausses.value.has(i)) {
    const reste = new Set(fausses.value)
    reste.delete(i)
    fausses.value = reste
  }
}

function verifier() {
  if (trouvee.value) return
  if (!connexion.exiger(verifier)) return
  const aRemplir = cases.value.map((c, i) => ({ c, i })).filter(({ c }) => !c.donnee)
  vides.value = aRemplir.filter(({ i }) => !(saisie.value[i] ?? '').trim()).length
  if (vides.value) return
  const erreurs = new Set<number>()
  for (const { c, i } of aRemplir) {
    if (!c.acceptes.has(normaliser(saisie.value[i] ?? ''))) erreurs.add(i)
  }
  fausses.value = erreurs
  if (question) question.verifier(erreurs.size === 0)
  else justeIci.value = erreurs.size === 0
}

function effacer() {
  saisie.value = []
  fausses.value = new Set()
  vides.value = 0
}
</script>

<template>
  <div class="tableau-memoire my-3">
    <p
      v-if="titre"
      class="mb-1 text-sm font-medium text-muted"
    >
      {{ titre }}
    </p>
    <table class="w-auto border-collapse text-sm">
      <thead>
        <tr class="bg-elevated">
          <th
            v-if="aVariables"
            class="border border-default px-3 py-1 text-left font-semibold"
          >
            Variable
          </th>
          <th class="border border-default px-3 py-1 text-left font-semibold">
            Valeur
          </th>
          <th class="border border-default px-3 py-1 text-left font-semibold">
            Adresse
          </th>
        </tr>
      </thead>
      <tbody>
        <template
          v-for="(c, i) in cases"
          :key="i"
        >
          <tr
            v-for="(adresse, k) in c.lignes"
            :key="adresse"
          >
            <td
              v-if="aVariables && k === 0"
              :rowspan="c.lignes.length"
              class="border border-default px-3 py-1 font-mono text-muted"
            >
              {{ c.variable }}
            </td>
            <td
              v-if="k === 0"
              :rowspan="c.lignes.length"
              class="border border-default px-2 py-1 align-middle"
            >
              <span
                v-if="c.donnee"
                class="block px-1 font-mono"
              >{{ c.affiche }}</span>
              <UInput
                v-else
                :id="`${prefixe}-${i}`"
                :aria-label="`Valeur à l'adresse ${c.lignes[0]}${c.variable ? ` (${c.variable})` : ''}`"
                :model-value="valeur(i)"
                :disabled="trouvee"
                :color="fausses.has(i) ? 'error' : trouvee ? 'success' : 'primary'"
                :highlight="fausses.has(i) || trouvee"
                :ui="{ base: `font-mono ${trouvee ? 'text-success font-semibold' : fausses.has(i) ? 'text-error font-semibold' : ''}` }"
                size="sm"
                autocomplete="off"
                spellcheck="false"
                class="w-20 sm:w-28"
                @update:model-value="poser(i, String($event ?? ''))"
                @keydown.enter.prevent="verifier"
              />
            </td>
            <td class="border border-default px-3 py-0.5 font-mono text-xs text-muted">
              {{ adresse }}
            </td>
          </tr>
        </template>
      </tbody>
    </table>

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
        Encore {{ vides }} case{{ vides > 1 ? 's' : '' }} à remplir.
      </span>
      <span
        v-else-if="!question && fausses.size"
        class="text-sm text-error"
      >
        {{ fausses.size }} case{{ fausses.size > 1 ? 's' : '' }} fausse{{ fausses.size > 1 ? 's' : '' }}.
      </span>
    </div>
    <p
      v-else
      class="mt-2 mb-0 text-sm text-success"
    >
      Toute la mémoire est juste.
    </p>
  </div>
</template>
