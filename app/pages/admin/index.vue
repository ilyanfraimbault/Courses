<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { ExpandedState, SortingState, VisibilityState } from '@tanstack/vue-table'
import type { UtilisateurAdministration, VueAdministration } from '~~/shared/types/administration'
import { PARCOURS } from '~~/shared/types/matieres'

// Pleine largeur : un tableau d'une douzaine de colonnes n'a que faire du
// sommaire d'une matière à sa gauche.
definePageMeta({ layout: false })

/**
 * Lue au montage, comme toute donnée d'utilisateur : le HTML servi ne porte la
 * trace d'aucun compte. Le middleware renvoie ailleurs qui n'a pas le drapeau,
 * mais c'est la route qui refuse — en 403 — à qui n'est pas administrateur.
 */
const { data, status, error, refresh } = await useLazyFetch<VueAdministration>('/api/admin/utilisateurs', { server: false })

const tous = computed(() => data.value?.utilisateurs ?? [])
const utilisateurs = computed(() => tous.value.filter(u => u.acces === 'accorde'))
const matieres = computed(() => data.value?.matieres ?? [])
const totalQuestions = computed(() => data.value?.questions ?? 0)

/**
 * Les comptes sans accès, à part et en tête : ce sont eux qui attendent
 * quelque chose. Une demande envoyée passe devant un compte qui n'a encore
 * rien demandé, la plus récente d'abord.
 */
const demandes = computed(() => tous.value
  .filter(u => u.acces !== 'accorde')
  .sort((a, b) => Number(b.acces === 'demande') - Number(a.acces === 'demande')
    || (b.demandeLe ?? b.inscritLe) - (a.demandeLe ?? a.inscritLe)))

const toast = useToast()
/** La décision en cours, « id:decision » : seul le bouton cliqué tourne. */
const enCours = ref<string | null>(null)

async function decider(u: UtilisateurAdministration, decision: 'accorder' | 'refuser') {
  enCours.value = `${u.id}:${decision}`
  try {
    await $fetch('/api/admin/acces', { method: 'POST', body: { id: u.id, decision } })
    toast.add({
      title: decision === 'accorder' ? `Accès accordé à ${u.pseudo}` : `Demande de ${u.pseudo} refusée`,
      description: decision === 'refuser' ? 'Le compte est supprimé, son pseudo redevient libre.' : undefined,
      icon: decision === 'accorder' ? 'i-lucide-check' : 'i-lucide-x',
      color: decision === 'accorder' ? 'success' : 'neutral'
    })
    await refresh()
  } catch (e) {
    toast.add({
      title: 'Décision impossible',
      description: (e as { statusMessage?: string })?.statusMessage,
      icon: 'i-lucide-triangle-alert',
      color: 'error'
    })
  } finally {
    enCours.value = null
  }
}

const SEMAINE = 7 * 24 * 60 * 60 * 1000
// Figé au montage : un « maintenant » réactif ferait recalculer la page pour rien.
const maintenant = ref(Date.now())

const chiffres = computed(() => {
  const u = utilisateurs.value
  return [
    { libelle: 'Comptes', valeur: u.length, detail: `${demandes.value.filter(d => d.acces === 'demande').length} demande(s) en attente`, icone: 'i-lucide-users' },
    { libelle: 'Actifs cette semaine', valeur: u.filter(x => x.derniereActivite && maintenant.value - x.derniereActivite < SEMAINE).length, detail: `${u.reduce((s, x) => s + x.acquisesSemaine, 0)} questions trouvées en 7 jours`, icone: 'i-lucide-activity' },
    { libelle: 'Parcours DL / SR', valeur: `${u.filter(x => x.parcours === 'dl').length} / ${u.filter(x => x.parcours === 'sr').length}`, detail: `${u.filter(x => !x.parcours).length} sans parcours choisi`, icone: 'i-lucide-git-fork' },
    { libelle: 'Questions du site', valeur: totalQuestions.value, detail: `${matieres.value.length} matières`, icone: 'i-lucide-circle-help' }
  ]
})

const UButton = resolveComponent('UButton')
const triable = useColonneTriable()

/**
 * Ce que la recherche lit d'un compte : nom, prénom et pseudo, sans accents.
 * Toujours une chaîne, même vide — TanStack décide si une colonne se filtre en
 * regardant la valeur de la première ligne, et un `null` en tête de tableau
 * couperait la recherche pour toutes les autres.
 */
function texteDuCompte(u: UtilisateurAdministration) {
  return replierTexte([u.prenom, u.nom, u.pseudo].filter(Boolean).join(' '))
}

const LIBELLES: Record<string, string> = {
  parcours: 'Parcours',
  acquises: 'Trouvées',
  semaine: '7 derniers jours',
  quiz: 'Quiz',
  dette: 'Dette',
  qcm: 'Copies de QCM',
  fiches: 'Fiches commencées',
  controles: 'Contrôles posés',
  todo: 'To-do',
  activite: 'Dernière activité',
  inscription: 'Inscription'
}

const colonnes = computed<TableColumn<UtilisateurAdministration>[]>(() => [
  {
    id: 'deplier',
    enableHiding: false,
    meta: { class: { th: 'w-10', td: 'w-10' } },
    cell: ({ row }) => h(UButton, {
      'color': 'neutral',
      'variant': 'ghost',
      'size': 'sm',
      'square': true,
      'icon': 'i-lucide-chevron-right',
      'aria-label': row.getIsExpanded() ? 'Replier le détail' : 'Déplier le détail',
      'aria-expanded': row.getIsExpanded(),
      'ui': { leadingIcon: ['transition-transform duration-200', row.getIsExpanded() ? 'rotate-90' : ''] },
      'onClick': () => row.toggleExpanded()
    })
  },
  {
    id: 'eleve',
    accessorFn: texteDuCompte,
    ...triable('Élève'),
    enableHiding: false,
    sortingFn: (a, b) => nomDuCompte(a.original).localeCompare(nomDuCompte(b.original), 'fr')
  },
  {
    id: 'parcours',
    accessorFn: u => u.parcours ?? 'aucun',
    header: 'Parcours',
    filterFn: 'equals'
  },
  {
    id: 'acquises',
    accessorKey: 'acquises',
    ...triable('Trouvées', { decroissantDAbord: true }),
    meta: { class: { td: 'min-w-48' } }
  },
  {
    id: 'semaine',
    accessorKey: 'acquisesSemaine',
    ...triable('7 jours', { decroissantDAbord: true })
  },
  {
    id: 'quiz',
    accessorFn: u => u.quiz.reponses,
    ...triable('Quiz', { decroissantDAbord: true })
  },
  {
    id: 'dette',
    accessorKey: 'enDette',
    ...triable('Dette', { decroissantDAbord: true })
  },
  {
    id: 'qcm',
    accessorFn: u => u.qcm.copies,
    ...triable('QCM', { decroissantDAbord: true })
  },
  {
    id: 'fiches',
    accessorKey: 'fichesOuvertes',
    ...triable('Fiches', { decroissantDAbord: true })
  },
  {
    id: 'controles',
    accessorKey: 'controles',
    ...triable('Contrôles posés', { decroissantDAbord: true })
  },
  {
    id: 'todo',
    accessorFn: u => u.todo.faites,
    ...triable('To-do', { decroissantDAbord: true }),
    cell: ({ row }) => `${row.original.todo.faites} / ${row.original.todo.total}`
  },
  // Une colonne par matière, masquées d'abord : on les montre pour comparer
  // la classe sur une matière, pas pour lire chaque ligne.
  ...matieres.value.map((m): TableColumn<UtilisateurAdministration> => ({
    id: `matiere:${m.cle}`,
    accessorFn: u => u.parMatiere[m.cle] ?? 0,
    ...triable(m.titre, { decroissantDAbord: true }),
    cell: ({ row }) => {
      const n = row.original.parMatiere[m.cle] ?? 0
      return h('span', { class: n ? 'tabular-nums text-default' : 'tabular-nums text-dimmed' }, `${n} / ${m.questions}`)
    }
  })),
  {
    id: 'activite',
    accessorFn: u => u.derniereActivite ?? 0,
    ...triable('Dernière activité', { decroissantDAbord: true })
  },
  {
    id: 'inscription',
    accessorKey: 'inscritLe',
    ...triable('Inscription', { decroissantDAbord: true }),
    cell: ({ row }) => dateCourte(row.original.inscritLe)
  }
])

const recherche = ref('')
const tri = ref<SortingState>([{ id: 'activite', desc: true }])
const deplies = ref<ExpandedState>({})
const visibles = ref<VisibilityState>({ fiches: false, controles: false, todo: false, inscription: false })

// Les colonnes de matière arrivent avec les données : on les masque à leur
// apparition, sans toucher à ce que l'administration a déjà choisi.
watch(matieres, (liste) => {
  const suite = { ...visibles.value }
  for (const m of liste) suite[`matiere:${m.cle}`] ??= false
  visibles.value = suite
}, { immediate: true })

/** Le filtre de parcours, posé sur la colonne : « tous » le retire. */
const filtreParcours = ref<'tous' | 'dl' | 'sr' | 'aucun'>('tous')
const filtresColonnes = computed(() => filtreParcours.value === 'tous' ? [] : [{ id: 'parcours', value: filtreParcours.value }])

const ongletsParcours = computed(() => [
  { label: 'Tous', value: 'tous', badge: utilisateurs.value.length },
  { label: PARCOURS.dl.court, value: 'dl', badge: utilisateurs.value.filter(u => u.parcours === 'dl').length },
  { label: PARCOURS.sr.court, value: 'sr', badge: utilisateurs.value.filter(u => u.parcours === 'sr').length },
  { label: 'Sans parcours', value: 'aucun', badge: utilisateurs.value.filter(u => !u.parcours).length }
])

const tableau = useTemplateRef('tableau')

const menuColonnes = computed<DropdownMenuItem[][]>(() => {
  const entree = (id: string, label: string): DropdownMenuItem => ({
    label,
    type: 'checkbox',
    checked: visibles.value[id] !== false,
    onUpdateChecked: (coche: boolean) => { visibles.value = { ...visibles.value, [id]: !!coche } },
    onSelect: (e: Event) => e.preventDefault()
  })
  return [
    [{ label: 'Colonnes', type: 'label' }, ...Object.entries(LIBELLES).map(([id, label]) => entree(id, label))],
    [{ label: 'Par matière', type: 'label' }, ...matieres.value.map(m => entree(`matiere:${m.cle}`, m.titre))]
  ]
})

/**
 * Le compte des lignes, lu dans le tableau lui-même plutôt que refiltré ici :
 * une seule règle de filtre. Après le rendu (`flush: 'post'`), quand le
 * tableau a reçu la recherche et le parcours.
 */
const lignesAffichees = ref(0)
watch([recherche, filtreParcours, utilisateurs, tableau], () => {
  lignesAffichees.value = tableau.value?.tableApi?.getFilteredRowModel().rows.length ?? 0
}, { flush: 'post', immediate: true })

function toutReplier() {
  deplies.value = {}
}

const colonnesDemandes: TableColumn<UtilisateurAdministration>[] = [
  { id: 'compte', header: 'Compte' },
  { id: 'statut', header: 'Statut' },
  { id: 'quand', header: 'Depuis' },
  { id: 'message', header: 'Son message', meta: { class: { td: 'whitespace-normal min-w-64' } } },
  { id: 'actions', meta: { class: { th: 'text-end', td: 'text-end' } } }
]

useSeoMeta({ title: 'Utilisateurs' })
</script>

<template>
  <UContainer>
    <UPage>
      <UPageHeader
        headline="Administration"
        title="Utilisateurs"
        description="Tous les comptes du site et ce qu'ils y font : leur parcours, ce qu'ils ont trouvé, et, ligne dépliée, leur progression jusqu'à l'exercice, leurs jours de travail et leurs séances. Jamais ce qu'ils ont répondu."
      />

      <UPageBody>
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="error.statusCode === 403 ? 'Réservé à l\'administration' : 'Lecture impossible'"
          :description="error.statusCode === 403 ? 'Ce compte n\'administre pas le site.' : 'Le serveur n\'a pas répondu.'"
          :actions="error.statusCode === 403 ? [] : [{ label: 'Réessayer', onClick: () => refresh() }]"
        />

        <div
          v-else-if="status === 'pending' && !data"
          class="flex flex-col gap-3"
        >
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <USkeleton
              v-for="i in 4"
              :key="i"
              class="h-24"
            />
          </div>
          <USkeleton class="h-96 w-full" />
        </div>

        <template v-else-if="data">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div
              v-for="c of chiffres"
              :key="c.libelle"
              class="rounded-lg border border-default bg-elevated/30 px-4 py-3"
            >
              <div class="flex items-center gap-2 text-sm text-muted">
                <UIcon
                  :name="c.icone"
                  class="size-4 shrink-0"
                />
                {{ c.libelle }}
              </div>
              <div class="mt-1 text-2xl font-semibold tabular-nums text-highlighted">
                {{ c.valeur }}
              </div>
              <div class="text-xs text-dimmed">
                {{ c.detail }}
              </div>
            </div>
          </div>

          <section
            v-if="demandes.length"
            class="mt-10"
          >
            <h2 class="text-lg font-semibold text-highlighted">
              Demandes d'accès
            </h2>
            <p class="mt-1 text-sm text-muted">
              Ces comptes ne peuvent rien faire tant qu'ils ne sont pas acceptés. Refuser supprime le compte.
            </p>

            <UTable
              class="mt-4 rounded-lg border border-default"
              :data="demandes"
              :columns="colonnesDemandes"
              :get-row-id="(u: UtilisateurAdministration) => String(u.id)"
              :meta="{ class: { tr: (r) => r.original.acces === 'demande' ? 'bg-primary/5' : '' } }"
            >
              <template #compte-cell="{ row }">
                <div class="flex items-center gap-3">
                  <UAvatar
                    :alt="nomDuCompte(row.original)"
                    size="sm"
                  />
                  <div class="min-w-0">
                    <div class="font-medium text-highlighted">
                      {{ nomDuCompte(row.original) }}
                    </div>
                    <div
                      v-if="row.original.prenom || row.original.nom"
                      class="text-xs text-dimmed"
                    >
                      @{{ row.original.pseudo }}
                    </div>
                  </div>
                </div>
              </template>
              <template #statut-cell="{ row }">
                <UBadge
                  :color="row.original.acces === 'demande' ? 'primary' : 'neutral'"
                  variant="subtle"
                  :label="row.original.acces === 'demande' ? 'En attente' : 'Rien demandé'"
                />
              </template>
              <template #quand-cell="{ row }">
                <span :title="dateEtHeure(row.original.demandeLe ?? row.original.inscritLe)">
                  {{ row.original.acces === 'demande' && row.original.demandeLe
                    ? `demandé ${depuisQuand(row.original.demandeLe, maintenant)}`
                    : `inscrit le ${dateCourte(row.original.inscritLe)}` }}
                </span>
              </template>
              <template #message-cell="{ row }">
                <p
                  v-if="row.original.demandeMessage"
                  class="whitespace-pre-line text-default"
                >
                  « {{ row.original.demandeMessage }} »
                </p>
                <span
                  v-else
                  class="text-dimmed"
                >—</span>
              </template>
              <template #actions-cell="{ row }">
                <div class="flex justify-end gap-2">
                  <UButton
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-x"
                    label="Refuser"
                    :loading="enCours === `${row.original.id}:refuser`"
                    :disabled="enCours !== null"
                    @click="decider(row.original, 'refuser')"
                  />
                  <UButton
                    size="sm"
                    icon="i-lucide-check"
                    label="Accepter"
                    :loading="enCours === `${row.original.id}:accorder`"
                    :disabled="enCours !== null"
                    @click="decider(row.original, 'accorder')"
                  />
                </div>
              </template>
            </UTable>
          </section>

          <section class="mt-10">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
              <UInput
                v-model="recherche"
                class="lg:w-72"
                icon="i-lucide-search"
                placeholder="Chercher un nom ou un pseudo…"
                aria-label="Chercher un compte"
              >
                <template
                  v-if="recherche"
                  #trailing
                >
                  <UButton
                    color="neutral"
                    variant="link"
                    size="sm"
                    icon="i-lucide-circle-x"
                    aria-label="Effacer la recherche"
                    @click="recherche = ''"
                  />
                </template>
              </UInput>

              <UTabs
                v-model="filtreParcours"
                :items="ongletsParcours"
                :content="false"
                size="sm"
                class="w-full lg:w-auto"
              />

              <div class="flex items-center gap-2 lg:ms-auto">
                <span class="text-sm text-muted tabular-nums">
                  {{ accorder(lignesAffichees, 'compte') }}
                </span>
                <UButton
                  v-if="deplies === true || Object.keys(deplies).length"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-chevrons-down-up"
                  label="Tout replier"
                  @click="toutReplier"
                />
                <UDropdownMenu
                  :items="menuColonnes"
                  :content="{ align: 'end' }"
                  :ui="{ content: 'max-h-96' }"
                >
                  <UButton
                    color="neutral"
                    variant="outline"
                    size="sm"
                    icon="i-lucide-columns-3"
                    label="Colonnes"
                    trailing-icon="i-lucide-chevron-down"
                  />
                </UDropdownMenu>
              </div>
            </div>

            <UTable
              ref="tableau"
              v-model:sorting="tri"
              v-model:expanded="deplies"
              v-model:column-visibility="visibles"
              v-model:global-filter="recherche"
              class="mt-4 rounded-lg border border-default"
              :data="utilisateurs"
              :columns="colonnes"
              :column-filters="filtresColonnes"
              :get-row-id="(u: UtilisateurAdministration) => String(u.id)"
              :global-filter-options="{
                getColumnCanGlobalFilter: (c) => c.id === 'eleve',
                globalFilterFn: (row, id, valeur) => String(row.getValue(id)).includes(replierTexte(String(valeur ?? '')))
              }"
              :loading="status === 'pending'"
              empty="Aucun compte ne correspond."
              :ui="{
                tr: 'data-[expanded=true]:bg-elevated/40',
                td: 'empty:p-0'
              }"
            >
              <template #eleve-cell="{ row }">
                <div class="flex items-center gap-3">
                  <UAvatar
                    :alt="nomDuCompte(row.original)"
                    size="sm"
                  />
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-highlighted">{{ nomDuCompte(row.original) }}</span>
                      <UBadge
                        v-if="row.original.admin"
                        size="sm"
                        color="primary"
                        variant="subtle"
                        label="Admin"
                      />
                    </div>
                    <div class="text-xs text-dimmed">
                      @{{ row.original.pseudo }}
                    </div>
                  </div>
                </div>
              </template>

              <template #parcours-cell="{ row }">
                <UTooltip
                  v-if="row.original.parcours"
                  :text="PARCOURS[row.original.parcours].long"
                >
                  <UBadge
                    :color="row.original.parcours === 'dl' ? 'primary' : 'info'"
                    variant="subtle"
                    :label="PARCOURS[row.original.parcours].court"
                  />
                </UTooltip>
                <span
                  v-else
                  class="text-dimmed"
                  title="Pas encore choisi"
                >—</span>
              </template>

              <template #acquises-cell="{ row }">
                <div class="flex items-center gap-3">
                  <UProgress
                    class="w-24"
                    size="sm"
                    :model-value="row.original.acquises"
                    :max="totalQuestions || 1"
                  />
                  <span class="tabular-nums text-default">{{ row.original.acquises }}</span>
                  <span class="tabular-nums text-dimmed">{{ proportion(row.original.acquises, totalQuestions) }} %</span>
                </div>
              </template>

              <template #semaine-cell="{ row }">
                <span
                  class="tabular-nums"
                  :class="row.original.acquisesSemaine ? 'font-medium text-success' : 'text-dimmed'"
                >
                  {{ row.original.acquisesSemaine ? `+${row.original.acquisesSemaine}` : '0' }}
                </span>
              </template>

              <template #quiz-cell="{ row }">
                <span
                  v-if="!row.original.quiz.reponses"
                  class="text-dimmed"
                >jamais</span>
                <div
                  v-else
                  class="flex items-center gap-2"
                >
                  <span class="tabular-nums text-default">{{ row.original.quiz.reponses }}</span>
                  <UBadge
                    size="sm"
                    variant="subtle"
                    :color="couleurScore(proportion(row.original.quiz.justes, row.original.quiz.reponses))"
                    :label="`${proportion(row.original.quiz.justes, row.original.quiz.reponses)} %`"
                  />
                  <span class="text-xs text-dimmed">{{ accorder(row.original.quiz.seances, 'séance') }}</span>
                </div>
              </template>

              <template #dette-cell="{ row }">
                <span
                  class="tabular-nums"
                  :class="row.original.enDette ? 'font-medium text-warning' : 'text-dimmed'"
                  :title="`${accorder(row.original.fautes, 'faute')} en tout, rattrapées comprises`"
                >
                  {{ row.original.enDette }}
                </span>
              </template>

              <template #qcm-cell="{ row }">
                <span class="tabular-nums">{{ row.original.qcm.copies }}</span>
                <span
                  v-if="row.original.qcm.composes"
                  class="ms-1 text-xs text-dimmed"
                >· {{ accorder(row.original.qcm.composes, 'composé') }}</span>
              </template>

              <template #activite-cell="{ row }">
                <span
                  :class="row.original.derniereActivite ? 'text-default' : 'text-dimmed'"
                  :title="row.original.derniereActivite ? dateEtHeure(row.original.derniereActivite) : undefined"
                >
                  {{ depuisQuand(row.original.derniereActivite, maintenant) }}
                </span>
              </template>

              <template #expanded="{ row }">
                <AdminDetailCompte
                  :utilisateur="row.original"
                  :maintenant="maintenant"
                />
              </template>
            </UTable>
          </section>
        </template>
      </UPageBody>
    </UPage>
  </UContainer>
</template>
