<script setup lang="ts">
/**
 * L'éditeur où l'on écrit son code sous une question, avant d'ouvrir la
 * solution. Rien ne le corrige : il garde ce qu'on a écrit, d'un appareil à
 * l'autre, pour qu'on le compare à la solution, affichée à côté, et qu'on se
 * note soi-même.
 *
 * Il ne vit pas dans `components/content/` : on ne l'écrit pas dans une fiche,
 * c'est l'attribut `code` d'une `exo-question` qui le fait apparaître.
 *
 * Les règles qui empêchent de perdre un texte :
 * - **seule une frappe déclenche une écriture.** Le monter, le remplir depuis
 *   le serveur ou le quitter sans avoir rien tapé n'envoie rien ;
 * - **le serveur ne remplit l'éditeur que tant qu'on n'y a rien tapé.** Se
 *   reconnecter relit la fiche : un texte tapé pendant que la session avait
 *   expiré doit survivre à cette relecture, puis partir ;
 * - **rien ne part avant que la fiche ait été lue** (`chargee`), comme pour la
 *   progression : écrire avant de savoir ce que la base contient pourrait
 *   remplacer un texte qu'on n'a pas encore vu.
 */
const props = defineProps<{
  /** Identité complète de la question, « chemin#bloc#label ». */
  identite: string | null
  /** Le langage, pour le titre de l'éditeur : « c » donne « C ». */
  langage?: string
}>()

const source = useDonneesFiche()
const connexion = useConnexion()
const route = useRoute()

const texte = ref('')
// Tapé depuis le dernier envoi réussi. C'est la seule chose qui autorise une
// écriture.
const sale = ref(false)
// Chaque frappe fait monter la version : un envoi parti avant une frappe ne
// rend pas l'éditeur propre en revenant.
let version = 0
const etat = ref<'repos' | 'modifie' | 'envoi' | 'enregistre' | 'connexion' | 'erreur'>('repos')

const titre = computed(() => {
  const l = props.langage?.toLowerCase()
  if (!l) return 'Ta réponse'
  return `Ta réponse — ${l === 'c' ? 'C' : l}`
})

// Le texte en base remplit l'éditeur tant qu'on n'y a rien tapé : à la
// première lecture, et à la relecture qui suit une reconnexion.
watch(() => source?.donnees.value?.ecrites?.[props.identite ?? ''], (enBase) => {
  if (sale.value || enBase === undefined) return
  texte.value = enBase
  etat.value = 'enregistre'
}, { immediate: true })

function corps() {
  return {
    chemin: cheminCanonique(route.path),
    question: props.identite,
    texte: texte.value
  }
}

async function envoyer() {
  if (!sale.value || !props.identite) return
  if (!source?.chargee.value) return
  const envoyee = version
  etat.value = 'envoi'
  try {
    await $fetch('/api/reponse-ecrite', { method: 'PUT', body: corps() })
    if (envoyee === version) {
      sale.value = false
      etat.value = 'enregistre'
    } else {
      etat.value = 'modifie'
    }
  } catch (erreur) {
    const statut = (erreur as { statusCode?: number })?.statusCode
    // Session expirée ou accès retiré : le texte reste dans l'éditeur, et part
    // dès qu'on s'est reconnecté.
    etat.value = statut === 401 || statut === 403 ? 'connexion' : 'erreur'
  }
}

const envoyerPlusTard = useDebounceFn(envoyer, 1200)

function saisir(valeur: string) {
  texte.value = valeur
  sale.value = true
  version++
  etat.value = 'modifie'
  envoyerPlusTard()
}

// La fiche lue après coup — au montage, ou après une reconnexion — libère ce
// qu'on avait tapé en attendant.
watch(() => source?.chargee.value, (lue) => {
  if (lue && sale.value) envoyer()
})
quandConnecte(() => {
  if (sale.value) envoyer()
})

const session = useUserSession()

// Le serveur a répondu 401 alors que la page se croit connectée : la session a
// expiré sous elle. On relit d'abord la session, sans quoi la fenêtre de
// connexion, qui se fie à ce que la page croit, ne s'ouvrirait pas. Une fois
// reconnecté, `quandConnecte` renvoie le texte.
async function seConnecter() {
  await session.fetch()
  if (connexion.exiger(envoyer, 'Connecte-toi pour enregistrer ce que tu as écrit.')) envoyer()
}

// Quitter la page coupe la temporisation : on envoie ce qui reste, en
// `keepalive` pour que l'envoi survive au démontage. Seulement si l'on a tapé
// quelque chose — quitter une page n'est pas une réponse.
function vider() {
  if (!sale.value || !props.identite || !source?.chargee.value) return
  try {
    fetch('/api/reponse-ecrite', {
      method: 'PUT',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corps())
    }).catch(() => {})
  } catch {
    // Un envoi manqué n'est pas une raison d'interrompre la navigation.
  }
}

if (import.meta.client) {
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') vider()
  })
  onBeforeUnmount(vider)
}

const lignes = computed(() => Math.min(30, Math.max(6, texte.value.split('\n').length + 1)))

// La tabulation fait un retrait au lieu de quitter le champ, comme dans un
// éditeur de code. Échap rend la main au clavier.
function clavier(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    (e.target as HTMLTextAreaElement).blur()
    return
  }
  if (e.key !== 'Tab' || e.shiftKey) return
  e.preventDefault()
  const el = e.target as HTMLTextAreaElement
  const debut = el.selectionStart
  saisir(texte.value.slice(0, debut) + '    ' + texte.value.slice(el.selectionEnd))
  nextTick(() => el.setSelectionRange(debut + 4, debut + 4))
}

const message = computed(() => {
  switch (etat.value) {
    case 'modifie': return 'Modifié'
    case 'envoi': return 'Enregistrement…'
    case 'enregistre': return 'Enregistré'
    case 'erreur': return 'Pas enregistré — réessaie plus tard'
    default: return source?.chargee.value ? '' : 'Pas encore enregistré'
  }
})
</script>

<template>
  <div class="saisie-code my-3 overflow-hidden rounded-lg border border-default bg-elevated/40 not-prose">
    <div class="flex items-center gap-2 border-b border-default px-3 py-1.5 text-xs text-muted">
      <UIcon
        name="i-lucide-square-code"
        class="size-4 shrink-0"
      />
      <span class="truncate">{{ titre }}</span>
      <span
        v-if="etat === 'connexion'"
        class="ml-auto flex items-center gap-2"
      >
        <span class="text-warning">Session expirée</span>
        <UButton
          size="xs"
          variant="soft"
          color="warning"
          label="Se connecter"
          @click="seConnecter"
        />
      </span>
      <span
        v-else
        class="ml-auto shrink-0"
        :class="etat === 'erreur' ? 'text-error' : ''"
        aria-live="polite"
      >{{ message }}</span>
    </div>
    <textarea
      :value="texte"
      :rows="lignes"
      class="block w-full resize-y bg-transparent px-3 py-2.5 font-mono text-sm leading-6 text-highlighted placeholder:text-dimmed focus:outline-none"
      placeholder="Écris ton code ici, puis compare-le à la solution."
      aria-label="Ta réponse"
      spellcheck="false"
      autocapitalize="off"
      autocomplete="off"
      autocorrect="off"
      @input="saisir(($event.target as HTMLTextAreaElement).value)"
      @keydown="clavier"
      @blur="envoyer"
    />
  </div>
</template>
