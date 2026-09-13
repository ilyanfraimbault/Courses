<script setup lang="ts">
import type { ApercuQuestion } from '~~/shared/types/mes-qcm'

/**
 * Une question lue avant d'être prise dans un QCM : l'énoncé commun de son bloc,
 * son énoncé et ses propositions, dans l'ordre de la fiche. Sans verdict, sans
 * bonne réponse — l'aperçu servirait sinon de corrigé.
 */
defineProps<{
  apercu: ApercuQuestion
  /** Intitulé du bloc, qui titre l'énoncé commun. */
  blocTitre?: string
}>()
</script>

<template>
  <div class="cours-body rounded-lg border border-default bg-elevated/30 px-3 py-3 text-sm">
    <div
      v-if="apercu.enonceBloc"
      class="cours-quiz-chapeau mb-3"
    >
      <p class="cours-panel-title text-dimmed!">
        <UIcon
          name="i-lucide-text-quote"
          class="size-4 shrink-0"
        />
        <span>{{ blocTitre ?? 'Énoncé commun' }}</span>
      </p>
      <div class="cours-panel-body text-muted">
        <QuizRendu :noeuds="apercu.enonceBloc" />
      </div>
    </div>

    <div class="cours-enonce text-highlighted">
      <QuizRendu :noeuds="apercu.enonce" />
    </div>

    <div class="mt-2 flex flex-col gap-1">
      <div
        v-for="lettre in apercu.lettres"
        :key="lettre"
        class="flex items-center gap-2"
      >
        <span class="shrink-0 font-medium text-muted uppercase">{{ lettre }}</span>
        <span class="min-w-0 flex-1 cours-qcm-choix">
          <QuizRendu :noeuds="apercu.choix[lettre] ?? null" />
        </span>
      </div>
    </div>
  </div>
</template>
