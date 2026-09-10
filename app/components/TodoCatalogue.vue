<script setup lang="ts">
import type { CibleCatalogue, ChapitreCatalogue, FicheCatalogue } from '~/composables/useTodo'

const { items, contient, basculer } = useTodo()
const catalogue = useCatalogueCibles()

const recherche = ref('')
const enCours = ref<string | null>(null)
const ouverts = ref(new Set<string>())

/** Replie accents et casse : « réciproques » se trouve en tapant « reciproques ». */
function replier(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Le catalogue filtré. Ce qui correspond est gardé **avec tout ce qu'il
 * contient** — chercher un chapitre le ramène entier — mais chercher
 * « exercice 4 » ne ramène pas les douze autres de sa fiche.
 */
const chapitres = computed<ChapitreCatalogue[]>(() => {
  const q = replier(recherche.value.trim())
  if (!q) return catalogue.value

  return catalogue.value
    .map((c) => {
      if (replier(c.titre).includes(q)) return c
      const fiches = c.fiches
        .map((f) => {
          if (replier(`${c.titre} ${f.titre}`).includes(q)) return f
          const blocs = f.blocs.filter(b => replier(b.titre).includes(q))
          return blocs.length ? { ...f, blocs } : null
        })
        .filter((f): f is FicheCatalogue => !!f)
      return fiches.length ? { ...c, fiches } : null
    })
    .filter((c): c is ChapitreCatalogue => !!c)
})

/** Une recherche déplie tout : on veut voir ce qu'on a trouvé. */
const forcerOuvert = computed(() => !!recherche.value.trim())
const estOuvert = (cle: string) => forcerOuvert.value || ouverts.value.has(cle)

function basculerOuvert(cle: string) {
  const suivant = new Set(ouverts.value)
  if (suivant.has(cle)) suivant.delete(cle)
  else suivant.add(cle)
  ouverts.value = suivant
}

const dedans = (c: CibleCatalogue) => contient({ chemin: c.chemin, bloc: c.bloc, titre: c.titre })

/** Combien d'éléments d'un niveau sont déjà retenus, pour l'annoncer sans déplier. */
function pris(chapitre: ChapitreCatalogue): number {
  return chapitre.fiches.reduce(
    (n, f) => n + (dedans(f) ? 1 : 0) + f.blocs.filter(dedans).length,
    dedans(chapitre) ? 1 : 0
  )
}

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
      {{ items.length }} déjà dans ta to-do. Coche un chapitre pour le prendre en entier,
      ou déplie-le pour choisir une fiche, puis un exercice.
    </p>

    <p
      v-if="!chapitres.length"
      class="mt-6 text-sm text-muted"
    >
      Rien ne correspond à « {{ recherche }} ».
    </p>

    <!-- Niveau 1 — le chapitre -->
    <div
      v-for="chapitre of chapitres"
      :key="chapitre.cle"
      class="mt-3 rounded-lg border"
      :class="dedans(chapitre) ? 'border-primary/40 bg-primary/5' : 'border-default'"
    >
      <div class="flex items-center gap-2 px-2 py-2 sm:px-3">
        <UButton
          :icon="estOuvert(chapitre.cle) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="estOuvert(chapitre.cle) ? 'Replier' : 'Déplier'"
          :disabled="forcerOuvert"
          @click="basculerOuvert(chapitre.cle)"
        />
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-3 text-left"
          :disabled="enCours === chapitre.cle"
          @click="basculerCible(chapitre)"
        >
          <UIcon
            :name="dedans(chapitre) ? 'i-lucide-square-check-big' : 'i-lucide-square'"
            class="size-4 shrink-0"
            :class="dedans(chapitre) ? 'text-primary' : 'text-dimmed'"
          />
          <span class="min-w-0 flex-1 truncate text-sm font-semibold text-highlighted">
            {{ chapitre.titre }}
          </span>
        </button>
        <span class="shrink-0 text-xs text-muted tabular-nums">
          {{ chapitre.fiches.length }} fiches
          <template v-if="pris(chapitre)">· {{ pris(chapitre) }} pris</template>
        </span>
      </div>

      <!-- Niveau 2 — la fiche -->
      <div
        v-if="estOuvert(chapitre.cle)"
        class="border-t border-default px-2 py-2 sm:px-3"
      >
        <div
          v-for="fiche of chapitre.fiches"
          :key="fiche.cle"
          class="rounded-md"
          :class="dedans(fiche) ? 'bg-primary/10' : ''"
        >
          <div class="flex items-center gap-2 px-1 py-1.5">
            <UButton
              v-if="fiche.blocs.length"
              :icon="estOuvert(fiche.cle) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="estOuvert(fiche.cle) ? 'Replier' : 'Déplier'"
              :disabled="forcerOuvert"
              @click="basculerOuvert(fiche.cle)"
            />
            <span
              v-else
              class="w-6 shrink-0"
            />
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-3 text-left"
              :disabled="enCours === fiche.cle"
              @click="basculerCible(fiche)"
            >
              <UIcon
                :name="dedans(fiche) ? 'i-lucide-square-check-big' : 'i-lucide-square'"
                class="size-4 shrink-0"
                :class="dedans(fiche) ? 'text-primary' : 'text-dimmed'"
              />
              <UBadge
                v-if="coursTypeInfo(fiche.type)"
                :color="coursTypeInfo(fiche.type)!.couleur"
                variant="subtle"
                size="sm"
                class="shrink-0"
                :icon="coursTypeInfo(fiche.type)!.icone"
                :label="fiche.titre"
              />
            </button>
            <span class="shrink-0 text-xs text-muted tabular-nums">
              <template v-if="fiche.blocs.length">{{ fiche.blocs.length }} blocs · </template>
              {{ fiche.questions }} q
            </span>
          </div>

          <!-- Niveau 3 — le bloc -->
          <ul
            v-if="fiche.blocs.length && estOuvert(fiche.cle)"
            class="flex list-none flex-col gap-0.5 ps-8 pb-1"
          >
            <li
              v-for="bloc of fiche.blocs"
              :key="bloc.cle"
            >
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-md px-2 py-1 text-left transition-colors"
                :class="dedans(bloc) ? 'bg-primary/10' : 'hover:bg-elevated/50'"
                :disabled="enCours === bloc.cle"
                @click="basculerCible(bloc)"
              >
                <UIcon
                  :name="dedans(bloc) ? 'i-lucide-square-check-big' : 'i-lucide-square'"
                  class="size-4 shrink-0"
                  :class="dedans(bloc) ? 'text-primary' : 'text-dimmed'"
                />
                <span
                  class="min-w-0 flex-1 truncate text-sm"
                  :class="dedans(bloc) ? 'text-highlighted' : 'text-default'"
                >{{ bloc.titre }}</span>
                <span
                  v-if="bloc.questions"
                  class="shrink-0 text-xs text-muted tabular-nums"
                >{{ bloc.questions }} q</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
