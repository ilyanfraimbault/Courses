<script setup lang="ts">
definePageMeta({ layout: 'cours' })

const comptes = useComptesQuestions()
const resume = useResumeProgression()
const { items: todo } = useTodo()

/** Toutes les fiches qui portent des questions, avec ce qu'on en sait. */
const { data: fiches } = await useAsyncData('cours-fiches', async () => {
  const lignes = await queryCollection('cours')
    .select('path', 'title', 'description', 'type', 'annee', 'matiere', 'ordre', 'icone', 'questions')
    .all()
  return lignes
    .filter(l => (l.questions ?? 0) > 0)
    .map(l => ({ ...l, chemin: cheminCanonique(l.path) }))
}, { default: () => [] })

const avancement = computed(() => {
  let total = 0
  let reussies = 0
  for (const f of fiches.value) {
    const t = comptes.value[f.chemin] ?? f.questions ?? 0
    total += t
    reussies += Math.min(resume.value[f.chemin]?.reussies ?? 0, t)
  }
  return { total, reussies, pourcentage: total ? Math.round(100 * reussies / total) : 0 }
})

/** Les fiches commencées mais pas finies, la plus récemment touchée d'abord. */
const enCours = computed(() =>
  fiches.value
    .map(f => ({ f, etat: resume.value[f.chemin] }))
    .filter(({ f, etat }) => etat && etat.reussies > 0 && etat.reussies < (comptes.value[f.chemin] ?? f.questions ?? 0))
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

function part(chemin: string) {
  const total = comptes.value[chemin] ?? 0
  const reussies = Math.min(resume.value[chemin]?.reussies ?? 0, total)
  return { total, reussies }
}

useSeoMeta({ title: 'Où j\'en suis' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Où j'en suis"
      :description="`${avancement.reussies} questions trouvées sur ${avancement.total}, toutes fiches confondues.`"
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
            <span class="min-w-0 flex-1 truncate text-sm text-highlighted">{{ f.title }}</span>
            <span class="shrink-0 text-xs text-muted tabular-nums">
              {{ part(f.chemin).reussies }} / {{ part(f.chemin).total }}
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
