<script setup lang="ts">
import type { NoeudProgramme } from '~/composables/useProgrammeCours'

/**
 * Choisir les chapitres d'un contrôle, et au besoin préciser jusqu'à la fiche
 * ou à l'exercice.
 *
 * Le premier niveau est le seul qu'on voit d'abord : une liste de chapitres à
 * cocher, comme on les lit au tableau. « Préciser » ouvre un chapitre sur ses
 * fiches, puis une fiche sur ses exercices — un geste distinct de la case,
 * sans quoi ouvrir un chapitre pour y choisir un exercice le cocherait en
 * entier. Ce qui est choisi se relit en haut, en pastilles qu'on retire d'un
 * clic.
 *
 * Cocher un nœud coche tout ce qu'il contient ; un nœud dont tout le contenu
 * est coché l'est lui-même. Le modèle ne garde que le plus haut : « tout le
 * chapitre 2 » s'écrit d'une clé, pas de quarante.
 */
const props = defineProps<{ noeuds: NoeudProgramme[] }>()
const modele = defineModel<string[]>({ required: true })

const index = computed(() => {
  const noeuds = new Map<string, NoeudProgramme>()
  const parents = new Map<string, NoeudProgramme | null>()
  const parcourir = (liste: NoeudProgramme[], parent: NoeudProgramme | null) => {
    for (const n of liste) {
      noeuds.set(n.cle, n)
      parents.set(n.cle, parent)
      parcourir(n.enfants, n)
    }
  }
  parcourir(props.noeuds, null)
  return { noeuds, parents }
})

function descendants(n: NoeudProgramme): NoeudProgramme[] {
  return n.enfants.flatMap(e => [e, ...descendants(e)])
}

function ancetres(cle: string): NoeudProgramme[] {
  const liste: NoeudProgramme[] = []
  let p = index.value.parents.get(cle) ?? null
  while (p) {
    liste.push(p)
    p = index.value.parents.get(p.cle) ?? null
  }
  return liste
}

/** Tout ce qui est coché, descendants compris. */
const coches = computed(() => {
  const ensemble = new Set<string>()
  for (const cle of modele.value) {
    ensemble.add(cle)
    const n = index.value.noeuds.get(cle)
    if (n) for (const d of descendants(n)) ensemble.add(d.cle)
  }
  return ensemble
})

function etat(n: NoeudProgramme): boolean | 'indeterminate' {
  if (coches.value.has(n.cle)) return true
  return descendants(n).some(d => coches.value.has(d.cle)) ? 'indeterminate' : false
}

function compacter(ensemble: Set<string>) {
  // Une clé du modèle absente du plan (exercice renommé) se garde : ce n'est
  // pas à la case qu'on vient de cocher de l'effacer.
  const inconnues = modele.value.filter(c => !index.value.noeuds.has(c))
  modele.value = [...inconnues, ...[...ensemble].filter(c =>
    index.value.noeuds.has(c) && !ensemble.has(index.value.parents.get(c)?.cle ?? ''))]
}

function basculer(n: NoeudProgramme) {
  const ensemble = new Set(coches.value)
  if (ensemble.has(n.cle)) {
    for (const x of [n, ...descendants(n), ...ancetres(n.cle)]) ensemble.delete(x.cle)
  } else {
    for (const x of [n, ...descendants(n)]) ensemble.add(x.cle)
    for (const a of ancetres(n.cle)) {
      if (a.enfants.every(e => ensemble.has(e.cle))) ensemble.add(a.cle)
    }
  }
  compacter(ensemble)
}

function retirer(cle: string) {
  const n = index.value.noeuds.get(cle)
  if (n) basculer(n)
  else modele.value = modele.value.filter(c => c !== cle)
}

const ouverts = ref(new Set<string>())
function ouvrir(cle: string) {
  const s = new Set(ouverts.value)
  if (s.has(cle)) s.delete(cle)
  else s.add(cle)
  ouverts.value = s
}

/** Les lignes visibles, à plat, avec leur profondeur. */
const lignes = computed(() => {
  const liste: { noeud: NoeudProgramme, profondeur: number }[] = []
  const parcourir = (noeuds: NoeudProgramme[], profondeur: number) => {
    for (const n of noeuds) {
      liste.push({ noeud: n, profondeur })
      if (ouverts.value.has(n.cle)) parcourir(n.enfants, profondeur + 1)
    }
  }
  parcourir(props.noeuds, 0)
  return liste
})

/** Le nom d'une pastille : le chapitre seul, ou « Chapitre › fiche ». */
function nomChoisi(cle: string) {
  const n = index.value.noeuds.get(cle)
  if (!n) return cle.split('/').pop() ?? cle
  return [...ancetres(cle).reverse().map(a => a.titre), n.titre].join(' › ')
}

function sousTitre(n: NoeudProgramme, profondeur: number) {
  if (!n.enfants.length) return null
  const nom = profondeur === 0 ? 'fiche' : 'exercice'
  return `${n.enfants.length} ${nom}${n.enfants.length > 1 ? 's' : ''}`
}

const identifiant = useId()
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      v-if="modele.length"
      class="flex flex-wrap gap-1.5"
      aria-label="Ce qui est choisi"
    >
      <UBadge
        v-for="cle in modele"
        :key="cle"
        color="primary"
        variant="subtle"
        size="md"
        class="max-w-full"
      >
        <span class="truncate">{{ nomChoisi(cle) }}</span>
        <button
          type="button"
          class="ms-0.5 rounded-sm opacity-70 hover:opacity-100"
          :aria-label="`Retirer ${nomChoisi(cle)}`"
          @click="retirer(cle)"
        >
          <UIcon
            name="i-lucide-x"
            class="size-3.5"
          />
        </button>
      </UBadge>
    </div>
    <p
      v-else
      class="m-0 text-xs text-muted"
    >
      Coche les chapitres au programme. « Préciser » descend jusqu'à la fiche ou à l'exercice.
    </p>

    <ul class="m-0 max-h-64 list-none divide-y divide-default overflow-y-auto rounded-md border border-default p-0">
      <li
        v-for="({ noeud, profondeur }, i) in lignes"
        :key="noeud.cle"
        class="flex items-center gap-2 py-1.5 pe-2"
        :class="profondeur === 0 ? 'bg-default' : 'bg-elevated/40'"
        :style="{ paddingInlineStart: `${0.75 + profondeur * 1.5}rem` }"
      >
        <!-- Un identifiant à soi : la case ne doit pas hériter de celui d'un
             champ qui l'entourerait, ni partager le sien avec sa voisine. -->
        <UCheckbox
          :id="`programme-${identifiant}-${i}`"
          :model-value="etat(noeud)"
          :ui="{ label: profondeur === 0 ? 'text-sm font-medium' : 'text-sm font-normal' }"
          class="min-w-0 flex-1"
          @update:model-value="basculer(noeud)"
        >
          <template #label>
            <span class="flex min-w-0 items-center gap-2">
              <span class="truncate">{{ noeud.titre }}</span>
              <UBadge
                v-if="noeud.type && coursTypeInfo(noeud.type)"
                :label="coursTypeInfo(noeud.type)!.label"
                :color="coursTypeInfo(noeud.type)!.couleur"
                variant="subtle"
                size="xs"
              />
            </span>
          </template>
        </UCheckbox>
        <UButton
          v-if="noeud.enfants.length"
          color="neutral"
          variant="ghost"
          size="xs"
          :trailing-icon="ouverts.has(noeud.cle) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          :label="ouverts.has(noeud.cle) ? 'Replier' : 'Préciser'"
          :title="sousTitre(noeud, profondeur) ?? undefined"
          :aria-expanded="ouverts.has(noeud.cle)"
          @click="ouvrir(noeud.cle)"
        />
      </li>
    </ul>
  </div>
</template>
