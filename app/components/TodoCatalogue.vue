<script setup lang="ts">
import type { CibleCatalogue } from '~/composables/useTodo'

const { items, contient, basculer } = useTodo()
const catalogue = useCatalogueCibles()

const recherche = ref('')
const enCours = ref<string | null>(null)

/** Replie accents et casse : « réciproques » se trouve en tapant « reciproques ». */
function replier(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const groupes = computed(() => {
  const q = replier(recherche.value.trim())
  return catalogue.value
    .map(g => ({
      ...g,
      // On cherche aussi dans le nom du chapitre et dans celui de la fiche :
      // taper « complexes » doit ramener tout le chapitre, pas seulement les
      // blocs dont le titre le répète.
      cibles: q
        ? g.cibles.filter(c => replier(`${g.chapitre} ${c.contexte} ${c.titre}`).includes(q))
        : g.cibles
    }))
    .filter(g => g.cibles.length)
})

const dejaDedans = (c: CibleCatalogue) =>
  contient({ chemin: c.chemin, bloc: c.bloc, titre: c.titre })

const totalCibles = computed(() => catalogue.value.reduce((n, g) => n + g.cibles.length, 0))
const totalAffichees = computed(() => groupes.value.reduce((n, g) => n + g.cibles.length, 0))

async function basculerCible(c: CibleCatalogue) {
  enCours.value = c.cle
  try {
    await basculer({ chemin: c.chemin, bloc: c.bloc, titre: c.titre, type: c.type })
  } finally {
    enCours.value = null
  }
}
</script>

<template>
  <div>
    <UInput
      v-model="recherche"
      icon="i-lucide-search"
      size="lg"
      class="w-full"
      placeholder="Filtrer : un chapitre, une fiche, un exercice…"
      :ui="{ trailing: 'pe-1' }"
    >
      <template
        v-if="recherche"
        #trailing
      >
        <UButton
          color="neutral"
          variant="link"
          icon="i-lucide-x"
          aria-label="Effacer"
          @click="recherche = ''"
        />
      </template>
    </UInput>

    <p class="mt-2 text-xs text-dimmed">
      {{ totalAffichees }} sur {{ totalCibles }} · {{ items.length }} déjà dans ta to-do.
      Clique pour ajouter ou retirer.
    </p>

    <p
      v-if="!groupes.length"
      class="mt-6 text-sm text-muted"
    >
      Rien ne correspond à « {{ recherche }} ».
    </p>

    <div
      v-for="groupe of groupes"
      :key="groupe.chapitre"
      class="mt-6"
    >
      <h3 class="text-sm font-semibold text-highlighted">
        {{ groupe.chapitre }}
      </h3>

      <ul class="mt-2 flex list-none flex-col gap-1 ps-0">
        <li
          v-for="cible of groupe.cibles"
          :key="cible.cle"
        >
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors"
            :class="dejaDedans(cible)
              ? 'border-primary/40 bg-primary/5'
              : 'border-default hover:border-primary/60'"
            :disabled="enCours === cible.cle"
            @click="basculerCible(cible)"
          >
            <UIcon
              :name="dejaDedans(cible) ? 'i-lucide-square-check-big' : 'i-lucide-square'"
              class="size-4 shrink-0"
              :class="dejaDedans(cible) ? 'text-primary' : 'text-dimmed'"
            />

            <UBadge
              v-if="coursTypeInfo(cible.type)"
              :color="coursTypeInfo(cible.type)!.couleur"
              variant="subtle"
              size="sm"
              class="shrink-0"
              :icon="coursTypeInfo(cible.type)!.icone"
              :label="coursTypeInfo(cible.type)!.label"
            />

            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-sm"
                :class="dejaDedans(cible) ? 'text-highlighted' : 'text-default'"
              >{{ cible.titre }}</span>
              <span class="block truncate text-xs text-dimmed">{{ cible.contexte }}</span>
            </span>

            <span
              v-if="cible.questions"
              class="shrink-0 text-xs text-muted tabular-nums"
            >
              {{ cible.questions }} q
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
