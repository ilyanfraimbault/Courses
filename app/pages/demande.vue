<script setup lang="ts">
import { fr } from '@nuxt/ui/locale'

definePageMeta({ layout: false })

/**
 * Où arrive un compte sans accès qui ouvre une page de travail : il n'y a
 * pas de page en dessous où rester. Le middleware y renvoie, et en éloigne
 * un compte dont l'accès est accordé.
 */
const { user, clear } = useUserSession()

watchEffect(() => {
  if (user.value?.acces === 'accorde') navigateTo('/')
})

async function deconnecter() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  reloadNuxtApp({ path: '/connexion' })
}

useSeoMeta({ title: 'Demande d\'accès' })
</script>

<template>
  <UApp :locale="fr">
    <div class="min-h-screen flex items-center justify-center p-4">
      <UCard class="w-full max-w-sm">
        <template #header>
          <h1 class="text-lg font-medium text-highlighted">
            Demande d'accès
          </h1>
        </template>

        <DemandeAcces @accorde="navigateTo('/')" />

        <template #footer>
          <div class="flex items-center justify-end gap-2 text-sm">
            <ULink
              as="button"
              class="text-muted"
              @click="deconnecter"
            >
              Se déconnecter
            </ULink>
          </div>
        </template>
      </UCard>
    </div>
  </UApp>
</template>
