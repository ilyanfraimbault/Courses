<script setup lang="ts">
import type { CopieQcmCompose, CorrectionQcmCompose, QcmCompose } from '~~/shared/types/mes-qcm'

definePageMeta({ layout: 'cours' })

const route = useRoute()
const id = computed(() => Number(route.params.id))

/**
 * Le QCM est une donnée du compte : lu au montage, jamais au rendu serveur. Une
 * seule requête rend questions et copies — la page n'a rien d'autre à demander.
 */
const { data: qcm, error } = await useLazyFetch<QcmCompose>(() => `/api/mes-qcm/${id.value}`, { server: false })

const reponses = ref<Record<string, string | null>>({})
const correction = ref<CorrectionQcmCompose | null>(null)
const envoi = ref(false)
const erreur = ref<string | null>(null)

const questions = computed(() => qcm.value?.questions ?? [])
const total = computed(() => questions.value.length)
const repondues = computed(() => questions.value.filter(q => reponses.value[q.id]).length)
const copies = computed(() => qcm.value?.copies ?? [])

/**
 * Le point de comparaison : la dernière copie **avant** celle qu'on vient de
 * rendre. Sans cette borne, la copie corrigée deviendrait sa propre référence et
 * toute progression disparaîtrait au moment même de l'afficher.
 */
const precedente = computed<CopieQcmCompose | null>(() => {
  const liste = copies.value
  const rendue = correction.value?.copie.t
  if (rendue === undefined) return liste.at(-1) ?? null
  return [...liste].reverse().find(c => c.t < rendue) ?? null
})

const justes = computed(() => correction.value?.copie.justes ?? 0)
const pourcentage = computed(() => (total.value ? Math.round(100 * justes.value / total.value) : 0))
const ecart = computed(() => (correction.value && precedente.value ? justes.value - precedente.value.justes : null))

const couleur = computed(() => {
  if (pourcentage.value >= 80) return 'success'
  if (pourcentage.value >= 50) return 'warning'
  return 'error'
})

const verdict = computed(() => {
  if (pourcentage.value >= 90) return 'C\'est acquis.'
  if (pourcentage.value >= 70) return 'Presque : reprends les questions ratées, elles suffisent.'
  if (pourcentage.value >= 50) return 'La moitié tient. Relis le cours des questions ratées avant de refaire ce QCM.'
  return 'Reprends le cours avant de refaire le QCM : les erreurs sont trop nombreuses pour être des étourderies.'
})

const ratees = computed(() => {
  const c = correction.value
  return c ? questions.value.filter(q => !c.corrections[q.id]?.juste) : []
})

function choisir(questionId: string, lettre: string | null) {
  if (correction.value) return
  reponses.value = { ...reponses.value, [questionId]: lettre }
}

async function corriger() {
  if (envoi.value || !qcm.value) return
  envoi.value = true
  erreur.value = null
  try {
    const rendue = await $fetch<CorrectionQcmCompose>(`/api/mes-qcm/${id.value}/copie`, {
      method: 'POST',
      // L'horodatage part avec la copie : un double clic renvoie le même, et le
      // serveur ne l'enregistre qu'une fois.
      body: { reponses: reponses.value, t: Date.now() }
    })
    correction.value = rendue
    if (!qcm.value.copies.some(c => c.t === rendue.copie.t)) {
      qcm.value = { ...qcm.value, copies: [...qcm.value.copies, rendue.copie].slice(-24) }
    }
    await nextTick()
    document.getElementById('qcm-resultat')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch (e) {
    const message = (e as { data?: { statusMessage?: string } })?.data?.statusMessage
    erreur.value = message || 'La copie n\'a pas pu être corrigée.'
  } finally {
    envoi.value = false
  }
}

function recommencer() {
  correction.value = null
  reponses.value = {}
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function allerA(position: number) {
  document.getElementById(`question-${position + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/* Renommer et supprimer. */

const edition = ref(false)
const nouveauTitre = ref('')
const suppression = ref(false)
const action = ref(false)

function editer() {
  nouveauTitre.value = qcm.value?.titre ?? ''
  edition.value = true
}

async function renommer() {
  if (!qcm.value || !nouveauTitre.value.trim() || action.value) return
  action.value = true
  try {
    const { titre } = await $fetch<{ titre: string }>(`/api/mes-qcm/${id.value}`, {
      method: 'PATCH',
      body: { titre: nouveauTitre.value }
    })
    qcm.value = { ...qcm.value, titre }
    edition.value = false
  } catch {
    erreur.value = 'Le QCM n\'a pas pu être renommé.'
  } finally {
    action.value = false
  }
}

async function supprimer() {
  if (action.value) return
  action.value = true
  try {
    await $fetch(`/api/mes-qcm/${id.value}`, { method: 'DELETE' })
    await navigateTo('/mes-qcm')
  } catch {
    erreur.value = 'Le QCM n\'a pas pu être supprimé.'
    suppression.value = false
  } finally {
    action.value = false
  }
}

function noteCourte(c: { justes: number, total: number }) {
  return `${c.justes}/${c.total}`
}

function tonNote(c: { justes: number, total: number }) {
  const p = c.total ? 100 * c.justes / c.total : 0
  if (p >= 80) return 'success'
  if (p >= 50) return 'warning'
  return 'error'
}

function dateCourte(t: number) {
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

useSeoMeta({ title: () => qcm.value?.titre ?? 'QCM composé' })
</script>

<template>
  <UPage>
    <template v-if="qcm">
      <UPageHeader
        :title="qcm.titre"
        :description="`${total} question${total > 1 ? 's' : ''} empruntée${total > 1 ? 's' : ''} aux fiches de ${qcm.matiereTitre ?? 'la matière'}. On répond à tout, puis on corrige : l'indice, la solution et le rappel de cours s'ouvrent sous chaque question une fois la copie rendue.`"
      >
        <template #headline>
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              color="warning"
              variant="subtle"
              size="md"
              icon="i-lucide-list-plus"
              label="QCM composé"
            />
            <span class="text-sm text-muted">
              <template v-if="qcm.annee">{{ qcm.annee }} · </template>{{ qcm.matiereTitre }}
            </span>
          </div>
        </template>
        <template #links>
          <UButton
            to="/mes-qcm"
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            label="Mes QCM"
          />
          <UButton
            color="neutral"
            variant="subtle"
            icon="i-lucide-pencil"
            label="Renommer"
            @click="editer"
          />
          <UButton
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            label="Supprimer"
            @click="suppression = true"
          />
        </template>
      </UPageHeader>

      <UPageBody>
        <form
          v-if="edition"
          class="flex flex-wrap items-center gap-2"
          @submit.prevent="renommer"
        >
          <UInput
            v-model="nouveauTitre"
            class="min-w-0 flex-1"
            :maxlength="120"
            autofocus
            aria-label="Nouveau titre"
          />
          <UButton
            type="submit"
            label="Enregistrer"
            :loading="action"
            :disabled="!nouveauTitre.trim()"
          />
          <UButton
            color="neutral"
            variant="ghost"
            label="Annuler"
            @click="edition = false"
          />
        </form>

        <UAlert
          v-if="qcm.manquantes"
          class="mt-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="`${qcm.manquantes} question${qcm.manquantes > 1 ? 's ont' : ' a'} disparu du contenu depuis la composition de ce QCM : ${qcm.manquantes > 1 ? 'elles ne sont' : 'elle n\'est'} plus posée${qcm.manquantes > 1 ? 's' : ''}.`"
        />

        <div
          v-if="copies.length && !correction"
          class="mt-4"
        >
          <p class="mt-0 mb-2 text-sm text-muted">
            Déjà passé {{ copies.length }} fois, dernier score
            <strong class="text-highlighted tabular-nums">{{ noteCourte(copies[copies.length - 1]!) }}</strong>.
          </p>
          <div class="flex flex-wrap items-center gap-1.5">
            <UBadge
              v-for="(copie, i) in copies"
              :key="copie.t"
              :color="tonNote(copie)"
              variant="subtle"
              size="sm"
              class="tabular-nums"
              :title="`Passage ${i + 1} — ${dateCourte(copie.t)}`"
              :label="noteCourte(copie)"
            />
          </div>
        </div>

        <div class="cours-body mt-2">
          <QcmComposeQuestion
            v-for="question in questions"
            :key="question.id"
            :question="question"
            :choisi="correction ? correction.corrections[question.id]?.donnee ?? null : reponses[question.id] ?? null"
            :correction="correction?.corrections[question.id] ?? null"
            :ratee-avant="!!precedente?.ratees.includes(question.id)"
            @choisir="choisir(question.id, $event)"
          />
        </div>

        <div
          id="qcm-resultat"
          class="mt-8 scroll-mt-24 rounded-lg border border-default bg-elevated/40 px-4 py-4"
        >
          <template v-if="!correction">
            <p class="cours-panel-title text-highlighted!">
              <UIcon
                name="i-lucide-send"
                class="size-4 shrink-0 text-primary"
              />
              <span>Rendre la copie</span>
            </p>
            <p class="mt-1 mb-3 text-sm text-muted">
              {{ repondues }} réponse{{ repondues > 1 ? 's' : '' }} sur {{ total }}.
              <template v-if="repondues < total">
                Les questions sans réponse compteront comme fausses.
              </template>
              <template v-else>
                Tout est rempli.
              </template>
            </p>
            <UAlert
              v-if="erreur"
              class="mb-3"
              color="error"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :description="erreur"
            />
            <UButton
              color="primary"
              icon="i-lucide-check-check"
              :loading="envoi"
              :disabled="repondues === 0"
              :label="`Corriger mes ${repondues} réponse${repondues > 1 ? 's' : ''}`"
              @click="corriger"
            />
          </template>

          <template v-else>
            <p class="cours-panel-title text-highlighted!">
              <UIcon
                name="i-lucide-award"
                class="size-4 shrink-0 text-primary"
              />
              <span>Résultat</span>
            </p>

            <p class="mt-2 mb-0 text-2xl font-semibold text-highlighted tabular-nums">
              {{ justes }} / {{ total }}
              <UBadge
                :color="couleur"
                variant="subtle"
                size="lg"
                class="ml-2 align-middle"
                :label="`${pourcentage} %`"
              />
              <UBadge
                v-if="ecart !== null"
                :color="ecart > 0 ? 'success' : ecart < 0 ? 'error' : 'neutral'"
                variant="soft"
                size="lg"
                class="ml-2 align-middle"
                :icon="ecart > 0 ? 'i-lucide-trending-up' : ecart < 0 ? 'i-lucide-trending-down' : 'i-lucide-minus'"
                :label="ecart > 0 ? `+${ecart} depuis la dernière fois` : ecart < 0 ? `${ecart} depuis la dernière fois` : 'même score que la dernière fois'"
              />
            </p>
            <p class="mt-2 mb-0 text-sm text-muted">
              {{ verdict }} Les questions justes sont cochées sur leurs fiches ; les ratées rejoignent
              « ce que j'ai raté » du quiz.
            </p>

            <template v-if="ratees.length">
              <p class="mt-4 mb-2 text-sm font-medium text-highlighted">
                À revoir — chaque question ratée porte maintenant son indice, sa solution et son rappel de cours :
              </p>
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-for="question in ratees"
                  :key="question.id"
                  size="xs"
                  color="error"
                  :variant="precedente?.ratees.includes(question.id) ? 'solid' : 'soft'"
                  :title="precedente?.ratees.includes(question.id) ? 'Déjà ratée au passage précédent' : undefined"
                  :label="`${question.position + 1}.`"
                  @click="allerA(question.position)"
                />
              </div>
            </template>
            <p
              v-else
              class="mt-4 mb-0 text-sm text-muted"
            >
              Sans faute.
            </p>

            <template v-if="copies.length > 1">
              <p class="mt-4 mb-2 text-sm font-medium text-highlighted">
                Tes passages, du plus ancien au plus récent :
              </p>
              <div class="flex flex-wrap items-center gap-1.5">
                <UBadge
                  v-for="(copie, i) in copies"
                  :key="copie.t"
                  :color="tonNote(copie)"
                  :variant="i === copies.length - 1 ? 'solid' : 'subtle'"
                  size="sm"
                  class="tabular-nums"
                  :title="`Passage ${i + 1} — ${dateCourte(copie.t)}`"
                  :label="noteCourte(copie)"
                />
              </div>
            </template>

            <div class="mt-4 flex flex-wrap items-center gap-2">
              <UButton
                color="neutral"
                variant="subtle"
                icon="i-lucide-rotate-ccw"
                label="Recommencer"
                @click="recommencer"
              />
            </div>
          </template>
        </div>
      </UPageBody>
    </template>

    <template v-else-if="error">
      <UPageHeader
        title="QCM introuvable"
        description="Ce QCM n'existe pas, ou il appartient à un autre compte."
      />
      <UPageBody>
        <UButton
          to="/mes-qcm"
          icon="i-lucide-arrow-left"
          label="Retour à mes QCM"
          color="neutral"
          variant="subtle"
        />
      </UPageBody>
    </template>

    <UPageBody v-else>
      <div class="flex flex-col gap-3">
        <USkeleton class="h-8 w-2/3" />
        <USkeleton class="h-4 w-full" />
        <USkeleton class="h-40 w-full" />
      </div>
    </UPageBody>

    <UModal
      v-model:open="suppression"
      title="Supprimer ce QCM ?"
      description="Le QCM et l'historique de ses copies disparaissent. Ce qu'il t'a fait gagner reste : les questions trouvées sont cochées sur leurs fiches, et les fautes restent dans « ce que j'ai raté »."
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Annuler"
            @click="suppression = false"
          />
          <UButton
            color="error"
            icon="i-lucide-trash-2"
            label="Supprimer"
            :loading="action"
            @click="supprimer"
          />
        </div>
      </template>
    </UModal>
  </UPage>
</template>
