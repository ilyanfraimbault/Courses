<script setup lang="ts">
import { fr } from '@nuxt/ui/locale'

definePageMeta({ layout: false })

const route = useRoute()
const { fetch: rafraichirSession, loggedIn } = useUserSession()

const pseudo = ref('')
const motDePasse = ref('')
const erreur = ref<string | null>(null)
const envoi = ref(false)

const suite = computed(() => {
  const s = route.query.suite
  // On n'accepte qu'un chemin interne : une redirection ouverte permettrait
  // d'expédier ailleurs quelqu'un qui vient de se connecter.
  return typeof s === 'string' && s.startsWith('/') && !s.startsWith('//') ? s : '/'
})

watchEffect(() => {
  if (loggedIn.value) navigateTo(suite.value)
})

async function connecter() {
  erreur.value = null
  envoi.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { pseudo: pseudo.value, motDePasse: motDePasse.value }
    })
    await rafraichirSession()
    await navigateTo(suite.value)
  } catch (e) {
    const statut = (e as { statusCode?: number })?.statusCode
    erreur.value = statut === 429
      ? 'Trop de tentatives. Réessaie dans une minute.'
      : 'Pseudo ou mot de passe incorrect.'
    motDePasse.value = ''
  } finally {
    envoi.value = false
  }
}

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
            Connecte-toi pour retrouver ta progression.
          </p>
        </template>

        <form
          class="flex flex-col gap-4"
          @submit.prevent="connecter"
        >
          <UInput
            v-model="pseudo"
            placeholder="Pseudo"
            autocomplete="username"
            size="lg"
            autofocus
            :disabled="envoi"
          />

          <UInput
            v-model="motDePasse"
            type="password"
            placeholder="Mot de passe"
            autocomplete="current-password"
            size="lg"
            :disabled="envoi"
          />

          <UAlert
            v-if="erreur"
            color="error"
            variant="subtle"
            :description="erreur"
            icon="i-lucide-triangle-alert"
          />

          <UButton
            type="submit"
            label="Se connecter"
            size="lg"
            block
            :loading="envoi"
            :disabled="!pseudo || !motDePasse"
          />
        </form>

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
