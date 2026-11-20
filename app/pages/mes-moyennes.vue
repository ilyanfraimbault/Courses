<script setup lang="ts">
import type { MatiereNotee, MesNotes } from '~~/shared/types/matieres'
import { PARCOURS } from '~~/shared/types/matieres'
import { ecrireMoyenne, moyenneSemestre, moyenneUe, semestreCourant } from '~~/shared/utils/moyennes'

definePageMeta({ layout: 'cours' })

/**
 * Le tableau des moyennes : on saisit sa moyenne dans chaque matière, et les
 * moyennes d'UE et de semestre se recalculent à chaque frappe, avec les
 * coefficients et les ECTS du programme de l'école.
 *
 * Chaque case s'enregistre seule, à la frappe, comme le code écrit sous une
 * question : jamais au montage, jamais avant que la lecture ait réussi, et
 * jamais le tableau entier — un onglet resté ouvert écraserait une note saisie
 * ailleurs depuis.
 */
// `deep` : une note se modifie en place, et les moyennes calculées doivent le
// voir — les données de useFetch sont superficielles par défaut.
const { data, status } = await useLazyFetch<MesNotes>('/api/notes', { server: false, deep: true })

// L'onglet du semestre en cours.
const onglet = ref(String(semestreCourant()))
const onglets = computed(() => (data.value?.semestres ?? []).map(s => ({ label: `S${s.semestre}`, value: String(s.semestre) })))
const semestre = computed(() => data.value?.semestres.find(s => String(s.semestre) === onglet.value) ?? null)

const moyenne = computed(() => semestre.value ? moyenneSemestre(semestre.value.ues) : null)
const uesRenseignees = computed(() => semestre.value?.ues.filter(ue => moyenneUe(ue) !== null).length ?? 0)

const etats = reactive(new Map<number, 'envoi' | 'ok' | 'erreur'>())
const minuteurs = new Map<number, ReturnType<typeof setTimeout>>()

function saisir(m: MatiereNotee, valeur: number | null | undefined) {
  const note = typeof valeur === 'number' && Number.isFinite(valeur) ? Math.min(20, Math.max(0, valeur)) : null
  if (note === m.note) return
  m.note = note
  clearTimeout(minuteurs.get(m.id))
  // Une pause dans la frappe, pas chaque chiffre : « 14,5 » n'a pas à
  // s'enregistrer trois fois.
  minuteurs.set(m.id, setTimeout(() => envoyer(m), 500))
}

async function envoyer(m: MatiereNotee) {
  if (status.value !== 'success') return
  etats.set(m.id, 'envoi')
  try {
    await $fetch('/api/notes', { method: 'PUT', body: { matiere: m.id, valeur: m.note } })
    etats.set(m.id, 'ok')
  } catch {
    etats.set(m.id, 'erreur')
  }
}

function couleur(valeur: number | null) {
  if (valeur === null) return 'text-dimmed'
  return valeur >= 10 ? 'text-success' : 'text-error'
}

useSeoMeta({ title: 'Mes moyennes' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Mes moyennes"
      description="Saisis ta moyenne dans chaque matière : celles des UE et du semestre se calculent avec les coefficients et les ECTS du programme."
    />

    <UPageBody>
      <template v-if="data">
        <UAlert
          v-if="!data.parcours"
          class="mb-4"
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          title="Choisis ton parcours pour voir les UE du S7 au S9."
        />

        <UTabs
          v-model="onglet"
          :items="onglets"
          :content="false"
          size="sm"
          class="mb-6"
        />

        <template v-if="semestre">
          <div class="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-default px-4 py-3">
            <span class="text-sm text-muted">Moyenne du S{{ semestre.semestre }}</span>
            <span
              class="text-2xl font-semibold tabular-nums"
              :class="couleur(moyenne)"
            >{{ ecrireMoyenne(moyenne) }}</span>
            <span
              v-if="moyenne !== null && uesRenseignees < semestre.ues.length"
              class="text-xs text-muted"
            >
              provisoire : {{ uesRenseignees }} UE sur {{ semestre.ues.length }} renseignée{{ uesRenseignees > 1 ? 's' : '' }}
            </span>
            <UBadge
              v-if="data.parcours && semestre.ues.some(ue => ue.parcours)"
              class="ms-auto"
              :label="`Parcours ${PARCOURS[data.parcours].court}`"
              color="neutral"
              variant="outline"
              size="sm"
            />
          </div>

          <div class="flex flex-col gap-4">
            <section
              v-for="ue in semestre.ues"
              :key="`${ue.code}-${ue.parcours}`"
              class="rounded-lg border border-default"
            >
              <header class="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-default px-4 py-2">
                <span class="text-xs font-semibold text-muted tabular-nums">{{ ue.code }}</span>
                <span class="min-w-0 flex-1 text-sm font-medium text-highlighted">{{ ue.intitule }}</span>
                <span class="text-xs text-muted">{{ ue.ects }} ECTS</span>
                <span
                  class="w-14 text-right text-sm font-semibold tabular-nums"
                  :class="couleur(moyenneUe(ue))"
                >{{ ecrireMoyenne(moyenneUe(ue)) }}</span>
              </header>
              <ul class="m-0 list-none p-0">
                <li
                  v-for="m in ue.matieres"
                  :key="m.id"
                  class="flex items-center gap-3 px-4 py-1.5"
                >
                  <span class="min-w-0 flex-1 text-sm">{{ m.intitule }}</span>
                  <span class="shrink-0 text-xs text-dimmed tabular-nums">
                    {{ m.coef ? `coef ${m.coef}` : 'sans coef' }}
                  </span>
                  <UIcon
                    v-if="etats.get(m.id) === 'erreur'"
                    name="i-lucide-circle-alert"
                    class="size-4 shrink-0 text-error"
                    title="Non enregistrée : modifie la case pour réessayer"
                  />
                  <UInputNumber
                    :model-value="m.note ?? undefined"
                    :min="0"
                    :max="20"
                    :step="0.01"
                    :increment="false"
                    :decrement="false"
                    :format-options="{ maximumFractionDigits: 2 }"
                    locale="fr-FR"
                    placeholder="—"
                    size="sm"
                    class="w-20 shrink-0"
                    :disabled="!m.coef"
                    :aria-label="`Moyenne en ${m.intitule}`"
                    @update:model-value="(v: number | null | undefined) => saisir(m, v)"
                  />
                </li>
              </ul>
            </section>
          </div>
        </template>
      </template>

      <div
        v-else-if="status === 'error'"
        class="text-sm text-muted"
      >
        Les moyennes n'ont pas pu être lues.
      </div>
      <div
        v-else
        class="flex flex-col gap-3"
      >
        <USkeleton class="h-12 w-full" />
        <USkeleton class="h-32 w-full" />
      </div>
    </UPageBody>
  </UPage>
</template>
