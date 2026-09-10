<script setup lang="ts">
import type { FragmentContenu } from '~~/shared/types/quiz'

/**
 * Rend un fragment de fiche — un énoncé, une proposition, une solution — tel
 * qu'il a été écrit.
 *
 * Le quiz ne recopie aucune question : il découpe des morceaux de l'arbre des
 * fiches et les fait rendre par le même moteur, avec les mêmes composants MDC et
 * les mêmes formules déjà mises en forme au build. Corriger une faute de frappe
 * dans un cours corrige donc le quiz du même coup, sans rien à resynchroniser.
 */
const props = defineProps<{ noeuds: FragmentContenu | null }>()

const valeur = computed(() => ({ body: { type: 'minimark', value: props.noeuds ?? [] } }))
</script>

<template>
  <ContentRenderer :value="valeur" />
</template>
