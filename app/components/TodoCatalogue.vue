<script setup lang="ts">
import type { CibleCatalogue, FicheCatalogue } from '~/composables/useTodo'

const { items, contient, basculer } = useTodo()
const catalogue = useCatalogueCibles()

const recherche = ref('')
const enCours = ref<string | null>(null)
const depliees = ref(new Set<string>())

/** Replie accents et casse : « réciproques » se trouve en tapant « reciproques ». */
function replier(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Le catalogue filtré. Une fiche dont le nom correspond est gardée entière ;
 * sinon on ne garde que ses blocs qui correspondent — chercher « exercice 4 »
 * ne doit pas ramener les douze autres de la fiche.
 */
const groupes = computed(() => {
  const q = replier(recherche.value.trim())
  if (!q) return catalogue.value

  return catalogue.value
    .map(g => ({
      chapitre: g.chapitre,
      fiches: g.fiches
        .map((f) => {
          const ficheCorrespond = replier(`${g.chapitre} ${f.titre}`).includes(q)
          if (ficheCorrespond) return f
          const blocs = f.blocs.filter(b => replier(b.titre).includes(q))
          return blocs.length ? { ...f, entiere: null, blocs } : null
        })
        .filter((f): f is FicheCatalogue => !!f)
    }))
    .filter(g => g.fiches.length)
})

/** Une recherche déplie d'office : on veut voir ce qu'on a trouvé. */
const forcerDeplie = computed(() => !!recherche.value.trim())
const estDepliee = (f: FicheCatalogue) => forcerDeplie.value || depliees.value.has(f.chemin)

function basculerDepli(f: FicheCatalogue) {
  const suivant = new Set(depliees.value)
  if (suivant.has(f.chemin)) suivant.delete(f.chemin)
  else suivant.add(f.chemin)
  depliees.value = suivant
}

const dedans = (c: CibleCatalogue) => contient({ chemin: c.chemin, bloc: c.bloc, titre: c.titre })

/** Combien des blocs d'une fiche sont déjà retenus, pour l'annoncer sans déplier. */
const retenus = (f: FicheCatalogue) => f.blocs.filter(dedans).length

async function basculerCible(c: CibleCatalogue) {
  enCours.value = c.cle
  try {
    await basculer({ chemin: c.chemin, bloc: c.bloc, titre: c.titre, type: c.type })
  } finally {
    enCours.value = null
  }
}

const totalFiches = computed(() => groupes.value.reduce((n, g) => n + g.fiches.length, 0))
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
      {{ totalFiches }} fiche{{ totalFiches > 1 ? 's' : '' }} · {{ items.length }} déjà dans ta to-do.
      Coche une fiche pour la prendre en entier, ou déplie-la pour choisir.
    </p>

    <p
      v-if="!groupes.length"
      class="mt-6 text-sm text-muted"
    >
      Rien ne correspond à « {{ recherche }} ».
    </p>

    <section
      v-for="groupe of groupes"
      :key="groupe.chapitre"
      class="mt-6"
    >
      <h3 class="text-sm font-semibold text-highlighted">
        {{ groupe.chapitre }}
      </h3>

      <div class="mt-2 flex flex-col gap-2">
        <div
          v-for="fiche of groupe.fiches"
          :key="fiche.chemin"
          class="rounded-lg border"
          :class="fiche.entiere && dedans(fiche.entiere)
            ? 'border-primary/40 bg-primary/5'
            : 'border-default'"
        >
          <!-- La fiche : sa case la prend en entier, le chevron l'ouvre. -->
          <div class="flex items-center gap-2 px-2 py-2 sm:px-3">
            <UButton
              v-if="fiche.blocs.length"
              :icon="estDepliee(fiche) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="estDepliee(fiche) ? 'Replier' : 'Déplier'"
              :disabled="forcerDeplie"
              @click="basculerDepli(fiche)"
            />
            <span
              v-else
              class="w-6 shrink-0"
            />

            <button
              v-if="fiche.entiere"
              type="button"
              class="flex min-w-0 flex-1 items-center gap-3 text-left"
              :disabled="enCours === fiche.entiere.cle"
              @click="basculerCible(fiche.entiere)"
            >
              <UIcon
                :name="dedans(fiche.entiere) ? 'i-lucide-square-check-big' : 'i-lucide-square'"
                class="size-4 shrink-0"
                :class="dedans(fiche.entiere) ? 'text-primary' : 'text-dimmed'"
              />
              <UBadge
                v-if="coursTypeInfo(fiche.type)"
                :color="coursTypeInfo(fiche.type)!.couleur"
                variant="subtle"
                size="sm"
                class="shrink-0"
                :icon="coursTypeInfo(fiche.type)!.icone"
                :label="coursTypeInfo(fiche.type)!.label"
              />
              <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">
                {{ fiche.titre }}
              </span>
            </button>

            <!-- Une page de cours ne se « fait » pas : pas de case, mais ses
                 contrôles express restent choisissables un par un. -->
            <div
              v-else
              class="flex min-w-0 flex-1 items-center gap-3"
            >
              <span class="min-w-0 flex-1 truncate text-sm font-medium text-muted">
                {{ fiche.titre }}
              </span>
            </div>

            <span class="shrink-0 text-xs text-muted tabular-nums">
              <template v-if="fiche.blocs.length">
                {{ fiche.blocs.length }} bloc{{ fiche.blocs.length > 1 ? 's' : '' }}
                <template v-if="retenus(fiche)">· {{ retenus(fiche) }} pris</template>
              </template>
              <template v-else-if="fiche.questions">{{ fiche.questions }} q</template>
            </span>
          </div>

          <!-- Les blocs de la fiche. -->
          <ul
            v-if="fiche.blocs.length && estDepliee(fiche)"
            class="flex list-none flex-col gap-1 border-t border-default px-2 py-2 ps-0 sm:px-3"
          >
            <li
              v-for="bloc of fiche.blocs"
              :key="bloc.cle"
            >
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors"
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
    </section>
  </div>
</template>
