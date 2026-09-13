<script setup lang="ts">
import type { ResumeQcmCompose } from '~~/shared/types/mes-qcm'

definePageMeta({ layout: 'cours' })

/**
 * Les QCM composés sont des données du compte : ils se lisent au montage,
 * jamais au rendu serveur, comme tout ce qui appartient à quelqu'un ici.
 */
const { data: qcms } = await useLazyFetch<ResumeQcmCompose[]>('/api/mes-qcm', { server: false })

/** Les QCM rangés par matière, dans l'ordre où la liste les rend : le plus récent d'abord. */
const groupes = computed(() => {
  const parMatiere = new Map<string, { cle: string, titre: string, annee: string | null, qcms: ResumeQcmCompose[] }>()
  for (const qcm of qcms.value ?? []) {
    const groupe = parMatiere.get(qcm.matiere)
      ?? { cle: qcm.matiere, titre: qcm.matiereTitre ?? qcm.matiere, annee: qcm.annee, qcms: [] }
    groupe.qcms.push(qcm)
    parMatiere.set(qcm.matiere, groupe)
  }
  return [...parMatiere.values()]
})

function dateCourte(t: number) {
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function tonNote(c: { justes: number, total: number }) {
  const p = c.total ? 100 * c.justes / c.total : 0
  if (p >= 80) return 'success'
  if (p >= 50) return 'warning'
  return 'error'
}

useSeoMeta({ title: 'Mes QCM' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Mes QCM"
      description="Des QCM composés à partir des questions des fiches. On choisit les questions — tirées comme pour un quiz, ou prises une à une —, et le QCM devient une page fixe : toutes les questions d'un coup, on répond à tout, puis on corrige."
    >
      <template #headline>
        <UBadge
          color="warning"
          variant="subtle"
          size="md"
          icon="i-lucide-list-plus"
          label="QCM composés"
        />
      </template>
      <template #links>
        <UButton
          to="/mes-qcm/nouveau"
          icon="i-lucide-plus"
          label="Composer un QCM"
          color="primary"
        />
      </template>
    </UPageHeader>

    <UPageBody>
      <!-- Branché sur les données et non sur l'état de chargement, pour que le
           rendu serveur et le premier rendu client coïncident. -->
      <template v-if="qcms">
        <div
          v-if="!qcms.length"
          class="rounded-xl border border-dashed border-default px-5 py-10 text-center"
        >
          <UIcon
            name="i-lucide-list-plus"
            class="size-8 text-dimmed"
          />
          <p class="mt-3 mb-0 font-medium text-highlighted">
            Aucun QCM pour l'instant
          </p>
          <p class="mx-auto mt-1 mb-0 max-w-md text-sm text-muted">
            Un QCM composé ne recopie aucune question : il les emprunte aux fiches. Corriger un cours
            corrige donc aussi tous les QCM qui en empruntent les questions.
          </p>
          <UButton
            class="mt-5"
            to="/mes-qcm/nouveau"
            icon="i-lucide-plus"
            label="Composer mon premier QCM"
          />
        </div>

        <section
          v-for="groupe in groupes"
          :key="groupe.cle"
          class="mt-8 first:mt-0"
        >
          <p
            v-if="groupe.annee"
            class="m-0 text-xs font-medium uppercase tracking-wide text-dimmed"
          >
            {{ groupe.annee }}
          </p>
          <h2 class="m-0 text-lg font-medium text-highlighted">
            {{ groupe.titre }}
          </h2>

          <div class="mt-3 flex flex-col gap-2">
            <ULink
              v-for="qcm in groupe.qcms"
              :key="qcm.id"
              :to="`/mes-qcm/${qcm.id}`"
              class="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-default px-4 py-3 transition-colors hover:border-primary/60 hover:bg-elevated/50"
            >
              <UIcon
                name="i-lucide-circle-check-big"
                class="size-5 shrink-0 text-primary"
              />
              <span class="min-w-0 flex-1">
                <span class="block font-medium text-highlighted">{{ qcm.titre }}</span>
                <span class="block text-xs text-muted">
                  {{ qcm.questions }} question{{ qcm.questions > 1 ? 's' : '' }}
                  <template v-if="qcm.manquantes">
                    · <span class="text-warning">{{ qcm.manquantes }} disparue{{ qcm.manquantes > 1 ? 's' : '' }} du contenu</span>
                  </template>
                  · composé le {{ dateCourte(qcm.cree_le) }}
                </span>
              </span>
              <span
                v-if="qcm.derniere"
                class="flex shrink-0 items-center gap-2"
              >
                <span class="text-xs text-dimmed">
                  {{ qcm.copies }} passage{{ qcm.copies > 1 ? 's' : '' }}
                </span>
                <UBadge
                  :color="tonNote(qcm.derniere)"
                  variant="subtle"
                  size="sm"
                  class="tabular-nums"
                  :label="`${qcm.derniere.justes} / ${qcm.derniere.total}`"
                />
              </span>
              <span
                v-else
                class="shrink-0 text-xs text-dimmed"
              >Jamais passé</span>
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
        <USkeleton class="h-14 w-full" />
        <USkeleton class="h-14 w-full" />
      </div>
    </UPageBody>
  </UPage>
</template>
