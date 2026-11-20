<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ClotureAdmin, ControlePoseAdmin } from '~~/shared/types/administration'
import { PARCOURS } from '~~/shared/types/matieres'

/** Ce que le compte a déclaré fini, et les contrôles qu'il a posés pour la classe. */
defineProps<{
  clotures: ClotureAdmin[]
  controles: ControlePoseAdmin[]
  notesSaisies: number
}>()

const NATURES: Record<ClotureAdmin['nature'], string> = { matiere: 'Matière', chapitre: 'Chapitre', fiche: 'Fiche' }

const colonnesClotures: TableColumn<ClotureAdmin>[] = [
  { id: 'nature', header: 'Quoi' },
  { id: 'titre', header: 'Intitulé', meta: { class: { td: 'whitespace-normal' } } },
  { id: 'closeLe', header: 'Clos le', cell: ({ row }) => dateCourte(row.original.closeLe) }
]

const colonnesControles: TableColumn<ControlePoseAdmin>[] = [
  { id: 'jour', header: 'Jour', cell: ({ row }) => h('span', { class: 'text-default first-letter:uppercase' }, `${jourLong(row.original.jour)} ${row.original.jour.slice(0, 4)}`) },
  { id: 'titre', header: 'Contrôle', meta: { class: { td: 'whitespace-normal text-default' } }, cell: ({ row }) => row.original.titre },
  { id: 'matiere', header: 'Matière', meta: { class: { td: 'whitespace-normal' } }, cell: ({ row }) => row.original.matiere },
  { id: 'parcours', header: 'Pour', cell: ({ row }) => (row.original.parcours ? PARCOURS[row.original.parcours].court : 'toute la classe') }
]
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-2">
    <section>
      <h3 class="mb-2 text-sm font-semibold text-highlighted">
        Ce qu'il a clos
      </h3>
      <UTable
        class="rounded-md border border-default"
        :data="clotures"
        :columns="colonnesClotures"
        :get-row-id="(c: ClotureAdmin) => c.chemin"
        empty="Rien de clos."
        :ui="{ td: 'py-2', th: 'py-2.5' }"
      >
        <template #nature-cell="{ row }">
          <UBadge
            size="sm"
            color="neutral"
            variant="subtle"
            :label="NATURES[row.original.nature]"
          />
        </template>
        <template #titre-cell="{ row }">
          <ULink
            :to="row.original.chemin"
            target="_blank"
            class="text-default hover:text-primary"
          >
            {{ row.original.titre }}
          </ULink>
        </template>
      </UTable>
    </section>

    <section>
      <h3 class="mb-2 text-sm font-semibold text-highlighted">
        Contrôles posés dans l'agenda
      </h3>
      <UTable
        class="rounded-md border border-default"
        :data="controles"
        :columns="colonnesControles"
        :get-row-id="(c: ControlePoseAdmin) => String(c.id)"
        empty="Aucun contrôle posé."
        :ui="{ td: 'py-2', th: 'py-2.5' }"
      />
    </section>

    <p class="text-sm text-muted lg:col-span-2">
      <UIcon
        name="i-lucide-calculator"
        class="me-1 size-4 align-text-bottom text-dimmed"
      />
      {{ notesSaisies ? `${accorder(notesSaisies, 'moyenne saisie', 'moyennes saisies')} dans « Mes moyennes ».` : 'Aucune moyenne saisie dans « Mes moyennes ».' }}
      Les notes elles-mêmes restent à l'élève.
    </p>
  </div>
</template>
