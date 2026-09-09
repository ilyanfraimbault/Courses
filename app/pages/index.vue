<script setup lang="ts">
// Accueil provisoire : le tableau de bord « où j'en suis » viendra ici une fois
// la base en place. Pour l'instant, une porte d'entrée vers le sommaire.
definePageMeta({
  layout: 'cours'
})

useSeoMeta({ title: 'Accueil' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Cours"
      description="Le cahier de révisions : fiches, exercices corrigés et QCM."
    />

    <UPageBody>
      <UButton
        to="/cours"
        icon="i-lucide-library"
        label="Ouvrir le sommaire"
        size="lg"
      />
    </UPageBody>
  </UPage>
</template>
