<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const sommaire = useSommaire()

const { header } = useAppConfig()
const { loggedIn, user, clear } = useUserSession()

/**
 * Seuls les deux lieux où l'on travaille restent dans la barre : le cours qu'on
 * lit, le quiz qu'on lance. Tout ce qui est à soi — ce qu'on a composé, prévu ou
 * mesuré — passe sous le profil, comme sur la plupart des sites : sept entrées
 * côte à côte ne tenaient qu'en icônes muettes avant les grands écrans.
 */
const liens = [
  { label: 'Cours', to: '/cours', icon: 'i-lucide-library' },
  { label: 'Quiz', to: '/quiz', icon: 'i-lucide-zap' }
]

const menu = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: user.value?.pseudo, icon: 'i-lucide-circle-user' }],
  [
    { label: 'Mes contrôles', to: '/mes-controles', icon: 'i-lucide-calendar-check' },
    { label: 'Mes QCM', to: '/mes-qcm', icon: 'i-lucide-list-plus' },
    { label: 'Ma to-do', to: '/ma-to-do', icon: 'i-lucide-list-checks' }
  ],
  [
    { label: 'Mes domaines', to: '/mes-domaines', icon: 'i-lucide-target' },
    { label: 'Mes résultats', to: '/mes-resultats', icon: 'i-lucide-chart-line' }
  ],
  [{ label: 'Se déconnecter', icon: 'i-lucide-log-out', onSelect: deconnecter }]
])

async function deconnecter() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await navigateTo('/connexion')
}
</script>

<template>
  <UHeader
    :ui="{ center: 'flex-1' }"
    :to="header?.to || '/'"
  >
    <UContentSearchButton
      v-if="header?.search"
      :collapsed="false"
      class="w-full"
    />

    <template #title>
      <span class="font-medium">{{ header?.title }}</span>
    </template>

    <template #right>
      <UContentSearchButton
        v-if="header?.search"
        class="lg:hidden"
      />

      <div
        v-if="loggedIn"
        class="hidden items-center gap-1 sm:flex"
      >
        <UButton
          v-for="lien of liens"
          :key="lien.to"
          v-bind="lien"
          color="neutral"
          variant="ghost"
          size="sm"
        />
      </div>

      <UColorModeButton v-if="header?.colorMode" />

      <UDropdownMenu
        v-if="loggedIn"
        :items="menu"
        :content="{ align: 'end' }"
        :ui="{ content: 'w-56' }"
      >
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-circle-user"
          :label="user?.pseudo"
          trailing-icon="i-lucide-chevron-down"
          :ui="{ label: 'hidden sm:inline' }"
          :aria-label="`Menu de ${user?.pseudo}`"
        />
      </UDropdownMenu>

      <template v-if="header?.links">
        <UButton
          v-for="(link, index) of header.links"
          :key="index"
          v-bind="{ color: 'neutral', variant: 'ghost', ...link }"
        />
      </template>
    </template>

    <template #body>
      <div
        v-if="loggedIn"
        class="mb-4 flex flex-col gap-1 sm:hidden"
      >
        <UButton
          v-for="lien of liens"
          :key="lien.to"
          v-bind="lien"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
        />
      </div>

      <ULink
        :to="sommaire.chemin"
        class="mb-2 block"
      >
        <span
          v-if="sommaire.annee"
          class="block text-xs font-medium uppercase tracking-wide text-dimmed"
        >{{ sommaire.annee }}</span>
        <span class="block text-sm font-semibold text-highlighted">{{ sommaire.titre }}</span>
      </ULink>

      <UContentNavigation
        highlight
        :navigation="sommaire.liens"
      />
    </template>
  </UHeader>
</template>
