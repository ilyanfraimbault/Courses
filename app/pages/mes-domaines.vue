<script setup lang="ts">
import type { ChapitreProgression, CompteProgression, ProgressionDomaines } from '~~/shared/types/domaines'

definePageMeta({ layout: 'cours' })

/**
 * La progression est une donnée d'utilisateur : elle se lit au montage, jamais
 * au rendu serveur. Le HTML servi est le même pour tout le monde.
 */
const { data, status, refresh } = await useLazyFetch<ProgressionDomaines>('/api/progression/domaines', { server: false })

/**
 * Ce qui est clos n'est pas dans la page — c'est ce qu'on a demandé en le
 * closant. On le nomme en bas, avec de quoi le rouvrir : sans quoi une matière
 * close disparaîtrait de la seule page qui dit où on en est, sans trace.
 */
const { liste: clotures, rouvrir } = useClotures()
const reouverture = ref<string | null>(null)
const natures = { matiere: 'Matière', chapitre: 'Chapitre', fiche: 'Fiche' } as const

async function rouvrirEtRelire(chemin: string) {
  if (reouverture.value) return
  reouverture.value = chemin
  try {
    await rouvrir(chemin)
    await refresh()
  } finally {
    reouverture.value = null
  }
}

const matieres = computed(() => data.value?.matieres ?? [])
const total = computed(() => data.value?.total ?? { questions: 0, acquises: 0, hesitantes: 0, interrogeables: 0 })
// L'année ne distingue rien tant qu'elles sont toutes de la même : six fois
// « Première année » au-dessus de six titres, c'est six lignes de bruit.
const plusieursAnnees = computed(() => new Set(matieres.value.map(m => m.annee)).size > 1)

/**
 * Une matière à la fois. Les cinq cents points de cours du site empilés sur une
 * page faisaient trente-cinq mille pixels de haut : on ne cherchait plus où ça
 * coince, on faisait défiler. Et deux matières ne se lisent pas ensemble — elles
 * ne partagent pas un pourcentage, elles ne partagent pas non plus un écran.
 *
 * Le choix vit dans l'adresse : un retour arrière depuis une fiche, ou un lien
 * gardé, rouvre la même matière.
 */
const route = useRoute()
const router = useRouter()
const matiereChoisie = computed(() =>
  matieres.value.find(m => m.cle === route.query.matiere) ?? matieres.value[0] ?? null)

function choisirMatiere(cle: string) {
  router.replace({ query: { ...route.query, matiere: cle } })
}

/**
 * Les chapitres sont repliés : leur ligne dit déjà où l'on en est, et c'est en
 * l'ouvrant qu'on va chercher le détail. Tout déplier d'office redonnerait le
 * mur qu'on quitte.
 */
const ouverts = ref(new Set<string>())
const tousOuverts = computed(() =>
  !!matiereChoisie.value?.chapitres.length
  && matiereChoisie.value.chapitres.every(c => ouverts.value.has(c.cle)))

function basculer(cle: string) {
  const suivants = new Set(ouverts.value)
  if (suivants.has(cle)) suivants.delete(cle)
  else suivants.add(cle)
  ouverts.value = suivants
}

function basculerTous() {
  ouverts.value = tousOuverts.value
    ? new Set()
    : new Set(matiereChoisie.value?.chapitres.map(c => c.cle))
}

/**
 * Ce qui est tout trouvé ne dit plus rien de ce qui reste à faire : on le replie
 * sous une ligne, en bas du chapitre. L'ordre du serveur — le moins acquis
 * d'abord — met de toute façon ces points-là en dernier.
 */
const acquisDeplies = ref(new Set<string>())

function aFaire(c: ChapitreProgression) {
  return c.domaines.filter(d => d.acquises < d.questions)
}

function toutTrouves(c: ChapitreProgression) {
  return c.domaines.filter(d => d.acquises >= d.questions)
}

function basculerAcquis(cle: string) {
  const suivants = new Set(acquisDeplies.value)
  if (suivants.has(cle)) suivants.delete(cle)
  else suivants.add(cle)
  acquisDeplies.value = suivants
}

/**
 * Les deux segments d'une barre. Ils se lisent l'un après l'autre : ce qui est
 * tombé juste du premier coup, puis ce qu'il a fallu reprendre. Le reste de la
 * barre — la piste nue — est ce qui n'a jamais été trouvé.
 *
 * Une question retrouvée après une faute reste **acquise** : elle ne perd pas le
 * terrain gagné, elle dit seulement qu'il a coûté quelque chose.
 */
function segments(c: CompteProgression) {
  const sures = Math.max(0, c.acquises - c.hesitantes)
  return [
    { value: sures, color: 'success' as const },
    {
      value: c.hesitantes,
      color: 'warning' as const,
      // Deux teintes qui se touchent se lisent comme une seule : un liseré de la
      // couleur du fond sépare les segments, et ne s'invite pas quand le premier
      // est vide.
      ui: sures ? { segment: 'border-s-2 border-(--ui-bg)' } : undefined
    }
  ]
}

function pourcentage(c: CompteProgression) {
  return c.questions ? Math.round(100 * c.acquises / c.questions) : 0
}

/**
 * Le détail d'une ligne, au survol. La barre montre déjà l'ambre ; l'écrire en
 * toutes lettres sur chaque ligne faisait plus de texte que de sujet.
 */
function detail(c: CompteProgression) {
  const base = `${c.acquises} trouvée${c.acquises > 1 ? 's' : ''} sur ${c.questions}`
  return c.hesitantes ? `${base}, dont ${c.hesitantes} après une faute` : base
}

function pluriel(n: number, mot: string) {
  return `${n} ${mot}${n > 1 ? 's' : ''}`
}

useSeoMeta({ title: 'Mes domaines' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Mes domaines"
      description="Ce qui est tenu, point de cours par point de cours. Dans chaque chapitre, ce qui résiste le plus passe en tête."
    />

    <UPageBody>
      <template v-if="data">
        <!-- La vue d'ensemble : une barre, et sa légende sur une ligne. Deux
             comptes s'additionnent plus vite dans la tête que deux pourcentages. -->
        <div>
          <UProgressGroup
            size="md"
            :max="total.questions"
            :items="segments(total)"
          />
          <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted tabular-nums">
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-success" />
              {{ total.acquises - total.hesitantes }} du premier coup
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-warning" />
              {{ total.hesitantes }} après une faute
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-accented" />
              {{ total.questions - total.acquises }} jamais trouvées
            </span>
            <span class="ms-auto font-medium text-highlighted">{{ pourcentage(total) }} %</span>
          </div>
        </div>

        <!-- Le choix de la matière reprend celui du quiz, avec la barre de
             chacune : on voit d'un coup d'œil laquelle ouvrir. -->
        <div
          class="mt-8 grid gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Matière"
        >
          <button
            v-for="matiere of matieres"
            :key="matiere.cle"
            type="button"
            role="radio"
            :aria-checked="matiereChoisie?.cle === matiere.cle"
            :title="detail(matiere)"
            class="flex flex-col gap-1.5 rounded-lg border px-3 py-2 text-left transition-colors"
            :class="matiereChoisie?.cle === matiere.cle ? 'border-primary bg-primary/5' : 'border-default hover:border-primary/60'"
            @click="choisirMatiere(matiere.cle)"
          >
            <span class="flex w-full items-center gap-3">
              <UIcon
                :name="matiere.icone || 'i-lucide-book-open'"
                class="size-5 shrink-0"
                :class="matiereChoisie?.cle === matiere.cle ? 'text-primary' : 'text-dimmed'"
              />
              <span class="min-w-0 flex-1">
                <span
                  v-if="plusieursAnnees && matiere.annee"
                  class="block text-xs text-dimmed"
                >{{ matiere.annee }}</span>
                <span class="block truncate text-sm font-medium text-highlighted">{{ matiere.titre }}</span>
              </span>
              <span class="shrink-0 text-sm text-muted tabular-nums">{{ pourcentage(matiere) }} %</span>
            </span>
            <UProgressGroup
              class="w-full"
              size="sm"
              :max="matiere.questions"
              :items="segments(matiere)"
            />
          </button>
        </div>

        <section
          v-if="matiereChoisie"
          class="mt-10"
        >
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 class="m-0 text-xl font-semibold text-highlighted">
              <ULink
                v-if="matiereChoisie.chemin"
                :to="matiereChoisie.chemin"
                class="hover:text-primary"
              >{{ matiereChoisie.titre }}</ULink>
              <template v-else>
                {{ matiereChoisie.titre }}
              </template>
            </h2>
            <span class="text-sm text-muted tabular-nums">
              {{ matiereChoisie.acquises }} / {{ matiereChoisie.questions }}
            </span>
            <div class="ms-auto flex items-center gap-1">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                :icon="tousOuverts ? 'i-lucide-chevrons-down-up' : 'i-lucide-chevrons-up-down'"
                :label="tousOuverts ? 'Tout replier' : 'Tout déplier'"
                @click="basculerTous"
              />
              <UButton
                v-if="matiereChoisie.interrogeables"
                size="xs"
                color="primary"
                variant="subtle"
                icon="i-lucide-zap"
                label="M'interroger sur la matière"
                :to="{ path: '/quiz', query: { matiere: matiereChoisie.cle } }"
              />
            </div>
          </div>

          <ul class="mt-4 flex list-none flex-col divide-y divide-default rounded-lg border border-default p-0">
            <li
              v-for="chapitre of matiereChoisie.chapitres"
              :key="chapitre.cle"
            >
              <div class="flex items-center gap-1 pe-2">
                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-center gap-3 py-2.5 ps-3 text-left hover:bg-elevated/50"
                  :aria-expanded="ouverts.has(chapitre.cle)"
                  :title="detail(chapitre)"
                  @click="basculer(chapitre.cle)"
                >
                  <UIcon
                    name="i-lucide-chevron-right"
                    class="size-4 shrink-0 text-dimmed transition-transform"
                    :class="ouverts.has(chapitre.cle) && 'rotate-90'"
                  />
                  <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ chapitre.titre }}</span>
                  <UProgressGroup
                    class="hidden w-28 shrink-0 sm:block"
                    size="sm"
                    :max="chapitre.questions"
                    :items="segments(chapitre)"
                  />
                  <span
                    class="w-12 shrink-0 text-end text-sm tabular-nums"
                    :class="chapitre.acquises >= chapitre.questions ? 'text-success' : 'text-muted'"
                  >{{ pourcentage(chapitre) }} %</span>
                </button>
                <UButton
                  v-if="chapitre.chemin"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-arrow-up-right"
                  :aria-label="`Ouvrir le chapitre : ${chapitre.titre}`"
                  :title="`Ouvrir le chapitre`"
                  :to="chapitre.chemin"
                />
                <UButton
                  v-if="chapitre.interrogeables"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-zap"
                  :aria-label="`M'interroger sur le chapitre : ${chapitre.titre}`"
                  :title="`M'interroger sur le chapitre`"
                  :to="{ path: '/quiz', query: { theme: chapitre.cle } }"
                />
                <span
                  v-else
                  class="size-6 shrink-0"
                />
              </div>

              <div
                v-if="ouverts.has(chapitre.cle)"
                class="border-t border-default bg-elevated/30 pb-1"
              >
                <ul class="m-0 flex list-none flex-col p-0">
                  <li
                    v-for="domaine of [...aFaire(chapitre), ...(acquisDeplies.has(chapitre.cle) ? toutTrouves(chapitre) : [])]"
                    :key="domaine.cle ?? `${chapitre.cle}#sans-renvoi`"
                    class="flex items-center gap-3 py-1 ps-6 pe-2 sm:ps-10"
                    :title="detail(domaine)"
                  >
                    <!-- Sur un téléphone, le titre passe avant la barre : tronqué
                         à dix lettres, un point de cours ne se reconnaît plus,
                         alors que le compte à côté dit déjà l'essentiel. -->
                    <span
                      class="min-w-0 flex-1 text-sm sm:truncate"
                      :class="domaine.cle ? 'text-default' : 'text-muted italic'"
                    >{{ domaine.titre }}</span>
                    <UProgressGroup
                      class="hidden w-24 shrink-0 sm:block"
                      size="sm"
                      :max="domaine.questions"
                      :items="segments(domaine)"
                    />
                    <span class="w-12 shrink-0 text-end text-xs text-muted tabular-nums">{{ domaine.acquises }}/{{ domaine.questions }}</span>
                    <UButton
                      v-if="domaine.cle && domaine.interrogeables"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-zap"
                      :aria-label="`M'interroger sur : ${domaine.titre}`"
                      :title="`M'interroger sur : ${domaine.titre}`"
                      :to="{ path: '/quiz', query: { notion: domaine.cle } }"
                    />
                    <span
                      v-else
                      class="size-6 shrink-0"
                    />
                  </li>
                </ul>
                <button
                  v-if="toutTrouves(chapitre).length"
                  type="button"
                  class="ms-6 mt-1 inline-flex items-center gap-1.5 py-1 text-xs text-success hover:underline sm:ms-10"
                  :aria-expanded="acquisDeplies.has(chapitre.cle)"
                  @click="basculerAcquis(chapitre.cle)"
                >
                  <UIcon
                    name="i-lucide-check"
                    class="size-3.5"
                  />
                  <template v-if="acquisDeplies.has(chapitre.cle)">
                    Masquer ce qui est tout trouvé
                  </template>
                  <template v-else-if="aFaire(chapitre).length">
                    {{ pluriel(toutTrouves(chapitre).length, 'point') }} tout trouvé{{ toutTrouves(chapitre).length > 1 ? 's' : '' }}
                  </template>
                  <template v-else>
                    Tout est trouvé — voir les {{ pluriel(toutTrouves(chapitre).length, 'point') }}
                  </template>
                </button>
              </div>
            </li>
          </ul>
        </section>

        <section
          v-if="clotures.length"
          class="mt-10"
        >
          <h2 class="m-0 text-base font-medium text-highlighted">
            Clos
          </h2>
          <p class="mt-1 mb-3 text-sm text-muted">
            Hors de cette page, des révisions et des séances sur toute la matière. Rien n'est effacé :
            rouvrir rend tout tel quel.
          </p>
          <ul class="m-0 flex list-none flex-col divide-y divide-default rounded-lg border border-default p-0">
            <li
              v-for="c of clotures"
              :key="c.chemin"
              class="flex items-center gap-3 px-3 py-1.5"
            >
              <UIcon
                name="i-lucide-archive"
                class="size-4 shrink-0 text-dimmed"
              />
              <ULink
                :to="c.chemin"
                class="min-w-0 flex-1 truncate text-sm text-highlighted hover:text-primary"
              >
                <span class="text-dimmed">{{ natures[c.nature] }} · </span>{{ c.titre }}
              </ULink>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-archive-restore"
                label="Rouvrir"
                :loading="reouverture === c.chemin"
                @click="rouvrirEtRelire(c.chemin)"
              />
            </li>
          </ul>
        </section>
      </template>

      <p
        v-else-if="status === 'error'"
        class="text-sm text-muted"
      >
        La progression n'a pas pu être lue. Recharge la page ; si ça recommence, c'est que la
        session a expiré.
      </p>

      <!--
        L'attente est le **troisième** cas et non le premier, et c'est voulu : au
        rendu serveur la requête n'a pas commencé (`status` vaut « idle »), alors
        qu'au premier rendu client elle est déjà « pending ». Brancher sur
        `status` ferait donc rendre deux choses différentes de part et d'autre de
        l'hydratation. Brancher sur `data`, absente des deux côtés, les fait
        coïncider.
      -->
      <div
        v-else
        class="flex flex-col gap-3"
      >
        <USkeleton class="h-3 w-full" />
        <USkeleton class="h-4 w-2/3" />
        <USkeleton class="h-4 w-1/2" />
      </div>
    </UPageBody>
  </UPage>
</template>
