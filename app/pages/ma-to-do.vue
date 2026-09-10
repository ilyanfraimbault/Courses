<script setup lang="ts">
definePageMeta({ layout: 'cours' })

const { items, marquer, supprimer, reordonner } = useTodo()
const catalogue = useCatalogueCibles()
const toast = useToast()

/** Toutes les cibles du catalogue, à plat, pour retrouver l'une d'elles par sa clé. */
const parCle = computed(() => {
  const table = new Map<string, { titre: string, questions: number, chapitre: string, fiche: string | null }>()
  for (const c of catalogue.value) {
    table.set(c.cle, { titre: c.titre, questions: c.questions, chapitre: c.titre, fiche: null })
    for (const f of c.fiches) {
      table.set(f.cle, { titre: f.titre, questions: f.questions, chapitre: c.titre, fiche: f.titre })
      for (const b of f.blocs) {
        table.set(b.cle, { titre: b.titre, questions: b.questions, chapitre: c.titre, fiche: f.titre })
      }
    }
  }
  return table
})

const cleDe = (chemin: string, bloc: string | null) => (bloc ? `${chemin}#${bloc}` : chemin)

/**
 * Dénominateur d'un item. Il vient du catalogue, donc du comptage fait au build :
 * un chapitre pèse la somme de ses fiches, une fiche la somme de ses blocs.
 */
function totalDe(chemin: string, bloc: string | null): number {
  return parCle.value.get(cleDe(chemin, bloc))?.questions ?? 0
}

/** D'où vient un item : « Fonctions usuelles › Exercices ». */
function situationDe(chemin: string, bloc: string | null): string {
  const cible = parCle.value.get(cleDe(chemin, bloc))
  if (!cible) return chemin.split('/').filter(Boolean).slice(-2).join(' › ')
  return cible.fiche && cible.fiche !== cible.titre
    ? `${cible.chapitre} › ${cible.fiche}`
    : cible.chapitre
}

function estTermine(item: typeof items.value[number]) {
  const total = totalDe(item.chemin, item.bloc)
  return !!item.fait_le || (total > 0 && item.reussies >= total)
}

const aFaire = computed(() => items.value.filter(i => !estTermine(i)))
const termines = computed(() => items.value.filter(estTermine))

/**
 * La liste, groupée par chapitre — la même hiérarchie que le catalogue.
 *
 * Les groupes se succèdent dans l'ordre où leur premier item apparaît : on ne
 * réordonne pas la liste, on la donne à lire. Le glisser-déposer, lui, continue
 * de porter sur l'ordre d'ensemble.
 */
const groupes = computed(() => {
  const sortie: { chapitre: string, items: typeof items.value }[] = []
  for (const item of items.value) {
    const chapitre = parCle.value.get(cleDe(item.chemin, item.bloc))?.chapitre
      ?? item.chemin.split('/').filter(Boolean).at(-2)
      ?? 'Cours'
    const dernier = sortie.find(g => g.chapitre === chapitre)
    if (dernier) dernier.items.push(item)
    else sortie.push({ chapitre, items: [item] })
  }
  return sortie
})

/**
 * Applique le nouvel ordre d'un chapitre à l'ordre d'ensemble : on remplace la
 * tranche occupée par ce groupe, en laissant les autres où ils sont.
 */
async function reordonnerGroupe(ids: number[]) {
  const positions = items.value
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => ids.includes(item.id))
    .map(({ index }) => index)

  const parId = new Map(items.value.map(i => [i.id, i]))
  const global = [...items.value]
  positions.forEach((position, i) => {
    global[position] = parId.get(ids[i]!)!
  })

  if (!await reordonner(global.map(i => i.id))) {
    toast.add({
      title: 'Ordre non enregistré',
      description: 'La liste est revenue à son état précédent.',
      color: 'error'
    })
  }
}

const catalogueOuvert = ref(false)

useSeoMeta({ title: 'Ma to-do' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Ma to-do"
      description="Ce que tu as décidé de reprendre, dans l'ordre que tu veux."
    />

    <UPageBody>
      <UButton
        :icon="catalogueOuvert ? 'i-lucide-chevron-down' : 'i-lucide-plus'"
        :label="catalogueOuvert ? 'Fermer le catalogue' : 'Ajouter des exercices, des QCM ou des fiches'"
        :color="catalogueOuvert ? 'neutral' : 'primary'"
        :variant="catalogueOuvert ? 'subtle' : 'solid'"
        size="lg"
        block
        @click="catalogueOuvert = !catalogueOuvert"
      />

      <div
        v-if="catalogueOuvert"
        class="mt-4 rounded-lg border border-default p-4"
      >
        <TodoCatalogue />
      </div>

      <p
        v-if="!items.length"
        class="mt-6 text-sm text-muted"
      >
        Rien pour l'instant. Ouvre le catalogue ci-dessus, ou clique sur
        <UIcon
          name="i-lucide-list-plus"
          class="inline size-4 align-text-bottom"
        />
        à côté d'un exercice depuis une fiche.
      </p>

      <div
        v-else
        class="mt-6 flex flex-col gap-6"
      >
        <TodoGroupe
          v-for="groupe of groupes"
          :key="groupe.chapitre"
          :chapitre="groupe.chapitre"
          :items="groupe.items"
          :total="totalDe"
          :situation="situationDe"
          :termine="estTermine"
          @marquer="marquer"
          @supprimer="supprimer"
          @reordonner="reordonnerGroupe"
        />
      </div>

      <p
        v-if="items.length"
        class="mt-4 text-xs text-dimmed"
      >
        {{ aFaire.length }} à faire, {{ termines.length }} terminé{{ termines.length > 1 ? 's' : '' }}.
        Glisse par la poignée, ou utilise les flèches — l'ordre se règle à l'intérieur d'un chapitre.
      </p>
    </UPageBody>
  </UPage>
</template>
