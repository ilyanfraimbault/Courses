import type { InjectionKey, MaybeRefOrGetter, Ref } from 'vue'
import type { DonneesFiche } from '~~/shared/types/resultats'

export interface DonneesFicheApi {
  /**
   * Vrai **uniquement** si la lecture serveur a abouti. C'est la pièce
   * maîtresse du garde-fou contre l'effacement : hors session, hors ligne ou
   * sur une erreur, il reste faux, et rien n'est jamais réécrit par-dessus ce
   * qu'on n'a pas pu lire.
   */
  chargee: Readonly<Ref<boolean>>
  donnees: Readonly<Ref<DonneesFiche | null>>
}

export const donneesFicheKey: InjectionKey<DonneesFicheApi> = Symbol('donnees-fiche')

/**
 * Charge en **une seule requête** tout ce qu'une fiche a besoin de savoir : sa
 * progression et l'historique de chacun de ses blocs de QCM.
 *
 * On ne lit qu'au montage, jamais au rendu serveur — exactement le contrat que
 * respectait le stockage local. Ce n'est pas une contrainte technique, c'est un
 * choix : le HTML d'une fiche reste ainsi identique pour tout le monde, donc
 * cacheable et prérendable, et l'hydratation ne peut pas diverger. La barre de
 * progression apparaissait déjà après hydratation, on ne perd rien.
 */
export function provideDonneesFiche(chemin: MaybeRefOrGetter<string>) {
  const donnees = ref<DonneesFiche | null>(null) as Ref<DonneesFiche | null>
  const chargee = ref(false)

  onMounted(async () => {
    try {
      donnees.value = await $fetch<DonneesFiche>('/api/fiche', {
        query: { chemin: cheminCanonique(toValue(chemin)) }
      })
      chargee.value = true
    } catch {
      // 401 hors session, réseau coupé, serveur en vrac : la fiche fonctionne
      // en mémoire pour la session en cours, elle n'enregistre simplement pas.
      chargee.value = false
    }
  })

  const api: DonneesFicheApi = { chargee: readonly(chargee), donnees: readonly(donnees) as Readonly<Ref<DonneesFiche | null>> }
  provide(donneesFicheKey, api)
  return api
}

/** Renvoie null hors d'une page de fiche. */
export function useDonneesFiche(): DonneesFicheApi | null {
  return inject(donneesFicheKey, null)
}
