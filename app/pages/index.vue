<script setup lang="ts">
import type { ResumeControle } from '~~/shared/types/controles'
import type { CatalogueQuiz, FiltreQuiz, QuestionQuiz, SessionQuiz } from '~~/shared/types/quiz'
import type { Revisions } from '~~/shared/types/revisions'
import { niveauxDuChemin } from '~~/shared/utils/niveaux'

definePageMeta({ layout: 'cours' })

const comptes = useComptesQuestions()
const resume = useResumeProgression()
const { closPar } = useClotures()

/**
 * Le plafond d'une séance du jour. Les paliers de la révision espacée font
 * monter le compte juste après une période de bachotage — trente-trois à
 * revoir le lendemain d'un contrôle —, et l'afficher tel quel transforme
 * l'accueil en liste de reproches. On en pose vingt, le reste glisse à demain.
 */
const TAILLE_SEANCE = 20

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
 * La liste du jour : ce qu'un contrôle demande, et une séance par matière qui
 * n'est pas close. Rien d'autre — c'est la page qu'on ouvre pour savoir quoi
 * faire, pas pour tout voir.
 *
 * La dette, les révisions et le neuf ne font qu'une séance, pas trois boutons :
 * l'élève n'a pas à arbitrer, l'ordre est connu — la dette d'abord, puis ce qui
 * revient, puis de quoi avancer pour finir les vingt places. Sans le neuf, une
 * matière pas encore commencée n'aurait jamais de séance, faute de rien à
 * reprendre ni à revoir. Seule une matière entièrement sue et sans échéance
 * aujourd'hui n'en a pas. Le compte brut reste lisible sur « Mes domaines ».
 */
const taches = computed(() => {
  const liste: { cle: string, icone: string, titre: string, detail: string, action: string, controle?: number, matiere?: string, seance?: Record<string, unknown> }[] = []
  for (const c of prochains.value) {
    if (!c.aujourdhui) continue
    const consigne = consigneDuJour(c)
    if (consigne === 'Journée libre' || consigne === 'Programme su') continue
    liste.push({
      cle: `controle-${c.id}`,
      icone: 'i-lucide-calendar-check',
      titre: c.titre,
      detail: `${consigne} · ${echeance(c.joursRestants)}`,
      action: 'Ouvrir',
      controle: c.id
    })
  }
  for (const m of revisions.value?.matieres ?? []) {
    const dette = Math.min(m.enDette, TAILLE_SEANCE)
    const revoir = Math.min(m.aRevoir, TAILLE_SEANCE - dette)
    const neuves = Math.min(m.nouvelles, TAILLE_SEANCE - dette - revoir)
    // Le neuf qui ne tient pas dans la séance n'« attend » pas : il n'a pas
    // d'échéance. Seules la dette et les révisions glissent à demain.
    const reste = m.enDette + m.aRevoir - dette - revoir
    const total = dette + revoir + neuves
    if (!total) continue
    const morceaux: string[] = []
    if (dette) morceaux.push(`${dette} ratée${dette > 1 ? 's' : ''} à retrouver`)
    if (revoir) morceaux.push(`${revoir} à revoir`)
    if (neuves) morceaux.push(`${neuves} nouvelle${neuves > 1 ? 's' : ''}`)
    liste.push({
      cle: `seance-${m.cle}`,
      icone: 'i-lucide-zap',
      titre: `Ta séance · ${total} question${total > 1 ? 's' : ''}`,
      detail: `${m.titre} · ${morceaux.join(', puis ')}${reste ? ` · ${reste} de plus attendront demain` : ''}`,
      action: 'Lancer',
      matiere: m.cle,
      seance: { matiere: m.cle, erreurs: dette > 0, aRevoir: revoir > 0, nouvelles: neuves > 0, taille: total }
    })
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

/**
 * Choisir les chapitres de la séance du jour.
 *
 * Le choix vaut pour une séance, il ne se retient pas : ce qui doit durer,
 * c'est la clôture. Le catalogue n'est lu qu'à la première ouverture — la
 * plupart des visites lancent la séance telle quelle.
 */
const { data: catalogue, execute: lireCatalogue } = useLazyFetch<CatalogueQuiz>('/api/quiz/catalogue', {
  server: false,
  immediate: false,
  query: { fuseau: fuseauLocal() }
})
const choix = ref<FiltreQuiz | null>(null)
const choixOuvert = computed({
  get: () => !!choix.value,
  set: (ouvert: boolean) => { if (!ouvert) choix.value = null }
})
const matiereChoisie = computed(() => catalogue.value?.matieres.find(m => m.cle === choix.value?.matiere) ?? null)
const filtreJour = useTemplateRef<{ disponibles: number, urgentes: number }>('filtreJour')
const tailleChoisie = computed(() => Math.min(TAILLE_SEANCE, filtreJour.value?.disponibles ?? 0))

async function choisir(matiere: string) {
  choix.value = { matiere, themes: [], sections: [], notions: [], erreurs: true, aRevoir: true, nouvelles: true }
  await lireCatalogue()
}

function lancerChoix() {
  const f = choix.value
  if (!f || !tailleChoisie.value) return
  lancer(`choix-${f.matiere}`, { ...f, taille: tailleChoisie.value })
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
// Ce qui est clos sort de l'accueil : de l'avancement, des matières, de
// « Reprendre ici ». Le sommaire, lui, le garde grisé.
const fiches = computed(() => pages.value.filter(p => (p.questions ?? 0) > 0 && !closPar(p.chemin)))

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
    anneeChemin: string | null
    ordre: number
    total: number
    reussies: number
  }>()
  for (const f of fiches.value) {
    const { annee, matiere } = niveauxDuChemin(f.chemin)
    if (!matiere) continue
    const page = parChemin.value.get(matiere)
    const groupe = groupes.get(matiere) ?? {
      cle: matiere,
      titre: page?.title ?? matiere,
      anneeChemin: annee,
      ordre: page?.ordre ?? 999,
      total: 0,
      reussies: 0
    }
    const p = part(f)
    groupe.total += p.total
    groupe.reussies += p.reussies
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

/** Où reprendre : la fiche touchée le plus récemment, finie ou non. */
const reprendre = computed(() => {
  const candidates = fiches.value
    .map(f => ({ f, etat: resume.value[f.chemin] }))
    .filter(({ etat }) => etat?.maj)
    .sort((a, b) => (b.etat!.maj ?? 0) - (a.etat!.maj ?? 0))
  return candidates[0] ?? null
})

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
              class="size-5 shrink-0 text-primary"
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
            <template v-else-if="t.seance">
              <UButton
                size="sm"
                color="neutral"
                variant="ghost"
                icon="i-lucide-list-filter"
                label="Choisir"
                @click="choisir(t.matiere!)"
              />
              <UButton
                size="sm"
                icon="i-lucide-play"
                :label="t.action"
                :loading="lancement === t.cle"
                @click="lancer(t.cle, t.seance)"
              />
            </template>
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
            Rien à travailler aujourd'hui
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

      <UModal
        v-model:open="choixOuvert"
        title="Sur quoi travailler aujourd'hui ?"
        description="Coche les chapitres ou les parties du cours. La séance y prend la dette, puis ce qui revient, puis du neuf."
        :ui="{ content: 'sm:max-w-2xl' }"
      >
        <template #body>
          <UAlert
            v-if="erreurSeance && choix"
            class="mb-3"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="erreurSeance"
          />
          <QuizFiltre
            v-if="matiereChoisie && choix"
            ref="filtreJour"
            v-model="choix"
            :catalogue="matiereChoisie"
            mode="jour"
          />
          <div
            v-else
            class="flex flex-col gap-2"
          >
            <USkeleton class="h-10 w-full" />
            <USkeleton class="h-10 w-full" />
            <USkeleton class="h-10 w-full" />
          </div>
        </template>
        <template #footer>
          <div class="flex w-full flex-wrap items-center justify-end gap-2">
            <span
              v-if="(filtreJour?.urgentes ?? 0) > TAILLE_SEANCE"
              class="me-auto text-xs text-muted"
            >
              {{ TAILLE_SEANCE }} aujourd'hui, le reste attendra demain.
            </span>
            <UButton
              color="neutral"
              variant="ghost"
              label="Annuler"
              @click="choix = null"
            />
            <UButton
              icon="i-lucide-play"
              :label="tailleChoisie ? `Lancer · ${tailleChoisie} question${tailleChoisie > 1 ? 's' : ''}` : 'Rien à travailler ici'"
              :disabled="!tailleChoisie"
              :loading="!!lancement?.startsWith('choix-')"
              @click="lancerChoix"
            />
          </div>
        </template>
      </UModal>

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
      <p
        v-else-if="controles"
        class="mb-8 text-sm text-muted"
      >
        Un contrôle en vue ?
        <ULink
          to="/mes-controles/nouveau"
          class="text-primary"
        >Déclare-le</ULink>, et le site te dira chaque jour quoi réviser d'ici là.
      </p>

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

      <div class="mt-8">
        <h2 class="text-lg font-medium text-highlighted">
          Tes matières
        </h2>
        <!-- Une ligne par matière : le titre, le score, une barre. Les actions
             (quiz, QCM composé) ont leurs pages ; les répéter ici sur chaque
             matière faisait de l'accueil une grille de boutons. -->
        <div class="mt-3 flex flex-col gap-2">
          <ULink
            v-for="matiere in matieres"
            :key="matiere.cle"
            :to="matiere.cle"
            class="group block rounded-lg border border-default px-4 py-3 transition-colors hover:border-primary/60 hover:bg-elevated/50"
          >
            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span class="min-w-0 flex-1 text-sm font-medium text-highlighted group-hover:text-primary">{{ matiere.titre }}</span>
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
          </ULink>
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
