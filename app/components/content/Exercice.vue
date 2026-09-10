<script setup lang="ts">
const props = defineProps<{
  /** Intitulé affiché en tête, par exemple « Exercice 3 ». */
  titre?: string
  /** Thème de l'exercice, affiché en sous-titre. */
  theme?: string
  /** Icône Lucide facultative. */
  icone?: string
  /** Repère de difficulté affiché à côté du titre, par exemple « ★★☆☆☆ ». */
  badge?: string
  /**
   * Nature du texte placé en tête du bloc, avant ses questions. Il n'a aucun
   * effet ici — la fiche l'affiche tel quel dans tous les cas — mais le mode
   * quiz le lit : il rappelle un **énoncé** au-dessus de chaque question qu'il
   * en tire, et laisse une **introduction** à sa fiche.
   *
   * Sans attribut, c'est un énoncé. C'est le défaut sûr : oublier de marquer une
   * introduction ne coûte qu'un peu de bruit dans le quiz, alors que se tromper
   * dans l'autre sens rendrait la question insoluble sans le dire. Voir
   * `docs/quiz.md`.
   */
  entete?: 'enonce' | 'introduction'
}>()

// Le titre du bloc est la seconde pièce de l'identité de ses questions : le même
// « 1. » revient dans chaque exercice d'une fiche, seul le bloc les distingue.
const { ids, slug } = provideBloc(() => props.titre)

const route = useRoute()

const progression = useProgression()

const trouvees = computed(() => [...ids].filter(id => progression?.memoire(id)).length)
</script>

<template>
  <section class="cours-exercice my-10 scroll-mt-24">
    <div class="flex items-center gap-2">
      <UIcon
        :name="icone || 'i-lucide-pencil-line'"
        class="size-5 shrink-0 text-primary"
      />
      <h2
        v-if="titre"
        class="m-0! text-xl! font-semibold text-highlighted"
      >
        {{ titre }}
      </h2>
      <UBadge
        v-if="badge"
        color="neutral"
        variant="subtle"
        size="sm"
        class="shrink-0 tracking-widest"
        :label="badge"
      />
      <UBadge
        v-if="ids.size && trouvees"
        :color="trouvees === ids.size ? 'success' : 'neutral'"
        variant="subtle"
        size="sm"
        class="shrink-0 tabular-nums"
        :icon="trouvees === ids.size ? 'i-lucide-check' : undefined"
        :label="`${trouvees} / ${ids.size}`"
      />
      <TodoBouton
        v-if="titre && slug"
        :chemin="route.path"
        :bloc="slug"
        :titre="titre"
        type="exercices"
      />
    </div>
    <p
      v-if="theme"
      class="mt-1! mb-0! text-sm text-muted"
    >
      {{ theme }}
    </p>
    <div class="mt-4">
      <slot />
    </div>
  </section>
</template>
