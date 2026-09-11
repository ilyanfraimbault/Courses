<script setup lang="ts">
/**
 * La liste de propositions d'une question à choix unique, partagée par le QCM
 * (verdict rendu d'un bloc, à la fin) et par les fiches d'exercice (verdict
 * immédiat, avec droit de retenter). Les deux ne diffèrent que par ce qu'elles
 * consentent à montrer : d'où des propriétés qui décrivent l'état affiché plutôt
 * qu'un mode, que ce composant n'aurait pas à connaître.
 *
 * Il vit hors de `components/content/`, dont tout le contenu devient une balise
 * utilisable en markdown : ce n'en est pas une.
 */
const props = defineProps<{
  /** Lettres effectivement proposées, dans l'ordre d'affichage. */
  lettres: readonly string[]
  /** Lettre attendue. Elle n'est mise en évidence que si `revele` est vrai. */
  bonne: string
  /** Lettre actuellement cochée. */
  choisi?: string | null
  /** Lettres déjà essayées et fausses : elles restent barrées de rouge. */
  errones?: readonly string[]
  /** Découvre la bonne réponse. Faux tant qu'on cherche encore. */
  revele?: boolean
  /** Ferme les propositions au clic. */
  fige?: boolean
  /** Libellé du groupe, pour les lecteurs d'écran. */
  intitule?: string
  /**
   * Repère à afficher à la place de la lettre. Le quiz brasse l'ordre des
   * propositions : les lettres de la fiche y arrivent dans le désordre, et les
   * montrer telles quelles écrirait « c, a, d, b » dans la marge.
   */
  etiquettes?: Record<string, string>
}>()

const emit = defineEmits<{ choisir: [lettre: string] }>()

type Etat = 'juste' | 'faux' | 'coche' | 'eteint' | 'neutre'

function etat(lettre: string): Etat {
  if (props.revele && lettre === props.bonne) return 'juste'
  if (props.errones?.includes(lettre)) return 'faux'
  if (lettre === props.choisi && !props.fige) return 'coche'
  if (props.revele || props.fige) return 'eteint'
  return 'neutre'
}

/*
 * Les propositions s'alignent au **centre** et non en tête : le contenu d'une
 * proposition est une formule, dont la boîte est plus haute qu'une ligne de
 * texte, et la lettre qui la repère flottait alors au-dessus d'elle. La ligne de
 * base, qui serait le bon réflexe, a été écartée quand la proposition défilait
 * encore (`overflow-x`) : une boîte de défilement n'en expose pas à son parent
 * flex. Elle ne défile plus, la ligne de base redevient possible — pas mesurée.
 */
const BASE = 'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors'

const HABILLAGE: Record<Etat, { classe: string, icone: string, teinte: string }> = {
  juste: { classe: 'border-success bg-success/10', icone: 'i-lucide-circle-check', teinte: 'text-success' },
  faux: { classe: 'border-error bg-error/10', icone: 'i-lucide-circle-x', teinte: 'text-error' },
  coche: { classe: 'border-primary bg-primary/10', icone: 'i-lucide-circle-dot', teinte: 'text-primary' },
  eteint: { classe: 'border-default opacity-60', icone: 'i-lucide-circle', teinte: 'text-dimmed' },
  neutre: { classe: 'border-default hover:border-primary/60 hover:bg-elevated/50', icone: 'i-lucide-circle', teinte: 'text-dimmed' }
}

function habillage(lettre: string) {
  return HABILLAGE[etat(lettre)]
}
</script>

<template>
  <div
    class="mt-3 flex flex-col gap-2"
    role="radiogroup"
    :aria-label="intitule || 'Propositions'"
  >
    <button
      v-for="lettre in lettres"
      :key="lettre"
      type="button"
      role="radio"
      :aria-checked="choisi === lettre"
      :disabled="fige"
      :class="[BASE, habillage(lettre).classe]"
      @click="emit('choisir', lettre)"
    >
      <UIcon
        :name="habillage(lettre).icone"
        class="size-4 shrink-0"
        :class="habillage(lettre).teinte"
      />
      <span class="shrink-0 font-medium text-muted uppercase">{{ etiquettes?.[lettre] ?? lettre }}</span>
      <span class="min-w-0 flex-1 cours-qcm-choix">
        <slot :lettre="lettre" />
      </span>
    </button>
  </div>
</template>
