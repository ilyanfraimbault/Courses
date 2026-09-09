import type { MaybeRefOrGetter, Ref } from 'vue'
import type { QcmTentative } from '~~/shared/types/resultats'

export type { QcmTentative }

/** Au-delà, les plus anciennes tentatives partent : la progression récente suffit. */
const MAX_TENTATIVES = 24

/**
 * Découpe « /chemin/de/la/fiche#slug-du-bloc » en ses deux moitiés. Le slug ne
 * contient que [a-z0-9-], donc le premier « # » est bien la césure.
 */
function decouper(identifiant: string): { chemin: string, bloc: string } | null {
  const i = identifiant.indexOf('#')
  if (i <= 0 || i === identifiant.length - 1) return null
  return { chemin: identifiant.slice(0, i), bloc: identifiant.slice(i + 1) }
}

/**
 * Mémorise les passages successifs sur un même QCM.
 *
 * L'identifiant peut être `null` — un QCM sans titre n'a pas de clé stable
 * d'une visite à l'autre —, auquel cas la mémoire est simplement inactive.
 *
 * La lecture ne fait pas de requête à elle : elle puise dans les données que la
 * page a chargées d'un bloc. Une fiche de cours peut porter onze QCM, et onze
 * requêtes au montage pour onze frises seraient onze de trop.
 */
export function useQcmHistorique(identifiant: MaybeRefOrGetter<string | null>) {
  const tentatives = ref<QcmTentative[]>([]) as Ref<QcmTentative[]>
  const source = useDonneesFiche()

  watch(() => source?.donnees.value, (donnees) => {
    const id = toValue(identifiant)
    const cible = id ? decouper(id) : null
    tentatives.value = (donnees && cible ? donnees.qcm[cible.bloc] : null) ?? []
  }, { immediate: true })

  async function ajouter(tentative: QcmTentative) {
    const id = toValue(identifiant)
    const cible = id ? decouper(id) : null
    if (!cible) return

    // Affichage optimiste : la frise se met à jour tout de suite, l'envoi suit.
    // Le plafond est réappliqué côté serveur, qui reste seul maître de la règle.
    tentatives.value = [...tentatives.value, tentative].slice(-MAX_TENTATIVES)

    try {
      await $fetch('/api/qcm/tentative', {
        method: 'POST',
        body: { chemin: cible.chemin, bloc: cible.bloc, ...tentative }
      })
    } catch {
      // Hors session ou hors ligne : la comparaison reste juste pour la session
      // en cours, elle ne survivra simplement pas au rechargement.
    }
  }

  async function effacer() {
    const id = toValue(identifiant)
    const cible = id ? decouper(id) : null
    tentatives.value = []
    if (!cible) return
    try {
      await $fetch('/api/qcm/tentative', {
        method: 'DELETE',
        query: { chemin: cible.chemin, bloc: cible.bloc }
      })
    } catch {
      // L'effacement en mémoire suffit pour la session en cours.
    }
  }

  return { tentatives, ajouter, effacer }
}
