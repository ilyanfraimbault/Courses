<script setup lang="ts">
import type { CibleTodo } from '~/composables/useTodo'

const props = defineProps<{
  chemin: string
  /** Slug du bloc, ou null pour la fiche entière. */
  bloc?: string | null
  titre: string
  type?: string | null
}>()

const { loggedIn } = useUserSession()
const { contient, basculer } = useTodo()

const cible = computed<CibleTodo>(() => ({
  chemin: props.chemin,
  bloc: props.bloc ?? null,
  titre: props.titre,
  type: props.type ?? null
}))

const dedans = computed(() => contient(cible.value))
const toast = useToast()

async function cliquer() {
  const etait = dedans.value
  await basculer(cible.value)
  toast.add({
    title: etait ? 'Retiré de la to-do' : 'Ajouté à la to-do',
    description: props.titre,
    icon: etait ? 'i-lucide-list-minus' : 'i-lucide-list-checks',
    color: etait ? 'neutral' : 'primary'
  })
}
</script>

<template>
  <!-- Hors session, la to-do n'a pas d'existence : mieux vaut ne rien montrer
       qu'un bouton qui ne fera rien. -->
  <UButton
    v-if="loggedIn"
    size="xs"
    variant="ghost"
    :color="dedans ? 'primary' : 'neutral'"
    :icon="dedans ? 'i-lucide-list-checks' : 'i-lucide-list-plus'"
    :aria-label="dedans ? 'Retirer de ma to-do' : 'Ajouter à ma to-do'"
    :title="dedans ? 'Retirer de ma to-do' : 'Ajouter à ma to-do'"
    class="shrink-0"
    @click="cliquer"
  />
</template>
