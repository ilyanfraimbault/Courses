<script setup lang="ts">
/**
 * La connexion et l'inscription par-dessus la page. Montée une fois, dans
 * `app.vue` : n'importe quel geste peut l'ouvrir par `useConnexion()`.
 */
const { ouverte, mode, motif, reussie, fermer } = useConnexion()

// Fermer par la croix, Échap ou un clic à côté passe par ici : le geste en
// attente doit être oublié, pas seulement la fenêtre masquée.
const visible = computed({
  get: () => ouverte.value,
  set: (valeur) => {
    if (!valeur) fermer()
  }
})

const titre = computed(() => (mode.value === 'connexion' ? 'Se connecter' : 'Créer un compte'))
const description = computed(() => motif.value
  ?? (mode.value === 'connexion'
    ? 'Connecte-toi pour retrouver ta progression.'
    : 'Il te faut le code d\'inscription.'))
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="titre"
    :description="description"
    :ui="{ content: 'max-w-sm' }"
  >
    <template #body>
      <!-- `key` : passer de l'un à l'autre repart d'un formulaire vierge plutôt
           que de garder une erreur qui ne le concerne plus. -->
      <ConnexionFormulaire
        v-if="mode === 'connexion'"
        key="connexion"
        @connecte="reussie"
      />
      <InscriptionFormulaire
        v-else
        key="inscription"
        @connecte="reussie"
      />
    </template>

    <template #footer>
      <p
        v-if="mode === 'connexion'"
        class="text-sm text-muted"
      >
        Pas encore de compte ?
        <ULink
          as="button"
          class="text-primary"
          @click="mode = 'inscription'"
        >
          En créer un
        </ULink>
      </p>
      <p
        v-else
        class="text-sm text-muted"
      >
        Déjà un compte ?
        <ULink
          as="button"
          class="text-primary"
          @click="mode = 'connexion'"
        >
          Se connecter
        </ULink>
      </p>
    </template>
  </UModal>
</template>
