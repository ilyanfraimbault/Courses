<script setup lang="ts">
const sommaire = useSommaire()

/**
 * L'état de la barre, retenu d'une page à l'autre et d'une visite à l'autre.
 * C'est un confort d'affichage propre à cet appareil : le stockage local est ici
 * le bon endroit, et son échec — navigation privée, quota plein — ne doit pas
 * empêcher la page de s'afficher.
 */
const CLE = 'cours:barre-repliee'
const repliee = ref(false)

onMounted(() => {
  try {
    repliee.value = localStorage.getItem(CLE) === '1'
  } catch {
    // Une barre toujours dépliée reste parfaitement utilisable.
  }
})

watch(repliee, (valeur) => {
  try {
    localStorage.setItem(CLE, valeur ? '1' : '0')
  } catch {
    // Idem : l'état vaut pour la session en cours.
  }
})
</script>

<template>
  <UContainer>
    <UPage :ui="{ left: repliee ? 'lg:hidden' : '' }">
      <template #left>
        <UPageAside :ui="{ root: 'lg:w-72' }">
          <div class="mb-3 flex items-start justify-between gap-2">
            <!-- La matière en tête : c'est elle qui dit de quel cours sont les
                 chapitres ci-dessous, et elle mène à son sommaire. -->
            <ULink
              :to="sommaire.chemin"
              class="min-w-0 flex-1 group"
            >
              <span
                v-if="sommaire.annee"
                class="block text-xs font-medium uppercase tracking-wide text-dimmed"
              >{{ sommaire.annee }}</span>
              <span class="block text-sm font-semibold text-highlighted group-hover:text-primary">
                {{ sommaire.titre }}
              </span>
            </ULink>
            <UButton
              icon="i-lucide-panel-left-close"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Replier le sommaire"
              title="Replier le sommaire"
              @click="repliee = true"
            />
          </div>

          <UContentNavigation
            highlight
            :navigation="sommaire.liens"
          />
        </UPageAside>
      </template>

      <!-- Rouvrir : le bouton ne s'affiche que barre repliée, et seulement sur
           les largeurs où la barre existe — en dessous, la navigation passe par
           le menu de l'entête. -->
      <UButton
        v-if="repliee"
        class="mb-4 hidden lg:inline-flex"
        icon="i-lucide-panel-left-open"
        color="neutral"
        variant="subtle"
        size="sm"
        label="Sommaire"
        @click="repliee = false"
      />

      <slot />
    </UPage>
  </UContainer>
</template>
