<script setup lang="ts">
/**
 * Le formulaire de connexion, seul. La page `/connexion` et la fenêtre ouverte
 * par-dessus une fiche le partagent : chacune décide de ce qui suit, celle-là
 * en changeant de page, celle-ci en rendant la main à la page où l'on était.
 */
const emit = defineEmits<{ connecte: [] }>()

const { fetch: rafraichirSession } = useUserSession()

const pseudo = ref('')
const motDePasse = ref('')
const erreur = ref<string | null>(null)
const envoi = ref(false)

async function connecter() {
  erreur.value = null
  envoi.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { pseudo: pseudo.value, motDePasse: motDePasse.value }
    })
    await rafraichirSession()
    emit('connecte')
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
</script>

<template>
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
</template>
