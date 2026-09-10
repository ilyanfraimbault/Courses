<script setup lang="ts">
/**
 * Le déroulé d'une séance.
 *
 * Pas de barre latérale ici, et une seule question à l'écran : c'est tout
 * l'intérêt du mode. Le reste du site sert à parcourir, celui-ci sert à
 * répondre.
 */
const route = useRoute()
const id = computed(() => Number(route.params.id))

const {
  session, question, correction, choisi, chargement, envoi, erreur, finie,
  repondre, suivante, clore
} = useSessionQuiz(id)

const sortie = ref(false)

const pourcentage = computed(() => {
  const s = session.value
  return s?.taille ? Math.round(100 * s.acquises / s.taille) : 0
})

/**
 * Les places en dette : manquées, et pas encore rattrapées.
 *
 * Ce n'est pas le nombre de fautes, qui ne redescend jamais. Une place ratée
 * puis regagnée plus loin ne doit plus rien, et le compteur doit le montrer —
 * sans quoi il annoncerait « douze à reprendre » sur une séance terminée.
 */
const enDette = computed(() => {
  const s = session.value
  if (!s) return 0
  const acquises = new Set(s.file.filter(p => p.etat === 'juste').map(p => p.place))
  return new Set(s.file.filter(p => p.etat === 'manquee' && !acquises.has(p.place)).map(p => p.place)).size
})

/** Réussite au premier coup : ce que la séance dit vraiment du niveau. */
const reussite = computed(() => {
  const s = session.value
  return s?.poses ? Math.round(100 * s.justes / s.poses) : 0
})

const verdict = computed(() => {
  if (reussite.value >= 90) return 'Presque rien n\'a résisté.'
  if (reussite.value >= 70) return 'Le fond tient : ce sont les reprises qui disent où creuser.'
  if (reussite.value >= 50) return 'La moitié passe du premier coup. Reprends le cours des notions ratées avant la prochaine séance.'
  return 'Beaucoup de reprises : c\'est le cours qu\'il faut relire, pas le quiz qu\'il faut refaire.'
})

async function quitter() {
  sortie.value = true
  await clore()
  await navigateTo('/quiz')
}

/** Entrée ou Espace enchaîne, une fois la correction lue. */
function auClavier(evenement: KeyboardEvent) {
  if (!correction.value || finie.value) return
  if (evenement.key !== 'Enter' && evenement.key !== ' ') return
  const cible = evenement.target as HTMLElement | null
  if (cible && ['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(cible.tagName)) return
  evenement.preventDefault()
  suivante()
}

useEventListener(document, 'keydown', auClavier)

useSeoMeta({ title: 'Séance de quiz' })
</script>

<template>
  <UContainer>
    <!-- La question tient au milieu de l'écran : `my-auto` plutôt qu'un
         `justify-center`, qui rognerait le haut d'une correction plus haute que
         la fenêtre au lieu de la laisser défiler. -->
    <div class="mx-auto flex min-h-[calc(100svh-11rem)] w-full max-w-3xl flex-col py-6 sm:py-10">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <UButton
          to="/quiz"
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-arrow-left"
          label="Quiz"
        />
        <div class="min-w-0 flex-1" />
        <template v-if="session">
          <span class="text-sm text-muted tabular-nums">
            <strong class="text-highlighted">{{ session.acquises }} / {{ session.taille }}</strong> acquises
          </span>
          <UBadge
            v-if="enDette"
            color="error"
            variant="subtle"
            size="sm"
            class="tabular-nums"
            :label="`${enDette} à reprendre`"
          />
          <UButton
            v-if="!finie"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-door-open"
            :loading="sortie"
            label="Arrêter"
            @click="quitter"
          />
        </template>
      </div>

      <UProgress
        v-if="session"
        class="mt-3"
        size="xs"
        :color="pourcentage === 100 ? 'success' : 'primary'"
        :model-value="session.acquises"
        :max="session.taille || 1"
      />

      <QuizFrise
        v-if="session"
        class="mt-3"
        :session="session"
      />

      <UAlert
        v-if="erreur"
        class="my-auto"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :description="erreur"
      >
        <template #actions>
          <UButton
            color="neutral"
            variant="subtle"
            size="sm"
            label="Retour au quiz"
            to="/quiz"
          />
        </template>
      </UAlert>

      <!-- Le bilan. Une séance finie ne se rejoue pas : elle se relit. -->
      <div
        v-else-if="finie && session"
        class="my-auto rounded-xl border border-default bg-elevated/30 px-5 py-8 text-center sm:px-8"
      >
        <UIcon
          name="i-lucide-party-popper"
          class="size-10 text-primary"
        />
        <h1 class="mt-3 mb-0 text-2xl font-semibold text-highlighted">
          Séance terminée
        </h1>
        <p class="mt-2 mb-0 text-muted">
          Les {{ session.taille }} place{{ session.taille > 1 ? 's' : '' }} sont acquises.
        </p>

        <div class="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3">
          <div class="rounded-lg border border-default px-3 py-3">
            <p class="m-0 text-2xl font-medium text-highlighted tabular-nums">
              {{ session.poses }}
            </p>
            <p class="m-0 text-xs text-muted">
              questions posées
            </p>
          </div>
          <div class="rounded-lg border border-default px-3 py-3">
            <p class="m-0 text-2xl font-medium text-highlighted tabular-nums">
              {{ reussite }} %
            </p>
            <p class="m-0 text-xs text-muted">
              justes du premier coup
            </p>
          </div>
          <div class="rounded-lg border border-default px-3 py-3">
            <p class="m-0 text-2xl font-medium text-highlighted tabular-nums">
              {{ session.fautes }}
            </p>
            <p class="m-0 text-xs text-muted">
              reprise{{ session.fautes > 1 ? 's' : '' }}
            </p>
          </div>
        </div>

        <p class="mx-auto mt-5 mb-0 max-w-md text-sm text-muted">
          {{ verdict }}
        </p>

        <div class="mt-6 flex flex-wrap items-center justify-center gap-2">
          <UButton
            to="/quiz"
            color="primary"
            icon="i-lucide-rotate-ccw"
            label="Nouvelle séance"
          />
          <UButton
            to="/cours"
            color="neutral"
            variant="subtle"
            icon="i-lucide-library"
            label="Retourner au cours"
          />
        </div>
      </div>

      <!-- La question. -->
      <div
        v-else
        class="my-auto rounded-xl border border-default bg-default px-4 py-6 sm:px-8 sm:py-8"
      >
        <div
          v-if="!question"
          class="flex min-h-40 items-center justify-center gap-2 text-sm text-muted"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-4 animate-spin"
          />
          <span>Chargement de la question…</span>
        </div>

        <template v-else>
          <QuizQuestion
            :key="question.id + '@' + question.position"
            :question="question"
            :choisi="choisi"
            :correction="correction"
            :envoi="envoi"
            :numero="question.position + 1"
            @choisir="repondre"
          />

          <QuizCorrection
            v-if="correction"
            :correction="correction"
            :question="question"
          />

          <div
            v-if="correction"
            class="mt-6 flex flex-wrap items-center gap-3"
          >
            <UButton
              size="lg"
              color="primary"
              trailing-icon="i-lucide-arrow-right"
              :loading="chargement"
              :label="session && session.position >= session.longueur ? 'Voir le bilan' : 'Question suivante'"
              @click="suivante"
            />
            <span class="text-xs text-dimmed">Entrée</span>
          </div>
        </template>
      </div>

      <p
        v-if="session && !finie"
        class="mt-4 mb-0 text-center text-xs text-dimmed tabular-nums"
      >
        {{ session.longueur - session.position }} question{{ session.longueur - session.position > 1 ? 's' : '' }}
        dans la file · {{ session.poses }} posée{{ session.poses > 1 ? 's' : '' }} depuis le début
      </p>
    </div>
  </UContainer>
</template>
