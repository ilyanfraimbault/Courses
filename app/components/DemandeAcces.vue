<script setup lang="ts">
/**
 * Ce qu'un compte sans accès peut faire : demander l'accès, puis voir où en est
 * sa demande. Partagé par la page `/demande` et la fenêtre de connexion.
 *
 * L'état vient de la session, relue en base à chaque lecture : « Vérifier » ne
 * fait que la relire, et l'accès accordé entre-temps se voit aussitôt.
 */
const emit = defineEmits<{ accorde: [] }>()

const { user, fetch: rafraichirSession } = useUserSession()

const MESSAGE_MAX = 500
const message = ref('')
const erreur = ref<string | null>(null)
const envoi = ref(false)
const verifie = ref(false)

const acces = computed(() => user.value?.acces ?? 'aucun')

async function demander() {
  erreur.value = null
  envoi.value = true
  try {
    await $fetch('/api/acces/demande', { method: 'POST', body: { message: message.value } })
    await rafraichirSession()
  } catch (e) {
    erreur.value = (e as { statusMessage?: string })?.statusMessage ?? 'Demande impossible.'
  } finally {
    envoi.value = false
  }
}

async function verifier() {
  envoi.value = true
  try {
    await rafraichirSession()
    verifie.value = true
    if (user.value?.acces === 'accorde') emit('accorde')
  } finally {
    envoi.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-if="acces === 'aucun'">
      <p class="text-sm text-muted">
        Ton compte <strong class="text-highlighted">{{ user?.pseudo }}</strong> est créé, mais il
        n'ouvre rien, pas même les cours, tant que l'administration ne l'a pas accepté.
      </p>

      <form
        class="flex flex-col gap-4"
        @submit.prevent="demander"
      >
        <div>
          <UTextarea
            v-model="message"
            placeholder="Qui es-tu ? (facultatif)"
            :rows="3"
            :maxlength="MESSAGE_MAX"
            autoresize
            class="w-full"
            :disabled="envoi"
          />
          <p class="mt-1 text-xs text-dimmed">
            Un mot pour que l'administration te reconnaisse.
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
          label="Demander l'accès"
          icon="i-lucide-send"
          size="lg"
          block
          :loading="envoi"
        />
      </form>
    </template>

    <template v-else-if="acces === 'demande'">
      <UAlert
        color="primary"
        variant="subtle"
        icon="i-lucide-hourglass"
        title="Demande envoyée"
        description="L'administration doit l'accepter. Reviens plus tard : ton accès s'ouvrira sans que tu aies à te reconnecter."
      />

      <p
        v-if="verifie"
        class="text-sm text-muted"
      >
        Toujours en attente.
      </p>

      <UButton
        label="Vérifier"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        block
        :loading="envoi"
        @click="verifier"
      />
    </template>

    <UAlert
      v-else
      color="success"
      variant="subtle"
      icon="i-lucide-check"
      title="Accès accordé"
    />
  </div>
</template>
