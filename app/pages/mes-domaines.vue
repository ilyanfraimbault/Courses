<script setup lang="ts">
import type { ChapitreProgression, DomaineProgression, ProgressionDomaines } from '~~/shared/types/domaines'

definePageMeta({ layout: 'cours' })

/**
 * La progression est une donnée d'utilisateur : elle se lit au montage, jamais
 * au rendu serveur. Le HTML servi est le même pour tout le monde.
 */
const { data, status } = await useLazyFetch<ProgressionDomaines>('/api/progression/domaines', { server: false })

const chapitres = computed(() => data.value?.chapitres ?? [])
const total = computed(() => data.value?.total ?? { questions: 0, acquises: 0, hesitantes: 0, interrogeables: 0 })
const domainesComptes = computed(() => chapitres.value.reduce((n, c) => n + c.domaines.length, 0))

type Compte = { questions: number, acquises: number, hesitantes: number }

/**
 * Les deux segments d'une barre. Ils se lisent l'un après l'autre : ce qui est
 * tombé juste du premier coup, puis ce qu'il a fallu reprendre. Le reste de la
 * barre — la piste nue — est ce qui n'a jamais été trouvé.
 *
 * Une question retrouvée après une faute reste **acquise** : elle ne perd pas le
 * terrain gagné, elle dit seulement qu'il a coûté quelque chose.
 */
function segments(c: Compte, avecIntitules: boolean) {
  const sures = Math.max(0, c.acquises - c.hesitantes)
  return [
    {
      value: sures,
      color: 'success' as const,
      label: avecIntitules ? 'Trouvées du premier coup' : undefined
    },
    {
      value: c.hesitantes,
      color: 'warning' as const,
      label: avecIntitules ? 'Retrouvées après une faute' : undefined,
      // Deux teintes qui se touchent se lisent comme une seule : un liseré de la
      // couleur du fond sépare les segments, et ne s'invite pas quand le premier
      // est vide.
      ui: sures ? { segment: 'border-s-2 border-(--ui-bg)' } : undefined
    }
  ]
}

function pourcentage(c: Compte) {
  return c.questions ? Math.round(100 * c.acquises / c.questions) : 0
}

/** Ce qu'on peut dire d'un domaine en une ligne, à côté de sa barre. */
function decompte(d: DomaineProgression) {
  const base = `${d.acquises} / ${d.questions}`
  return d.hesitantes ? `${base} · ${d.hesitantes} après une faute` : base
}

/** Ce qui n'a jamais été trouvé dans un chapitre. */
function restant(c: ChapitreProgression) {
  return c.questions - c.acquises
}

useSeoMeta({ title: 'Mes domaines' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Mes domaines"
      description="La progression rangée par point de cours plutôt que par fiche. Une fiche est un contenant ; un point de cours est un sujet — c'est de lui qu'on veut savoir s'il est tenu. Dans chaque chapitre, ce qui résiste le plus est en tête."
    />

    <UPageBody>
      <template v-if="data">
        <UProgressGroup
          size="lg"
          status
          :max="total.questions"
          :items="segments(total, true)"
        >
          <template #status="{ percent }">
            {{ percent }} %
          </template>
          <!--
            Le pourcentage par défaut se lit mal ici : « 52 % » et « 6 % » ne
            s'additionnent pas dans la tête aussi vite que deux comptes.
          -->
          <template #item-trailing="{ index }">
            <span class="tabular-nums">
              {{ index === 0 ? total.acquises - total.hesitantes : total.hesitantes }}
            </span>
          </template>
        </UProgressGroup>

        <p class="mt-3 text-sm text-muted">
          {{ total.acquises }} question{{ total.acquises > 1 ? 's' : '' }} trouvée{{ total.acquises > 1 ? 's' : '' }}
          sur {{ total.questions }}, réparties en {{ domainesComptes }} point{{ domainesComptes > 1 ? 's' : '' }}
          de cours. La piste vide, c'est ce qui n'a jamais été trouvé.
        </p>

        <section
          v-for="chapitre of chapitres"
          :key="chapitre.cle"
          class="mt-10"
        >
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <UIcon
              :name="chapitre.icone || 'i-lucide-book-open-text'"
              class="size-5 shrink-0 text-primary"
            />
            <h2 class="text-lg font-medium text-highlighted">
              <ULink
                v-if="chapitre.chemin"
                :to="chapitre.chemin"
                class="hover:text-primary"
              >{{ chapitre.titre }}</ULink>
              <template v-else>
                {{ chapitre.titre }}
              </template>
            </h2>
            <span class="text-sm text-muted tabular-nums">
              {{ chapitre.acquises }} / {{ chapitre.questions }} · {{ pourcentage(chapitre) }} %
            </span>
            <UButton
              v-if="chapitre.interrogeables"
              class="ms-auto"
              size="xs"
              color="neutral"
              variant="subtle"
              icon="i-lucide-zap"
              label="M'interroger sur le chapitre"
              :to="`/quiz?theme=${encodeURIComponent(chapitre.cle)}`"
            />
          </div>

          <UProgressGroup
            class="mt-3"
            size="md"
            :max="chapitre.questions"
            :items="segments(chapitre, false)"
          />

          <p
            v-if="!restant(chapitre)"
            class="mt-2 text-sm text-success"
          >
            Tout est trouvé dans ce chapitre.
          </p>

          <ul class="mt-4 flex flex-col divide-y divide-default">
            <li
              v-for="domaine of chapitre.domaines"
              :key="domaine.cle ?? `${chapitre.cle}#sans-renvoi`"
              class="flex flex-col gap-1.5 py-3"
            >
              <div class="flex items-center gap-3">
                <span
                  class="min-w-0 flex-1 truncate text-sm"
                  :class="domaine.cle ? 'text-highlighted' : 'text-muted italic'"
                >{{ domaine.titre }}</span>
                <span class="shrink-0 text-xs text-muted tabular-nums">{{ decompte(domaine) }}</span>
                <UButton
                  v-if="domaine.cle && domaine.interrogeables"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-zap"
                  :aria-label="`M'interroger sur : ${domaine.titre}`"
                  :title="`M'interroger sur : ${domaine.titre}`"
                  :to="`/quiz?notion=${encodeURIComponent(domaine.cle)}`"
                />
                <span
                  v-else
                  class="size-6 shrink-0"
                />
              </div>
              <UProgressGroup
                size="sm"
                :max="domaine.questions"
                :items="segments(domaine, false)"
              />
            </li>
          </ul>
        </section>
      </template>

      <p
        v-else-if="status === 'error'"
        class="text-sm text-muted"
      >
        La progression n'a pas pu être lue. Recharge la page ; si ça recommence, c'est que la
        session a expiré.
      </p>

      <!--
        L'attente est le **troisième** cas et non le premier, et c'est voulu : au
        rendu serveur la requête n'a pas commencé (`status` vaut « idle »), alors
        qu'au premier rendu client elle est déjà « pending ». Brancher sur
        `status` ferait donc rendre deux choses différentes de part et d'autre de
        l'hydratation. Brancher sur `data`, absente des deux côtés, les fait
        coïncider.
      -->
      <div
        v-else
        class="flex flex-col gap-3"
      >
        <USkeleton class="h-3 w-full" />
        <USkeleton class="h-4 w-2/3" />
        <USkeleton class="h-4 w-1/2" />
      </div>
    </UPageBody>
  </UPage>
</template>
