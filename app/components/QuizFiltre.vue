<script setup lang="ts">
import type { FiltreQuiz, MatiereCatalogue } from '~~/shared/types/quiz'

/**
 * Le choix de ce sur quoi on se fait interroger.
 *
 * Il a d'abord été une liste de pastilles portant l'intitulé du rappel de cours
 * visé, avec un nombre à côté. Deux défauts, l'un et l'autre suffisants pour
 * rendre l'écran illisible :
 *
 * - **le même intitulé apparaissait deux fois.** Deux rappels écrits dans deux
 *   fiches différentes portent souvent le même titre — six fois dans les
 *   chapitres « fonctions dérivées » et « complexes » — sans rien qui les
 *   distingue à l'œil ;
 * - **les comptes ne s'additionnaient pas.** Les questions qui ne visent aucun
 *   rappel n'apparaissaient dans aucune pastille : trigonométrie annonçait 77
 *   questions pour 29 atteignables.
 *
 * Le second niveau est donc devenu le **plan du chapitre**, et le nombre est
 * écrit avec son unité. Un chiffre nu à côté d'un titre ne se devine pas.
 */
const props = defineProps<{
  /**
   * La matière dans laquelle on choisit. Le filtre ne sort jamais d'une
   * matière : c'est la page qui la fixe, et « rien de coché » veut dire elle
   * toute entière.
   */
  catalogue: MatiereCatalogue
  modelValue: FiltreQuiz
  /**
   * « programme » quand on ne choisit pas une séance mais ce sur quoi porte un
   * contrôle : la dette n'y a pas de sens — un programme ne change pas selon ce
   * qu'on a raté — et le compte ne parle plus de séance.
   *
   * « jour » pour restreindre la séance du jour de l'accueil : elle prend déjà
   * la dette et les révisions, si bien que la case « seulement ce que j'ai
   * raté » n'a plus d'objet, et qu'une case vaut ce qu'elle a à reprendre ou à
   * revoir aujourd'hui, pas son stock.
   */
  mode?: 'seance' | 'programme' | 'jour'
}>()

const emit = defineEmits<{ 'update:modelValue': [filtre: FiltreQuiz] }>()

const deplies = ref<string[]>([])

/**
 * Un chapitre dont une notion est cochée s'ouvre tout seul.
 *
 * C'est ce qui rend lisible un filtre qu'on n'a pas composé soi-même — un lien
 * venu de « Mes domaines » arrive avec un point de cours déjà coché. Replié, le
 * chapitre annoncerait « 4 questions dans la sélection » sans que rien à l'écran
 * ne dise lesquelles.
 */
watch(() => props.modelValue.notions, (notions) => {
  for (const notion of notions ?? []) {
    const chapitre = notion.split('#')[0]
    if (chapitre && !deplies.value.includes(chapitre)) deplies.value.push(chapitre)
  }
}, { immediate: true })

function estDeplie(cle: string) {
  return deplies.value.includes(cle)
}

function deplier(cle: string) {
  deplies.value = estDeplie(cle) ? deplies.value.filter(c => c !== cle) : [...deplies.value, cle]
}

function modifier(champs: Partial<FiltreQuiz>) {
  emit('update:modelValue', { ...props.modelValue, ...champs })
}

function basculerTheme(cle: string) {
  const themes = props.modelValue.themes.includes(cle)
    ? props.modelValue.themes.filter(t => t !== cle)
    : [...props.modelValue.themes, cle]
  // Cocher un chapitre rend inutiles les sections qu'on y avait choisies : elles
  // sont déjà dedans, et les laisser ferait un filtre qui se contredit à l'œil.
  const clesDuTheme = new Set(sectionsDe(cle).map(s => s.cle))
  const sections = themes.includes(cle)
    ? props.modelValue.sections.filter(s => !clesDuTheme.has(s))
    : props.modelValue.sections
  modifier({ themes, sections })
}

function basculerSection(cle: string) {
  modifier({
    sections: props.modelValue.sections.includes(cle)
      ? props.modelValue.sections.filter(s => s !== cle)
      : [...props.modelValue.sections, cle]
  })
}

function basculerErreurs() {
  modifier({ erreurs: !props.modelValue.erreurs })
}

function tout() {
  // La séance du jour garde sa dette : la case « seulement ce que j'ai raté »
  // n'y existe pas, il n'y a donc rien à décocher.
  const erreurs = props.mode === 'jour' ? props.modelValue.erreurs : false
  emit('update:modelValue', { ...props.modelValue, themes: [], sections: [], notions: [], erreurs })
}

function oublierPoints() {
  modifier({ notions: [] })
}

/** Les points de cours reçus par lien, retrouvés dans le catalogue pour être nommés. */
const points = computed(() => {
  const cles = props.modelValue.notions ?? []
  if (!cles.length) return []
  return props.catalogue.themes
    .flatMap(t => t.sections.flatMap(sec => sec.notions.map(n => ({ ...n, section: sec.titre }))))
    .filter(n => cles.includes(n.cle))
})

function sectionsDe(cle: string) {
  return props.catalogue.themes.find(t => t.cle === cle)?.sections ?? []
}

const rienDeCoche = computed(() =>
  !props.modelValue.themes.length && !props.modelValue.sections.length && !props.modelValue.notions?.length)
const vierge = computed(() => rienDeCoche.value && (props.mode === 'jour' || !props.modelValue.erreurs))

/**
 * Ce que vaut une case : son stock, sa seule dette en mode « ce que j'ai
 * raté », ou ce qu'elle attend aujourd'hui pour la séance du jour.
 */
function compte(entree: { questions: number, ratees: number, aRevoir: number }) {
  if (props.mode === 'jour') return entree.ratees + entree.aRevoir
  return props.modelValue.erreurs ? entree.ratees : entree.questions
}

/** Le compte d'une case, en toutes lettres, pour la séance du jour. */
function duJour(entree: { ratees: number, aRevoir: number }) {
  const morceaux: string[] = []
  if (entree.ratees) morceaux.push(`${entree.ratees} à reprendre`)
  if (entree.aRevoir) morceaux.push(`${entree.aRevoir} à revoir`)
  return morceaux.join(' · ') || 'rien aujourd\'hui'
}

/** Quelque chose est clos dans la matière : « rien de coché » ne veut plus dire tout. */
const desClos = computed(() => props.catalogue.themes.some(t => t.clos || t.sections.some(sec => sec.clos)))

/**
 * Combien de questions le filtre retient. Le compte suit exactement la règle du
 * serveur — chapitres et sections **s'additionnent**, la dette **restreint** —
 * parce qu'un compte qui dirait autre chose que ce qui sera tiré serait pire
 * que pas de compte.
 */
const disponibles = computed(() => {
  if (rienDeCoche.value) return compte(props.catalogue)
  let total = 0
  for (const theme of props.catalogue.themes) {
    if (props.modelValue.themes.includes(theme.cle)) {
      total += compte(theme)
      continue
    }
    for (const section of theme.sections) {
      if (props.modelValue.sections.includes(section.cle)) {
        total += compte(section)
        continue
      }
      for (const notion of section.notions) {
        if (props.modelValue.notions?.includes(notion.cle)) total += compte(notion)
      }
    }
  }
  return total
})

defineExpose({ disponibles })
</script>

<template>
  <div>
    <!-- « Ce que j'ai raté » n'est pas un chapitre de plus : c'est un tamis
         posé sur la sélection. D'où sa place au-dessus de la liste, et le mot
         « seulement » dans son libellé. -->
    <button
      v-if="mode === 'seance' || !mode"
      type="button"
      role="checkbox"
      :aria-checked="!!modelValue.erreurs"
      :disabled="!catalogue.ratees && !modelValue.erreurs"
      class="flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors"
      :class="[
        modelValue.erreurs ? 'border-error bg-error/5' : 'border-default',
        catalogue.ratees || modelValue.erreurs ? 'hover:border-error/60' : 'opacity-60'
      ]"
      @click="basculerErreurs"
    >
      <UIcon
        :name="modelValue.erreurs ? 'i-lucide-square-check-big' : 'i-lucide-square'"
        class="size-4 shrink-0"
        :class="modelValue.erreurs ? 'text-error' : 'text-dimmed'"
      />
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-medium text-highlighted">
          Seulement ce que j'ai raté
        </span>
        <span class="mt-0.5 block text-xs text-muted">
          <template v-if="catalogue.ratees">
            Les questions ratées sur une fiche, dans un QCM ou au quiz, et pas encore retrouvées depuis.
          </template>
          <template v-else>
            Rien en attente : tout ce que tu as raté a fini par être retrouvé.
          </template>
        </span>
      </span>
      <UBadge
        :color="modelValue.erreurs ? 'error' : 'neutral'"
        variant="subtle"
        size="sm"
        class="shrink-0 tabular-nums"
        :label="`${catalogue.ratees} à revoir`"
      />
    </button>

    <div
      class="flex flex-wrap items-center justify-between gap-2"
      :class="(mode === 'seance' || !mode) && 'mt-4'"
    >
      <p class="m-0 text-sm text-muted">
        <template v-if="vierge && mode === 'programme'">
          Rien de coché : le contrôle porte sur toute la matière, clos compris.
        </template>
        <template v-else-if="vierge && mode === 'jour'">
          Rien de coché : toute la matière{{ desClos ? ', hors ce que tu as clos' : '' }},
          <strong class="text-highlighted tabular-nums">{{ disponibles }}</strong>
          question{{ disponibles > 1 ? 's' : '' }} à reprendre ou à revoir.
        </template>
        <template v-else-if="vierge">
          Rien de coché : la séance pioche dans
          <strong class="text-highlighted tabular-nums">{{ catalogue.questions }}</strong> questions,
          toute la matière{{ desClos ? ' hors ce que tu as clos' : '' }}.
        </template>
        <template v-else>
          <strong class="text-highlighted tabular-nums">{{ disponibles }}</strong>
          question{{ disponibles > 1 ? 's' : '' }} dans la sélection.
        </template>
      </p>
      <UButton
        v-if="!vierge"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-eraser"
        label="Toute la matière"
        @click="tout"
      />
    </div>

    <!-- Un point de cours reçu par lien : il n'a pas de case dans la liste — la
         nomenclature de l'écran est le plan du chapitre — donc il se nomme ici,
         faute de quoi la sélection annoncerait « 4 questions » sans dire
         lesquelles. -->
    <div
      v-if="points.length"
      class="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary bg-primary/5 px-3 py-2"
    >
      <UIcon
        name="i-lucide-target"
        class="size-4 shrink-0 text-primary"
      />
      <span class="min-w-0 flex-1 text-sm text-highlighted">
        <span class="block text-xs text-muted">Point de cours reçu depuis « Mes domaines »</span>
        <span
          v-for="point in points"
          :key="point.cle"
          class="block"
        >
          <strong>{{ point.titre }}</strong>
          <span class="text-dimmed"> — {{ point.section }}, {{ point.questions }} question{{ point.questions > 1 ? 's' : '' }}</span>
        </span>
      </span>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        label="Retirer"
        @click="oublierPoints"
      />
    </div>

    <div class="mt-3 flex flex-col gap-2">
      <div
        v-for="theme in catalogue.themes"
        :key="theme.cle"
        class="rounded-lg border transition-colors"
        :class="modelValue.themes.includes(theme.cle) ? 'border-primary bg-primary/5' : 'border-default'"
      >
        <div class="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left"
            role="checkbox"
            :aria-checked="modelValue.themes.includes(theme.cle)"
            @click="basculerTheme(theme.cle)"
          >
            <UIcon
              :name="modelValue.themes.includes(theme.cle) ? 'i-lucide-square-check-big' : 'i-lucide-square'"
              class="size-4 shrink-0"
              :class="modelValue.themes.includes(theme.cle) ? 'text-primary' : 'text-dimmed'"
            />
            <UIcon
              v-if="theme.icone"
              :name="theme.icone"
              class="size-4 shrink-0 text-primary"
            />
            <span
              class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted"
              :class="theme.clos && 'opacity-60'"
            >{{ theme.titre }}</span>
            <UBadge
              v-if="theme.clos"
              color="neutral"
              variant="subtle"
              size="sm"
              icon="i-lucide-archive"
              label="clos"
            />
            <span
              v-if="mode === 'jour'"
              class="shrink-0 text-xs text-muted tabular-nums"
            >{{ duJour(theme) }}</span>
            <span
              v-else
              class="shrink-0 text-xs text-muted tabular-nums"
            >
              {{ theme.questions }} question{{ theme.questions > 1 ? 's' : '' }}
              <span
                v-if="theme.ratees"
                class="text-error"
              >· {{ theme.ratees }} à revoir</span>
            </span>
          </button>
          <UButton
            v-if="theme.sections.length"
            size="xs"
            color="neutral"
            variant="ghost"
            :icon="estDeplie(theme.cle) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            :aria-expanded="estDeplie(theme.cle)"
            :aria-label="`Détailler le plan de ${theme.titre}`"
            @click="deplier(theme.cle)"
          />
        </div>

        <div
          v-if="estDeplie(theme.cle)"
          class="border-t border-default px-3 py-2"
        >
          <!-- Le chiffre d'une ligne de section est nu, faute de place : c'est
               ici, une fois pour toutes les lignes, qu'on dit ce qu'il compte. -->
          <p
            v-if="modelValue.themes.includes(theme.cle)"
            class="mt-1 mb-2 text-xs text-muted"
          >
            Le chapitre entier est pris, plan compris. Décoche-le pour n'en garder que quelques parties.
          </p>
          <p
            v-else
            class="mt-1 mb-2 text-xs text-dimmed"
          >
            Le plan du chapitre, dans l'ordre du cours, et le nombre de questions de chaque partie.
          </p>
          <div class="flex flex-col">
            <button
              v-for="section in theme.sections"
              :key="section.cle"
              type="button"
              role="checkbox"
              :aria-checked="modelValue.sections.includes(section.cle)"
              :disabled="modelValue.themes.includes(theme.cle)"
              class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors disabled:opacity-50"
              :class="modelValue.sections.includes(section.cle) ? 'bg-primary/10' : 'hover:bg-elevated/50'"
              @click="basculerSection(section.cle)"
            >
              <UIcon
                :name="modelValue.sections.includes(section.cle) ? 'i-lucide-square-check-big' : 'i-lucide-square'"
                class="size-4 shrink-0"
                :class="modelValue.sections.includes(section.cle) ? 'text-primary' : 'text-dimmed'"
              />
              <span
                class="min-w-0 flex-1 text-sm text-highlighted"
                :class="section.clos && 'opacity-60'"
              >{{ section.titre }}<span
                v-if="section.clos && !theme.clos"
                class="text-dimmed"
              > · clos</span></span>
              <span
                v-if="mode === 'jour'"
                class="shrink-0 text-xs text-muted tabular-nums"
              >{{ duJour(section) }}</span>
              <span
                v-else
                class="shrink-0 text-xs text-muted tabular-nums"
              >
                {{ section.questions }}
                <span
                  v-if="section.ratees"
                  class="text-error"
                >· {{ section.ratees }} à revoir</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
