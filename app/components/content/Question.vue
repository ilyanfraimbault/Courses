<script setup lang="ts">
/**
 * La question posée au fil d'un cours.
 *
 * Elle a longtemps eu son propre habillage : sa solution se dépliait quand celle
 * d'un exercice s'ouvrait en fenêtre, et le bouton « Cours » lui manquait. C'est
 * désormais la même question qu'un exercice, relayée telle quelle. La balise
 * reste, parce que le contenu l'emploie et que le relevé du build la compte.
 */
defineProps<{
  /** Numéro ou repère affiché devant l'énoncé, par exemple « 1. » ou « a) ». */
  label?: string
  /** Lettre attendue. Absente, la question s'auto-évalue après lecture de la solution. */
  bonne?: string
  /** Identifiant de l'extrait de cours à déployer, s'il y en a un. */
  cours?: string
}>()
</script>

<template>
  <ExoQuestion
    :label="label"
    :bonne="bonne"
    :cours="cours"
  >
    <template
      v-for="(_, nom) in $slots"
      #[nom]
    >
      <slot :name="nom" />
    </template>
  </ExoQuestion>
</template>
