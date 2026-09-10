<script setup lang="ts">
import type { CatalogueQuiz, FiltreQuiz, HistoriqueQuiz, QuestionQuiz, SessionQuiz } from '~~/shared/types/quiz'

definePageMeta({ layout: 'cours' })

/**
 * Le catalogue est du contenu, l'historique est une donnée — mais les deux se
 * lisent au montage, jamais au rendu serveur. C'est la règle de tout le site :
 * le HTML servi est le même pour tout le monde, donc cacheable, et il ne peut
 * rien laisser fuir.
 */
const { data: catalogue } = await useLazyFetch<CatalogueQuiz>('/api/quiz/catalogue', { server: false })
const { data: historique, refresh: relireHistorique } = await useLazyFetch<HistoriqueQuiz>('/api/quiz/historique', {
  server: false
})

const filtre = ref<FiltreQuiz>({ themes: [], notions: [] })
const taille = ref(20)
const lancement = ref(false)
const erreur = ref<string | null>(null)

/** Le compte du filtre, calculé comme le serveur le calculera. */
const disponibles = computed(() => {
  const c = catalogue.value
  if (!c) return 0
  if (!filtre.value.themes.length && !filtre.value.notions.length) return c.total
  let total = 0
  for (const theme of c.themes) {
    if (filtre.value.themes.includes(theme.cle)) {
      total += theme.questions
      continue
    }
    for (const notion of theme.notions) {
      if (filtre.value.notions.includes(notion.cle)) total += notion.questions
    }
  }
  return total
})

const tailleMin = computed(() => catalogue.value?.tailleMin ?? 5)
const tailleMax = computed(() =>
  Math.max(tailleMin.value, Math.min(catalogue.value?.tailleMax ?? 60, disponibles.value || 1)))

const raccourcis = computed(() =>
  [10, 20, 30, 40, 60].filter(n => n >= tailleMin.value && n <= tailleMax.value))

// Réduire la sélection ne doit pas laisser une taille qu'on ne peut plus servir.
watch(tailleMax, (max) => {
  if (taille.value > max) taille.value = max
  if (taille.value < tailleMin.value) taille.value = tailleMin.value
})

async function commencer() {
  if (lancement.value) return
  lancement.value = true
  erreur.value = null
  try {
    const { session } = await $fetch<{ session: SessionQuiz, question: QuestionQuiz | null }>('/api/quiz/session', {
      method: 'POST',
      body: { themes: filtre.value.themes, notions: filtre.value.notions, taille: taille.value }
    })
    await navigateTo(`/quiz/${session.id}`)
  } catch (e) {
    const message = (e as { data?: { statusMessage?: string } })?.data?.statusMessage
    erreur.value = message || 'La séance n\'a pas pu démarrer.'
    lancement.value = false
  }
}

/** Reprendre la sélection sur ce qui a effectivement coûté des points. */
function reviserCeQuiResiste() {
  const notions = (historique.value?.resistent ?? []).map(n => n.cle)
  if (!notions.length) return
  filtre.value = { themes: [], notions }
}

async function clore(id: number) {
  await $fetch(`/api/quiz/session/${id}`, { method: 'DELETE' })
  await relireHistorique()
}

function dateCourte(t: number) {
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function tonScore(s: { acquises: number, taille: number }) {
  if (s.taille && s.acquises >= s.taille) return 'success'
  return s.acquises > 0 ? 'warning' : 'neutral'
}

useSeoMeta({ title: 'Quiz' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Quiz"
      description="Une question au milieu de l'écran, une seule à la fois. Une erreur ne coûte pas un point : elle renvoie la place à la fin de la file, avec une autre question sur le même point de cours. La séance se termine quand tout est acquis, pas quand les questions sont épuisées."
    >
      <template #headline>
        <UBadge
          color="primary"
          variant="subtle"
          size="md"
          icon="i-lucide-zap"
          label="Entraînement libre"
        />
      </template>
    </UPageHeader>

    <UPageBody>
      <UAlert
        v-if="historique?.encours"
        color="primary"
        variant="subtle"
        icon="i-lucide-play"
        title="Une séance est en cours"
        :description="`${historique.encours.acquises} place${historique.encours.acquises > 1 ? 's' : ''} acquise${historique.encours.acquises > 1 ? 's' : ''} sur ${historique.encours.taille}, ${historique.encours.poses} question${historique.encours.poses > 1 ? 's' : ''} posée${historique.encours.poses > 1 ? 's' : ''} — ${historique.encours.themes.join(', ')}.`"
      >
        <template #actions>
          <UButton
            color="primary"
            size="sm"
            icon="i-lucide-arrow-right"
            label="Reprendre"
            :to="`/quiz/${historique.encours.id}`"
          />
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            label="Clore"
            @click="clore(historique.encours!.id)"
          />
        </template>
      </UAlert>

      <div class="mt-8">
        <h2 class="text-lg font-medium text-highlighted">
          Sur quoi ?
        </h2>
        <p class="mt-1 mb-0 text-sm text-muted">
          Un chapitre entier, ou quelques points de cours précis. Ce qui est coché s'additionne.
        </p>

        <!-- L'affichage ne se branche que sur les données, jamais sur l'état de
             chargement : `pending` ne vaut pas la même chose au rendu serveur et
             à l'hydratation, et Vue signalait la divergence à chaque visite. -->
        <QuizFiltre
          v-if="catalogue"
          v-model="filtre"
          class="mt-4"
          :catalogue="catalogue"
        />
        <div
          v-else
          class="mt-4 flex items-center gap-2 text-sm text-muted"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-4 animate-spin"
          />
          <span>Chargement du catalogue…</span>
        </div>
      </div>

      <div
        v-if="catalogue"
        class="mt-8"
      >
        <h2 class="text-lg font-medium text-highlighted">
          Combien de questions ?
        </h2>
        <p class="mt-1 mb-0 text-sm text-muted">
          C'est le nombre de places à acquérir. Chaque erreur en rallonge la file, jamais le compte.
        </p>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <UButton
            v-for="n in raccourcis"
            :key="n"
            size="sm"
            :color="taille === n ? 'primary' : 'neutral'"
            :variant="taille === n ? 'solid' : 'outline'"
            class="tabular-nums"
            :label="String(n)"
            @click="taille = n"
          />
          <span class="text-sm text-muted tabular-nums">
            <strong class="text-highlighted">{{ taille }}</strong> question{{ taille > 1 ? 's' : '' }}
          </span>
        </div>

        <USlider
          v-model="taille"
          class="mt-4 max-w-md"
          :min="tailleMin"
          :max="tailleMax"
          :step="1"
          :aria-label="'Nombre de questions'"
        />

        <p
          v-if="disponibles < taille"
          class="mt-3 mb-0 text-sm text-warning"
        >
          La sélection ne contient que {{ disponibles }} question{{ disponibles > 1 ? 's' : '' }} :
          la séance en comptera autant.
        </p>

        <UAlert
          v-if="erreur"
          class="mt-4"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="erreur"
        />

        <UButton
          class="mt-5"
          size="lg"
          color="primary"
          icon="i-lucide-play"
          :loading="lancement"
          :disabled="!disponibles"
          label="Commencer la séance"
          @click="commencer"
        />
      </div>

      <div
        v-if="historique?.resistent?.length"
        class="mt-10"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-lg font-medium text-highlighted">
            Ce qui résiste
          </h2>
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-target"
            label="M'interroger là-dessus"
            @click="reviserCeQuiResiste"
          />
        </div>
        <p class="mt-1 mb-3 text-sm text-muted">
          Les points de cours qui ont coûté le plus de fautes, toutes séances confondues.
        </p>
        <div class="flex flex-col gap-2">
          <div
            v-for="notion in historique.resistent"
            :key="notion.cle"
            class="flex items-center gap-3 rounded-lg border border-default px-3 py-2"
          >
            <UIcon
              name="i-lucide-alert-circle"
              class="size-4 shrink-0 text-error"
            />
            <span class="min-w-0 flex-1 text-sm text-highlighted">{{ notion.titre }}</span>
            <span class="shrink-0 text-xs text-muted tabular-nums">
              {{ notion.fautes }} faute{{ notion.fautes > 1 ? 's' : '' }} sur {{ notion.posees }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="historique?.sessions?.length"
        class="mt-10"
      >
        <h2 class="text-lg font-medium text-highlighted">
          Tes séances
        </h2>
        <div class="mt-3 flex flex-col gap-2">
          <div
            v-for="s in historique.sessions"
            :key="s.id"
            class="flex flex-wrap items-center gap-3 rounded-lg border border-default px-3 py-2"
          >
            <UBadge
              :color="tonScore(s)"
              variant="subtle"
              size="sm"
              class="shrink-0 tabular-nums"
              :label="`${s.acquises} / ${s.taille}`"
            />
            <span class="min-w-0 flex-1 truncate text-sm text-highlighted">
              {{ s.themes.join(', ') }}
            </span>
            <span class="shrink-0 text-xs text-muted tabular-nums">
              {{ s.poses }} posée{{ s.poses > 1 ? 's' : '' }},
              {{ s.fautes }} faute{{ s.fautes > 1 ? 's' : '' }} · {{ dateCourte(s.commencee_le) }}
            </span>
            <UButton
              v-if="!s.finie"
              size="xs"
              color="primary"
              variant="soft"
              icon="i-lucide-arrow-right"
              label="Reprendre"
              :to="`/quiz/${s.id}`"
            />
          </div>
        </div>
      </div>
    </UPageBody>
  </UPage>
</template>
