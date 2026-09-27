<script setup lang="ts">
import type { ResumeControle } from '~~/shared/types/controles'
import type { QuestionQuiz, SessionQuiz } from '~~/shared/types/quiz'
import type { Revisions } from '~~/shared/types/revisions'
import { niveauxDuChemin } from '~~/shared/utils/niveaux'

definePageMeta({ layout: 'cours' })

const comptes = useComptesQuestions()
const resume = useResumeProgression()
const { items: todo } = useTodo()

/**
 * Les contrôles à venir, en tête de page : c'est ce qui dit quoi faire
 * aujourd'hui. Données du compte, donc lues au montage seulement.
 */
const { data: controles } = await useLazyFetch<ResumeControle[]>('/api/controles', {
  server: false,
  query: { fuseau: fuseauLocal() }
})
const prochains = computed(() => (controles.value ?? []).filter(c => c.joursRestants >= 0).slice(0, 3))

/** Ce qui revient aujourd'hui dans la révision espacée, matière par matière. */
const { data: revisions } = await useLazyFetch<Revisions>('/api/revisions', {
  server: false,
  query: { fuseau: fuseauLocal() }
})

/**
 * La liste du jour : ce qu'un contrôle demande, ce qui revient, ce qui est en
 * dette. Rien d'autre — c'est la page qu'on ouvre pour savoir quoi faire, pas
 * pour tout voir.
 *
 * Un contrôle n'y entre que s'il demande quelque chose aujourd'hui ; une
 * matière, que si quelque chose y revient ou y est en dette.
 */
const taches = computed(() => {
  const liste: { cle: string, icone: string, ton: 'primary' | 'warning' | 'error', titre: string, detail: string, action: string, controle?: number, seance?: Record<string, unknown> }[] = []
  for (const c of prochains.value) {
    if (!c.aujourdhui) continue
    const consigne = consigneDuJour(c)
    if (consigne === 'Journée libre' || consigne === 'Programme su') continue
    liste.push({
      cle: `controle-${c.id}`,
      icone: 'i-lucide-calendar-check',
      ton: 'primary',
      titre: c.titre,
      detail: `${consigne} · ${echeance(c.joursRestants)}`,
      action: 'Ouvrir',
      controle: c.id
    })
  }
  for (const m of revisions.value?.matieres ?? []) {
    if (m.aRevoir) {
      liste.push({
        cle: `revoir-${m.cle}`,
        icone: 'i-lucide-repeat',
        ton: 'warning',
        titre: `${m.aRevoir} question${m.aRevoir > 1 ? 's' : ''} à revoir`,
        detail: `${m.titre} · sues, et c'est le moment de vérifier qu'elles le restent`,
        action: 'Réviser',
        seance: { matiere: m.cle, aRevoir: true, taille: m.aRevoir }
      })
    }
    if (m.enDette) {
      liste.push({
        cle: `dette-${m.cle}`,
        icone: 'i-lucide-rotate-ccw',
        ton: 'error',
        titre: `${m.enDette} question${m.enDette > 1 ? 's' : ''} ratée${m.enDette > 1 ? 's' : ''} à retrouver`,
        detail: `${m.titre} · la dette, ratée quelque part et pas encore retrouvée`,
        action: 'Reprendre',
        seance: { matiere: m.cle, erreurs: true, taille: m.enDette }
      })
    }
  }
  return liste
})

/** Ce qui reviendra demain, pour qu'une journée vide ne donne pas l'impression d'avoir fini. */
const demain = computed(() => (revisions.value?.matieres ?? []).reduce((n, m) => n + m.demain, 0))
const prochaineRevision = computed(() =>
  (revisions.value?.matieres ?? []).map(m => m.prochaine).filter((j): j is string => !!j).sort()[0] ?? null)

const lancement = ref<string | null>(null)
const erreurSeance = ref<string | null>(null)

/** Ouvre la séance d'une tâche et y envoie. Le fuseau part avec : l'échéance se compte chez l'élève. */
async function lancer(cle: string, corps: Record<string, unknown>) {
  if (lancement.value) return
  lancement.value = cle
  erreurSeance.value = null
  try {
    const taille = Math.min(60, Math.max(5, Number(corps.taille) || 5))
    const { session } = await $fetch<{ session: SessionQuiz, question: QuestionQuiz | null }>('/api/quiz/session', {
      method: 'POST',
      query: { fuseau: fuseauLocal() },
      body: { themes: [], sections: [], ...corps, taille }
    })
    await navigateTo(`/quiz/${session.id}`)
  } catch (e) {
    erreurSeance.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage || 'La séance n\'a pas pu démarrer.'
    lancement.value = null
  }
}

const titreDuJour = computed(() => {
  const jour = revisions.value?.aujourdhui
  if (!jour) return ''
  const texte = jourLong(jour)
  return texte.charAt(0).toUpperCase() + texte.slice(1)
})

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

useSeoMeta({ title: 'Aujourd\'hui' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Aujourd'hui"
      :description="titreDuJour || 'Ce que tes contrôles demandent, ce qui revient, ce qui est en dette.'"
    />

    <UPageBody>
      <!-- La liste du jour. Branchée sur les données, pas sur leur chargement :
           le rendu serveur et le premier rendu client coïncident. -->
      <section class="mb-10">
        <UAlert
          v-if="erreurSeance"
          class="mb-3"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="erreurSeance"
        />
        <div
          v-if="taches.length"
          class="flex flex-col gap-2"
        >
          <div
            v-for="t in taches"
            :key="t.cle"
            class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-default px-4 py-3"
          >
            <UIcon
              :name="t.icone"
              class="size-5 shrink-0"
              :class="{ 'text-primary': t.ton === 'primary', 'text-warning': t.ton === 'warning', 'text-error': t.ton === 'error' }"
            />
            <span class="min-w-0 flex-1">
              <span class="block font-medium text-highlighted">{{ t.titre }}</span>
              <span class="block text-xs text-muted">{{ t.detail }}</span>
            </span>
            <UButton
              v-if="t.controle"
              size="sm"
              variant="subtle"
              trailing-icon="i-lucide-arrow-right"
              :label="t.action"
              :to="`/mes-controles/${t.controle}`"
            />
            <UButton
              v-else-if="t.seance"
              size="sm"
              :color="t.ton"
              :variant="t.ton === 'warning' ? 'solid' : 'subtle'"
              icon="i-lucide-zap"
              :label="t.action"
              :loading="lancement === t.cle"
              @click="lancer(t.cle, t.seance)"
            />
          </div>
        </div>
        <div
          v-else-if="revisions && controles"
          class="rounded-lg border border-dashed border-default px-4 py-5 text-center"
        >
          <UIcon
            name="i-lucide-coffee"
            class="size-6 text-dimmed"
          />
          <p class="mt-2 mb-0 font-medium text-highlighted">
            Rien d'urgent aujourd'hui
          </p>
          <p class="mx-auto mt-1 mb-0 max-w-md text-sm text-muted">
            <template v-if="demain">
              {{ demain }} question{{ demain > 1 ? 's' : '' }} reviendr{{ demain > 1 ? 'ont' : 'a' }} demain.
            </template>
            <template v-else-if="prochaineRevision">
              Prochaine révision le {{ jourLong(prochaineRevision) }}.
            </template>
            Une question trouvée revient d'elle-même au bout d'un jour, puis de trois, de sept… tant que tu la retrouves.
          </p>
        </div>
        <div
          v-else
          class="flex flex-col gap-2"
        >
          <USkeleton class="h-14 w-full" />
          <USkeleton class="h-14 w-full" />
        </div>
      </section>

      <div
        v-if="prochains.length"
        class="mb-8"
      >
        <div class="flex items-center gap-2">
          <h2 class="m-0 flex-1 text-lg font-medium text-highlighted">
            Tes prochains contrôles
          </h2>
          <UButton
            to="/mes-controles"
            size="xs"
            color="neutral"
            variant="ghost"
            trailing-icon="i-lucide-chevron-right"
            label="Tous"
          />
        </div>
        <div class="mt-3 flex flex-col gap-2">
          <ULink
            v-for="c in prochains"
            :key="c.id"
            :to="`/mes-controles/${c.id}`"
            class="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-default px-4 py-3 transition-colors hover:border-primary/60 hover:bg-elevated/50"
          >
            <UIcon
              name="i-lucide-calendar-check"
              class="size-5 shrink-0 text-primary"
            />
            <span class="min-w-0 flex-1">
              <span class="block font-medium text-highlighted group-hover:text-primary">{{ c.titre }}</span>
              <span class="block text-xs text-muted">
                {{ consigneDuJour(c) }} · prêt à {{ partSue(c.etat) }} %
              </span>
            </span>
            <UBadge
              :color="c.joursRestants <= 2 ? 'error' : c.joursRestants <= 7 ? 'warning' : 'neutral'"
              variant="subtle"
              :label="echeance(c.joursRestants)"
            />
          </ULink>
        </div>
      </div>
      <div
        v-else-if="controles"
        class="mb-8 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-default px-4 py-3"
      >
        <UIcon
          name="i-lucide-calendar-plus"
          class="size-5 shrink-0 text-dimmed"
        />
        <p class="m-0 min-w-0 flex-1 text-sm text-muted">
          Un contrôle en vue ? Déclare-le, et le site te dira chaque jour quoi réviser d'ici là.
        </p>
        <UButton
          to="/mes-controles/nouveau"
          size="sm"
          variant="subtle"
          icon="i-lucide-plus"
          label="Nouveau contrôle"
        />
      </div>

      <h2 class="m-0 text-lg font-medium text-highlighted">
        Où j'en suis
      </h2>
      <p class="mt-1 mb-3 text-sm text-muted">
        {{ avancement.reussies }} question{{ avancement.reussies > 1 ? 's' : '' }} trouvée{{ avancement.reussies > 1 ? 's' : '' }}
        sur {{ avancement.total }}, toutes matières confondues.
      </p>
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
