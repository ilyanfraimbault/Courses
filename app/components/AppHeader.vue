<script setup lang="ts">
const sommaire = useSommaire()

const { header } = useAppConfig()
const { loggedIn, user, clear } = useUserSession()

const liens = [
  { label: 'Cours', to: '/cours', icon: 'i-lucide-library' },
  { label: 'Quiz', to: '/quiz', icon: 'i-lucide-zap' },
  { label: 'Mes QCM', to: '/mes-qcm', icon: 'i-lucide-list-plus' },
  { label: 'Ma to-do', to: '/ma-to-do', icon: 'i-lucide-list-checks' },
  { label: 'Mes domaines', to: '/mes-domaines', icon: 'i-lucide-target' },
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

      <!-- Six entrées ne tiennent pas avec leur libellé avant les grands
           écrans : en dessous, l'icône seule, et le libellé en info-bulle. -->
      <div
        v-if="loggedIn"
        class="hidden items-center gap-1 sm:flex"
      >
        <UButton
          v-for="lien of liens"
          :key="lien.to"
          :to="lien.to"
          :icon="lien.icon"
          :aria-label="lien.label"
          :title="lien.label"
          color="neutral"
          variant="ghost"
          size="sm"
          :ui="{ label: 'hidden xl:inline' }"
          :label="lien.label"
        />
      </div>

      <UColorModeButton v-if="header?.colorMode" />

      <UButton
        v-if="loggedIn"
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-log-out"
        :label="user?.pseudo"
        :aria-label="`Se déconnecter de ${user?.pseudo}`"
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
