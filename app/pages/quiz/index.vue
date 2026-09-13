<script setup lang="ts">
import type { CatalogueQuiz, FiltreQuiz, HistoriqueQuiz, MatiereCatalogue, QuestionQuiz, SessionQuiz } from '~~/shared/types/quiz'

definePageMeta({ layout: 'cours' })

/**
 * Le catalogue est du contenu, l'historique est une donnée — mais les deux se
 * lisent au montage, jamais au rendu serveur. C'est la règle de tout le site :
 * le HTML servi est le même pour tout le monde, donc cacheable, et il ne peut
 * rien laisser fuir.
 */
const { data: catalogue } = await useLazyFetch<CatalogueQuiz>('/api/quiz/catalogue', { server: false })
const { data: historique, refresh: relireHistorique } = await useLazyFetch<HistoriqueQuiz>('/api/quiz/historique', {
  server: false
})

const vide = (matiere: string | null): FiltreQuiz => ({ matiere, themes: [], sections: [], notions: [], erreurs: false })

const filtre = ref<FiltreQuiz>(vide(null))
const taille = ref(20)
const lancement = ref(false)
const erreur = ref<string | null>(null)

const matiere = computed<MatiereCatalogue | null>(() =>
  catalogue.value?.matieres.find(m => m.cle === filtre.value.matiere) ?? null)
const plusieursMatieres = computed(() => (catalogue.value?.matieres.length ?? 0) > 1)

/**
 * Une matière, un chapitre ou un point de cours passés en adresse présélectionnent
 * le filtre : c'est par là que « Mes domaines » et le tableau de bord envoient
 * ici, avec la case déjà cochée.
 *
 * La matière vient en premier, et elle se déduit au besoin : un lien vers un
 * chapitre ouvre la matière qui le porte. Sans rien en adresse, c'est la
 * première matière du sommaire.
 *
 * Les clés sont confrontées au catalogue avant d'être retenues. Un lien mis en
 * favori survit ainsi à un cours renommé — il ouvre le quiz sur toute la
 * matière, ce qui est le comportement par défaut, au lieu de préparer une
 * séance vide.
 */
const route = useRoute()

function listeQuery(valeur: unknown): string[] {
  return (Array.isArray(valeur) ? valeur : [valeur]).filter((v): v is string => typeof v === 'string' && !!v)
}

const notionsDe = (m: MatiereCatalogue) => m.themes.flatMap(t => t.sections.flatMap(s => s.notions))

watch(catalogue, (c) => {
  if (!c || filtre.value.matiere) return
  const themes = listeQuery(route.query.theme)
  const notions = listeQuery(route.query.notion)
  const demandee = listeQuery(route.query.matiere)[0]
  const trouvee = c.matieres.find(m => m.cle === demandee)
    ?? c.matieres.find(m => m.themes.some(t => themes.includes(t.cle)))
    ?? c.matieres.find(m => notionsDe(m).some(n => notions.includes(n.cle)))
    ?? c.matieres[0]
  if (!trouvee) return
  const themesConnus = new Set(trouvee.themes.map(t => t.cle))
  const notionsConnues = new Set(notionsDe(trouvee).map(n => n.cle))
  filtre.value = {
    ...vide(trouvee.cle),
    themes: themes.filter(t => themesConnus.has(t)),
    notions: notions.filter(n => notionsConnues.has(n))
  }
}, { immediate: true })

/** Changer de matière repart d'une sélection vierge : des chapitres d'un autre cours n'y ont pas de sens. */
const matiereChoisie = computed({
  get: () => filtre.value.matiere ?? null,
  set: (cle: string | null) => {
    if (cle !== filtre.value.matiere) filtre.value = vide(cle)
  }
})

/** Le compte du filtre, calculé comme le serveur le calculera. */
const disponibles = computed(() => {
  const m = matiere.value
  if (!m) return 0
  const erreurs = !!filtre.value.erreurs
  const compte = (e: { questions: number, ratees: number }) => (erreurs ? e.ratees : e.questions)
  const notions = filtre.value.notions ?? []
  if (!filtre.value.themes.length && !filtre.value.sections.length && !notions.length) {
    return compte(m)
  }
  let total = 0
  for (const theme of m.themes) {
    if (filtre.value.themes.includes(theme.cle)) {
      total += compte(theme)
      continue
    }
    for (const section of theme.sections) {
      if (filtre.value.sections.includes(section.cle)) {
        total += compte(section)
        continue
      }
      for (const notion of section.notions) {
        if (notions.includes(notion.cle)) total += compte(notion)
      }
    }
  }
  return total
})

const tailleMin = computed(() => catalogue.value?.tailleMin ?? 5)
const tailleMax = computed(() =>
  Math.max(tailleMin.value, Math.min(catalogue.value?.tailleMax ?? 60, disponibles.value || 1)))

const raccourcis = computed(() =>
  [10, 20, 30, 40, 60].filter(n => n >= tailleMin.value && n <= tailleMax.value))

// Réduire la sélection ne doit pas laisser une taille qu'on ne peut plus servir.
watch(tailleMax, (max) => {
  if (taille.value > max) taille.value = max
  if (taille.value < tailleMin.value) taille.value = tailleMin.value
})

async function commencer() {
  if (lancement.value) return
  lancement.value = true
  erreur.value = null
  try {
    const { session } = await $fetch<{ session: SessionQuiz, question: QuestionQuiz | null }>('/api/quiz/session', {
      method: 'POST',
      body: {
        matiere: filtre.value.matiere,
        themes: filtre.value.themes,
        sections: filtre.value.sections,
        notions: filtre.value.notions ?? [],
        erreurs: !!filtre.value.erreurs,
        taille: taille.value
      }
    })
    await navigateTo(`/quiz/${session.id}`)
  } catch (e) {
    const message = (e as { data?: { statusMessage?: string } })?.data?.statusMessage
    erreur.value = message || 'La séance n\'a pas pu démarrer.'
    lancement.value = false
  }
}

/** Reprendre la sélection sur la seule dette, dans toute la matière. */
function reviserCeQuiResiste() {
  filtre.value = { ...vide(filtre.value.matiere ?? null), erreurs: true }
}

/** Ce qui résiste, dans la matière choisie : la dette d'un autre cours n'a rien à faire ici. */
const resistent = computed(() =>
  (historique.value?.resistent ?? []).filter(s => !filtre.value.matiere || s.matiere === filtre.value.matiere))

async function clore(id: number) {
  await $fetch(`/api/quiz/session/${id}`, { method: 'DELETE' })
  await relireHistorique()
}

function dateCourte(t: number) {
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function tonScore(s: { acquises: number, taille: number }) {
  if (s.taille && s.acquises >= s.taille) return 'success'
  return s.acquises > 0 ? 'warning' : 'neutral'
}

useSeoMeta({ title: 'Quiz' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Quiz"
      description="Une question au milieu de l'écran, une seule à la fois. Une erreur ne coûte pas un point : elle renvoie la place à la fin de la file, avec une autre question sur le même point de cours. La séance se termine quand tout est acquis, pas quand les questions sont épuisées."
    >
      <template #headline>
        <UBadge
          color="primary"
          variant="subtle"
          size="md"
          icon="i-lucide-zap"
          label="Entraînement libre"
        />
      </template>
    </UPageHeader>

    <UPageBody>
      <UAlert
        v-if="historique?.encours"
        color="primary"
        variant="subtle"
        icon="i-lucide-play"
        title="Une séance est en cours"
        :description="`${historique.encours.acquises} place${historique.encours.acquises > 1 ? 's' : ''} acquise${historique.encours.acquises > 1 ? 's' : ''} sur ${historique.encours.taille}, ${historique.encours.poses} question${historique.encours.poses > 1 ? 's' : ''} posée${historique.encours.poses > 1 ? 's' : ''} — ${[historique.encours.matiereTitre, ...historique.encours.themes].filter(Boolean).join(', ')}.`"
      >
        <template #actions>
          <UButton
            color="primary"
            size="sm"
            icon="i-lucide-arrow-right"
            label="Reprendre"
            :to="`/quiz/${historique.encours.id}`"
          />
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            label="Clore"
            @click="clore(historique.encours!.id)"
          />
        </template>
      </UAlert>

      <!-- L'affichage ne se branche que sur les données, jamais sur l'état de
           chargement : `pending` ne vaut pas la même chose au rendu serveur et
           à l'hydratation, et Vue signalait la divergence à chaque visite. -->
      <div
        v-if="!catalogue"
        class="mt-8 flex items-center gap-2 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-4 animate-spin"
        />
        <span>Chargement du catalogue…</span>
      </div>

      <template v-else>
        <div class="mt-8">
          <h2 class="text-lg font-medium text-highlighted">
            Quelle matière ?
          </h2>
          <p class="mt-1 mb-0 text-sm text-muted">
            Une séance reste dans une matière : deux cours mélangés ne se révisent ni l'un ni l'autre.
          </p>
          <MatiereChoix
            v-model="matiereChoisie"
            class="mt-4"
            :matieres="catalogue.matieres"
          />
        </div>

        <div
          v-if="matiere"
          class="mt-8"
        >
          <h2 class="text-lg font-medium text-highlighted">
            Sur quoi ?
          </h2>
          <p class="mt-1 mb-0 text-sm text-muted">
            Un chapitre entier, ou quelques parties de son cours. Ce qui est coché s'additionne, et le
            nombre écrit à droite est celui des questions disponibles derrière la case.
          </p>

          <QuizFiltre
            :key="matiere.cle"
            v-model="filtre"
            class="mt-4"
            :catalogue="matiere"
          />
        </div>

        <div
          v-if="matiere"
          class="mt-8"
        >
          <h2 class="text-lg font-medium text-highlighted">
            Combien de questions ?
          </h2>
          <p class="mt-1 mb-0 text-sm text-muted">
            C'est le nombre de places à acquérir. Chaque erreur en rallonge la file, jamais le compte.
          </p>

          <div class="mt-4 flex flex-wrap items-center gap-2">
            <UButton
              v-for="n in raccourcis"
              :key="n"
              size="sm"
              :color="taille === n ? 'primary' : 'neutral'"
              :variant="taille === n ? 'solid' : 'outline'"
              class="tabular-nums"
              :label="String(n)"
              @click="taille = n"
            />
            <span class="text-sm text-muted tabular-nums">
              <strong class="text-highlighted">{{ taille }}</strong> question{{ taille > 1 ? 's' : '' }}
            </span>
          </div>

          <USlider
            v-model="taille"
            class="mt-4 max-w-md"
            :min="tailleMin"
            :max="tailleMax"
            :step="1"
            :aria-label="'Nombre de questions'"
          />

          <p
            v-if="disponibles < taille"
            class="mt-3 mb-0 text-sm text-warning"
          >
            La sélection ne contient que {{ disponibles }} question{{ disponibles > 1 ? 's' : '' }} :
            la séance en comptera autant.
          </p>

          <UAlert
            v-if="erreur"
            class="mt-4"
            color="error"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :description="erreur"
          />

          <div class="mt-5 flex flex-wrap items-center gap-2">
            <UButton
              size="lg"
              color="primary"
              icon="i-lucide-play"
              :loading="lancement"
              :disabled="!disponibles"
              label="Commencer la séance"
              @click="commencer"
            />
            <UButton
              size="lg"
              color="neutral"
              variant="ghost"
              icon="i-lucide-list-plus"
              label="Composer un QCM plutôt"
              :to="{ path: '/mes-qcm/nouveau', query: { matiere: matiere.cle } }"
            />
          </div>
        </div>
      </template>

      <div
        v-if="resistent.length"
        class="mt-10"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-lg font-medium text-highlighted">
            Ce qui résiste
          </h2>
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-target"
            label="M'interroger là-dessus"
            @click="reviserCeQuiResiste"
          />
        </div>
        <p class="mt-1 mb-3 text-sm text-muted">
          Ce que tu as raté et pas encore retrouvé, par partie du cours — exercices, QCM et quiz
          confondus. Une question s'en retire dès qu'elle tombe juste, où que ce soit.
        </p>
        <div class="flex flex-col gap-2">
          <div
            v-for="section in resistent"
            :key="section.cle"
            class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-default px-3 py-2"
          >
            <UIcon
              name="i-lucide-alert-circle"
              class="size-4 shrink-0 text-error"
            />
            <span class="min-w-0 flex-1 text-sm text-highlighted">
              {{ section.titre }}
              <span
                v-if="section.themeTitre"
                class="text-dimmed"
              >— {{ section.themeTitre }}</span>
            </span>
            <span class="shrink-0 text-xs text-muted tabular-nums">
              {{ section.enDette }} à revoir · {{ section.fautes }} faute{{ section.fautes > 1 ? 's' : '' }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="historique?.sessions?.length"
        class="mt-10"
      >
        <h2 class="text-lg font-medium text-highlighted">
          Tes séances
        </h2>
        <div class="mt-3 flex flex-col gap-2">
          <div
            v-for="s in historique.sessions"
            :key="s.id"
            class="flex flex-wrap items-center gap-3 rounded-lg border border-default px-3 py-2"
          >
            <UBadge
              :color="tonScore(s)"
              variant="subtle"
              size="sm"
              class="shrink-0 tabular-nums"
              :label="`${s.acquises} / ${s.taille}`"
            />
            <span class="min-w-0 flex-1 truncate text-sm text-highlighted">
              <span
                v-if="plusieursMatieres && s.matiereTitre"
                class="text-dimmed"
              >{{ s.matiereTitre }} · </span>{{ s.themes.join(', ') }}
            </span>
            <span class="shrink-0 text-xs text-muted tabular-nums">
              {{ s.poses }} posée{{ s.poses > 1 ? 's' : '' }},
              {{ s.fautes }} faute{{ s.fautes > 1 ? 's' : '' }} · {{ dateCourte(s.commencee_le) }}
            </span>
            <UButton
              v-if="!s.finie"
              size="xs"
              color="primary"
              variant="soft"
              icon="i-lucide-arrow-right"
              label="Reprendre"
              :to="`/quiz/${s.id}`"
            />
          </div>
        </div>
      </div>
    </UPageBody>
  </UPage>
</template>
