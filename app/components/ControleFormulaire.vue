<script setup lang="ts">
import { parseDate, type CalendarDate } from '@internationalized/date'
import type { ValeursControle } from '~~/shared/types/controles'
import { PARCOURS, type MatiereSite, type Parcours } from '~~/shared/types/matieres'

/**
 * Planifier un contrôle, dans l'ordre où l'élève y pense : la matière, le
 * jour, pour qui — et, s'il le sait, sur quoi.
 *
 * « Sur quoi » est une question à trois réponses avant d'être une liste à
 * cocher : on ne le sait souvent pas encore, et quand on le sait, c'est
 * souvent « tout ». La liste des chapitres n'apparaît que si l'on dit « des
 * chapitres précis ». L'intitulé est facultatif : « Contrôle — Ethical
 * hacking » suffit le plus souvent.
 */
const props = defineProps<{
  initial: ValeursControle
  libelle: string
  enCours?: boolean
  erreur?: string | null
}>()

const emit = defineEmits<{ valider: [valeurs: ValeursControle] }>()

const { data: matieresLues, refresh: relireMatieres } = useLazyFetch<MatiereSite[]>('/api/matieres', { server: false, default: () => [] })

const titre = ref(props.initial.titre)
const jour = ref(props.initial.jour)
const codeMatiere = ref<string | undefined>(props.initial.matiere || undefined)
const concerne = ref<Parcours | 'tous'>(props.initial.parcours ?? 'tous')
const precisions = ref(props.initial.precisions ?? '')

const matiere = computed(() => matieresLues.value.find(m => m.code === codeMatiere.value) ?? null)

/**
 * Sur quoi il porte. « Toute la matière » s'écrit du chemin du cours ; « on ne
 * sait pas » d'un programme vide ; le reste, de chapitres, fiches, exercices.
 */
type Etendue = 'inconnue' | 'tout' | 'precise'
const programme = ref<string[]>([...props.initial.programme])
const etendue = ref<Etendue>('inconnue')
watch(matiere, (m) => {
  // Lu une fois la liste des matières arrivée : c'est elle qui dit le chemin du cours.
  if (!m || etendue.value !== 'inconnue' || !programme.value.length) return
  etendue.value = programme.value.length === 1 && programme.value[0] === m.cours ? 'tout' : 'precise'
}, { immediate: true })

/** Changer de matière vide le programme : les chapitres d'un autre cours n'y ont pas de sens. */
watch(codeMatiere, (nouveau, ancien) => {
  if (ancien && nouveau !== ancien) {
    programme.value = []
    etendue.value = 'inconnue'
  }
})

const choixEtendue = [
  { label: 'Pas encore connu', value: 'inconnue', icon: 'i-lucide-circle-help' },
  { label: 'Toute la matière', value: 'tout', icon: 'i-lucide-book-open' },
  { label: 'Des chapitres précis', value: 'precise', icon: 'i-lucide-list-checks' }
]

/**
 * Une `CalendarDate` n'a ni heure ni fuseau : c'est exactement la date de
 * calendrier que le serveur attend, « AAAA-MM-JJ », sans conversion qui la
 * ferait glisser d'un jour.
 */
const date = computed<CalendarDate | undefined>({
  get: () => {
    try {
      return jour.value ? parseDate(jour.value) : undefined
    } catch {
      return undefined
    }
  },
  set: (valeur) => {
    jour.value = valeur ? valeur.toString() : ''
  }
})
const calendrier = useTemplateRef('calendrier')

/** Les matières par semestre, le hors programme à la fin. */
const choixMatieres = computed(() => {
  const groupes = new Map<string, { label: string, value: string, description?: string }[]>()
  for (const m of matieresLues.value) {
    const groupe = m.semestre ? `Semestre ${m.semestre}` : 'Hors programme'
    groupes.set(groupe, [...(groupes.get(groupe) ?? []), {
      label: m.intitule,
      value: m.code,
      description: [m.ue, m.parcours ? PARCOURS[m.parcours].court : null, m.cours ? 'cours sur le site' : null].filter(Boolean).join(' · ') || undefined
    }])
  }
  return [...groupes.values()]
})

/** Une matière d'un parcours ne concerne que lui. */
const parcoursImpose = computed(() => matiere.value?.parcours ?? null)
watch(parcoursImpose, (p) => {
  if (p) concerne.value = p
}, { immediate: true })

const choixConcerne = [
  { label: 'Toute la classe', value: 'tous' },
  { label: PARCOURS.dl.court, value: 'dl' },
  { label: PARCOURS.sr.court, value: 'sr' }
]

const ajout = ref(false)
const erreurAjout = ref<string | null>(null)
async function ajouterMatiere(intitule: string) {
  ajout.value = true
  erreurAjout.value = null
  try {
    const creee = await $fetch<MatiereSite>('/api/matieres', { method: 'POST', body: { intitule } })
    await relireMatieres()
    codeMatiere.value = creee.code
  } catch (e) {
    erreurAjout.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage || 'La matière n\'a pas pu être ajoutée.'
  } finally {
    ajout.value = false
  }
}

const { arbre } = useProgrammeCours(() => matiere.value?.cours ?? null)

const pret = computed(() => !!jour.value && !!matiere.value)

function programmeEnvoye(): string[] {
  const m = matiere.value
  if (!m?.cours) return []
  if (etendue.value === 'tout') return [m.cours]
  if (etendue.value === 'precise') return programme.value
  return []
}

function valider() {
  if (!pret.value || props.enCours) return
  emit('valider', {
    titre: titre.value.trim(),
    matiere: matiere.value!.code,
    jour: jour.value,
    parcours: concerne.value === 'tous' ? null : concerne.value,
    programme: programmeEnvoye(),
    precisions: precisions.value.trim() || null
  })
}
</script>

<template>
  <form
    class="flex flex-col gap-5"
    @submit.prevent="valider"
  >
    <UFormField
      label="Matière"
      required
      :error="erreurAjout ?? undefined"
    >
      <USelectMenu
        v-model="codeMatiere"
        :items="choixMatieres"
        value-key="value"
        placeholder="Choisir une matière"
        :search-input="{ placeholder: 'Chercher, ou taper une nouvelle matière…' }"
        create-item
        :loading="ajout"
        class="w-full"
        @create="ajouterMatiere"
      >
        <template #create-item-label="{ item }">
          Ajouter « {{ item }} »
        </template>
      </USelectMenu>
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Date"
        required
      >
        <UInputDate
          ref="calendrier"
          v-model="date"
          locale="fr-FR"
          class="w-full"
        >
          <template #trailing>
            <UPopover :reference="calendrier?.inputsRef[3]?.$el">
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                icon="i-lucide-calendar"
                aria-label="Choisir la date dans un calendrier"
                class="px-0"
              />
              <template #content>
                <UCalendar
                  v-model="date"
                  locale="fr-FR"
                  :week-starts-on="1"
                  class="p-2"
                />
              </template>
            </UPopover>
          </template>
        </UInputDate>
      </UFormField>
      <UFormField
        label="Pour qui ?"
        :help="parcoursImpose ? `Matière du parcours ${PARCOURS[parcoursImpose].court} seulement.` : undefined"
      >
        <UTabs
          v-model="concerne"
          :items="choixConcerne"
          :content="false"
          size="sm"
          class="w-full"
          :disabled="!!parcoursImpose"
        />
      </UFormField>
    </div>

    <!-- Pas de UFormField autour : il prend pour sien l'identifiant d'une case
         de la liste, et son libellé deviendrait celui de cette case. -->
    <div
      v-if="matiere?.cours"
      role="group"
      aria-labelledby="etendue-titre"
      class="flex flex-col gap-2"
    >
      <p
        id="etendue-titre"
        class="m-0 text-sm font-medium text-default"
      >
        Sur quoi porte-t-il ?
      </p>
      <UTabs
        v-model="etendue"
        :items="choixEtendue"
        :content="false"
        size="sm"
        class="w-full"
      />
      <template v-if="etendue === 'precise'">
        <ProgrammeArbre
          v-if="arbre.length"
          v-model="programme"
          :noeuds="arbre"
        />
        <div
          v-else
          class="flex flex-col gap-2"
        >
          <USkeleton class="h-8 w-full" />
          <USkeleton class="h-8 w-full" />
        </div>
      </template>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Intitulé"
        hint="Facultatif"
      >
        <UInput
          v-model="titre"
          :placeholder="matiere ? `Contrôle — ${matiere.intitule}` : 'Partiel, TP noté…'"
          maxlength="120"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Infos utiles"
        hint="Facultatif"
      >
        <UInput
          v-model="precisions"
          placeholder="Documents autorisés, salle, durée…"
          maxlength="2000"
          class="w-full"
        />
      </UFormField>
    </div>

    <UAlert
      v-if="erreur"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="erreur"
    />

    <div class="flex justify-end">
      <UButton
        type="submit"
        icon="i-lucide-calendar-plus"
        :label="libelle"
        :loading="enCours"
        :disabled="!pret"
      />
    </div>
  </form>
</template>
