<script setup lang="ts">
/**
 * Un QCM à plusieurs bonnes réponses — « plusieurs réponses possibles », la
 * forme des QCM du contrôle de C. On coche tout ce qui est vrai, et rien d'autre.
 *
 * Le choix unique (`bonne="b"`) ne sait pas dire « t[1] et *(t + 1) » : forcer
 * une seule lettre obligerait à réécrire la question, ou à inventer une
 * proposition « a et c » qui souffle qu'il y en a deux. Chaque case se corrige
 * pour elle-même, comme une case de table de vérité.
 *
 * Posé dans une `exo-question` sans `bonne`, il rend son verdict à la question,
 * qui l'écrit en base comme n'importe quelle réponse ; seul, il se corrige pour
 * lui-même, sans mémoire. Même contrat que la table de vérité, hors du quiz.
 */
const props = defineProps<{
  /** Les propositions, dans l'ordre du sujet. Le code s'écrit entre accents graves. */
  propositions: string[]
  /** Les numéros des propositions justes, à partir de 1 comme dans le sujet. */
  bonnes: number[]
}>()

const prefixe = useId()
const question = useQuestionRemplie()
const connexion = useConnexion()
question?.inscrire('cases')

/*
 * Les propositions viennent du YAML, en texte : on n'y rend que le code entre
 * accents graves, après avoir échappé le reste — `char* c[4]` contient des
 * caractères qu'un `v-html` brut lirait comme des balises.
 */
function rendre(texte: string): string {
  const sur = String(texte).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return sur.replace(/`([^`]+)`/g, '<code>$1</code>')
}

const attendues = computed(() => new Set((props.bonnes ?? []).map(Number)))
const items = computed(() => (props.propositions ?? []).map((texte, i) => ({ numero: i + 1, html: rendre(texte) })))

const cochees = ref<Set<number>>(new Set())
const fausses = ref<Set<number>>(new Set())
const manquantes = ref(0)
const justeIci = ref(false)

const trouvee = computed(() => question?.trouvee.value ?? justeIci.value)

function estCochee(n: number): boolean {
  return trouvee.value ? attendues.value.has(n) : cochees.value.has(n)
}

function basculer(n: number) {
  if (trouvee.value) return
  const suite = new Set(cochees.value)
  if (suite.has(n)) suite.delete(n)
  else suite.add(n)
  cochees.value = suite
  if (fausses.value.has(n)) {
    const reste = new Set(fausses.value)
    reste.delete(n)
    fausses.value = reste
  }
}

function verifier() {
  if (trouvee.value) return
  if (!connexion.exiger(verifier)) return
  // Seules les cases cochées à tort passent au rouge : marquer aussi une bonne
  // réponse oubliée la désignerait, et la question serait résolue d'office.
  const erreurs = new Set<number>()
  let manque = 0
  for (const { numero } of items.value) {
    const cochee = cochees.value.has(numero)
    if (cochee && !attendues.value.has(numero)) erreurs.add(numero)
    if (!cochee && attendues.value.has(numero)) manque++
  }
  fausses.value = erreurs
  manquantes.value = manque
  const juste = erreurs.size === 0 && manque === 0
  if (question) question.verifier(juste)
  else justeIci.value = juste
}

function habillage(n: number): string {
  if (trouvee.value) return attendues.value.has(n) ? 'border-success bg-success/10' : 'border-default opacity-60'
  if (fausses.value.has(n)) return 'border-error bg-error/10'
  if (cochees.value.has(n)) return 'border-primary bg-primary/10'
  return 'border-default hover:bg-elevated'
}
</script>

<template>
  <div class="cases-a-cocher my-3">
    <p class="mb-2 text-sm text-muted">
      Plusieurs réponses possibles : coche toutes celles qui sont vraies.
    </p>
    <ul class="m-0 list-none space-y-2 p-0">
      <li
        v-for="item in items"
        :key="item.numero"
      >
        <label
          :for="`${prefixe}-${item.numero}`"
          class="flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors"
          :class="habillage(item.numero)"
        >
          <UCheckbox
            :id="`${prefixe}-${item.numero}`"
            :model-value="estCochee(item.numero)"
            :disabled="trouvee"
            @update:model-value="basculer(item.numero)"
          />
          <span class="font-mono text-xs text-muted">{{ item.numero }}.</span>
          <!-- eslint-disable-next-line vue/no-v-html -- texte échappé par rendre() -->
          <span v-html="item.html" />
        </label>
      </li>
    </ul>

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
      <span
        v-if="manquantes && !fausses.size"
        class="text-sm text-muted"
      >
        Tout ce qui est coché est juste, mais il manque au moins une bonne réponse.
      </span>
      <span
        v-else-if="manquantes"
        class="text-sm text-muted"
      >
        Et il manque au moins une bonne réponse.
      </span>
    </div>
    <p
      v-else
      class="mt-2 mb-0 text-sm text-success"
    >
      Toutes les bonnes réponses, et rien qu'elles.
    </p>
  </div>
</template>
