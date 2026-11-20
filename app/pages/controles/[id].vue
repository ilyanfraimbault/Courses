<script setup lang="ts">
import type { Controle } from '~~/shared/types/controles'
import { PARCOURS } from '~~/shared/types/matieres'

definePageMeta({ layout: 'cours' })

/**
 * Un contrôle : sa date, sa matière, à qui il s'adresse, et son programme
 * quand on le connaît — chaque morceau mène à sa page du cours. Son auteur peut
 * le modifier ou le retirer.
 */
const route = useRoute()
const { data: controle, error, refresh } = await useLazyFetch<Controle>(() => `/api/controles/${route.params.id}`, {
  server: false,
  query: { fuseau: fuseauLocal() }
})

const { titres } = useProgrammeCours(() => controle.value?.cours ?? null)

/** « /fiche#bloc » mène à la fiche : l'ancre d'un bloc n'est pas celle de son titre. */
function lien(cle: string) {
  return cle.split('#')[0]
}

const modifier = ref(false)
const retrait = ref(false)
const erreurRetrait = ref<string | null>(null)
/** Retirer efface le contrôle pour toute la classe : on le fait confirmer d'un second clic. */
const confirmer = ref(false)

async function retirer() {
  if (!controle.value) return
  if (!confirmer.value) {
    confirmer.value = true
    return
  }
  retrait.value = true
  erreurRetrait.value = null
  try {
    await $fetch(`/api/controles/${controle.value.id}`, { method: 'DELETE' })
    await navigateTo('/controles')
  } catch (e) {
    erreurRetrait.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Le contrôle n\'a pas pu être retiré.'
    retrait.value = false
  }
}

useSeoMeta({ title: () => controle.value?.titre ?? 'Contrôle' })
</script>

<template>
  <UPage>
    <template v-if="controle">
      <UPageHeader
        :title="controle.titre"
        :description="`${controle.matiereTitre ?? controle.matiere} · ${jourLong(controle.jour)} · ${echeance(controle.joursRestants)}`"
      >
        <template #links>
          <template v-if="controle.modifiable">
            <UButton
              icon="i-lucide-pencil"
              label="Modifier"
              color="neutral"
              variant="subtle"
              @click="modifier = true"
            />
            <UButton
              icon="i-lucide-trash-2"
              :label="confirmer ? 'Retirer pour toute la classe ?' : 'Retirer'"
              color="error"
              :variant="confirmer ? 'solid' : 'ghost'"
              :loading="retrait"
              @click="retirer"
            />
          </template>
        </template>
      </UPageHeader>

      <UPageBody>
        <UAlert
          v-if="erreurRetrait"
          class="mb-4"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="erreurRetrait"
        />

        <dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt class="text-muted">
            Concerne
          </dt>
          <dd class="m-0">
            {{ controle.parcours ? `Parcours ${PARCOURS[controle.parcours].court} — ${PARCOURS[controle.parcours].long}` : 'Toute la classe' }}
          </dd>
          <template v-if="controle.auteur">
            <dt class="text-muted">
              Planifié par
            </dt>
            <dd class="m-0">
              {{ controle.auteur }}
            </dd>
          </template>
          <template v-if="controle.precisions">
            <dt class="text-muted">
              Précisions
            </dt>
            <dd class="m-0 whitespace-pre-line">
              {{ controle.precisions }}
            </dd>
          </template>
        </dl>

        <h2 class="mt-8 mb-3 text-base font-medium text-highlighted">
          Programme
        </h2>
        <ul
          v-if="controle.programme.length"
          class="m-0 flex list-none flex-col gap-1.5 p-0"
        >
          <li
            v-for="cle in controle.programme"
            :key="cle"
          >
            <ULink
              :to="lien(cle)"
              class="text-sm text-default hover:text-primary"
            >
              {{ titres.get(cle) ?? cle }}
            </ULink>
          </li>
        </ul>
        <p
          v-else
          class="text-sm text-muted"
        >
          Pas encore connu.
          <ULink
            v-if="controle.cours"
            :to="controle.cours"
            class="text-primary"
          >Voir le cours</ULink>
        </p>

        <ControlePlanifier
          v-model:open="modifier"
          :controle="controle"
          @enregistre="refresh()"
        />
      </UPageBody>
    </template>

    <UPageBody v-else-if="error">
      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-calendar-x"
        title="Ce contrôle n'existe pas, ou ne te concerne pas."
      />
    </UPageBody>

    <UPageBody v-else>
      <USkeleton class="h-10 w-1/2" />
    </UPageBody>
  </UPage>
</template>
