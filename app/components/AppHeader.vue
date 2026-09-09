<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'

const navigation = inject<Ref<ContentNavigationItem[]>>('navigation')

const { header } = useAppConfig()
const { loggedIn, clear } = useUserSession()

const liens = [
  { label: 'Cours', to: '/cours', icon: 'i-lucide-library' },
  { label: 'Ma to-do', to: '/ma-to-do', icon: 'i-lucide-list-checks' },
  { label: 'Mes résultats', to: '/mes-resultats', icon: 'i-lucide-chart-line' }
]

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

      <UButton
        v-if="loggedIn"
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-log-out"
        aria-label="Se déconnecter"
        title="Se déconnecter"
        @click="deconnecter"
      />

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

      <UContentNavigation
        highlight
        :navigation="navigation"
      />
    </template>
  </UHeader>
</template>
