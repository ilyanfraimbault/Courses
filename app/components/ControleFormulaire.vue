<script setup lang="ts">
import type { ValeursControle } from '~~/shared/types/controles'
import type { FiltreQuiz, MatiereCatalogue } from '~~/shared/types/quiz'

/**
 * Ce qui décrit un contrôle : un titre, une date, une matière et un programme.
 * Il sert à le déclarer comme à le retoucher — la matière ne se choisit alors
 * plus : un contrôle d'une autre matière est un autre contrôle.
 *
 * Le programme se coche sur le plan du cours, avec le même composant que la
 * sélection du quiz. C'est ce qui garantit qu'une journée de la feuille de route
 * désigne exactement ce qu'une séance saura poser.
 */
const props = defineProps<{
  matieres: MatiereCatalogue[]
  initial: ValeursControle
  /** Vrai à la retouche : la matière est celle du contrôle. */
  matiereFixe?: boolean
  libelle: string
  enCours?: boolean
  erreur?: string | null
}>()

const emit = defineEmits<{ valider: [valeurs: ValeursControle] }>()

const titre = ref(props.initial.titre)
const jour = ref(props.initial.jour)
const filtre = ref<FiltreQuiz>({
  matiere: props.initial.matiere,
  themes: [...props.initial.themes],
  sections: [...props.initial.sections],
  notions: [],
  erreurs: false
})

/** Changer de matière repart d'un programme vierge : les chapitres d'un autre cours n'y ont pas de sens. */
const matiereChoisie = computed({
  get: () => filtre.value.matiere ?? null,
  set: (cle: string | null) => {
    if (cle !== filtre.value.matiere) filtre.value = { matiere: cle, themes: [], sections: [], notions: [], erreurs: false }
  }
})

const matiere = computed(() => props.matieres.find(m => m.cle === filtre.value.matiere) ?? null)

const pret = computed(() => !!titre.value.trim() && !!jour.value && !!matiere.value)

function valider() {
  if (!pret.value || props.enCours) return
  emit('valider', {
    titre: titre.value.trim(),
    matiere: filtre.value.matiere ?? null,
    jour: jour.value,
    themes: filtre.value.themes,
    sections: filtre.value.sections
  })
}
</script>

<template>
  <form
    class="flex flex-col gap-6"
    @submit.prevent="valider"
  >
    <div class="grid gap-4 sm:grid-cols-[1fr_auto]">
      <UFormField
        label="Intitulé"
        required
      >
        <UInput
          v-model="titre"
          placeholder="Contrôle de trigonométrie"
          maxlength="120"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Date"
        required
      >
        <UInput
          v-model="jour"
          type="date"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField
      v-if="!matiereFixe && matieres.length > 1"
      label="Matière"
      required
    >
      <MatiereChoix
        v-model="matiereChoisie"
        :matieres="matieres"
      />
    </UFormField>

    <UFormField
      v-if="matiere"
      label="Programme"
      description="Ce sur quoi porte le contrôle, sur le plan du cours. Un chapitre coché le prend en entier ; déplie-le pour n'en garder que quelques parties."
    >
      <QuizFiltre
        v-model="filtre"
        class="mt-2"
        mode="programme"
        :catalogue="matiere"
      />
    </UFormField>

    <UAlert
      v-if="erreur"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="erreur"
    />

    <div class="flex justify-end">
      <UButton
        type="submit"
        icon="i-lucide-calendar-check"
        :label="libelle"
        :loading="enCours"
        :disabled="!pret"
      />
    </div>
  </form>
</template>
