<script setup lang="ts">
import { fr } from '@nuxt/ui/locale'

definePageMeta({ layout: false })

const { fetch: rafraichirSession, loggedIn } = useUserSession()

const pseudo = ref('')
const motDePasse = ref('')
const code = ref('')
const erreur = ref<string | null>(null)
const envoi = ref(false)

watchEffect(() => {
  if (loggedIn.value) navigateTo('/')
})

const MOT_DE_PASSE_MIN = 8
const assezLong = computed(() => motDePasse.value.length >= MOT_DE_PASSE_MIN)

async function inscrire() {
  erreur.value = null
  envoi.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: { pseudo: pseudo.value, motDePasse: motDePasse.value, code: code.value }
    })
    await rafraichirSession()
    await navigateTo('/')
  } catch (e) {
    const err = e as { statusCode?: number, statusMessage?: string }
    // Le serveur dit précisément ce qui ne va pas — pseudo pris, code faux,
    // mot de passe trop court : le recopier vaut mieux qu'un message générique.
    erreur.value = err?.statusMessage ?? 'Inscription impossible.'
  } finally {
    envoi.value = false
  }
}

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

        <form
          class="flex flex-col gap-4"
          @submit.prevent="inscrire"
        >
          <UInput
            v-model="pseudo"
            placeholder="Pseudo"
            autocomplete="username"
            size="lg"
            autofocus
            :disabled="envoi"
          />

          <div>
            <UInput
              v-model="motDePasse"
              type="password"
              placeholder="Mot de passe"
              autocomplete="new-password"
              size="lg"
              class="w-full"
              :disabled="envoi"
            />
            <p
              class="mt-1 text-xs"
              :class="assezLong ? 'text-muted' : 'text-dimmed'"
            >
              {{ MOT_DE_PASSE_MIN }} caractères minimum.
            </p>
          </div>

          <UInput
            v-model="code"
            placeholder="Code d'inscription"
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
            label="Créer mon compte"
            size="lg"
            block
            :loading="envoi"
            :disabled="!pseudo || !assezLong || !code"
          />
        </form>

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
