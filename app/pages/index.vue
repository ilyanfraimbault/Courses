<script setup lang="ts">
import { niveauxDuChemin } from '~~/shared/utils/niveaux'

definePageMeta({ layout: 'cours' })

const comptes = useComptesQuestions()
const resume = useResumeProgression()
const { items: todo } = useTodo()

/**
 * Toutes les pages du contenu : les fiches qui portent des questions, et les
 * pages d'index qui nomment les années et les matières.
 */
const { data: pages } = await useAsyncData('cours-tableau-de-bord', async () => {
  const lignes = await queryCollection('cours')
    .select('path', 'title', 'description', 'type', 'ordre', 'icone', 'questions')
    .all()
  return lignes.map(l => ({ ...l, chemin: cheminCanonique(l.path) }))
}, { default: () => [] })

const parChemin = computed(() => new Map(pages.value.map(p => [p.chemin, p])))
const fiches = computed(() => pages.value.filter(p => (p.questions ?? 0) > 0))

function part(f: { chemin: string, questions?: number | null }) {
  const total = comptes.value[f.chemin] ?? f.questions ?? 0
  const reussies = Math.min(resume.value[f.chemin]?.reussies ?? 0, total)
  return { total, reussies }
}

const avancement = computed(() => {
  let total = 0
  let reussies = 0
  for (const f of fiches.value) {
    const p = part(f)
    total += p.total
    reussies += p.reussies
  }
  return { total, reussies, pourcentage: total ? Math.round(100 * reussies / total) : 0 }
})

/**
 * L'avancement matière par matière, dans l'ordre du sommaire.
 *
 * Un pourcentage de tout le site mêlerait deux cours qui n'ont rien à voir :
 * c'est matière par matière qu'on sait où on en est. Le chiffre global reste en
 * tête, pour la vue d'ensemble.
 */
const matieres = computed(() => {
  const groupes = new Map<string, {
    cle: string
    titre: string
    annee: string | null
    anneeChemin: string | null
    icone: string | null
    ordre: number
    total: number
    reussies: number
    fiches: number
    ouvertes: number
  }>()
  for (const f of fiches.value) {
    const { annee, matiere } = niveauxDuChemin(f.chemin)
    if (!matiere) continue
    const page = parChemin.value.get(matiere)
    const groupe = groupes.get(matiere) ?? {
      cle: matiere,
      titre: page?.title ?? matiere,
      annee: annee ? parChemin.value.get(annee)?.title ?? null : null,
      anneeChemin: annee,
      icone: page?.icone ?? null,
      ordre: page?.ordre ?? 999,
      total: 0,
      reussies: 0,
      fiches: 0,
      ouvertes: 0
    }
    const p = part(f)
    groupe.total += p.total
    groupe.reussies += p.reussies
    groupe.fiches += 1
    if (resume.value[f.chemin]) groupe.ouvertes += 1
    groupes.set(matiere, groupe)
  }
  return [...groupes.values()].sort((a, b) =>
    (a.anneeChemin ?? '').localeCompare(b.anneeChemin ?? '')
    || a.ordre - b.ordre
    || a.titre.localeCompare(b.titre, 'fr'))
})

/** « Remise à niveau en maths » pour une fiche : ce qui distingue deux « Exercices » de deux cours. */
function matiereDe(chemin: string): string | null {
  const matiere = niveauxDuChemin(chemin).matiere
  return matiere ? parChemin.value.get(matiere)?.title ?? null : null
}

/** Les fiches commencées mais pas finies, la plus récemment touchée d'abord. */
const enCours = computed(() =>
  fiches.value
    .map(f => ({ f, etat: resume.value[f.chemin] }))
    .filter(({ f, etat }) => etat && etat.reussies > 0 && etat.reussies < part(f).total)
    .sort((a, b) => (b.etat!.maj ?? 0) - (a.etat!.maj ?? 0))
    .slice(0, 4)
)

/** Où reprendre : la fiche touchée le plus récemment, finie ou non. */
const reprendre = computed(() => {
  const candidates = fiches.value
    .map(f => ({ f, etat: resume.value[f.chemin] }))
    .filter(({ etat }) => etat?.maj)
    .sort((a, b) => (b.etat!.maj ?? 0) - (a.etat!.maj ?? 0))
  return candidates[0] ?? null
})

const jamaisOuvertes = computed(() =>
  fiches.value.filter(f => !resume.value[f.chemin]).length)

const todoAFaire = computed(() => todo.value.filter(i => !i.fait_le).length)

function pourcentage(g: { total: number, reussies: number }) {
  return g.total ? Math.round(100 * g.reussies / g.total) : 0
}

useSeoMeta({ title: 'Où j\'en suis' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Où j'en suis"
      :description="`${avancement.reussies} questions trouvées sur ${avancement.total}, toutes matières confondues.`"
    />

    <UPageBody>
      <UProgress
        size="md"
        :color="avancement.pourcentage === 100 ? 'success' : 'primary'"
        :model-value="avancement.reussies"
        :max="avancement.total || 1"
      />

      <div class="mt-6 grid gap-4 sm:grid-cols-3">
        <UCard>
          <p class="text-2xl font-medium text-highlighted tabular-nums">
            {{ avancement.pourcentage }} %
          </p>
          <p class="text-sm text-muted">
            de l'ensemble des questions
          </p>
        </UCard>
        <UCard>
          <p class="text-2xl font-medium text-highlighted tabular-nums">
            {{ todoAFaire }}
          </p>
          <p class="text-sm text-muted">
            dans la to-do,
            <ULink
              to="/ma-to-do"
              class="text-primary"
            >à faire</ULink>
          </p>
        </UCard>
        <UCard>
          <p class="text-2xl font-medium text-highlighted tabular-nums">
            {{ jamaisOuvertes }}
          </p>
          <p class="text-sm text-muted">
            fiche{{ jamaisOuvertes > 1 ? 's' : '' }} jamais ouverte{{ jamaisOuvertes > 1 ? 's' : '' }}
          </p>
        </UCard>
      </div>

      <div class="mt-8">
        <h2 class="text-lg font-medium text-highlighted">
          Tes matières
        </h2>
        <div class="mt-3 flex flex-col gap-3">
          <div
            v-for="matiere in matieres"
            :key="matiere.cle"
            class="rounded-lg border border-default px-4 py-3"
          >
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
              <UIcon
                :name="matiere.icone || 'i-lucide-book-open'"
                class="size-5 shrink-0 text-primary"
              />
              <ULink
                :to="matiere.cle"
                class="min-w-0 flex-1 group"
              >
                <span
                  v-if="matiere.annee"
                  class="block text-xs text-dimmed"
                >{{ matiere.annee }}</span>
                <span class="block font-medium text-highlighted group-hover:text-primary">{{ matiere.titre }}</span>
              </ULink>
              <span class="shrink-0 text-sm text-muted tabular-nums">
                {{ matiere.reussies }} / {{ matiere.total }} · {{ pourcentage(matiere) }} %
              </span>
            </div>
            <UProgress
              class="mt-2"
              size="xs"
              :color="pourcentage(matiere) === 100 ? 'success' : 'primary'"
              :model-value="matiere.reussies"
              :max="matiere.total || 1"
            />
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span class="me-auto text-xs text-dimmed">
                {{ matiere.ouvertes }} fiche{{ matiere.ouvertes > 1 ? 's' : '' }} ouverte{{ matiere.ouvertes > 1 ? 's' : '' }}
                sur {{ matiere.fiches }}
              </span>
              <UButton
                size="xs"
                color="primary"
                variant="subtle"
                icon="i-lucide-zap"
                label="Quiz"
                :to="{ path: '/quiz', query: { matiere: matiere.cle } }"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="subtle"
                icon="i-lucide-list-plus"
                label="Composer un QCM"
                :to="{ path: '/mes-qcm/nouveau', query: { matiere: matiere.cle } }"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="reprendre"
        class="mt-8"
      >
        <h2 class="text-lg font-medium text-highlighted">
          Reprendre ici
        </h2>
        <CarteLien
          class="mt-3"
          :to="reprendre.f.chemin"
          :titre="reprendre.f.title"
          :description="reprendre.f.description"
          :type="reprendre.f.type"
          :meta="matiereDe(reprendre.f.chemin) ?? undefined"
        />
      </div>

      <div
        v-if="enCours.length"
        class="mt-8"
      >
        <h2 class="text-lg font-medium text-highlighted">
          Commencé, pas fini
        </h2>
        <div class="mt-3 flex flex-col gap-2">
          <ULink
            v-for="{ f } in enCours"
            :key="f.chemin"
            :to="f.chemin"
            class="flex items-center gap-3 rounded-lg border border-default px-3 py-2 hover:border-primary/60"
          >
            <UIcon
              :name="f.icone || 'i-lucide-file-text'"
              class="size-4 shrink-0 text-primary"
            />
            <span class="min-w-0 flex-1 truncate text-sm text-highlighted">
              {{ f.title }}
              <span
                v-if="matieres.length > 1"
                class="text-dimmed"
              >· {{ matiereDe(f.chemin) }}</span>
            </span>
            <span class="shrink-0 text-xs text-muted tabular-nums">
              {{ part(f).reussies }} / {{ part(f).total }}
            </span>
          </ULink>
        </div>
      </div>

      <div class="mt-8 flex flex-wrap items-center gap-2">
        <UButton
          to="/cours"
          icon="i-lucide-library"
          label="Ouvrir le sommaire"
          color="neutral"
          variant="subtle"
        />
        <UButton
          to="/quiz"
          icon="i-lucide-zap"
          label="Lancer un quiz"
          color="primary"
          variant="subtle"
        />
        <UButton
          to="/mes-qcm"
          icon="i-lucide-list-plus"
          label="Mes QCM"
          color="neutral"
          variant="subtle"
        />
        <UButton
          to="/mes-domaines"
          icon="i-lucide-target"
          label="Voir mes domaines"
          color="neutral"
          variant="subtle"
        />
      </div>
    </UPageBody>
  </UPage>
</template>
