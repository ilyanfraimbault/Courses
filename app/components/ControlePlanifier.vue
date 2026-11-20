<script setup lang="ts">
import type { Controle, ValeursControle } from '~~/shared/types/controles'

/**
 * La fenêtre « Planifier un contrôle », ouverte depuis le calendrier ou depuis
 * une matière — et, pour son auteur, « Modifier » le même contrôle.
 *
 * Ce qui la remplit au départ vient de l'endroit d'où on l'ouvre : le jour
 * choisi dans le calendrier, la matière dont on lit le cours.
 */
const props = defineProps<{
  /** À la retouche : le contrôle tel qu'il est. */
  controle?: Controle | null
  jour?: string | null
  /** Le code de la matière à présélectionner. */
  matiere?: string | null
}>()
const ouvert = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ enregistre: [id: number] }>()

const enCours = ref(false)
const erreur = ref<string | null>(null)

function dansUneSemaine() {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const initial = computed<ValeursControle>(() => props.controle
  ? {
      titre: props.controle.titre,
      matiere: props.controle.matiere,
      jour: props.controle.jour,
      parcours: props.controle.parcours,
      programme: props.controle.programme,
      precisions: props.controle.precisions
    }
  : { titre: '', matiere: props.matiere ?? '', jour: props.jour ?? dansUneSemaine(), parcours: null, programme: [], precisions: null })

/** Le formulaire repart de zéro à chaque ouverture : il lit ses valeurs au montage. */
const cle = ref(0)
watch(ouvert, (o) => {
  if (o) {
    cle.value += 1
    erreur.value = null
  }
})

async function enregistrer(valeurs: ValeursControle) {
  enCours.value = true
  erreur.value = null
  try {
    let id = props.controle?.id
    if (id) await $fetch(`/api/controles/${id}`, { method: 'PATCH', body: valeurs })
    else id = (await $fetch<{ id: number }>('/api/controles', { method: 'POST', body: valeurs })).id
    ouvert.value = false
    emit('enregistre', id)
  } catch (e) {
    erreur.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Le contrôle n\'a pas pu être enregistré.'
  } finally {
    enCours.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="ouvert"
    :title="controle ? 'Modifier le contrôle' : 'Planifier un contrôle'"
    description="Il apparaît dans le calendrier de tous ceux qu'il concerne."
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <ControleFormulaire
        :key="cle"
        :initial="initial"
        :libelle="controle ? 'Enregistrer' : 'Planifier'"
        :en-cours="enCours"
        :erreur="erreur"
        @valider="enregistrer"
      />
    </template>
  </UModal>
</template>
