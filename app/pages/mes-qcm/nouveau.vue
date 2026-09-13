<script setup lang="ts">
import type { ApercuQuestion, QuestionCandidate } from '~~/shared/types/mes-qcm'
import type { CatalogueQuiz, FiltreQuiz, MatiereCatalogue } from '~~/shared/types/quiz'

definePageMeta({ layout: 'cours' })

/**
 * Composer un QCM.
 *
 * Deux façons de choisir, qui se complètent au lieu de s'exclure :
 *
 * - **tirer**, exactement comme on lance un quiz — la même sélection par
 *   chapitre et section du cours, la même préférence pour ce qui est en dette.
 *   Chaque tirage **s'ajoute** à ce qui est déjà retenu, sans le répéter ;
 * - **prendre à la main**, en parcourant le plan de la matière, et en lisant une
 *   question avant de la retenir.
 *
 * Rien n'est écrit tant qu'on n'a pas cliqué « Créer le QCM » : la sélection vit
 * dans la page, et la quitter la perd. C'est voulu — un brouillon en base serait
 * une chose de plus à nettoyer, pour une composition qui prend deux minutes.
 */

const route = useRoute()
const { data: catalogue } = await useLazyFetch<CatalogueQuiz>('/api/quiz/catalogue', { server: false })

const matiereCle = ref<string | null>(null)
const matiere = computed<MatiereCatalogue | null>(() =>
  catalogue.value?.matieres.find(m => m.cle === matiereCle.value) ?? null)

watch(catalogue, (c) => {
  if (!c || matiereCle.value) return
  const demandee = typeof route.query.matiere === 'string' ? route.query.matiere : null
  matiereCle.value = c.matieres.find(m => m.cle === demandee)?.cle ?? c.matieres[0]?.cle ?? null
}, { immediate: true })

const titre = ref('')
const retenues = ref<QuestionCandidate[]>([])
const retenuesIds = computed(() => new Set(retenues.value.map(q => q.id)))

/** La borne du serveur, relue dans le catalogue pour que la page n'invente rien. */
const maximum = computed(() => catalogue.value?.tailleMax ?? 60)
const place = computed(() => Math.max(0, maximum.value - retenues.value.length))

/* Le tirage. */

const vide = (cle: string | null): FiltreQuiz => ({ matiere: cle, themes: [], sections: [], notions: [], erreurs: false })
const filtre = ref<FiltreQuiz>(vide(null))
const nombre = ref(10)
const tirage = ref(false)
const messageTirage = ref<{ texte: string, ton: 'success' | 'warning' | 'error' } | null>(null)

async function tirerQuestions() {
  if (!matiereCle.value || tirage.value || !place.value) return
  const demande = Math.min(nombre.value, place.value)
  tirage.value = true
  messageTirage.value = null
  try {
    const tirees = await $fetch<QuestionCandidate[]>('/api/mes-qcm/tirage', {
      method: 'POST',
      body: { ...filtre.value, matiere: matiereCle.value, taille: demande, exclues: [...retenuesIds.value] }
    })
    retenues.value = [...retenues.value, ...tirees]
    messageTirage.value = !tirees.length
      ? { texte: 'Plus rien à proposer dans cette sélection : tout y est déjà retenu.', ton: 'warning' }
      : tirees.length < demande
        ? { texte: `La sélection n'avait plus que ${tirees.length} question${tirees.length > 1 ? 's' : ''} à proposer : ${tirees.length > 1 ? 'elles sont ajoutées' : 'elle est ajoutée'}.`, ton: 'warning' }
        : { texte: `${tirees.length} question${tirees.length > 1 ? 's' : ''} ajoutée${tirees.length > 1 ? 's' : ''} au QCM.`, ton: 'success' }
  } catch (e) {
    const message = (e as { data?: { statusMessage?: string } })?.data?.statusMessage
    messageTirage.value = { texte: message || 'Le tirage n\'a pas abouti.', ton: 'error' }
  } finally {
    tirage.value = false
  }
}

/* Le choix à la main. */

const candidates = ref<QuestionCandidate[] | null>(null)
const erreurCandidates = ref(false)

async function chargerCandidates(cle: string | null) {
  candidates.value = null
  erreurCandidates.value = false
  if (!cle) return
  try {
    candidates.value = await $fetch<QuestionCandidate[]>('/api/mes-qcm/candidates', { query: { matiere: cle } })
  } catch {
    erreurCandidates.value = true
  }
}

// Un QCM ne mélange pas deux matières : en changer repart d'une page blanche.
watch(matiereCle, (cle) => {
  retenues.value = []
  filtre.value = vide(cle)
  messageTirage.value = null
  apercus.value = {}
  chargerCandidates(cle)
})

const recherche = ref('')

/** Replie accents et casse : « réciproques » se trouve en tapant « reciproques ». */
function replier(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

interface SectionArbre { cle: string, titre: string, questions: QuestionCandidate[] }
interface ChapitreArbre { cle: string, titre: string, total: number, sections: SectionArbre[] }

/** Les candidates rangées par chapitre puis par section du cours, dans l'ordre du plan. */
const arbre = computed<ChapitreArbre[]>(() => {
  const q = replier(recherche.value.trim())
  const chapitres = new Map<string, { cle: string, titre: string, total: number, sections: Map<string, SectionArbre> }>()
  for (const c of candidates.value ?? []) {
    if (q && !replier(`${c.themeTitre ?? ''} ${c.sectionTitre ?? ''} ${c.ficheTitre} ${c.blocTitre} ${c.label}`).includes(q)) continue
    const cleChapitre = c.theme ?? 'divers'
    const chapitre = chapitres.get(cleChapitre)
      ?? { cle: cleChapitre, titre: c.themeTitre ?? 'Divers', total: 0, sections: new Map<string, SectionArbre>() }
    const cleSection = c.section ?? `${cleChapitre}#reste`
    const section = chapitre.sections.get(cleSection)
      ?? { cle: cleSection, titre: c.sectionTitre ?? 'Le reste du chapitre', questions: [] }
    section.questions.push(c)
    chapitre.total += 1
    chapitre.sections.set(cleSection, section)
    chapitres.set(cleChapitre, chapitre)
  }
  return [...chapitres.values()].map(ch => ({ ...ch, sections: [...ch.sections.values()] }))
})

const ouverts = ref(new Set<string>())
/** Une recherche déplie tout : on veut voir ce qu'on a trouvé. */
const estOuvert = (cle: string) => !!recherche.value.trim() || ouverts.value.has(cle)

function basculerOuvert(cle: string) {
  const suivant = new Set(ouverts.value)
  if (suivant.has(cle)) suivant.delete(cle)
  else suivant.add(cle)
  ouverts.value = suivant
}

function basculerQuestion(c: QuestionCandidate) {
  if (retenuesIds.value.has(c.id)) retirer(c.id)
  else if (place.value) retenues.value = [...retenues.value, c]
}

function prendreSection(section: SectionArbre) {
  const nouvelles = section.questions.filter(q => !retenuesIds.value.has(q.id)).slice(0, place.value)
  retenues.value = [...retenues.value, ...nouvelles]
}

const apercus = ref<Record<string, ApercuQuestion | 'chargement' | 'erreur'>>({})

async function basculerApercu(id: string) {
  if (apercus.value[id]) {
    const { [id]: _retire, ...reste } = apercus.value
    apercus.value = reste
    return
  }
  apercus.value = { ...apercus.value, [id]: 'chargement' }
  try {
    const apercu = await $fetch<ApercuQuestion>('/api/mes-qcm/apercu', { query: { id } })
    apercus.value = { ...apercus.value, [id]: apercu }
  } catch {
    apercus.value = { ...apercus.value, [id]: 'erreur' }
  }
}

function apercuDe(id: string): ApercuQuestion | null {
  const a = apercus.value[id]
  return a && typeof a === 'object' ? a : null
}

/* La sélection. */

function retirer(id: string) {
  retenues.value = retenues.value.filter(q => q.id !== id)
}

function deplacer(index: number, sens: -1 | 1) {
  const cible = index + sens
  if (cible < 0 || cible >= retenues.value.length) return
  const copie = [...retenues.value]
  ;[copie[index], copie[cible]] = [copie[cible]!, copie[index]!]
  retenues.value = copie
}

function melanger() {
  const copie = [...retenues.value]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j]!, copie[i]!]
  }
  retenues.value = copie
}

function reference(c: QuestionCandidate) {
  return `${c.ficheTitre} › ${c.blocTitre}, question ${c.label}`
}

/* La création. */

const creation = ref(false)
const erreurCreation = ref<string | null>(null)
const pret = computed(() => !!titre.value.trim() && !!retenues.value.length && !!matiereCle.value)

async function creer() {
  if (!pret.value || creation.value) return
  creation.value = true
  erreurCreation.value = null
  try {
    const { id } = await $fetch<{ id: number }>('/api/mes-qcm', {
      method: 'POST',
      body: { titre: titre.value, matiere: matiereCle.value, questions: retenues.value.map(q => q.id) }
    })
    await navigateTo(`/mes-qcm/${id}`)
  } catch (e) {
    const message = (e as { data?: { statusMessage?: string } })?.data?.statusMessage
    erreurCreation.value = message || 'Le QCM n\'a pas pu être créé.'
    creation.value = false
  }
}

useSeoMeta({ title: 'Composer un QCM' })
</script>

<template>
  <UPage>
    <UPageHeader
      title="Composer un QCM"
      description="Choisis des questions dans les fiches d'une matière — tirées comme pour un quiz, ou prises une à une — et donne un titre au QCM. Il devient une page fixe, rangée dans « Mes QCM », où toutes les questions se posent d'un coup."
    >
      <template #links>
        <UButton
          to="/mes-qcm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
          label="Mes QCM"
        />
      </template>
    </UPageHeader>

    <UPageBody>
      <div
        v-if="!catalogue"
        class="flex items-center gap-2 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-4 animate-spin"
        />
        <span>Chargement des questions…</span>
      </div>

      <template v-else>
        <!-- 1. Le QCM -->
        <section>
          <h2 class="text-lg font-medium text-highlighted">
            1. Le QCM
          </h2>
          <UFormField
            class="mt-3 max-w-xl"
            label="Titre"
            description="C'est le nom de la page, tel qu'il s'affichera dans « Mes QCM »."
            required
          >
            <UInput
              v-model="titre"
              class="w-full"
              :maxlength="120"
              placeholder="Par exemple : Dérivées composées, deuxième passage"
            />
          </UFormField>

          <p class="mt-5 mb-0 text-sm font-medium text-highlighted">
            Matière
          </p>
          <p class="mt-0.5 mb-0 text-xs text-muted">
            Un QCM reste dans une matière. En changer vide la sélection.
          </p>
          <MatiereChoix
            v-model="matiereCle"
            class="mt-2"
            :matieres="catalogue.matieres"
          />
        </section>

        <template v-if="matiere">
          <!-- 2. Tirer -->
          <section class="mt-10">
            <h2 class="text-lg font-medium text-highlighted">
              2. Tirer des questions
            </h2>
            <p class="mt-1 mb-0 text-sm text-muted">
              Comme pour un quiz : ce qui est en dette passe d'abord, puis ce qui n'a jamais été posé.
              Chaque tirage s'ajoute au QCM sans reprendre ce qui y est déjà.
            </p>

            <QuizFiltre
              :key="matiere.cle"
              v-model="filtre"
              class="mt-4"
              :catalogue="matiere"
            />

            <div class="mt-4 flex flex-wrap items-center gap-2">
              <UButton
                v-for="n in [5, 10, 20]"
                :key="n"
                size="sm"
                :color="nombre === n ? 'primary' : 'neutral'"
                :variant="nombre === n ? 'solid' : 'outline'"
                class="tabular-nums"
                :label="String(n)"
                @click="nombre = n"
              />
              <UButton
                color="primary"
                variant="subtle"
                icon="i-lucide-shuffle"
                :loading="tirage"
                :disabled="!place"
                :label="`Tirer ${Math.min(nombre, place)} question${Math.min(nombre, place) > 1 ? 's' : ''}`"
                @click="tirerQuestions"
              />
            </div>
            <p
              v-if="messageTirage"
              class="mt-2 mb-0 text-sm"
              :class="{ success: 'text-success', warning: 'text-warning', error: 'text-error' }[messageTirage.ton]"
            >
              {{ messageTirage.texte }}
            </p>
          </section>

          <!-- 3. À la main -->
          <section class="mt-10">
            <h2 class="text-lg font-medium text-highlighted">
              3. Choisir à la main
            </h2>
            <p class="mt-1 mb-0 text-sm text-muted">
              Le plan de la matière, question par question. « Lire » ouvre l'énoncé avant de le prendre.
            </p>

            <UInput
              v-model="recherche"
              class="mt-4 w-full max-w-xl"
              icon="i-lucide-search"
              placeholder="Filtrer : une section, une fiche, un exercice…"
            />

            <p
              v-if="erreurCandidates"
              class="mt-3 text-sm text-error"
            >
              Les questions de la matière n'ont pas pu être chargées.
            </p>
            <div
              v-else-if="!candidates"
              class="mt-3 flex flex-col gap-2"
            >
              <USkeleton class="h-10 w-full" />
              <USkeleton class="h-10 w-full" />
            </div>
            <p
              v-else-if="!arbre.length"
              class="mt-3 text-sm text-muted"
            >
              Rien ne correspond à cette recherche.
            </p>

            <div
              v-else
              class="mt-3 flex flex-col gap-2"
            >
              <div
                v-for="chapitre in arbre"
                :key="chapitre.cle"
                class="rounded-lg border border-default"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left"
                  :aria-expanded="estOuvert(chapitre.cle)"
                  @click="basculerOuvert(chapitre.cle)"
                >
                  <UIcon
                    :name="estOuvert(chapitre.cle) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                    class="size-4 shrink-0 text-dimmed"
                  />
                  <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ chapitre.titre }}</span>
                  <span class="shrink-0 text-xs text-muted tabular-nums">
                    {{ chapitre.total }} question{{ chapitre.total > 1 ? 's' : '' }}
                  </span>
                </button>

                <div
                  v-if="estOuvert(chapitre.cle)"
                  class="border-t border-default px-3 py-2"
                >
                  <div
                    v-for="section in chapitre.sections"
                    :key="section.cle"
                    class="py-2"
                  >
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="m-0 min-w-0 flex-1 text-xs font-medium uppercase tracking-wide text-dimmed">
                        {{ section.titre }}
                      </p>
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-list-plus"
                        :disabled="!place || section.questions.every(q => retenuesIds.has(q.id))"
                        label="Tout prendre"
                        @click="prendreSection(section)"
                      />
                    </div>

                    <div class="mt-1 flex flex-col">
                      <div
                        v-for="c in section.questions"
                        :key="c.id"
                        class="py-1"
                      >
                        <div class="flex items-center gap-2">
                          <button
                            type="button"
                            role="checkbox"
                            :aria-checked="retenuesIds.has(c.id)"
                            :disabled="!retenuesIds.has(c.id) && !place"
                            class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left transition-colors disabled:opacity-50"
                            :class="retenuesIds.has(c.id) ? 'bg-primary/10' : 'hover:bg-elevated/50'"
                            @click="basculerQuestion(c)"
                          >
                            <UIcon
                              :name="retenuesIds.has(c.id) ? 'i-lucide-square-check-big' : 'i-lucide-square'"
                              class="size-4 shrink-0"
                              :class="retenuesIds.has(c.id) ? 'text-primary' : 'text-dimmed'"
                            />
                            <span class="min-w-0 flex-1 truncate text-sm text-highlighted">{{ reference(c) }}</span>
                            <span
                              v-if="c.enDette"
                              class="shrink-0 text-xs text-error"
                            >à revoir</span>
                          </button>
                          <UButton
                            size="xs"
                            color="neutral"
                            variant="ghost"
                            :icon="apercus[c.id] ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                            :loading="apercus[c.id] === 'chargement'"
                            :label="apercus[c.id] ? 'Masquer' : 'Lire'"
                            @click="basculerApercu(c.id)"
                          />
                        </div>
                        <QcmApercu
                          v-if="apercuDe(c.id)"
                          class="mt-1 ms-8"
                          :apercu="apercuDe(c.id)!"
                          :bloc-titre="c.blocTitre"
                        />
                        <p
                          v-else-if="apercus[c.id] === 'erreur'"
                          class="mt-1 ms-8 mb-0 text-xs text-error"
                        >
                          L'énoncé n'a pas pu être lu.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 4. La sélection -->
          <section class="mt-10">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-lg font-medium text-highlighted">
                4. Le QCM, dans l'ordre
              </h2>
              <div
                v-if="retenues.length"
                class="flex items-center gap-1"
              >
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-shuffle"
                  label="Mélanger"
                  :disabled="retenues.length < 2"
                  @click="melanger"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-eraser"
                  label="Tout retirer"
                  @click="retenues = []"
                />
              </div>
            </div>

            <p
              v-if="!retenues.length"
              class="mt-2 text-sm text-muted"
            >
              Aucune question retenue pour l'instant. Tire-en quelques-unes ou coche-les dans le plan.
            </p>

            <ol
              v-else
              class="mt-3 flex list-none flex-col gap-1 p-0"
            >
              <li
                v-for="(c, index) in retenues"
                :key="c.id"
                class="flex items-center gap-2 rounded-lg border border-default px-3 py-2"
              >
                <span class="w-7 shrink-0 text-sm font-semibold text-highlighted tabular-nums">{{ index + 1 }}.</span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm text-highlighted">{{ reference(c) }}</span>
                  <span
                    v-if="c.sectionTitre || c.themeTitre"
                    class="block truncate text-xs text-dimmed"
                  >{{ [c.themeTitre, c.sectionTitre].filter(Boolean).join(' · ') }}</span>
                </span>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-arrow-up"
                  aria-label="Monter"
                  :disabled="index === 0"
                  @click="deplacer(index, -1)"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-arrow-down"
                  aria-label="Descendre"
                  :disabled="index === retenues.length - 1"
                  @click="deplacer(index, 1)"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-x"
                  :aria-label="`Retirer la question ${index + 1}`"
                  @click="retirer(c.id)"
                />
              </li>
            </ol>
          </section>

          <!-- La barre de création reste sous les yeux pendant qu'on parcourt le
               plan : c'est elle qui dit combien de questions sont retenues. -->
          <div class="sticky bottom-0 z-10 mt-8 -mx-4 border-t border-default bg-default/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-t-lg sm:border-x">
            <UAlert
              v-if="erreurCreation"
              class="mb-3"
              color="error"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :description="erreurCreation"
            />
            <div class="flex flex-wrap items-center gap-3">
              <span class="me-auto text-sm text-muted tabular-nums">
                <strong class="text-highlighted">{{ retenues.length }}</strong>
                question{{ retenues.length > 1 ? 's' : '' }} retenue{{ retenues.length > 1 ? 's' : '' }}
                sur {{ maximum }} au plus
                <template v-if="!titre.trim() && retenues.length">
                  · <span class="text-warning">il manque un titre</span>
                </template>
              </span>
              <UButton
                color="primary"
                icon="i-lucide-check"
                :loading="creation"
                :disabled="!pret"
                label="Créer le QCM"
                @click="creer"
              />
            </div>
          </div>
        </template>
      </template>
    </UPageBody>
  </UPage>
</template>
