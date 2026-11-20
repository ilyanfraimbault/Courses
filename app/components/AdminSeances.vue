<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { PaginationState, SortingState } from '@tanstack/vue-table'
import { getPaginationRowModel } from '@tanstack/vue-table'
import type { SeanceAdmin } from '~~/shared/types/administration'

/** Les séances de quiz et les copies de QCM d'un compte, avec leur score. */
const props = defineProps<{
  seances: SeanceAdmin[]
  maintenant: number
}>()

const triable = useColonneTriable()

const TYPES: Record<SeanceAdmin['type'], { libelle: string, couleur: 'primary' | 'info' | 'neutral', icone: string }> = {
  'quiz': { libelle: 'Quiz', couleur: 'primary', icone: 'i-lucide-zap' },
  'qcm': { libelle: 'QCM', couleur: 'info', icone: 'i-lucide-list-checks' },
  'qcm-compose': { libelle: 'QCM composé', couleur: 'neutral', icone: 'i-lucide-layers' }
}

const filtreType = ref<'tous' | SeanceAdmin['type']>('tous')
const types = computed(() => [
  { label: 'Tout', value: 'tous', badge: props.seances.length },
  ...(Object.keys(TYPES) as SeanceAdmin['type'][])
    .map(t => ({ label: TYPES[t].libelle, value: t, badge: props.seances.filter(s => s.type === t).length }))
    .filter(t => t.badge)
])
const filtres = computed(() => filtreType.value === 'tous' ? [] : [{ id: 'type', value: filtreType.value }])

const tri = ref<SortingState>([{ id: 't', desc: true }])
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: 10 })
watch(filtreType, () => {
  pagination.value = { ...pagination.value, pageIndex: 0 }
})

const affichees = computed(() => filtreType.value === 'tous' ? props.seances.length : props.seances.filter(s => s.type === filtreType.value).length)

const colonnes: TableColumn<SeanceAdmin>[] = [
  { id: 'type', accessorKey: 'type', header: 'Type', filterFn: 'equals' },
  { id: 'titre', header: 'Sur quoi', meta: { class: { td: 'whitespace-normal min-w-64' } } },
  { id: 't', accessorKey: 't', ...triable('Quand', { decroissantDAbord: true }) },
  { id: 'score', accessorFn: s => (s.total ? s.justes / s.total : 0), ...triable('Score', { decroissantDAbord: true }) },
  { id: 'etat', header: 'État' }
]
</script>

<template>
  <div class="flex flex-col gap-3">
    <UTabs
      v-if="types.length > 2"
      v-model="filtreType"
      :items="types"
      :content="false"
      size="xs"
      variant="pill"
      class="w-full sm:w-auto sm:self-start"
    />

    <UTable
      v-model:sorting="tri"
      v-model:pagination="pagination"
      class="rounded-md border border-default"
      :data="seances"
      :columns="colonnes"
      :column-filters="filtres"
      :get-row-id="(s: SeanceAdmin) => s.cle"
      :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
      empty="Ni quiz ni QCM pour l'instant."
      :ui="{ td: 'py-2', th: 'py-2.5' }"
    >
      <template #type-cell="{ row }">
        <UBadge
          size="sm"
          variant="subtle"
          :color="TYPES[row.original.type].couleur"
          :icon="TYPES[row.original.type].icone"
          :label="TYPES[row.original.type].libelle"
        />
      </template>

      <template #titre-cell="{ row }">
        <ULink
          v-if="row.original.lien"
          :to="row.original.lien"
          target="_blank"
          class="font-medium text-default hover:text-primary"
        >
          {{ row.original.titre }}
        </ULink>
        <span
          v-else
          class="font-medium text-default"
        >{{ row.original.titre }}</span>
        <div
          v-if="row.original.detail"
          class="text-xs text-dimmed"
        >
          {{ row.original.detail }}
        </div>
      </template>

      <template #t-cell="{ row }">
        <span
          class="text-default"
          :title="dateEtHeure(row.original.t)"
        >{{ depuisQuand(row.original.t, maintenant) }}</span>
      </template>

      <template #score-cell="{ row }">
        <span
          v-if="!row.original.total"
          class="text-dimmed"
        >rien répondu</span>
        <div
          v-else
          class="flex items-center gap-2"
        >
          <span class="tabular-nums text-default">{{ row.original.justes }} / {{ row.original.total }}</span>
          <UBadge
            size="sm"
            variant="subtle"
            :color="couleurScore(proportion(row.original.justes, row.original.total))"
            :label="`${proportion(row.original.justes, row.original.total)} %`"
          />
        </div>
      </template>

      <template #etat-cell="{ row }">
        <template v-if="row.original.type === 'quiz'">
          <span
            v-if="row.original.finieLe"
            class="text-success"
          >finie</span>
          <span
            v-else
            class="text-muted"
          >en cours</span>
          <span class="ms-1 text-xs text-dimmed">· {{ accorder(row.original.taille ?? 0, 'question demandée', 'questions demandées') }}</span>
        </template>
        <span
          v-else
          class="text-dimmed"
        >copie rendue</span>
      </template>
    </UTable>

    <div
      v-if="affichees > pagination.pageSize"
      class="flex justify-end"
    >
      <UPagination
        :page="pagination.pageIndex + 1"
        :items-per-page="pagination.pageSize"
        :total="affichees"
        size="sm"
        @update:page="(p: number) => pagination = { ...pagination, pageIndex: p - 1 }"
      />
    </div>
  </div>
</template>
