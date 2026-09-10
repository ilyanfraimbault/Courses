<script setup lang="ts">
definePageMeta({ layout: 'cours' })

const { resultats, relire } = useResultats()
const comptes = useComptesQuestions()
const toast = useToast()

const json = computed(() => (resultats.value ? JSON.stringify(resultats.value, null, 2) : ''))

const questionsTrouvees = computed(() =>
  resultats.value?.fiches.reduce((n, f) => n + f.reussies, 0) ?? 0)

const passages = computed(() =>
  resultats.value?.qcm.reduce((n, q) => n + q.tentatives.length, 0) ?? 0)

const fiches = computed(() =>
  (resultats.value?.fiches ?? [])
    .map(f => ({ ...f, denominateur: comptes.value[f.chemin] ?? f.total }))
    .sort((a, b) => Date.parse(b.maj) - Date.parse(a.maj)))

/** Les QCM, du dernier passage au premier, avec l'écart entre les deux derniers. */
const qcm = computed(() =>
  (resultats.value?.qcm ?? []).map((q) => {
    const derniere = q.tentatives.at(-1)
    const avant = q.tentatives.at(-2)
    return {
      ...q,
      derniere,
      ecart: derniere && avant ? derniere.justes - avant.justes : null
    }
  }))

function telecharger() {
  const jour = new Date().toISOString().slice(0, 10)
  const url = URL.createObjectURL(new Blob([json.value], { type: 'application/json' }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = `resultats-${jour}.json`
  lien.click()
  URL.revokeObjectURL(url)
}

const importEnCours = ref(false)
const collageOuvert = ref(false)
const colle = ref('')

/**
 * Verse un export déjà lu. Les deux entrées — le fichier et le collage — passent
 * par ici : le sélecteur de fichier échoue parfois selon le navigateur ou la
 * façon dont le fichier a été enregistré, et un champ de texte n'a aucune de ces
 * dépendances.
 */
async function verser(brut: string) {
  importEnCours.value = true
  try {
    const rapport = await $fetch<{
      fiches: { ecrites: number }
      questions: { inserees: number, dejaPresentes: number, ignorees: number }
      tentatives: { inserees: number, dejaPresentes: number }
      todo: { inserees: number, dejaPresentes: number }
      avertissements: string[]
    }>('/api/resultats/import', { method: 'POST', body: JSON.parse(brut) })

    toast.add({
      title: 'Import terminé',
      description: `${rapport.questions.inserees} questions ajoutées, `
        + `${rapport.questions.dejaPresentes} déjà connues, `
        + `${rapport.tentatives.inserees} passages de QCM ajoutés`
        + (rapport.todo.inserees ? `, ${rapport.todo.inserees} items de to-do.` : '.')
        + (rapport.questions.ignorees ? ` ${rapport.questions.ignorees} entrées illisibles.` : ''),
      icon: 'i-lucide-check',
      color: rapport.questions.ignorees ? 'warning' : 'success',
      duration: 8000
    })
    colle.value = ''
    collageOuvert.value = false
    await relire()
  } catch (erreur) {
    const e = erreur as { statusMessage?: string, message?: string }
    toast.add({
      title: 'Import refusé',
      description: e?.statusMessage ?? e?.message ?? 'Fichier illisible.',
      icon: 'i-lucide-triangle-alert',
      color: 'error',
      duration: 10000
    })
  } finally {
    importEnCours.value = false
  }
}

/**
 * Dépôt d'un ancien export. C'est le chemin praticable en production : l'image
 * d'exécution ne contient que `.output`, pas le script en ligne de commande.
 */
async function importer(evenement: Event) {
  const champ = evenement.target as HTMLInputElement
  const fichier = champ.files?.[0]
  if (!fichier) return
  try {
    await verser(await fichier.text())
  } finally {
    champ.value = ''
  }
}

useSeoMeta({ title: 'Mes résultats' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Mes résultats"
      description="Tout ce qui est enregistré : questions trouvées et passages de QCM."
    />

    <UPageBody>
      <div class="flex flex-wrap items-center gap-4 text-sm text-muted">
        <span>
          <span class="font-medium text-highlighted tabular-nums">{{ fiches.length }}</span>
          fiche{{ fiches.length > 1 ? 's' : '' }} commencée{{ fiches.length > 1 ? 's' : '' }}
        </span>
        <span>
          <span class="font-medium text-highlighted tabular-nums">{{ questionsTrouvees }}</span>
          question{{ questionsTrouvees > 1 ? 's' : '' }} trouvée{{ questionsTrouvees > 1 ? 's' : '' }}
        </span>
        <span>
          <span class="font-medium text-highlighted tabular-nums">{{ passages }}</span>
          passage{{ passages > 1 ? 's' : '' }} de QCM
        </span>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <UButton
          icon="i-lucide-download"
          label="Télécharger le JSON"
          :disabled="!fiches.length && !passages"
          @click="telecharger"
        />
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-upload"
          label="Importer un export"
          :loading="importEnCours"
          @click="($refs.fichier as HTMLInputElement).click()"
        />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-clipboard-paste"
          label="Coller le JSON"
          @click="collageOuvert = !collageOuvert"
        />
        <input
          ref="fichier"
          type="file"
          accept="application/json,.json,text/plain"
          class="hidden"
          @change="importer"
        >
      </div>

      <div
        v-if="collageOuvert"
        class="mt-4"
      >
        <UTextarea
          v-model="colle"
          :rows="8"
          class="w-full font-mono"
          placeholder="Colle ici le contenu du fichier JSON…"
          :disabled="importEnCours"
        />
        <UButton
          class="mt-2"
          label="Importer ce contenu"
          icon="i-lucide-upload"
          :loading="importEnCours"
          :disabled="!colle.trim()"
          @click="verser(colle)"
        />
      </div>

      <template v-if="fiches.length">
        <h2 class="mt-8 text-lg font-medium text-highlighted">
          Par fiche
        </h2>
        <div class="mt-3 flex flex-col gap-2">
          <ULink
            v-for="f of fiches"
            :key="f.chemin"
            :to="f.chemin"
            class="flex items-center gap-3 rounded-lg border border-default px-3 py-2 hover:border-primary/60"
          >
            <span class="min-w-0 flex-1 truncate text-sm text-highlighted">
              {{ f.titre ?? f.chemin }}
            </span>
            <span class="hidden w-32 shrink-0 sm:block">
              <UProgress
                size="xs"
                :color="f.reussies >= f.denominateur ? 'success' : 'primary'"
                :model-value="Math.min(f.reussies, f.denominateur)"
                :max="f.denominateur || 1"
              />
            </span>
            <span class="shrink-0 text-xs text-muted tabular-nums">
              {{ f.reussies }} / {{ f.denominateur }}
            </span>
          </ULink>
        </div>
      </template>

      <template v-if="qcm.length">
        <h2 class="mt-8 text-lg font-medium text-highlighted">
          QCM
        </h2>
        <div class="mt-3 flex flex-col gap-2">
          <ULink
            v-for="q of qcm"
            :key="q.chemin + q.bloc"
            :to="`${q.chemin}#${q.bloc}`"
            class="flex items-center gap-3 rounded-lg border border-default px-3 py-2 hover:border-primary/60"
          >
            <span class="min-w-0 flex-1 truncate text-sm text-highlighted">
              {{ q.titre ?? q.bloc }}
            </span>
            <UBadge
              v-if="q.ecart !== null"
              :color="q.ecart > 0 ? 'success' : q.ecart < 0 ? 'error' : 'neutral'"
              variant="subtle"
              size="sm"
              class="shrink-0 tabular-nums"
              :label="`${q.ecart > 0 ? '+' : ''}${q.ecart}`"
            />
            <span class="shrink-0 text-xs text-muted tabular-nums">
              {{ q.derniere?.justes }} / {{ q.derniere?.total }}
              · {{ q.tentatives.length }} passage{{ q.tentatives.length > 1 ? 's' : '' }}
            </span>
          </ULink>
        </div>
      </template>

      <p
        v-if="!fiches.length && !qcm.length"
        class="mt-8 text-sm text-muted"
      >
        Rien d'enregistré pour l'instant. Réponds à une question ou corrige un QCM, ou importe un
        export produit sur l'ancien site.
      </p>
    </UPageBody>
  </UPage>
</template>
