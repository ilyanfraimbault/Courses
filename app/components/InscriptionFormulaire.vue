<script setup lang="ts">
/** Le formulaire d'inscription, partagé par la page `/inscription` et la fenêtre de connexion. */
const emit = defineEmits<{ connecte: [] }>()

const { fetch: rafraichirSession } = useUserSession()

const pseudo = ref('')
const motDePasse = ref('')
const code = ref('')
const erreur = ref<string | null>(null)
const envoi = ref(false)

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
    emit('connecte')
  } catch (e) {
    const err = e as { statusCode?: number, statusMessage?: string }
    // Le serveur dit précisément ce qui ne va pas — pseudo pris, code faux,
    // mot de passe trop court : le recopier vaut mieux qu'un message générique.
    erreur.value = err?.statusMessage ?? 'Inscription impossible.'
  } finally {
    envoi.value = false
  }
}
</script>

<template>
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

    <div>
      <UInput
        v-model="code"
        placeholder="Code d'invitation (facultatif)"
        size="lg"
        class="w-full"
        :disabled="envoi"
      />
      <p class="mt-1 text-xs text-dimmed">
        Sans code, ton compte attendra l'accord de l'administration.
      </p>
    </div>

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
      :disabled="!pseudo || !assezLong"
    />
  </form>
</template>
