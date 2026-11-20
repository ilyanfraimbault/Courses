<script setup lang="ts">
import type { TreeItem } from '@nuxt/ui'
import { getLocalTimeZone, today, type DateValue } from '@internationalized/date'
import type { ActiviteJour } from '~~/shared/types/activite'
import type { Controle } from '~~/shared/types/controles'
import type { CompteProgression, ProgressionDomaines } from '~~/shared/types/domaines'
import { PARCOURS, type MesNotes } from '~~/shared/types/matieres'
import { ecrireMoyenne, moyenneSemestre, semestreCourant } from '~~/shared/utils/moyennes'

/**
 * L'accueil : le tableau de bord de l'élève, sur un seul écran.
 *
 * Ce qu'un élève cherche en arrivant, dans l'ordre : qui est connecté et dans
 * quel parcours ; ce qui arrive — le prochain contrôle ; où il en est — sa
 * moyenne, et ce qu'il a trouvé dans chaque matière ; et l'agenda, avec ce
 * qu'il a fait tel jour. Pas de sommaire à gauche : on n'est dans aucun cours,
 * et chaque matière est à un clic depuis sa barre.
 *
 * Tout tient dans la hauteur de l'écran sur un ordinateur : les deux cartes du
 * bas prennent ce qui reste et défilent en elles-mêmes si besoin, jamais la
 * page. Sur un téléphone, les blocs s'empilent.
 *
 * Données du compte : lues au montage seulement, et la page rendue côté client
 * — « aujourd'hui » n'est pas le même jour pour le serveur en UTC et pour
 * l'élève.
 */
definePageMeta({ layout: false })

const fuseau = fuseauLocal()
const { user } = useUserSession()
const { demande: modifierProfil } = useProfil()

const { data: controles, refresh: relireControles } = useLazyFetch<Controle[]>('/api/controles', { server: false, query: { fuseau } })
const { data: activite } = useLazyFetch<{ jours: string[] }>('/api/activite', { server: false, query: { fuseau } })
const { data: progression } = useLazyFetch<ProgressionDomaines>('/api/progression/domaines', { server: false })
const { data: notes } = useLazyFetch<MesNotes>('/api/notes', { server: false })

// —— Qui est là

const prenom = computed(() => user.value?.prenom || user.value?.pseudo || '')
const nomComplet = computed(() => [user.value?.prenom, user.value?.nom].filter(Boolean).join(' ') || user.value?.pseudo || '')
const parcours = computed(() => user.value?.parcours ? PARCOURS[user.value.parcours] : null)
const salut = new Date().getHours() >= 18 ? 'Bonsoir' : 'Bonjour'
const aujourdhuiTexte = (() => {
  const t = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
})()

// —— Les trois chiffres du bandeau

const aVenir = computed(() => (controles.value ?? []).filter(c => c.joursRestants >= 0))
const prochain = computed(() => aVenir.value[0] ?? null)

const semestre = semestreCourant()
const moyenne = computed(() => {
  const s = notes.value?.semestres.find(x => x.semestre === semestre)
  return s ? moyenneSemestre(s.ues) : null
})

function pourcentage(c: CompteProgression) {
  return c.questions ? Math.round(100 * c.acquises / c.questions) : 0
}

// —— Mes matières : la barre de « Mes domaines », matière par matière

/**
 * Deux segments, comme sur « Mes domaines » : ce qui est tombé juste du
 * premier coup, puis ce qu'il a fallu reprendre. La piste nue est ce qui n'a
 * jamais été trouvé.
 */
function segments(c: CompteProgression) {
  const sures = Math.max(0, c.acquises - c.hesitantes)
  return [
    { value: sures, color: 'success' as const },
    { value: c.hesitantes, color: 'warning' as const, ui: sures ? { segment: 'border-s-2 border-(--ui-bg)' } : undefined }
  ]
}

function detail(c: CompteProgression) {
  const base = `${c.acquises} trouvée${c.acquises > 1 ? 's' : ''} sur ${c.questions}`
  return c.hesitantes ? `${base}, dont ${c.hesitantes} après une faute` : base
}

// —— L'agenda

const controlesParJour = computed(() => {
  const parJour = new Map<string, Controle[]>()
  for (const c of controles.value ?? []) parJour.set(c.jour, [...(parJour.get(c.jour) ?? []), c])
  return parJour
})
const joursTravailles = computed(() => new Set(activite.value?.jours ?? []))

const jour = shallowRef<DateValue>(today(getLocalTimeZone()))
const jourChoisi = computed(() => jour.value?.toString() ?? '')
const estAujourdhui = computed(() => jourChoisi.value === today(getLocalTimeZone()).toString())
const controlesDuJour = computed(() => controlesParJour.value.get(jourChoisi.value) ?? [])
const travailleLeJour = computed(() => joursTravailles.value.has(jourChoisi.value))

/** Le détail d'un jour ne se lit que pour un jour marqué : la plupart des clics tombent sur un jour vide. */
const { data: detailJour, status: statutDetail, execute: lireDetail } = useLazyFetch<ActiviteJour>(
  () => `/api/activite/${jourChoisi.value}`,
  { server: false, query: { fuseau }, immediate: false, watch: false }
)
watch([jourChoisi, travailleLeJour], () => {
  if (travailleLeJour.value && detailJour.value?.jour !== jourChoisi.value) lireDetail()
}, { immediate: true })

function pluriel(n: number) {
  return `${n} question${n > 1 ? 's' : ''}`
}

/** Matière › chapitre › fiche › exercice, tout replié : un sommaire, qu'on déplie. */
const arbre = computed<TreeItem[]>(() => (detailJour.value?.jour === jourChoisi.value ? detailJour.value.matieres : []).map(m => ({
  cle: `m:${m.chemin}`,
  label: m.titre,
  compte: m.questions,
  icon: 'i-lucide-book-open',
  children: m.chapitres.map(c => ({
    cle: `c:${m.chemin}:${c.chemin}`,
    label: c.titre,
    compte: c.questions,
    icon: 'i-lucide-folder',
    children: c.fiches.map(f => ({
      cle: `f:${f.chemin}`,
      label: f.titre,
      compte: f.questions,
      icon: 'i-lucide-file-text',
      children: f.exercices.map(x => ({
        cle: `x:${f.chemin}#${x.bloc}`,
        label: x.titre,
        compte: x.questions,
        icon: 'i-lucide-pencil-line',
        onSelect: () => navigateTo(f.chemin)
      }))
    }))
  }))
})))

const titreDuJour = computed(() => {
  if (!jourChoisi.value) return ''
  if (estAujourdhui.value) return 'Aujourd\'hui'
  const texte = jourLong(jourChoisi.value)
  return texte.charAt(0).toUpperCase() + texte.slice(1)
})

/** Les contrôles à venir, hors ceux du jour affiché juste au-dessus. */
const suivants = computed(() => aVenir.value.filter(c => c.jour !== jourChoisi.value).slice(0, 4))

function couleurEcheance(n: number) {
  return n <= 2 ? 'error' as const : n <= 7 ? 'warning' as const : 'neutral' as const
}

/** Écrites en entier : Tailwind ne génère pas une classe composée à la volée. */
function texteEcheance(n: number) {
  return { error: 'text-error', warning: 'text-warning', neutral: 'text-highlighted' }[couleurEcheance(n)]
}

const planifier = ref(false)

useSeoMeta({ title: 'Accueil' })
</script>

<template>
  <UContainer class="flex flex-col gap-4 py-4 lg:h-[calc(100dvh-var(--ui-header-height))] lg:overflow-hidden">
    <ClientOnly>
      <!-- Le bandeau : qui, et les trois chiffres qui comptent. -->
      <header class="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <UAvatar
            :alt="nomComplet"
            size="xl"
          />
          <div class="min-w-0">
            <h1 class="m-0 truncate text-xl font-semibold text-highlighted sm:text-2xl">
              {{ salut }} {{ prenom }}
            </h1>
            <p class="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span>{{ aujourdhuiTexte }}</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 hover:text-highlighted"
                title="Mon profil"
                @click="modifierProfil = true"
              >
                <UBadge
                  v-if="parcours"
                  :label="parcours.court"
                  variant="subtle"
                  size="sm"
                />
                {{ parcours?.long ?? 'Choisir son parcours' }}
              </button>
            </p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 lg:w-[34rem]">
          <ULink
            :to="prochain ? `/controles/${prochain.id}` : '/controles'"
            class="flex min-w-0 flex-col rounded-lg border border-default px-3 py-2 transition-colors hover:border-primary/60"
          >
            <span class="text-xs text-muted">Prochain contrôle</span>
            <template v-if="prochain">
              <span
                class="text-lg font-semibold tabular-nums"
                :class="texteEcheance(prochain.joursRestants)"
              >{{ prochain.joursRestants === 0 ? 'Aujourd\'hui' : `J-${prochain.joursRestants}` }}</span>
              <span class="truncate text-xs text-muted">{{ prochain.matiereTitre ?? prochain.titre }}</span>
            </template>
            <template v-else>
              <span class="text-lg font-semibold text-dimmed">—</span>
              <span class="truncate text-xs text-muted">Rien de prévu</span>
            </template>
          </ULink>
          <ULink
            to="/mes-moyennes"
            class="flex min-w-0 flex-col rounded-lg border border-default px-3 py-2 transition-colors hover:border-primary/60"
          >
            <span class="text-xs text-muted">Moyenne S{{ semestre }}</span>
            <span
              class="text-lg font-semibold tabular-nums"
              :class="moyenne === null ? 'text-dimmed' : moyenne >= 10 ? 'text-success' : 'text-error'"
            >{{ ecrireMoyenne(moyenne) }}</span>
            <span class="truncate text-xs text-muted">{{ moyenne === null ? 'À renseigner' : 'sur 20' }}</span>
          </ULink>
          <ULink
            to="/mes-domaines"
            class="flex min-w-0 flex-col rounded-lg border border-default px-3 py-2 transition-colors hover:border-primary/60"
          >
            <span class="text-xs text-muted">Questions trouvées</span>
            <span class="text-lg font-semibold tabular-nums text-highlighted">{{ progression ? `${pourcentage(progression.total)} %` : '…' }}</span>
            <span class="truncate text-xs text-muted tabular-nums">{{ progression ? `${progression.total.acquises} sur ${progression.total.questions}` : '' }}</span>
          </ULink>
        </div>
      </header>

      <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-12">
        <!-- L'agenda : le calendrier, et le jour qu'on y choisit. -->
        <section class="flex min-h-0 flex-col rounded-lg border border-default lg:col-span-7">
          <div class="flex items-center gap-2 border-b border-default px-4 py-2">
            <h2 class="m-0 flex-1 text-sm font-semibold text-highlighted">
              Agenda
            </h2>
            <UButton
              icon="i-lucide-calendar-plus"
              label="Planifier un contrôle"
              size="xs"
              color="neutral"
              variant="subtle"
              @click="planifier = true"
            />
          </div>
          <div class="grid min-h-0 flex-1 gap-4 p-3 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div class="flex flex-col items-center gap-2">
              <UCalendar
                v-model="jour"
                locale="fr-FR"
                size="sm"
                :week-starts-on="1"
                :year-controls="false"
                :fixed-weeks="false"
              >
                <template #day="{ day }">
                  <span class="relative flex size-full items-center justify-center">
                    {{ day.day }}
                    <span
                      v-if="controlesParJour.has(day.toString()) || joursTravailles.has(day.toString())"
                      class="absolute inset-x-0 -bottom-1 flex justify-center gap-0.5"
                    >
                      <span
                        v-if="controlesParJour.has(day.toString())"
                        class="size-1 rounded-full bg-error"
                      />
                      <span
                        v-if="joursTravailles.has(day.toString())"
                        class="size-1 rounded-full bg-success"
                      />
                    </span>
                  </span>
                </template>
              </UCalendar>
              <div class="flex items-center gap-3 text-xs text-muted">
                <span class="flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-error" />Contrôle</span>
                <span class="flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-success" />Travaillé</span>
              </div>
            </div>

            <div class="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto">
              <div>
                <h3 class="m-0 text-sm font-medium text-highlighted">
                  {{ titreDuJour }}
                </h3>
                <div
                  v-if="controlesDuJour.length"
                  class="mt-2 flex flex-col gap-1.5"
                >
                  <ULink
                    v-for="c in controlesDuJour"
                    :key="c.id"
                    :to="`/controles/${c.id}`"
                    class="group flex items-center gap-2 rounded-md border border-error/40 bg-error/5 px-2.5 py-1.5"
                  >
                    <UIcon
                      name="i-lucide-calendar-check"
                      class="size-4 shrink-0 text-error"
                    />
                    <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted group-hover:text-primary">{{ c.titre }}</span>
                  </ULink>
                </div>
                <template v-if="travailleLeJour">
                  <UTree
                    v-if="arbre.length"
                    class="mt-1"
                    size="sm"
                    color="neutral"
                    :items="arbre"
                    :get-key="(item: TreeItem) => item.cle"
                  >
                    <template #item-label="{ item }">
                      <span class="truncate">{{ item.label }}</span>
                      <span class="ms-2 shrink-0 text-xs text-dimmed tabular-nums">{{ pluriel(item.compte) }}</span>
                    </template>
                  </UTree>
                  <div
                    v-else-if="statutDetail === 'pending' || statutDetail === 'idle'"
                    class="mt-2 flex flex-col gap-2"
                  >
                    <USkeleton class="h-5 w-2/3" />
                    <USkeleton class="h-5 w-1/2" />
                  </div>
                </template>
                <p
                  v-if="!controlesDuJour.length && !travailleLeJour"
                  class="m-0 mt-1 text-sm text-muted"
                >
                  {{ estAujourdhui ? 'Rien pour l\'instant.' : 'Rien ce jour-là.' }}
                </p>
              </div>

              <div v-if="suivants.length">
                <h3 class="m-0 text-xs font-medium tracking-wide text-dimmed uppercase">
                  À venir
                </h3>
                <ul class="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
                  <li
                    v-for="c in suivants"
                    :key="c.id"
                  >
                    <ULink
                      :to="`/controles/${c.id}`"
                      class="group flex items-center gap-2 text-sm"
                    >
                      <UBadge
                        :label="c.joursRestants === 0 ? 'Auj.' : `J-${c.joursRestants}`"
                        :color="couleurEcheance(c.joursRestants)"
                        variant="subtle"
                        size="sm"
                        class="w-12 justify-center tabular-nums"
                      />
                      <span class="min-w-0 flex-1 truncate group-hover:text-primary">{{ c.titre }}</span>
                    </ULink>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <!-- Mes matières : la barre de chacune, qui mène à son cours. -->
        <section class="flex min-h-0 flex-col rounded-lg border border-default lg:col-span-5">
          <div class="flex items-center gap-2 border-b border-default px-4 py-2">
            <h2 class="m-0 flex-1 text-sm font-semibold text-highlighted">
              Mes matières
            </h2>
            <UButton
              to="/mes-domaines"
              trailing-icon="i-lucide-chevron-right"
              label="Mes domaines"
              size="xs"
              color="neutral"
              variant="ghost"
            />
          </div>
          <div
            v-if="progression"
            class="flex min-h-0 flex-1 flex-col gap-3 p-3"
          >
            <div class="flex items-center gap-3 text-xs text-muted tabular-nums">
              <span class="flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-success" />Du premier coup</span>
              <span class="flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-warning" />Après une faute</span>
              <span class="flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-accented" />Jamais trouvées</span>
            </div>
            <ul class="m-0 flex min-h-0 flex-1 list-none flex-col gap-1 overflow-y-auto p-0">
              <li
                v-for="m in progression.matieres"
                :key="m.cle"
              >
                <ULink
                  :to="m.chemin ?? `/mes-domaines?matiere=${encodeURIComponent(m.cle)}`"
                  :title="detail(m)"
                  class="group flex flex-col gap-1.5 rounded-md px-2 py-1.5 transition-colors hover:bg-elevated/60"
                >
                  <span class="flex items-center gap-2">
                    <UIcon
                      :name="m.icone || 'i-lucide-book-open'"
                      class="size-4 shrink-0 text-dimmed group-hover:text-primary"
                    />
                    <span class="min-w-0 flex-1 truncate text-sm text-highlighted">{{ m.titre }}</span>
                    <span class="shrink-0 text-xs text-muted tabular-nums">{{ pourcentage(m) }} %</span>
                  </span>
                  <UProgressGroup
                    size="xs"
                    :max="m.questions || 1"
                    :items="segments(m)"
                  />
                </ULink>
              </li>
            </ul>
          </div>
          <div
            v-else
            class="flex flex-col gap-3 p-3"
          >
            <USkeleton
              v-for="i in 5"
              :key="i"
              class="h-9 w-full"
            />
          </div>
        </section>
      </div>

      <ControlePlanifier
        v-model:open="planifier"
        :jour="jourChoisi"
        @enregistre="relireControles()"
      />

      <template #fallback>
        <USkeleton class="h-16 w-full" />
        <div class="grid flex-1 gap-4 lg:grid-cols-12">
          <USkeleton class="h-80 lg:col-span-7" />
          <USkeleton class="h-80 lg:col-span-5" />
        </div>
      </template>
    </ClientOnly>
  </UContainer>
</template>
