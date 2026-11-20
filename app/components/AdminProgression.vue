<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ExpandedState } from '@tanstack/vue-table'
import type { LigneProgressionAdmin } from '~~/shared/types/administration'

/**
 * L'arbre de progression d'un compte : matière › chapitre › fiche › exercice,
 * chaque niveau avec ce qui est trouvé, raté, et quand on y est passé. Un
 * tableau arborescent (`get-sub-rows`) dans son propre `UTable` : sur le
 * tableau des comptes, déplier une branche ouvrirait aussi le détail de la
 * ligne.
 */
const props = defineProps<{
  lignes: LigneProgressionAdmin[]
  maintenant: number
}>()

/**
 * Par défaut, ce qui a été travaillé : un compte qui n'a ouvert que deux fiches
 * ne doit pas se lire au milieu de six cents exercices vides.
 */
const travailleSeulement = ref(true)

function travaille(l: LigneProgressionAdmin) {
  return l.trouvees + l.fautes > 0 || l.derniere !== null
}

function elaguer(lignes: LigneProgressionAdmin[]): LigneProgressionAdmin[] {
  return lignes.filter(travaille).map(l => (l.enfants ? { ...l, enfants: elaguer(l.enfants) } : l))
}

const donnees = computed(() => travailleSeulement.value ? elaguer(props.lignes) : props.lignes)

// Les matières dépliées d'emblée : c'est le premier niveau qui dit quelque chose.
const deplies = ref<ExpandedState>(Object.fromEntries(props.lignes.map(l => [l.cle, true])))

const ICONES: Record<LigneProgressionAdmin['niveau'], string> = {
  matiere: 'i-lucide-book-open',
  chapitre: 'i-lucide-folder',
  fiche: 'i-lucide-file-text',
  exercice: 'i-lucide-pencil-line'
}

const colonnes: TableColumn<LigneProgressionAdmin>[] = [
  { id: 'titre', header: 'Où', meta: { class: { td: 'whitespace-normal min-w-72' } } },
  { id: 'trouvees', header: 'Trouvées', meta: { class: { td: 'min-w-52' } } },
  { id: 'fautes', header: 'Fautes', meta: { class: { th: 'text-end', td: 'text-end tabular-nums' } } },
  { id: 'dette', header: 'En dette', meta: { class: { th: 'text-end', td: 'text-end' } } },
  { id: 'derniere', header: 'Dernier passage', meta: { class: { th: 'text-end', td: 'text-end' } } }
]
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-3">
      <USwitch
        v-model="travailleSeulement"
        size="sm"
        label="Seulement ce qui a été travaillé"
      />
      <div class="ms-auto flex gap-1">
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-chevrons-up-down"
          label="Tout déplier"
          @click="deplies = true"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-chevrons-down-up"
          label="Tout replier"
          @click="deplies = {}"
        />
      </div>
    </div>

    <UTable
      v-model:expanded="deplies"
      sticky
      class="max-h-[32rem] rounded-md border border-default"
      :data="donnees"
      :columns="colonnes"
      :get-sub-rows="(l: LigneProgressionAdmin) => l.enfants"
      :get-row-id="(l: LigneProgressionAdmin) => l.cle"
      empty="Rien de travaillé pour l'instant."
      :ui="{
        base: 'border-separate border-spacing-0',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        tr: 'group',
        th: 'py-2.5',
        td: 'py-2 empty:p-0 group-has-[td:not(:empty)]:border-b border-default'
      }"
    >
      <template #titre-cell="{ row }">
        <div
          class="flex items-center gap-2"
          :style="{ paddingInlineStart: `${row.depth * 1.25}rem` }"
        >
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            square
            icon="i-lucide-chevron-right"
            :class="row.getCanExpand() ? '' : 'invisible'"
            :ui="{ leadingIcon: ['transition-transform duration-200', row.getIsExpanded() ? 'rotate-90' : ''] }"
            :aria-label="row.getIsExpanded() ? 'Replier' : 'Déplier'"
            @click="row.toggleExpanded()"
          />
          <UIcon
            :name="ICONES[row.original.niveau]"
            class="size-4 shrink-0"
            :class="row.original.niveau === 'matiere' ? 'text-primary' : 'text-dimmed'"
          />
          <ULink
            v-if="row.original.lien && row.original.niveau !== 'exercice'"
            :to="row.original.lien"
            target="_blank"
            class="hover:text-primary"
            :class="row.depth === 0 ? 'font-semibold text-highlighted' : 'text-default'"
          >
            {{ row.original.titre }}
          </ULink>
          <span
            v-else
            :class="row.depth === 0 ? 'font-semibold text-highlighted' : 'text-default'"
          >{{ row.original.titre }}</span>
        </div>
      </template>

      <template #trouvees-cell="{ row }">
        <div class="flex items-center gap-3">
          <UProgress
            class="w-24"
            size="sm"
            :color="row.original.trouvees === row.original.questions ? 'success' : 'primary'"
            :model-value="row.original.trouvees"
            :max="row.original.questions || 1"
          />
          <span class="tabular-nums text-default">{{ row.original.trouvees }} / {{ row.original.questions }}</span>
        </div>
      </template>

      <template #fautes-cell="{ row }">
        <span :class="row.original.fautes ? 'text-default' : 'text-dimmed'">{{ row.original.fautes }}</span>
      </template>

      <template #dette-cell="{ row }">
        <UBadge
          v-if="row.original.enDette"
          size="sm"
          color="warning"
          variant="subtle"
          :label="String(row.original.enDette)"
        />
        <span
          v-else
          class="text-dimmed"
        >0</span>
      </template>

      <template #derniere-cell="{ row }">
        <span
          :class="row.original.derniere ? 'text-default' : 'text-dimmed'"
          :title="row.original.derniere ? dateEtHeure(row.original.derniere) : undefined"
        >
          {{ row.original.derniere ? depuisQuand(row.original.derniere, maintenant) : '—' }}
        </span>
      </template>
    </UTable>
  </div>
</template>
