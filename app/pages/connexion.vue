<script setup lang="ts">
import { fr } from '@nuxt/ui/locale'

definePageMeta({ layout: false })

/**
 * La page reste pour ce qu'aucune fenêtre ne peut couvrir : arriver par une
 * adresse réservée sans session. Il n'y a alors pas de page en dessous où
 * rester ; depuis une fiche, c'est la fenêtre de connexion qui s'ouvre.
 */
const route = useRoute()
const { loggedIn } = useUserSession()

const suite = computed(() => {
  const s = route.query.suite
  // On n'accepte qu'un chemin interne : une redirection ouverte permettrait
  // d'expédier ailleurs quelqu'un qui vient de se connecter. Une route d'API
  // n'est pas une page : ouverte sans session, elle mène ici, et s'y faire
  // renvoyer après la connexion n'afficherait qu'un JSON brut.
  return typeof s === 'string' && s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/api/') ? s : '/'
})

watchEffect(() => {
  if (loggedIn.value) navigateTo(suite.value)
})

useSeoMeta({ title: 'Connexion' })
</script>

<template>
  <UApp :locale="fr">
    <div class="min-h-screen flex items-center justify-center p-4">
      <UCard class="w-full max-w-sm">
        <template #header>
          <h1 class="text-lg font-medium text-highlighted">
            Cours
          </h1>
          <p class="text-sm text-muted mt-1">
            Connecte-toi pour lire les cours et retrouver ta progression.
          </p>
        </template>

        <ConnexionFormulaire @connecte="navigateTo(suite)" />

        <template #footer>
          <p class="text-sm text-muted">
            Pas encore de compte ?
            <ULink
              to="/inscription"
              class="text-primary"
            >
              En créer un
            </ULink>
          </p>
        </template>
      </UCard>
    </div>
  </UApp>
</template>
