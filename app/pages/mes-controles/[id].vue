<script setup lang="ts">
import type { Controle, JourControle, SectionControle, ValeursControle } from '~~/shared/types/controles'
import type { CatalogueQuiz, QuestionQuiz, SessionQuiz } from '~~/shared/types/quiz'

definePageMeta({ layout: 'cours' })

const route = useRoute()
const id = computed(() => Number(route.params.id))

/**
 * Tout le contrôle en une requête, relue au montage : état, sections, feuille
 * de route et examen blanc. Revenir d'une séance remonte la page, et la relit
 * donc — c'est ce qui fait avancer la journée sous les yeux.
 */
const { data: controle, error, refresh } = await useLazyFetch<Controle>(() => `/api/controles/${id.value}`, {
  server: false,
  query: { fuseau: fuseauLocal() }
})

const parCle = computed(() => new Map((controle.value?.sections ?? []).map(s => [s.cle, s])))

/**
 * Les morceaux d'une journée, avec leur section. Une grosse section s'étale sur
 * plusieurs jours : `questions` est la part de celui-ci, et `entiere` dit si
 * elle couvre tout ce qu'il restait de la section.
 */
function morceauxDu(jour: JourControle) {
  return jour.parts.flatMap((p) => {
    const section = parCle.value.get(p.cle)
    return section ? [{ section, questions: p.questions, entiere: p.questions >= section.restantesCeMatin }] : []
  })
}

const aujourdhui = computed(() => controle.value?.aujourdhui ?? null)
const morceauxDuJour = computed(() => (aujourdhui.value ? morceauxDu(aujourdhui.value.jour) : []))
/** Ce que la journée demande encore. */
const resteDuJour = computed(() => Math.max(0, (aujourdhui.value?.questions ?? 0) - (aujourdhui.value?.gagnees ?? 0)))
const journeeFaite = computed(() => !!morceauxDuJour.value.length && resteDuJour.value === 0)

/** La prochaine journée d'apprentissage après aujourd'hui, pour prendre de l'avance. */
const prochaine = computed(() => (controle.value?.feuille ?? []).slice(1).find(j => j.parts.length) ?? null)

/** Les sections du programme, rangées par chapitre pour l'affichage. */
const chapitres = computed(() => {
  const groupes = new Map<string, { cle: string, titre: string, sections: SectionControle[] }>()
  for (const s of controle.value?.sections ?? []) {
    const cle = s.theme ?? 'divers'
    const g = groupes.get(cle) ?? { cle, titre: s.themeTitre ?? 'Divers', sections: [] }
    g.sections.push(s)
    groupes.set(cle, g)
  }
  return [...groupes.values()]
})

/* --- Séances ---------------------------------------------------------------- */

const lancement = ref<string | null>(null)
const erreurAction = ref<string | null>(null)

const borner = (n: number) => Math.min(60, Math.max(5, n))

function messageDe(e: unknown, defaut: string) {
  return (e as { data?: { statusMessage?: string } })?.data?.statusMessage || defaut
}

/**
 * Ouvre une séance de quiz et y envoie. Le contrôle ne pose rien lui-même : il
 * choisit la sélection, le quiz fait le reste — file, reprises, report sur les
 * fiches, dette.
 */
async function seance(cle: string, corps: { themes?: string[], sections?: string[], erreurs?: boolean, nonAcquises?: boolean, taille: number }) {
  if (!controle.value || lancement.value) return
  lancement.value = cle
  erreurAction.value = null
  try {
    const { session } = await $fetch<{ session: SessionQuiz, question: QuestionQuiz | null }>('/api/quiz/session', {
      method: 'POST',
      body: { matiere: controle.value.matiere, themes: [], sections: [], ...corps, taille: borner(corps.taille) }
    })
    await navigateTo(`/quiz/${session.id}`)
  } catch (e) {
    erreurAction.value = messageDe(e, 'La séance n\'a pas pu démarrer.')
    lancement.value = null
  }
}

/**
 * La séance d'une journée : ce qui n'est pas encore su dans ses sections, à
 * hauteur de ce qu'elle demande. Une section étalée sur deux jours n'est pas
 * posée en entier le premier.
 */
function apprendre(cle: string, jour: JourControle, reste: number) {
  return seance(cle, { sections: jour.parts.map(p => p.cle), nonAcquises: true, taille: reste })
}

/**
 * Une section seule. Tant qu'elle n'est pas sue, on n'y pose que ce qui manque ;
 * une fois sue, on la repasse entière — c'est alors de l'entretien.
 */
function interrogerSection(s: SectionControle) {
  const reste = s.questions - s.sues
  return seance(s.cle, { sections: [s.cle], nonAcquises: reste > 0, taille: reste || s.questions })
}

/** La dette du programme, et seulement elle. */
function solderDette() {
  const c = controle.value
  if (!c) return
  return seance('dette', { themes: c.programme.themes, sections: c.programme.sections, erreurs: true, taille: c.etat.dette })
}

async function composerBlanc() {
  if (lancement.value) return
  lancement.value = 'blanc'
  erreurAction.value = null
  try {
    const { id: qcm } = await $fetch<{ id: number }>(`/api/controles/${id.value}/examen-blanc`, { method: 'POST' })
    await navigateTo(`/mes-qcm/${qcm}`)
  } catch (e) {
    erreurAction.value = messageDe(e, 'L\'examen blanc n\'a pas pu être composé.')
    lancement.value = null
  }
}

/* --- Retouche, bilan, suppression ------------------------------------------ */

const edition = ref(false)
const enregistrement = ref(false)
const erreurEdition = ref<string | null>(null)
const { data: catalogue, execute: chargerCatalogue } = useLazyFetch<CatalogueQuiz>('/api/quiz/catalogue', {
  server: false,
  immediate: false
})

async function ouvrirEdition() {
  erreurEdition.value = null
  edition.value = true
  if (!catalogue.value) await chargerCatalogue()
}

const initial = computed<ValeursControle | null>(() => controle.value
  ? {
      titre: controle.value.titre,
      matiere: controle.value.matiere,
      jour: controle.value.jour,
      themes: controle.value.programme.themes,
      sections: controle.value.programme.sections
    }
  : null)

async function modifier(valeurs: ValeursControle) {
  enregistrement.value = true
  erreurEdition.value = null
  try {
    await $fetch(`/api/controles/${id.value}`, {
      method: 'PATCH',
      body: { titre: valeurs.titre, jour: valeurs.jour, themes: valeurs.themes, sections: valeurs.sections }
    })
    edition.value = false
    await refresh()
  } catch (e) {
    erreurEdition.value = messageDe(e, 'Les modifications n\'ont pas pu être enregistrées.')
  } finally {
    enregistrement.value = false
  }
}

const note = ref<number | null>(null)
const bareme = ref<number | null>(20)
watch(controle, (c) => {
  if (!c) return
  note.value = c.note
  bareme.value = c.bareme ?? 20
}, { immediate: true })

const noteEnregistree = ref(false)
async function enregistrerNote() {
  erreurAction.value = null
  try {
    await $fetch(`/api/controles/${id.value}`, {
      method: 'PATCH',
      body: { note: note.value ?? null, bareme: bareme.value ?? null }
    })
    noteEnregistree.value = true
    await refresh()
  } catch (e) {
    erreurAction.value = messageDe(e, 'La note n\'a pas pu être enregistrée.')
  }
}

const confirmation = ref(false)
async function supprimer() {
  await $fetch(`/api/controles/${id.value}`, { method: 'DELETE' })
  await navigateTo('/mes-controles')
}

/* --- Affichage --------------------------------------------------------------- */

function libelleRang(rang: number) {
  if (rang === 0) return 'Jour J'
  return `J-${rang}`
}

function tonEcheance(joursRestants: number) {
  if (joursRestants <= 2) return 'error'
  if (joursRestants <= 7) return 'warning'
  return 'primary'
}

function dateHeure(t: number) {
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

useSeoMeta({ title: () => controle.value?.titre ?? 'Contrôle' })
</script>

<template>
  <UPage>
    <template v-if="controle">
      <UPageHeader
        :title="controle.titre"
        :description="`${controle.matiereTitre ?? controle.matiere} · ${jourLong(controle.jour)}`"
      >
        <template #headline>
          <UButton
            to="/mes-controles"
            icon="i-lucide-arrow-left"
            label="Mes contrôles"
            color="neutral"
            variant="link"
            class="px-0"
          />
        </template>
        <template #links>
          <UButton
            icon="i-lucide-pencil"
            label="Modifier"
            color="neutral"
            variant="subtle"
            @click="ouvrirEdition"
          />
          <UButton
            icon="i-lucide-trash-2"
            aria-label="Supprimer le contrôle"
            color="error"
            variant="ghost"
            @click="confirmation = true"
          />
        </template>
      </UPageHeader>

      <UPageBody>
        <UAlert
          v-if="erreurAction"
          class="mb-6"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="erreurAction"
        />
        <UAlert
          v-if="controle.manquantes"
          class="mb-6"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`${controle.manquantes} partie${controle.manquantes > 1 ? 's' : ''} du programme ${controle.manquantes > 1 ? 'ont' : 'a'} disparu du cours`"
          description="Un chapitre ou une section a été renommé ou retiré depuis. Ces parties ne comptent plus : modifie le programme pour le remettre d'aplomb."
        />

        <!-- L'essentiel en trois chiffres : quand, où j'en suis, ce qui coince. -->
        <div class="grid gap-4 sm:grid-cols-3">
          <UCard>
            <p class="m-0 text-2xl font-medium text-highlighted">
              {{ controle.joursRestants >= 0 ? echeance(controle.joursRestants) : 'Passé' }}
            </p>
            <p class="m-0 text-sm text-muted">
              {{ jourLong(controle.jour) }}
            </p>
          </UCard>
          <UCard>
            <p class="m-0 text-2xl font-medium text-highlighted tabular-nums">
              {{ partSue(controle.etat) }} %
            </p>
            <p class="m-0 text-sm text-muted tabular-nums">
              du programme su · {{ controle.etat.sues }} / {{ controle.etat.questions }}
            </p>
          </UCard>
          <UCard>
            <p
              class="m-0 text-2xl font-medium tabular-nums"
              :class="controle.etat.dette ? 'text-error' : 'text-highlighted'"
            >
              {{ controle.etat.dette }}
            </p>
            <p class="m-0 text-sm text-muted">
              question{{ controle.etat.dette > 1 ? 's' : '' }} ratée{{ controle.etat.dette > 1 ? 's' : '' }}, à retrouver
            </p>
          </UCard>
        </div>

        <UProgressGroup
          class="mt-4"
          size="md"
          :max="controle.etat.questions || 1"
          :items="segmentsControle(controle.etat, true)"
        />

        <!-- Aujourd'hui : la seule chose qu'on ait à décider en ouvrant la page. -->
        <UCard
          v-if="aujourdhui"
          class="mt-8"
          :ui="{ root: 'ring-primary/40' }"
        >
          <div class="flex flex-wrap items-center gap-2">
            <UIcon
              name="i-lucide-sun"
              class="size-5 text-primary"
            />
            <h2 class="m-0 flex-1 text-lg font-medium text-highlighted">
              Aujourd'hui
            </h2>
            <UBadge
              :color="tonEcheance(controle.joursRestants)"
              variant="subtle"
              :label="libelleRang(aujourdhui.jour.rang)"
            />
          </div>

          <!-- Une journée d'apprentissage. -->
          <template v-if="morceauxDuJour.length">
            <p class="mt-2 mb-0 text-sm text-muted">
              <template v-if="journeeFaite">
                Journée faite : tout ce qui était prévu est su.
              </template>
              <template v-else>
                {{ aujourdhui.gagnees }} question{{ aujourdhui.gagnees > 1 ? 's' : '' }} gagnée{{ aujourdhui.gagnees > 1 ? 's' : '' }}
                sur les {{ aujourdhui.questions }} prévue{{ aujourdhui.questions > 1 ? 's' : '' }} aujourd'hui.
                La séance ne pose que ce que tu ne sais pas encore.
              </template>
            </p>
            <UProgress
              class="mt-3"
              size="sm"
              :color="journeeFaite ? 'success' : 'primary'"
              :model-value="aujourdhui.gagnees"
              :max="aujourdhui.questions || 1"
            />
            <ul class="mt-4 mb-0 flex list-none flex-col gap-1 p-0">
              <li
                v-for="m in morceauxDuJour"
                :key="m.section.cle"
                class="flex items-center gap-2 text-sm"
              >
                <UIcon
                  :name="m.section.sues === m.section.questions ? 'i-lucide-circle-check' : 'i-lucide-circle'"
                  class="size-4 shrink-0"
                  :class="m.section.sues === m.section.questions ? 'text-success' : 'text-dimmed'"
                />
                <span class="min-w-0 flex-1 text-highlighted">
                  {{ m.section.titre }}
                  <span class="text-dimmed">· {{ m.section.themeTitre }}</span>
                </span>
                <span class="shrink-0 text-xs text-muted tabular-nums">
                  <template v-if="m.entiere">{{ m.questions }} question{{ m.questions > 1 ? 's' : '' }}</template>
                  <template v-else>{{ m.questions }} sur {{ m.section.restantesCeMatin }}, la suite demain</template>
                </span>
              </li>
            </ul>
            <div class="mt-4 flex flex-wrap gap-2">
              <UButton
                v-if="!journeeFaite"
                icon="i-lucide-zap"
                :label="`Commencer la séance du jour · ${resteDuJour} question${resteDuJour > 1 ? 's' : ''}`"
                :loading="lancement === 'jour'"
                @click="apprendre('jour', aujourdhui.jour, resteDuJour)"
              />
              <UButton
                v-else-if="prochaine"
                icon="i-lucide-fast-forward"
                :label="`Prendre de l'avance sur ${jourCourt(prochaine.jour)}`"
                variant="subtle"
                :loading="lancement === 'avance'"
                @click="apprendre('avance', prochaine, prochaine.questions)"
              />
            </div>
          </template>

          <!-- L'examen blanc. -->
          <template v-else-if="aujourdhui.jour.blanc">
            <p class="mt-2 mb-0 text-sm text-muted">
              C'est le jour de l'examen blanc : {{ controle.tailleBlanc }} questions tirées dans tout le programme,
              à parts égales, sans privilégier ce que tu sais le moins. Il mesure ; les fautes iront dans la dette,
              et demain est fait pour elles.
              <template v-if="aujourdhui.jour.dette">
                Le temps presse : solde la dette dans la foulée.
              </template>
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              <UButton
                v-if="controle.examenBlanc && !controle.examenBlanc.derniere"
                icon="i-lucide-file-check"
                label="Passer l'examen blanc"
                :to="`/mes-qcm/${controle.examenBlanc.id}`"
              />
              <UButton
                v-else
                icon="i-lucide-file-plus"
                :label="controle.examenBlanc ? 'Composer un nouvel examen blanc' : 'Composer l\'examen blanc'"
                :loading="lancement === 'blanc'"
                @click="composerBlanc"
              />
              <UButton
                v-if="aujourdhui.jour.dette && controle.etat.dette"
                icon="i-lucide-rotate-ccw"
                color="error"
                variant="subtle"
                :label="`Solder la dette · ${controle.etat.dette}`"
                :loading="lancement === 'dette'"
                @click="solderDette"
              />
            </div>
          </template>

          <!-- La veille, le jour même, ou une journée de marge. -->
          <template v-else>
            <p class="mt-2 mb-0 text-sm text-muted">
              <template v-if="aujourdhui.jour.dette && controle.etat.dette">
                Rien de neuf aujourd'hui : on consolide. Il reste {{ controle.etat.dette }} question{{ controle.etat.dette > 1 ? 's' : '' }}
                ratée{{ controle.etat.dette > 1 ? 's' : '' }} dans le programme — la séance ne pose qu'elles.
              </template>
              <template v-else-if="aujourdhui.jour.dette">
                Aucune dette dans le programme. Relis tes points faibles, ou repose-toi : tu es prêt.
              </template>
              <template v-else-if="controle.etat.sues === controle.etat.questions">
                Tout le programme est su. Une journée libre — ou un examen blanc pour t'en assurer.
              </template>
              <template v-else>
                Journée de marge : le programme est découpé sur les jours d'avant. Prends de l'avance si tu veux.
              </template>
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              <UButton
                v-if="controle.etat.dette"
                icon="i-lucide-rotate-ccw"
                color="error"
                :label="`Solder la dette · ${controle.etat.dette}`"
                :loading="lancement === 'dette'"
                @click="solderDette"
              />
              <UButton
                v-if="prochaine"
                icon="i-lucide-fast-forward"
                variant="subtle"
                :label="`Prendre de l'avance sur ${jourCourt(prochaine.jour)}`"
                :loading="lancement === 'avance'"
                @click="apprendre('avance', prochaine, prochaine.questions)"
              />
            </div>
          </template>
        </UCard>

        <!-- La feuille de route. -->
        <section
          v-if="controle.feuille.length > 1"
          class="mt-10"
        >
          <h2 class="m-0 text-lg font-medium text-highlighted">
            Feuille de route
          </h2>
          <p class="mt-1 mb-0 text-sm text-muted">
            Ce qu'il restait à apprendre ce matin, découpé en journées dans l'ordre du cours. Une journée
            manquée n'est pas perdue : demain, le reste se redécoupe sur les jours qui restent.
          </p>
          <ol class="mt-4 mb-0 flex list-none flex-col gap-0 p-0">
            <li
              v-for="(j, k) in controle.feuille"
              :key="j.jour"
              class="relative flex gap-3 pb-4 last:pb-0"
            >
              <!-- Le fil qui relie les jours. -->
              <span
                v-if="k < controle.feuille.length - 1"
                class="absolute top-6 bottom-0 left-[0.6875rem] w-px bg-(--ui-border)"
                aria-hidden="true"
              />
              <span
                class="relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.625rem] font-medium tabular-nums"
                :class="k === 0 ? 'border-primary bg-primary text-inverted' : 'border-default bg-default text-muted'"
              >
                {{ j.rang }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="m-0 text-sm">
                  <span class="font-medium text-highlighted">{{ k === 0 ? 'Aujourd\'hui' : jourCourt(j.jour) }}</span>
                  <span class="text-dimmed"> · {{ libelleRang(j.rang) }}</span>
                </p>
                <p
                  v-if="j.parts.length"
                  class="m-0 text-sm text-muted"
                >
                  {{ morceauxDu(j).map(m => m.entiere ? m.section.titre : `${m.section.titre} (${m.questions})`).join(' · ') }}
                  <span class="text-dimmed tabular-nums">— {{ j.questions }} question{{ j.questions > 1 ? 's' : '' }}</span>
                </p>
                <p
                  v-else-if="j.rang === 0"
                  class="m-0 text-sm text-muted"
                >
                  Le contrôle. Un dernier coup d'œil à la dette, s'il en reste.
                </p>
                <p
                  v-else-if="j.blanc"
                  class="m-0 text-sm text-muted"
                >
                  Examen blanc{{ j.dette ? ', puis la dette' : '' }}.
                </p>
                <p
                  v-else-if="j.dette"
                  class="m-0 text-sm text-muted"
                >
                  Rien de neuf : solder la dette.
                </p>
                <p
                  v-else
                  class="m-0 text-sm text-dimmed"
                >
                  Marge.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <!-- L'examen blanc, quand ce n'est pas son jour : on peut le passer quand on veut. -->
        <section
          v-if="!aujourdhui?.jour.blanc && controle.etat.questions"
          class="mt-10"
        >
          <h2 class="m-0 text-lg font-medium text-highlighted">
            Examen blanc
          </h2>
          <div class="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-default px-4 py-3">
            <UIcon
              name="i-lucide-file-check"
              class="size-5 shrink-0 text-primary"
            />
            <p class="m-0 min-w-0 flex-1 text-sm text-muted">
              <template v-if="controle.examenBlanc?.derniere">
                Dernier passage le {{ dateHeure(controle.examenBlanc.derniere.t) }} :
                <strong class="text-highlighted tabular-nums">{{ controle.examenBlanc.derniere.justes }} / {{ controle.examenBlanc.derniere.total }}</strong>.
              </template>
              <template v-else-if="controle.examenBlanc">
                Composé, pas encore passé — {{ controle.examenBlanc.questions }} questions.
              </template>
              <template v-else>
                {{ controle.tailleBlanc }} questions tirées dans tout le programme, à parts égales. Prévu
                l'avant-veille, mais rien n'empêche de le passer avant pour savoir où tu en es.
              </template>
            </p>
            <UButton
              v-if="controle.examenBlanc"
              size="sm"
              variant="subtle"
              :label="controle.examenBlanc.derniere ? 'Revoir' : 'Passer'"
              :to="`/mes-qcm/${controle.examenBlanc.id}`"
            />
            <UButton
              size="sm"
              color="neutral"
              variant="subtle"
              :label="controle.examenBlanc ? 'Nouveau tirage' : 'Composer'"
              :loading="lancement === 'blanc'"
              @click="composerBlanc"
            />
          </div>
        </section>

        <!-- Le programme, section par section. -->
        <section class="mt-10">
          <h2 class="m-0 text-lg font-medium text-highlighted">
            Le programme
          </h2>
          <p class="mt-1 mb-0 text-sm text-muted">
            {{ controle.etat.questions }} questions, dans l'ordre du cours. Une section est sue quand chacune
            de ses questions a été trouvée au moins une fois, et qu'aucune n'a été ratée depuis.
          </p>
          <p
            v-if="!controle.sections.length"
            class="mt-4 text-sm text-muted"
          >
            Le programme ne porte aucune question que le quiz sache poser.
          </p>
          <div
            v-for="ch in chapitres"
            :key="ch.cle"
            class="mt-6"
          >
            <h3 class="m-0 text-sm font-medium text-highlighted">
              {{ ch.titre }}
            </h3>
            <div class="mt-2 flex flex-col gap-1">
              <div
                v-for="s in ch.sections"
                :key="s.cle"
                class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-1.5 hover:bg-elevated/50"
              >
                <UIcon
                  :name="s.sues === s.questions ? 'i-lucide-circle-check' : s.dette ? 'i-lucide-circle-alert' : 'i-lucide-circle'"
                  class="size-4 shrink-0"
                  :class="s.sues === s.questions ? 'text-success' : s.dette ? 'text-error' : 'text-dimmed'"
                />
                <span class="min-w-0 flex-1 text-sm text-highlighted">{{ s.titre }}</span>
                <UProgressGroup
                  class="w-24 shrink-0 sm:w-32"
                  size="xs"
                  :max="s.questions || 1"
                  :items="segmentsControle(s)"
                />
                <span class="w-14 shrink-0 text-right text-xs text-muted tabular-nums">{{ s.sues }} / {{ s.questions }}</span>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-zap"
                  :aria-label="`M'interroger sur ${s.titre}`"
                  :title="s.sues === s.questions ? 'Repasser la section entière' : 'M\'interroger sur ce qui manque'"
                  :loading="lancement === s.cle"
                  @click="interrogerSection(s)"
                />
              </div>
            </div>
          </div>
        </section>

        <!-- Le bilan, une fois le jour venu. -->
        <section
          v-if="controle.joursRestants <= 0"
          class="mt-10"
        >
          <h2 class="m-0 text-lg font-medium text-highlighted">
            Bilan
          </h2>
          <p class="mt-1 mb-0 text-sm text-muted">
            La note obtenue, à côté de ce que le site pensait de ta préparation : prêt à
            {{ partSue(controle.etat) }} % aujourd'hui.
          </p>
          <form
            class="mt-3 flex flex-wrap items-end gap-3"
            @submit.prevent="enregistrerNote"
          >
            <UFormField label="Note">
              <UInputNumber
                v-model="note"
                :min="0"
                :step="0.25"
                placeholder="14"
                class="w-32"
              />
            </UFormField>
            <UFormField label="Sur">
              <UInputNumber
                v-model="bareme"
                :min="1"
                :step="1"
                class="w-28"
              />
            </UFormField>
            <UButton
              type="submit"
              icon="i-lucide-save"
              label="Enregistrer"
              variant="subtle"
            />
            <span
              v-if="noteEnregistree"
              class="text-sm text-success"
            >Enregistrée.</span>
          </form>
        </section>
      </UPageBody>

      <UModal
        v-model:open="edition"
        title="Modifier le contrôle"
        :ui="{ content: 'sm:max-w-2xl' }"
      >
        <template #body>
          <ControleFormulaire
            v-if="catalogue && initial"
            :matieres="catalogue.matieres"
            :initial="initial"
            matiere-fixe
            libelle="Enregistrer"
            :en-cours="enregistrement"
            :erreur="erreurEdition"
            @valider="modifier"
          />
          <USkeleton
            v-else
            class="h-40 w-full"
          />
        </template>
      </UModal>

      <UModal
        v-model:open="confirmation"
        title="Supprimer ce contrôle ?"
        description="Sa feuille de route disparaît. Ce que tu as appris reste dans ta progression, et son examen blanc reste dans « Mes QCM »."
      >
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Annuler"
              @click="confirmation = false"
            />
            <UButton
              color="error"
              icon="i-lucide-trash-2"
              label="Supprimer"
              @click="supprimer"
            />
          </div>
        </template>
      </UModal>
    </template>

    <template v-else-if="error">
      <UPageHeader title="Contrôle introuvable" />
      <UPageBody>
        <p class="text-muted">
          Ce contrôle n'existe pas, ou il appartient à un autre compte.
        </p>
        <UButton
          to="/mes-controles"
          icon="i-lucide-arrow-left"
          label="Mes contrôles"
          variant="subtle"
        />
      </UPageBody>
    </template>

    <UPageBody v-else>
      <div class="flex flex-col gap-3 pt-8">
        <USkeleton class="h-10 w-2/3" />
        <USkeleton class="h-24 w-full" />
        <USkeleton class="h-40 w-full" />
      </div>
    </UPageBody>
  </UPage>
</template>
