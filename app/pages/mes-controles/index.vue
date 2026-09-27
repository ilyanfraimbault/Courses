<script setup lang="ts">
import type { ResumeControle } from '~~/shared/types/controles'

definePageMeta({ layout: 'cours' })

/** Données du compte : lues au montage, jamais au rendu serveur. */
const { data: controles } = await useLazyFetch<ResumeControle[]>('/api/controles', {
  server: false,
  query: { fuseau: fuseauLocal() }
})

const aVenir = computed(() => (controles.value ?? []).filter(c => c.joursRestants >= 0))
const passes = computed(() => (controles.value ?? []).filter(c => c.joursRestants < 0))

function tonEcheance(c: ResumeControle) {
  if (c.joursRestants <= 2) return 'error'
  if (c.joursRestants <= 7) return 'warning'
  return 'neutral'
}

useSeoMeta({ title: 'Mes contrôles' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Mes contrôles"
      description="Un contrôle, c'est une date et un programme. Le site en tire une feuille de route : ce qu'il reste à apprendre, découpé en journées, un examen blanc l'avant-veille et la dette à solder la veille. Tout se recalcule à chaque séance, où qu'elle ait lieu."
    >
      <template #headline>
        <UBadge
          color="primary"
          variant="subtle"
          size="md"
          icon="i-lucide-calendar-check"
          label="Préparation"
        />
      </template>
      <template #links>
        <UButton
          to="/mes-controles/nouveau"
          icon="i-lucide-plus"
          label="Nouveau contrôle"
        />
      </template>
    </UPageHeader>

    <UPageBody>
      <template v-if="controles">
        <div
          v-if="!controles.length"
          class="rounded-xl border border-dashed border-default px-5 py-10 text-center"
        >
          <UIcon
            name="i-lucide-calendar-check"
            class="size-8 text-dimmed"
          />
          <p class="mt-3 mb-0 font-medium text-highlighted">
            Aucun contrôle pour l'instant
          </p>
          <p class="mx-auto mt-1 mb-0 max-w-md text-sm text-muted">
            Déclare ton prochain contrôle — sa date et les chapitres qu'il couvre — et le site
            te dira chaque jour quoi réviser pour arriver prêt.
          </p>
          <UButton
            class="mt-5"
            to="/mes-controles/nouveau"
            icon="i-lucide-plus"
            label="Déclarer un contrôle"
          />
        </div>

        <section v-if="aVenir.length">
          <h2 class="m-0 text-lg font-medium text-highlighted">
            À venir
          </h2>
          <div class="mt-3 flex flex-col gap-3">
            <ULink
              v-for="c in aVenir"
              :key="c.id"
              :to="`/mes-controles/${c.id}`"
              class="group rounded-lg border border-default px-4 py-3 transition-colors hover:border-primary/60 hover:bg-elevated/50"
            >
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="min-w-0 flex-1">
                  <span class="block text-xs text-dimmed">{{ c.matiereTitre }} · {{ jourLong(c.jour) }}</span>
                  <span class="block font-medium text-highlighted group-hover:text-primary">{{ c.titre }}</span>
                </span>
                <UBadge
                  :color="tonEcheance(c)"
                  variant="subtle"
                  :label="echeance(c.joursRestants)"
                />
              </div>
              <UProgressGroup
                class="mt-3"
                size="sm"
                :max="c.etat.questions || 1"
                :items="segmentsControle(c.etat)"
              />
              <div class="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                <span class="tabular-nums">Prêt à {{ partSue(c.etat) }} % · {{ c.etat.sues }} / {{ c.etat.questions }} sues</span>
                <span
                  v-if="c.etat.dette"
                  class="text-error"
                >{{ c.etat.dette }} en dette</span>
                <span class="ms-auto font-medium text-highlighted">{{ consigneDuJour(c) }}</span>
              </div>
            </ULink>
          </div>
        </section>

        <section
          v-if="passes.length"
          :class="aVenir.length && 'mt-10'"
        >
          <h2 class="m-0 text-lg font-medium text-highlighted">
            Passés
          </h2>
          <div class="mt-3 flex flex-col gap-2">
            <ULink
              v-for="c in passes"
              :key="c.id"
              :to="`/mes-controles/${c.id}`"
              class="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-default px-4 py-3 transition-colors hover:border-primary/60 hover:bg-elevated/50"
            >
              <span class="min-w-0 flex-1">
                <span class="block text-xs text-dimmed">{{ c.matiereTitre }} · {{ jourLong(c.jour) }}</span>
                <span class="block font-medium text-highlighted">{{ c.titre }}</span>
              </span>
              <span class="text-xs text-muted tabular-nums">Prêt à {{ partSue(c.etat) }} %</span>
              <UBadge
                v-if="c.note !== null"
                color="neutral"
                variant="subtle"
                class="tabular-nums"
                :label="c.bareme ? `${c.note} / ${c.bareme}` : String(c.note)"
              />
              <span
                v-else
                class="text-xs text-dimmed"
              >Note à saisir</span>
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 shrink-0 text-dimmed transition-transform group-hover:translate-x-0.5"
              />
            </ULink>
          </div>
        </section>
      </template>

      <div
        v-else
        class="flex flex-col gap-3"
      >
        <USkeleton class="h-24 w-full" />
        <USkeleton class="h-24 w-full" />
      </div>
    </UPageBody>
  </UPage>
</template>
