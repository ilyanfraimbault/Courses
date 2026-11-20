<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ExpandedState, PaginationState } from '@tanstack/vue-table'
import { getPaginationRowModel } from '@tanstack/vue-table'
import type { JourAdmin } from '~~/shared/types/administration'

/**
 * Les jours où le compte a travaillé, du plus récent au plus ancien. Déplier
 * un jour dit ce qui s'y est fait, rangé comme le cours — le même sommaire que
 * l'agenda de l'accueil montre à l'élève.
 */
const props = defineProps<{ jours: JourAdmin[] }>()

const UButton = resolveComponent('UButton')

const deplies = ref<ExpandedState>({})
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: 10 })

const colonnes: TableColumn<JourAdmin>[] = [
  {
    id: 'deplier',
    meta: { class: { th: 'w-10', td: 'w-10' } },
    cell: ({ row }) => h(UButton, {
      'color': 'neutral',
      'variant': 'ghost',
      'size': 'xs',
      'square': true,
      'icon': 'i-lucide-chevron-right',
      'aria-label': row.getIsExpanded() ? 'Replier le jour' : 'Déplier le jour',
      'ui': { leadingIcon: ['transition-transform duration-200', row.getIsExpanded() ? 'rotate-90' : ''] },
      'onClick': () => row.toggleExpanded()
    })
  },
  { id: 'jour', header: 'Jour', cell: ({ row }) => h('span', { class: 'text-default first-letter:uppercase' }, `${jourLong(row.original.jour)} ${row.original.jour.slice(0, 4)}`) },
  { id: 'questions', header: 'Questions', meta: { class: { th: 'text-end', td: 'text-end tabular-nums text-default' } }, cell: ({ row }) => String(row.original.questions) },
  { id: 'reponses', header: 'Justes / fausses', meta: { class: { td: 'min-w-44' } } },
  { id: 'matieres', header: 'Matières', meta: { class: { td: 'whitespace-normal' } } }
]

const total = computed(() => props.jours.length)
</script>

<template>
  <div class="flex flex-col gap-3">
    <UTable
      v-model:expanded="deplies"
      v-model:pagination="pagination"
      class="rounded-md border border-default"
      :data="jours"
      :columns="colonnes"
      :get-row-id="(j: JourAdmin) => j.jour"
      :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
      empty="Aucun jour de travail pour l'instant."
      :ui="{ td: 'py-2 empty:p-0', th: 'py-2.5', tr: 'data-[expanded=true]:bg-elevated/40' }"
    >
      <template #reponses-cell="{ row }">
        <div class="flex items-center gap-2">
          <div
            class="flex h-1.5 w-24 overflow-hidden rounded-full bg-accented"
            :title="`${row.original.justes} justes, ${row.original.fautes} fausses`"
          >
            <div
              class="bg-success"
              :style="{ width: `${proportion(row.original.justes, row.original.justes + row.original.fautes)}%` }"
            />
            <div
              class="bg-error"
              :style="{ width: `${proportion(row.original.fautes, row.original.justes + row.original.fautes)}%` }"
            />
          </div>
          <span class="tabular-nums text-success">{{ row.original.justes }}</span>
          <span class="text-dimmed">/</span>
          <span class="tabular-nums text-error">{{ row.original.fautes }}</span>
        </div>
      </template>

      <template #matieres-cell="{ row }">
        <div class="flex flex-wrap gap-1">
          <UBadge
            v-for="m of row.original.matieres"
            :key="m.chemin ?? m.titre"
            size="sm"
            color="neutral"
            variant="subtle"
            :label="`${m.titre} · ${m.questions}`"
          />
        </div>
      </template>

      <template #expanded="{ row }">
        <ul class="flex flex-col gap-3 whitespace-normal py-1 ps-12 text-sm">
          <li
            v-for="m of row.original.matieres"
            :key="m.chemin ?? m.titre"
          >
            <div class="flex items-center gap-2 font-medium text-highlighted">
              <UIcon
                name="i-lucide-book-open"
                class="size-4 text-primary"
              />
              {{ m.titre }}
              <span class="text-xs font-normal text-dimmed">{{ accorder(m.questions, 'question') }}</span>
            </div>
            <ul class="mt-1 flex flex-col gap-1 border-s border-default ps-4 ms-2">
              <li
                v-for="c of m.chapitres"
                :key="c.chemin ?? c.titre"
              >
                <span class="text-default">{{ c.titre }}</span>
                <span class="ms-1 text-xs text-dimmed">{{ c.questions }}</span>
                <ul class="mt-0.5 flex flex-col gap-0.5 ps-4">
                  <li
                    v-for="f of c.fiches"
                    :key="f.chemin"
                    class="text-muted"
                  >
                    <ULink
                      :to="f.chemin"
                      target="_blank"
                      class="text-default hover:text-primary"
                    >
                      {{ f.titre }}
                    </ULink>
                    <span class="ms-1 text-xs text-dimmed">
                      — {{ f.exercices.map(x => `${x.titre} (${x.questions})`).join(', ') }}
                    </span>
                  </li>
                </ul>
              </li>
            </ul>
          </li>
        </ul>
      </template>
    </UTable>

    <div
      v-if="total > pagination.pageSize"
      class="flex justify-end"
    >
      <UPagination
        :page="pagination.pageIndex + 1"
        :items-per-page="pagination.pageSize"
        :total="total"
        size="sm"
        @update:page="(p: number) => pagination = { ...pagination, pageIndex: p - 1 }"
      />
    </div>
  </div>
</template>
