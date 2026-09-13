<script setup lang="ts">
/**
 * L'habillage d'une question, le même partout : exercice, question posée au fil
 * d'un cours, QCM de contenu, QCM composé.
 *
 * Chacun a longtemps eu le sien. La solution s'ouvrait en fenêtre dans un
 * exercice et se dépliait dans un cours ; le bouton « Cours » manquait aux
 * questions du cours ; le QCM dessinait ses propositions à la main et cachait
 * indice et solution dans deux fenêtres. La même question, rencontrée sur deux
 * pages, ne se lisait pas de la même façon.
 *
 * Ce composant ne sait rien du barème : ni quand une réponse est juste, ni quand
 * l'aide a le droit d'apparaître. Il reçoit un état et le dessine. Chaque
 * contexte garde sa règle — correction immédiate sur une fiche, copie rendue
 * dans un QCM — et tous partagent la même lecture : l'énoncé, les propositions,
 * puis **Indice**, **Solution** et **Cours**, dans cet ordre, qui se déplient
 * sous la question sans quitter la page.
 *
 * Il vit hors de `components/content/` : ce n'est pas une balise de contenu.
 *
 * Sa racine porte **la** classe que le contrôle de rendu compte contre le
 * relevé du build (docs/contenu.md) : une par question rendue, jamais deux. Ne
 * pas en écrire le nom dans un commentaire du gabarit — le serveur de
 * développement garde ces commentaires dans le HTML, et le compte doublait.
 */
// `withDefaults` et non une comparaison à `false` dans le gabarit : Vue convertit
// une prop booléenne **absente** en `false`, pas en `undefined`. Écrit
// `aide !== false`, le défaut cachait l'aide de toutes les questions qui ne
// passaient pas la prop — c'est-à-dire de toutes les fiches.
withDefaults(defineProps<{
  /** Repère affiché devant l'énoncé : « 12. », « a) ». */
  label?: string
  /** Identifiant DOM, pour qu'un récapitulatif puisse y conduire. */
  ancre?: string
  /** Le liseré et la marque : juste, faux, ou rien tant qu'il n'y a pas de verdict. */
  verdict?: 'juste' | 'faux' | null
  /**
   * La rangée d'aide et ses panneaux. Un QCM la retient jusqu'à la copie
   * rendue : une solution qu'on peut déplier avant de répondre ferait de la
   * note un décompte de clics.
   */
  aide?: boolean
  indice?: boolean
  /** Un exemple similaire entièrement traité, replié dans le panneau d'indice. */
  exemple?: boolean
  solution?: boolean
  cours?: boolean
}>(), { aide: true })

const indiceOuvert = defineModel<boolean>('indiceOuvert', { default: false })
const solutionOuverte = defineModel<boolean>('solutionOuverte', { default: false })

const emit = defineEmits<{ cours: [] }>()

const uid = useId()

// L'exemple similaire se déroule en second, et seulement si la piste n'a pas
// suffi : refermer l'indice le replie.
const exempleDeplie = ref(false)
watch(indiceOuvert, (ouvert) => {
  if (!ouvert) exempleDeplie.value = false
})
</script>

<template>
  <div
    :id="ancre ?? uid"
    class="cours-question scroll-mt-24 border-l-2 transition-colors pl-4 sm:pl-5 py-1 my-7"
    :class="verdict === 'juste'
      ? 'border-success'
      : verdict === 'faux' ? 'border-error' : 'border-default hover:border-primary/60'"
  >
    <slot name="entete" />

    <div class="flex gap-3 items-baseline">
      <span
        v-if="label"
        class="shrink-0 font-semibold text-highlighted tabular-nums"
      >{{ label }}</span>
      <div class="min-w-0 flex-1 cours-enonce">
        <slot />
      </div>
      <UIcon
        v-if="verdict"
        :name="verdict === 'juste' ? 'i-lucide-check' : 'i-lucide-x'"
        class="size-5 shrink-0"
        :class="verdict === 'juste' ? 'text-success' : 'text-error'"
      />
    </div>

    <slot name="choix" />

    <slot name="message" />

    <template v-if="aide">
      <div
        v-if="indice || solution || cours"
        class="flex flex-wrap gap-2 mt-3"
      >
        <UButton
          v-if="indice"
          size="xs"
          color="warning"
          variant="soft"
          :icon="indiceOuvert ? 'i-lucide-lightbulb-off' : 'i-lucide-lightbulb'"
          :label="indiceOuvert ? 'Masquer l\'indice' : 'Indice'"
          :aria-expanded="indiceOuvert"
          :aria-controls="`${uid}-indice`"
          @click="indiceOuvert = !indiceOuvert"
        />
        <UButton
          v-if="solution"
          size="xs"
          color="primary"
          variant="soft"
          :icon="solutionOuverte ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          :label="solutionOuverte ? 'Masquer la solution' : 'Solution'"
          :aria-expanded="solutionOuverte"
          :aria-controls="`${uid}-solution`"
          @click="solutionOuverte = !solutionOuverte"
        />
        <UButton
          v-if="cours"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-book-open-text"
          label="Cours"
          @click="emit('cours')"
        />
      </div>

      <slot name="apres" />

      <!-- Indice et solution se déplient sur place plutôt qu'en fenêtre : une
           modale à chaque mauvaise réponse casserait le geste « je relis et je
           retente aussitôt », et une solution se lit mieux sous son énoncé. -->
      <Transition name="cours-reveal">
        <div
          v-if="indice"
          v-show="indiceOuvert"
          :id="`${uid}-indice`"
          class="cours-panel cours-panel-indice"
        >
          <p class="cours-panel-title">
            <UIcon
              name="i-lucide-lightbulb"
              class="size-4 shrink-0"
            />
            <span>Indice</span>
          </p>
          <div class="cours-panel-body">
            <slot name="indice" />
          </div>

          <div
            v-if="exemple"
            class="mt-4 rounded-lg border border-default bg-default"
          >
            <button
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-left"
              :aria-expanded="exempleDeplie"
              :aria-controls="`${uid}-exemple`"
              @click="exempleDeplie = !exempleDeplie"
            >
              <UIcon
                name="i-lucide-square-function"
                class="size-4 shrink-0 text-primary"
              />
              <span class="min-w-0 flex-1 text-sm font-medium text-highlighted">
                Exemple similaire, entièrement traité
              </span>
              <UIcon
                name="i-lucide-chevron-down"
                class="size-4 shrink-0 text-dimmed transition-transform"
                :class="exempleDeplie && 'rotate-180'"
              />
            </button>

            <div
              v-show="exempleDeplie"
              :id="`${uid}-exemple`"
              class="cours-panel-body border-t border-default px-3 py-3"
            >
              <slot name="exemple" />
            </div>
          </div>
        </div>
      </Transition>

      <Transition name="cours-reveal">
        <div
          v-if="solution"
          v-show="solutionOuverte"
          :id="`${uid}-solution`"
          class="cours-panel cours-panel-solution"
        >
          <p class="cours-panel-title">
            <UIcon
              name="i-lucide-circle-check"
              class="size-4 shrink-0"
            />
            <span>Solution détaillée</span>
          </p>
          <div class="cours-panel-body">
            <slot name="solution" />
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>
