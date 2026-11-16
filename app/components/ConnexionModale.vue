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

const TITRES = { connexion: 'Se connecter', inscription: 'Créer un compte', demande: 'Demande d\'accès' }
const DESCRIPTIONS = {
  connexion: 'Connecte-toi pour retrouver ta progression.',
  inscription: 'Sans code d\'invitation, l\'administration devra accepter ton compte.',
  demande: 'Ton compte attend l\'accord de l\'administration.'
}
const titre = computed(() => TITRES[mode.value])
const description = computed(() => motif.value ?? DESCRIPTIONS[mode.value])
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
        v-else-if="mode === 'inscription'"
        key="inscription"
        @connecte="reussie"
      />
      <!-- L'accès accordé pendant que la fenêtre est ouverte rejoue le geste. -->
      <DemandeAcces
        v-else
        key="demande"
        @accorde="reussie"
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
        v-else-if="mode === 'inscription'"
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
