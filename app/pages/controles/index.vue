<script setup lang="ts">
import type { Controle } from '~~/shared/types/controles'
import { PARCOURS } from '~~/shared/types/matieres'

definePageMeta({ layout: 'cours' })

/**
 * L'agenda de la classe : les contrôles qui te concernent, à venir puis
 * passés. N'importe qui en planifie un, pour tous ; seul son auteur le change.
 */
const { data: controles, refresh } = await useLazyFetch<Controle[]>('/api/controles', {
  server: false,
  query: { fuseau: fuseauLocal() }
})

const aVenir = computed(() => (controles.value ?? []).filter(c => c.joursRestants >= 0))
const passes = computed(() => (controles.value ?? []).filter(c => c.joursRestants < 0).reverse())

const planifier = ref(false)

useSeoMeta({ title: 'Contrôles' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Contrôles"
      description="L'agenda de la classe. Un contrôle planifié apparaît dans le calendrier de tous ceux qu'il concerne."
    >
      <template #links>
        <UButton
          icon="i-lucide-calendar-plus"
          label="Planifier un contrôle"
          @click="planifier = true"
        />
      </template>
    </UPageHeader>

    <UPageBody>
      <template v-if="controles">
        <p
          v-if="!controles.length"
          class="text-sm text-muted"
        >
          Aucun contrôle planifié pour l'instant.
        </p>

        <section
          v-for="groupe in [{ titre: 'À venir', liste: aVenir }, { titre: 'Passés', liste: passes }]"
          :key="groupe.titre"
          class="mb-8"
        >
          <template v-if="groupe.liste.length">
            <h2 class="mb-3 text-base font-medium text-highlighted">
              {{ groupe.titre }}
            </h2>
            <div class="flex flex-col gap-2">
              <ULink
                v-for="c in groupe.liste"
                :key="c.id"
                :to="`/controles/${c.id}`"
                class="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-default px-4 py-3 transition-colors hover:border-primary/60 hover:bg-elevated/50"
              >
                <UIcon
                  name="i-lucide-calendar-check"
                  class="size-5 shrink-0 text-error"
                />
                <span class="min-w-0 flex-1">
                  <span class="block font-medium text-highlighted group-hover:text-primary">{{ c.titre }}</span>
                  <span class="block text-xs text-muted">
                    {{ c.matiereTitre ?? c.matiere }} · {{ jourLong(c.jour) }}
                  </span>
                </span>
                <UBadge
                  v-if="c.parcours"
                  :label="PARCOURS[c.parcours].court"
                  color="neutral"
                  variant="outline"
                  size="sm"
                />
                <UBadge
                  :color="c.joursRestants < 0 ? 'neutral' : c.joursRestants <= 2 ? 'error' : c.joursRestants <= 7 ? 'warning' : 'neutral'"
                  variant="subtle"
                  :label="echeance(c.joursRestants)"
                />
              </ULink>
            </div>
          </template>
        </section>
      </template>
      <div
        v-else
        class="flex flex-col gap-2"
      >
        <USkeleton class="h-14 w-full" />
        <USkeleton class="h-14 w-full" />
      </div>

      <ControlePlanifier
        v-model:open="planifier"
        @enregistre="refresh()"
      />
    </UPageBody>
  </UPage>
</template>
