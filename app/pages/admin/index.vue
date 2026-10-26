<script setup lang="ts">
import type { UtilisateurAdministration, VueAdministration } from '~~/shared/types/administration'

definePageMeta({ layout: 'cours' })

/**
 * Lue au montage, comme toute donnée d'utilisateur : le HTML servi ne porte la
 * trace d'aucun compte. Le middleware renvoie ailleurs qui n'a pas le drapeau,
 * mais c'est la route qui refuse — en 403 — à qui n'est pas administrateur.
 */
const { data, status, error, refresh } = await useLazyFetch<VueAdministration>('/api/admin/utilisateurs', { server: false })

const utilisateurs = computed(() => data.value?.utilisateurs ?? [])
const matieres = computed(() => data.value?.matieres ?? [])

const SEMAINE = 7 * 24 * 60 * 60 * 1000
// Figé au montage : un « maintenant » réactif ferait recalculer la page pour rien.
const maintenant = ref(Date.now())
const actifsSemaine = computed(() =>
  utilisateurs.value.filter(u => u.derniereActivite && maintenant.value - u.derniereActivite < SEMAINE).length)

const ouverts = ref(new Set<number>())
function basculer(id: number) {
  const suite = new Set(ouverts.value)
  if (suite.has(id)) suite.delete(id)
  else suite.add(id)
  ouverts.value = suite
}

function pourcentage(n: number, sur: number) {
  return sur ? Math.round(100 * n / sur) : 0
}

const relatif = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
const UNITES: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400_000],
  ['month', 30 * 86_400_000],
  ['week', 7 * 86_400_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000]
]

function ilYA(t: number | null) {
  if (!t) return 'jamais'
  const ecart = t - maintenant.value
  for (const [unite, ms] of UNITES) {
    if (Math.abs(ecart) >= ms) return relatif.format(Math.round(ecart / ms), unite)
  }
  return 'à l\'instant'
}

function date(t: number) {
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Les chiffres d'un compte, dans l'ordre où on les lit : ce qui coince, puis ce qui est fait. */
function chiffres(u: UtilisateurAdministration) {
  return [
    { icone: 'i-lucide-file-text', texte: `${u.fichesOuvertes} fiche${u.fichesOuvertes > 1 ? 's' : ''} commencée${u.fichesOuvertes > 1 ? 's' : ''}` },
    { icone: 'i-lucide-circle-alert', texte: `${u.enDette} en dette · ${u.fautes} faute${u.fautes > 1 ? 's' : ''}` },
    {
      icone: 'i-lucide-zap',
      texte: u.quiz.reponses
        ? `${u.quiz.reponses} réponse${u.quiz.reponses > 1 ? 's' : ''} au quiz · ${pourcentage(u.quiz.justes, u.quiz.reponses)} % justes`
        : 'jamais au quiz'
    },
    { icone: 'i-lucide-list-checks', texte: `${u.qcm.copies} copie${u.qcm.copies > 1 ? 's' : ''} de QCM · ${u.qcm.composes} composé${u.qcm.composes > 1 ? 's' : ''}` },
    { icone: 'i-lucide-calendar-check', texte: `${u.controles} contrôle${u.controles > 1 ? 's' : ''}` },
    { icone: 'i-lucide-square-check', texte: `to-do ${u.todo.faites} / ${u.todo.total}` }
  ]
}

useSeoMeta({ title: 'Utilisateurs' })
</script>

<template>
  <UPage>
    <UPageHeader
      headline="Administration"
      title="Utilisateurs"
      description="Tous les comptes du site et où ils en sont : ce qu'ils ont trouvé, matière par matière, et quand ils sont passés pour la dernière fois. Les plus récemment actifs d'abord."
    />

    <UPageBody>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="error.statusCode === 403 ? 'Réservé à l\'administration' : 'Lecture impossible'"
        :description="error.statusCode === 403 ? 'Ce compte n\'administre pas le site.' : 'Le serveur n\'a pas répondu.'"
        :actions="error.statusCode === 403 ? [] : [{ label: 'Réessayer', onClick: () => refresh() }]"
      />

      <div
        v-else-if="status === 'pending' && !data"
        class="flex flex-col gap-3"
      >
        <USkeleton
          v-for="i in 3"
          :key="i"
          class="h-24 w-full"
        />
      </div>

      <template v-else-if="data">
        <p class="text-sm text-muted">
          {{ utilisateurs.length }} compte{{ utilisateurs.length > 1 ? 's' : '' }},
          dont {{ actifsSemaine }} actif{{ actifsSemaine > 1 ? 's' : '' }} ces sept derniers jours.
          Le site compte {{ data.questions }} questions.
        </p>

        <ul class="mt-6 flex flex-col gap-3">
          <li
            v-for="u of utilisateurs"
            :key="u.id"
            class="rounded-lg border border-default px-4 py-4 sm:px-5"
          >
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <UIcon
                name="i-lucide-circle-user"
                class="size-6 shrink-0 text-primary"
              />
              <span class="font-semibold text-highlighted">{{ u.pseudo }}</span>
              <UBadge
                v-if="u.admin"
                size="sm"
                color="primary"
                variant="subtle"
                label="Admin"
              />
              <span class="text-sm text-dimmed">inscrit le {{ date(u.inscritLe) }}</span>
              <span
                class="ms-auto text-sm tabular-nums"
                :class="u.derniereActivite ? 'text-muted' : 'text-dimmed'"
                :title="u.derniereActivite ? new Date(u.derniereActivite).toLocaleString('fr-FR') : undefined"
              >
                actif {{ ilYA(u.derniereActivite) }}
              </span>
            </div>

            <div class="mt-3 flex items-center gap-3">
              <UProgress
                class="flex-1"
                size="sm"
                :model-value="u.acquises"
                :max="data.questions || 1"
              />
              <span class="shrink-0 text-sm text-muted tabular-nums">
                {{ u.acquises }} / {{ data.questions }} · {{ pourcentage(u.acquises, data.questions) }} %
              </span>
            </div>

            <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <li
                v-for="c of chiffres(u)"
                :key="c.icone"
                class="flex items-center gap-1"
              >
                <UIcon
                  :name="c.icone"
                  class="size-3.5 shrink-0 text-dimmed"
                />
                {{ c.texte }}
              </li>
            </ul>

            <UButton
              class="mt-3 -ms-2"
              size="xs"
              color="neutral"
              variant="ghost"
              :icon="ouverts.has(u.id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              :label="ouverts.has(u.id) ? 'Masquer le détail' : 'Par matière'"
              :aria-expanded="ouverts.has(u.id)"
              @click="basculer(u.id)"
            />

            <div
              v-if="ouverts.has(u.id)"
              class="mt-2 grid gap-3 sm:grid-cols-2"
            >
              <div
                v-for="m of matieres"
                :key="m.cle"
              >
                <div class="flex items-baseline gap-2 text-sm">
                  <UIcon
                    :name="m.icone || 'i-lucide-book-open'"
                    class="size-4 shrink-0 self-center text-primary"
                  />
                  <span class="min-w-0 flex-1 truncate text-highlighted">{{ m.titre }}</span>
                  <span class="shrink-0 text-muted tabular-nums">
                    {{ u.parMatiere[m.cle] ?? 0 }} / {{ m.questions }}
                  </span>
                </div>
                <UProgress
                  class="mt-1"
                  size="xs"
                  :model-value="u.parMatiere[m.cle] ?? 0"
                  :max="m.questions || 1"
                />
              </div>
            </div>
          </li>
        </ul>
      </template>
    </UPageBody>
  </UPage>
</template>
