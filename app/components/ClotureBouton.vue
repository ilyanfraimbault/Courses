<script setup lang="ts">
import type { NatureCloture } from '~~/shared/types/clotures'

/**
 * Clore ce qu'on a fini, ou le rouvrir.
 *
 * Deux formes, parce qu'un état et une action ne se montrent pas pareil : le
 * **bandeau** dit qu'une page est close — la sienne ou celle d'un parent — et
 * propose de la rouvrir ; le **bouton** propose de la clore. La page pose l'un
 * en tête, l'autre parmi ses actions discrètes.
 */
const props = defineProps<{
  chemin: string
  nature: NatureCloture
  forme: 'bandeau' | 'bouton'
}>()

const { disponible, closPar, clore, rouvrir } = useClotures()
const toast = useToast()
const enCours = ref(false)

const cloture = computed(() => closPar(props.chemin))
const parUnParent = computed(() => !!cloture.value && cloture.value.chemin !== cheminCanonique(props.chemin))

const noms: Record<NatureCloture, { ce: string, clos: string, accord: string }> = {
  matiere: { ce: 'cette matière', clos: 'Matière close', accord: 'close' },
  chapitre: { ce: 'ce chapitre', clos: 'Chapitre clos', accord: 'clos' },
  fiche: { ce: 'cette fiche', clos: 'Fiche close', accord: 'close' }
}

async function agir(action: () => Promise<void>, erreur: string) {
  if (enCours.value) return
  enCours.value = true
  try {
    await action()
  } catch {
    toast.add({ title: erreur, color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    enCours.value = false
  }
}
</script>

<template>
  <UAlert
    v-if="forme === 'bandeau' && cloture"
    color="neutral"
    variant="subtle"
    icon="i-lucide-archive"
    :title="parUnParent ? `« ${cloture.titre} » est ${noms[cloture.nature].accord}` : noms[nature].clos"
    description="Hors de ta progression, des révisions et des séances sur toute la matière. Coché à la main dans le quiz, il reste disponible."
  >
    <template #actions>
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        icon="i-lucide-archive-restore"
        :label="parUnParent ? `Rouvrir « ${cloture.titre} »` : 'Rouvrir'"
        :loading="enCours"
        @click="agir(() => rouvrir(cloture!.chemin), 'La réouverture n\'a pas abouti.')"
      />
    </template>
  </UAlert>
  <UButton
    v-else-if="forme === 'bouton' && disponible && !cloture"
    size="xs"
    color="neutral"
    variant="ghost"
    icon="i-lucide-archive"
    :label="`Clore ${noms[nature].ce}`"
    :loading="enCours"
    @click="agir(() => clore(chemin), 'La clôture n\'a pas abouti.')"
  />
</template>
