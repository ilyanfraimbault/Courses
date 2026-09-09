<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const { fetch: rafraichirSession, loggedIn } = useUserSession()

const motDePasse = ref('')
const erreur = ref<string | null>(null)
const envoi = ref(false)

// Déjà connecté : la page de connexion n'a rien à dire.
watchEffect(() => {
  if (loggedIn.value) navigateTo(suite.value)
})

const suite = computed(() => {
  const s = route.query.suite
  // On n'accepte qu'un chemin interne : une redirection ouverte permettrait
  // d'expédier ailleurs quelqu'un qui vient de se connecter.
  return typeof s === 'string' && s.startsWith('/') && !s.startsWith('//') ? s : '/'
})

async function connecter() {
  erreur.value = null
  envoi.value = true
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { motDePasse: motDePasse.value } })
    await rafraichirSession()
    await navigateTo(suite.value)
  } catch (e) {
    const statut = (e as { statusCode?: number })?.statusCode
    erreur.value = statut === 429
      ? 'Trop de tentatives. Réessaie dans une minute.'
      : 'Mot de passe incorrect.'
    motDePasse.value = ''
  } finally {
    envoi.value = false
  }
}

useSeoMeta({ title: 'Connexion' })
</script>

<template>
  <UApp>
    <div class="min-h-screen flex items-center justify-center p-4">
      <UCard class="w-full max-w-sm">
        <template #header>
          <h1 class="text-lg font-medium text-highlighted">
            Cours
          </h1>
          <p class="text-sm text-muted mt-1">
            Entre le mot de passe pour retrouver ta progression.
          </p>
        </template>

        <form
          class="flex flex-col gap-4"
          @submit.prevent="connecter"
        >
          <UInput
            v-model="motDePasse"
            type="password"
            placeholder="Mot de passe"
            autocomplete="current-password"
            size="lg"
            autofocus
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
            :disabled="!motDePasse"
          />
        </form>
      </UCard>
    </div>
  </UApp>
</template>
