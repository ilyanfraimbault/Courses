<script setup lang="ts">
import { fr } from '@nuxt/ui/locale'

definePageMeta({ layout: false })

const { loggedIn } = useUserSession()

watchEffect(() => {
  if (loggedIn.value) navigateTo('/')
})

useSeoMeta({ title: 'Créer un compte' })
</script>

<template>
  <UApp :locale="fr">
    <div class="min-h-screen flex items-center justify-center p-4">
      <UCard class="w-full max-w-sm">
        <template #header>
          <h1 class="text-lg font-medium text-highlighted">
            Créer un compte
          </h1>
          <p class="text-sm text-muted mt-1">
            Il te faut le code d'inscription.
          </p>
        </template>

        <InscriptionFormulaire @connecte="navigateTo('/')" />

        <template #footer>
          <p class="text-sm text-muted">
            Déjà un compte ?
            <ULink
              to="/connexion"
              class="text-primary"
            >
              Se connecter
            </ULink>
          </p>
        </template>
      </UCard>
    </div>
  </UApp>
</template>
