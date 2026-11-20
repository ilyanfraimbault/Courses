<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { DetailUtilisateurAdministration, UtilisateurAdministration } from '~~/shared/types/administration'

/**
 * Ce qu'on lit d'un compte en dépliant sa ligne, et que la ligne ne dit pas
 * déjà : ses chiffres restent dans leurs colonnes, le détail ne les répète
 * pas. Lu à l'ouverture et pas avant : il relit toute l'histoire du compte,
 * et la liste n'en a pas besoin pour s'afficher.
 */
const props = defineProps<{
  utilisateur: UtilisateurAdministration
  maintenant: number
}>()

const { data, status, error, refresh } = useLazyFetch<DetailUtilisateurAdministration>(
  () => `/api/admin/utilisateurs/${props.utilisateur.id}`,
  { server: false, query: { fuseau: fuseauLocal() }, key: `admin-compte-${props.utilisateur.id}` }
)

const onglets = computed<TabsItem[]>(() => [
  { label: 'Progression', icon: 'i-lucide-list-tree', slot: 'progression' as const, value: 'progression' },
  { label: 'Jours de travail', icon: 'i-lucide-calendar-days', slot: 'jours' as const, value: 'jours', badge: data.value?.jours.length || undefined },
  { label: 'Quiz et QCM', icon: 'i-lucide-zap', slot: 'seances' as const, value: 'seances', badge: data.value?.seances.length || undefined },
  { label: 'Le reste', icon: 'i-lucide-archive', slot: 'reste' as const, value: 'reste' }
])
</script>

<template>
  <!-- `w-0 min-w-full` : le détail prend la largeur de la ligne sans l'imposer.
       Sans cela, une liste d'exercices un peu longue élargirait tout le tableau
       des comptes, et ses dernières colonnes sortiraient de l'écran. -->
  <div class="w-0 min-w-full whitespace-normal px-2 py-3 sm:px-4">
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Détail illisible"
      :description="error.statusMessage || 'Le serveur n\'a pas répondu.'"
      :actions="[{ label: 'Réessayer', onClick: () => refresh() }]"
    />

    <USkeleton
      v-else-if="!data && status !== 'success'"
      class="h-64 w-full"
    />

    <UTabs
      v-else-if="data"
      :items="onglets"
      size="sm"
      default-value="progression"
      :ui="{ list: 'overflow-x-auto', content: 'pt-3' }"
    >
      <template #progression>
        <AdminProgression
          :lignes="data.progression"
          :maintenant="maintenant"
        />
      </template>

      <template #jours>
        <AdminJours :jours="data.jours" />
      </template>

      <template #seances>
        <AdminSeances
          :seances="data.seances"
          :maintenant="maintenant"
        />
      </template>

      <template #reste>
        <AdminReste
          :clotures="data.clotures"
          :controles="data.controles"
          :notes-saisies="data.notesSaisies"
        />
      </template>
    </UTabs>
  </div>
</template>
