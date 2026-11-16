<script setup lang="ts">
import { fr } from '@nuxt/ui/locale'

definePageMeta({ layout: false })

const { loggedIn } = useUserSession()
const autorise = useAccesAccorde()

// Sans code d'invitation, le compte tout neuf n'a pas d'accès : c'est sa
// demande qu'on lui montre, pas un accueil qui le renverrait aussitôt.
const suite = () => navigateTo(autorise.value ? '/' : PAGE_DEMANDE)

watchEffect(() => {
  if (loggedIn.value) suite()
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
            Sans code d'invitation, l'administration devra accepter ton compte.
          </p>
        </template>

        <InscriptionFormulaire @connecte="suite" />

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
