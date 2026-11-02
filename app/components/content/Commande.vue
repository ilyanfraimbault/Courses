<script setup lang="ts">
import { corrigerCommande, type ModeCommande } from '~~/shared/utils/commandes'

/**
 * Un terminal où l'on tape la commande — ce qu'on fera sur la copie du
 * contrôle de Docker, où rien n'est à cocher.
 *
 * Un choix entre quatre commandes apprend à reconnaître la bonne, pas à
 * l'écrire : l'œil retrouve `-dit` dans une liste bien plus facilement que la
 * main ne le retrouve devant une ligne vide. La correction tolère tout ce que
 * Docker tolère — l'ordre des options, `-it` contre `-i -t`, `docker ps` contre
 * `docker container ls` — et rien de plus. Voir `shared/utils/commandes.ts`.
 *
 * Posé dans une `exo-question` sans `bonne`, il rend son verdict à la question,
 * qui l'écrit en base comme n'importe quelle réponse ; seul, il se corrige pour
 * lui-même, sans mémoire.
 */
const props = withDefaults(defineProps<{
  /** Les réponses admises. La première est celle qu'on affiche une fois la question trouvée. */
  attendues: string[]
  /** `shell` pour des commandes, `dockerfile` pour des instructions, `yaml` pour un morceau de compose.yaml. */
  mode?: ModeCommande
  /** L'invite affichée devant la ligne : `$` sur l'hôte, `/ #` dans un conteneur Alpine. */
  invite?: string
  /** Ce que le terminal affiche une fois la commande juste — la récompense, et la suite de l'histoire. */
  sortie?: string
  /** Le nom du fichier édité, en mode `dockerfile` ou `yaml`. */
  fichier?: string
}>(), { mode: 'shell', invite: undefined, sortie: undefined, fichier: undefined })

const question = useQuestionRemplie()
const connexion = useConnexion()
question?.inscrire('commande')

const attendues = computed(() => (props.attendues ?? []).map(a => String(a).replace(/\n+$/, '')))

/**
 * Une ligne suffit à une commande ; plusieurs commandes, un Dockerfile ou un
 * morceau de YAML demandent une zone de texte. Le nombre de lignes de la
 * réponse la plus longue donne la hauteur — sans dire combien il en faut.
 */
const lignesAttendues = computed(() => Math.max(1, ...attendues.value.map(a => a.split('\n').length)))
const multiligne = computed(() => props.mode !== 'shell' || lignesAttendues.value > 1)
const hauteur = computed(() => Math.min(14, Math.max(3, lignesAttendues.value + 1)))
const invite = computed(() => props.invite ?? (props.mode === 'shell' ? '$' : null))
/** Ce que la correction laisse libre, pour qu'on ne perde pas de temps à le deviner. */
const tolerance = computed(() => ({
  shell: ' — l\'ordre des options ne compte pas.',
  dockerfile: ' — majuscules ou minuscules, comme tu veux.',
  yaml: ' — l\'ordre des clés et les guillemets ne comptent pas.'
})[props.mode])
const titre = computed(() => props.fichier ?? (props.mode === 'dockerfile' ? 'Dockerfile' : props.mode === 'yaml' ? 'compose.yaml' : 'Terminal'))

const saisie = ref('')
const remarques = ref<string[]>([])
const justeIci = ref(false)
const trouvee = computed(() => question?.trouvee.value ?? justeIci.value)

// Une question trouvée lors d'une visite précédente se rouvre remplie, avec la
// réponse telle que le cours l'écrit.
watch(trouvee, (t) => {
  if (t && !saisie.value) saisie.value = attendues.value[0] ?? ''
}, { immediate: true })

function verifier() {
  if (trouvee.value) return
  if (!connexion.exiger(verifier)) return
  const verdict = corrigerCommande(saisie.value, attendues.value, props.mode)
  // Une saisie vide n'est pas une faute : on n'a encore rien répondu.
  if (!verdict.juste && !saisie.value.trim()) {
    remarques.value = verdict.remarques
    return
  }
  remarques.value = verdict.remarques
  if (question) question.verifier(verdict.juste)
  else justeIci.value = verdict.juste
}

function clavier(e: KeyboardEvent) {
  const valider = multiligne.value ? (e.ctrlKey || e.metaKey) : true
  if (e.key === 'Enter' && valider) {
    e.preventDefault()
    verifier()
    return
  }
  // Dans un fichier, la tabulation fait un retrait au lieu de quitter le champ :
  // YAML refuse les tabulations, on insère donc deux espaces.
  if (e.key === 'Tab' && multiligne.value && props.mode !== 'shell' && !e.shiftKey) {
    e.preventDefault()
    const champ = e.target as HTMLTextAreaElement
    const debut = champ.selectionStart
    saisie.value = saisie.value.slice(0, debut) + '  ' + saisie.value.slice(champ.selectionEnd)
    nextTick(() => champ.setSelectionRange(debut + 2, debut + 2))
  }
}

// Corriger sa saisie efface les remarques : elles parlaient de l'essai précédent.
watch(saisie, () => {
  if (remarques.value.length) remarques.value = []
})
</script>

<template>
  <div class="commande my-3 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950 font-mono text-sm text-neutral-100 not-prose">
    <div class="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-400">
      <span class="flex gap-1.5">
        <span class="size-2.5 rounded-full bg-neutral-700" />
        <span class="size-2.5 rounded-full bg-neutral-700" />
        <span class="size-2.5 rounded-full bg-neutral-700" />
      </span>
      <span class="truncate">{{ titre }}</span>
    </div>

    <div class="px-3 py-2.5">
      <div class="flex items-start gap-2">
        <span
          v-if="invite && !multiligne"
          class="shrink-0 select-none leading-6 text-emerald-400"
        >{{ invite }}</span>
        <textarea
          v-if="multiligne"
          v-model="saisie"
          :rows="hauteur"
          :readonly="trouvee"
          class="block w-full resize-y bg-transparent leading-6 text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
          :placeholder="mode === 'shell' ? 'Une commande par ligne' : 'Écris ici'"
          aria-label="Ta réponse"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          autocorrect="off"
          @keydown="clavier"
        />
        <input
          v-else
          v-model="saisie"
          type="text"
          :readonly="trouvee"
          class="block w-full bg-transparent leading-6 text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
          placeholder="Tape la commande, puis Entrée"
          aria-label="La commande à taper"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          autocorrect="off"
          @keydown="clavier"
        >
      </div>

      <ul
        v-if="remarques.length && !trouvee"
        class="mt-2 mb-0 list-none space-y-0.5 p-0 text-amber-300"
      >
        <li
          v-for="(r, k) in remarques"
          :key="k"
          class="m-0 p-0"
        >
          ✗ {{ r }}
        </li>
      </ul>

      <pre
        v-if="trouvee && sortie"
        class="mt-2 mb-0 overflow-x-auto whitespace-pre bg-transparent p-0 text-neutral-400"
      >{{ sortie.replace(/\n+$/, '') }}</pre>
    </div>

    <div class="flex flex-wrap items-center gap-2 border-t border-neutral-800 px-3 py-1.5 font-sans">
      <template v-if="!trouvee">
        <UButton
          size="xs"
          icon="i-lucide-corner-down-left"
          :label="mode === 'shell' ? 'Exécuter' : 'Vérifier'"
          @click="verifier"
        />
        <span class="text-xs text-neutral-500">
          {{ multiligne ? 'Ctrl + Entrée pour vérifier' : 'Entrée pour vérifier' }}{{ tolerance }}
        </span>
      </template>
      <span
        v-else
        class="text-xs text-emerald-400"
      >
        ✓ {{ mode === 'shell' ? 'Commande juste.' : 'Juste.' }}
      </span>
    </div>
  </div>
</template>
