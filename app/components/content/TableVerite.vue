<script setup lang="ts">
import katex from 'katex'

/**
 * Une table de vérité à remplir, case par case — ce qu'on fait sur une copie.
 *
 * Elle remplace le choix entre quatre colonnes recopiées en ligne (« V, V, V,
 * F… ») : huit lettres alignées ne se relisent pas, et choisir parmi quatre
 * colonnes toutes faites dispense de construire la table, qui était l'exercice.
 *
 * Posée dans une `exo-question` sans `bonne`, elle rend son verdict à la
 * question, qui l'écrit en base comme n'importe quelle réponse ; seule, elle se
 * corrige pour elle-même, sans mémoire.
 */
interface ColonneTable {
  /** En-tête, en LaTeX : `p \lor q`. */
  formule: string
  /** Les valeurs attendues, de haut en bas : « VVFF » ou une liste de V et de F. */
  valeurs: string | string[]
  /** Colonne fournie, déjà remplie : pour ne faire remplir que ce qui compte. */
  donnee?: boolean
}

const props = defineProps<{
  /** Les propositions simples, en LaTeX, dans l'ordre des colonnes de gauche. */
  variables: string[]
  colonnes: ColonneTable[]
}>()

type Valeur = 'V' | 'F'

const question = useQuestionRemplie()
question?.inscrire()

const variables = computed(() => props.variables ?? [])
const nbLignes = computed(() => 2 ** variables.value.length)

/*
 * L'ordre des lignes est celui des cours et des sujets : tout à V d'abord, la
 * dernière variable alternant le plus vite. Il n'est pas écrit dans le contenu
 * parce qu'il n'y a qu'une façon de l'écrire juste.
 */
const lignes = computed(() => Array.from({ length: nbLignes.value }, (_, i) =>
  variables.value.map((_, k) => ((i >> (variables.value.length - 1 - k)) & 1) === 0 ? 'V' : 'F') as Valeur[]
))

function attendues(colonne: ColonneTable): Valeur[] {
  const brut = Array.isArray(colonne.valeurs) ? colonne.valeurs : [...String(colonne.valeurs).replace(/[^VF]/gi, '')]
  return brut.map(v => String(v).toUpperCase() === 'V' ? 'V' : 'F')
}

const colonnes = computed(() => (props.colonnes ?? []).map(c => ({
  ...c,
  attendues: attendues(c),
  entete: katex.renderToString(c.formule, { throwOnError: false })
})))

const entetesVariables = computed(() => variables.value.map(v => katex.renderToString(v, { throwOnError: false })))

/** Une colonne mal comptée se voit ici plutôt que comme une table qu'on ne peut pas réussir. */
const malFormee = computed(() => colonnes.value.find(c => c.attendues.length !== nbLignes.value)?.formule ?? null)

const cle = (i: number, j: number) => `${i}:${j}`
const saisie = ref<Record<string, Valeur | undefined>>({})
const fausses = ref<Set<string>>(new Set())
const vides = ref(0)
const justeIci = ref(false)

const trouvee = computed(() => question?.trouvee.value ?? justeIci.value)

function valeur(i: number, j: number): Valeur | undefined {
  const col = colonnes.value[j]!
  if (col.donnee || trouvee.value) return col.attendues[i]
  return saisie.value[cle(i, j)]
}

function poser(i: number, j: number, v: Valeur | undefined) {
  if (trouvee.value) return
  saisie.value = { ...saisie.value, [cle(i, j)]: v }
  // Corriger une case efface sa marque : le rouge dit « cette case-ci était
  // fausse », pas « tu t'es trompé un jour ici ».
  if (fausses.value.has(cle(i, j))) {
    const reste = new Set(fausses.value)
    reste.delete(cle(i, j))
    fausses.value = reste
  }
}

/** Un clic fait tourner la case : vide, V, F, vide. */
function basculer(i: number, j: number) {
  const actuelle = saisie.value[cle(i, j)]
  poser(i, j, actuelle === undefined ? 'V' : actuelle === 'V' ? 'F' : undefined)
}

function clavier(e: KeyboardEvent, i: number, j: number) {
  const touche = e.key.toLowerCase()
  if (touche === 'v' || touche === '1') poser(i, j, 'V')
  else if (touche === 'f' || touche === '0') poser(i, j, 'F')
  else if (touche === 'backspace' || touche === 'delete') poser(i, j, undefined)
  else return
  e.preventDefault()
}

const aRemplir = computed(() => colonnes.value.flatMap((c, j) => c.donnee ? [] : c.attendues.map((_, i) => cle(i, j))))

function verifier() {
  if (trouvee.value) return
  const manquantes = aRemplir.value.filter(k => !saisie.value[k])
  vides.value = manquantes.length
  if (manquantes.length) return
  const erreurs = new Set<string>()
  colonnes.value.forEach((c, j) => {
    if (c.donnee) return
    c.attendues.forEach((v, i) => {
      if (saisie.value[cle(i, j)] !== v) erreurs.add(cle(i, j))
    })
  })
  fausses.value = erreurs
  if (question) question.verifier(erreurs.size === 0)
  else justeIci.value = erreurs.size === 0
}

function effacer() {
  saisie.value = {}
  fausses.value = new Set()
  vides.value = 0
}

function habillage(i: number, j: number) {
  const col = colonnes.value[j]!
  if (col.donnee) return 'text-muted'
  if (trouvee.value) return 'bg-success/10 text-success font-semibold'
  if (fausses.value.has(cle(i, j))) return 'bg-error/15 text-error font-semibold ring-1 ring-error ring-inset'
  return saisie.value[cle(i, j)] ? 'text-highlighted font-semibold' : 'text-dimmed'
}
</script>

<template>
  <div class="table-verite my-3">
    <p
      v-if="malFormee"
      class="text-sm text-error"
    >
      Table mal écrite : la colonne « {{ malFormee }} » n'a pas {{ nbLignes }} valeurs.
    </p>
    <div class="overflow-x-auto">
      <table class="!my-0 border-collapse text-center">
        <thead>
          <tr>
            <!-- Du HTML fabriqué par KaTeX à partir du contenu du dépôt, qui
                 échappe ce qu'il compose : rien de saisi par un visiteur. -->
            <!-- eslint-disable vue/no-v-html -->
            <th
              v-for="(entete, k) in entetesVariables"
              :key="`v${k}`"
              class="border border-default bg-elevated/60 px-3 py-1.5"
              v-html="entete"
            />
            <th
              v-for="(col, j) in colonnes"
              :key="`c${j}`"
              class="border border-default px-3 py-1.5"
              :class="j === colonnes.length - 1 ? 'bg-primary/10' : 'bg-elevated/30'"
              v-html="col.entete"
            />
            <!-- eslint-enable vue/no-v-html -->
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(ligne, i) in lignes"
            :key="i"
          >
            <td
              v-for="(v, k) in ligne"
              :key="`v${k}`"
              class="border border-default bg-elevated/60 px-3 py-1 font-medium"
            >
              {{ v }}
            </td>
            <td
              v-for="(col, j) in colonnes"
              :key="`c${j}`"
              class="border border-default p-0"
            >
              <span
                v-if="col.donnee"
                class="block px-3 py-1"
                :class="habillage(i, j)"
              >{{ valeur(i, j) }}</span>
              <button
                v-else
                type="button"
                class="block h-full min-h-8 w-full min-w-12 px-3 py-1 transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary disabled:hover:bg-transparent"
                :class="habillage(i, j)"
                :disabled="trouvee"
                :aria-label="`Ligne ${i + 1}, colonne ${col.formule} : ${valeur(i, j) ?? 'vide'}`"
                @click="basculer(i, j)"
                @keydown="clavier($event, i, j)"
              >
                {{ valeur(i, j) ?? '·' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="!trouvee"
      class="mt-2 flex flex-wrap items-center gap-2"
    >
      <UButton
        size="xs"
        icon="i-lucide-check-check"
        label="Vérifier ma table"
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
      Table juste.
    </p>
    <p
      v-if="!trouvee"
      class="mt-1 mb-0 text-xs text-dimmed"
    >
      Clique sur une case pour la faire passer de vide à V, puis à F — ou tape V ou F au clavier.
    </p>
  </div>
</template>
