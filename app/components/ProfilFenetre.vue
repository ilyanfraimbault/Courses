<script setup lang="ts">
import { PARCOURS, type Parcours } from '~~/shared/types/matieres'

/**
 * « Qui es-tu ? » : prénom, nom et parcours, au premier passage.
 *
 * Tant qu'il manque quelque chose, la fenêtre ne se ferme pas sans réponse :
 * ni croix, ni clic à côté, ni Échap — le parcours décide des matières que le
 * site montre. Ouverte ensuite depuis le badge, elle se ferme comme une autre.
 */
const profil = useProfil()

const ouverte = computed({
  get: () => profil.obligatoire.value || profil.demande.value,
  set: (valeur: boolean) => { if (!profil.obligatoire.value) profil.demande.value = valeur }
})

const prenom = ref('')
const nom = ref('')
const parcours = ref<Parcours | null>(null)
watch(ouverte, (o) => {
  if (!o) return
  prenom.value = profil.prenom.value ?? ''
  nom.value = profil.nom.value ?? ''
  parcours.value = profil.parcours.value
}, { immediate: true })

const enCours = ref(false)
const erreur = ref<string | null>(null)
const pret = computed(() => !!prenom.value.trim() && !!nom.value.trim() && !!parcours.value)

async function valider() {
  if (!pret.value || enCours.value) return
  enCours.value = true
  erreur.value = null
  try {
    await profil.enregistrer({ prenom: prenom.value.trim(), nom: nom.value.trim(), parcours: parcours.value! })
  } catch (e) {
    erreur.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Ton profil n\'a pas pu être enregistré. Réessaie.'
  } finally {
    enCours.value = false
  }
}

const options: { valeur: Parcours, icone: string, detail: string }[] = [
  { valeur: 'dl', icone: 'i-lucide-code-xml', detail: 'Génie logiciel, développement, architecture' },
  { valeur: 'sr', icone: 'i-lucide-network', detail: 'Systèmes, réseaux, infrastructure' }
]
</script>

<template>
  <ClientOnly>
    <UModal
      v-model:open="ouverte"
      :dismissible="!profil.obligatoire.value"
      :close="!profil.obligatoire.value"
      :title="profil.obligatoire.value ? 'Bienvenue !' : 'Mon profil'"
      :description="profil.obligatoire.value
        ? 'Deux choses avant de commencer : qui tu es, et ton parcours — il décide des matières et des contrôles que le site te montre.'
        : 'Ton parcours décide des matières et des contrôles que le site te montre.'"
    >
      <template #body>
        <form
          class="flex flex-col gap-5"
          @submit.prevent="valider"
        >
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField
              label="Prénom"
              required
            >
              <UInput
                v-model="prenom"
                autocomplete="given-name"
                maxlength="60"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Nom"
              required
            >
              <UInput
                v-model="nom"
                autocomplete="family-name"
                maxlength="60"
                class="w-full"
              />
            </UFormField>
          </div>

          <div
            role="radiogroup"
            aria-label="Parcours"
          >
            <p class="m-0 mb-2 text-sm font-medium text-default">
              Parcours <span class="text-error">*</span>
            </p>
            <div class="grid gap-3 sm:grid-cols-2">
              <button
                v-for="o in options"
                :key="o.valeur"
                type="button"
                role="radio"
                :aria-checked="parcours === o.valeur"
                class="flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors hover:border-primary/60"
                :class="parcours === o.valeur ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-default'"
                @click="parcours = o.valeur"
              >
                <span class="flex items-center gap-2">
                  <UIcon
                    :name="o.icone"
                    class="size-5 text-primary"
                  />
                  <span class="font-semibold text-highlighted">{{ PARCOURS[o.valeur].court }}</span>
                </span>
                <span class="text-sm font-medium text-default">{{ PARCOURS[o.valeur].long }}</span>
                <span class="text-xs text-muted">{{ o.detail }}</span>
              </button>
            </div>
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
              :label="profil.obligatoire.value ? 'C\'est parti' : 'Enregistrer'"
              :loading="enCours"
              :disabled="!pret"
            />
          </div>
        </form>
      </template>
    </UModal>
  </ClientOnly>
</template>
