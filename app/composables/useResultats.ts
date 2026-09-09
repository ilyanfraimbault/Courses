import type { Ref } from 'vue'
import type { ResultatsExport } from '~~/shared/types/resultats'

/** Métadonnées d'une fiche, telles que la collection les connaît. */
export type Repertoire = Record<string, { titre?: string, type?: string }>

/**
 * Intitulé et nature de chaque fiche, pour que l'export se lise sans avoir le
 * dépôt sous les yeux. Le serveur ne connaît pas ces intitulés — le contenu est
 * versionné, pas en base — donc c'est le client qui les joint.
 *
 * Clé fixe : plusieurs blocs d'export sur une même page se partagent la requête.
 */
export function useRepertoireFiches() {
  const { data } = useAsyncData('cours-repertoire', async () => {
    const lignes = await queryCollection('cours').select('path', 'title', 'type').all()
    return Object.fromEntries(
      lignes.map(l => [cheminCanonique(l.path), { titre: l.title, type: l.type }])
    ) as Repertoire
  }, { default: () => ({} as Repertoire) })

  return data
}

/** Recopie les intitulés du répertoire sur l'export venu du serveur. */
export function enrichirResultats(brut: ResultatsExport | null, repertoire: Repertoire): ResultatsExport | null {
  if (!brut) return null
  return {
    ...brut,
    fiches: brut.fiches.map(f => ({ ...f, ...repertoire[f.chemin] })),
    qcm: brut.qcm.map(q => ({ ...q, ...repertoire[q.chemin] }))
  }
}

/**
 * L'export complet, tel que le serveur le constitue, augmenté des intitulés.
 *
 * Le format est celui du site d'origine, à l'octet près : un export produit là
 * se réimporte ici, et réciproquement.
 */
export function useResultats() {
  const repertoire = useRepertoireFiches()
  const brut = ref<ResultatsExport | null>(null) as Ref<ResultatsExport | null>
  const chargement = ref(true)
  const refus = ref(false)

  async function relire() {
    chargement.value = true
    try {
      brut.value = await $fetch<ResultatsExport>('/api/resultats/export')
      refus.value = false
    } catch {
      brut.value = null
      refus.value = true
    } finally {
      chargement.value = false
    }
  }

  onMounted(relire)

  const resultats = computed(() => enrichirResultats(brut.value, repertoire.value))

  return { resultats, chargement, refus, relire }
}
