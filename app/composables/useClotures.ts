import type { Cloture } from '~~/shared/types/clotures'

/**
 * Les clôtures du compte : ce que l'élève a déclaré fini. Voir
 * `docs/clotures.md`.
 *
 * Lues au montage seulement, une fois par visite, et partagées par `useState`
 * entre le sommaire, l'accueil, la page ouverte et « Mes domaines ». Au rendu
 * serveur la liste est vide : le HTML d'une fiche reste le même pour tout le
 * monde, et le grisé n'arrive qu'après l'hydratation.
 */
export function useClotures() {
  const liste = useState<Cloture[]>('clotures', () => [])
  const demandee = useState('clotures-demandee', () => false)
  /** Vrai une fois la lecture réussie : hors session, rien ne se clôt. */
  const disponible = useState('clotures-disponible', () => false)

  async function relire() {
    try {
      liste.value = await $fetch<Cloture[]>('/api/clotures')
      disponible.value = true
    } catch {
      demandee.value = false
    }
  }

  function chargerUneFois() {
    if (demandee.value) return
    demandee.value = true
    relire()
  }

  onMounted(chargerUneFois)
  quandConnecte(chargerUneFois)

  /** La clôture qui couvre ce chemin — la sienne, ou celle d'un parent. */
  function closPar(chemin: string | null | undefined): Cloture | null {
    if (!chemin) return null
    const canonique = cheminCanonique(chemin)
    return liste.value.find(c => canonique === c.chemin || canonique.startsWith(c.chemin + '/')) ?? null
  }

  async function clore(chemin: string) {
    await $fetch('/api/clotures', { method: 'POST', body: { chemin } })
    await relire()
  }

  async function rouvrir(chemin: string) {
    await $fetch('/api/clotures', { method: 'DELETE', query: { chemin } })
    await relire()
  }

  return { liste, disponible, closPar, clore, rouvrir }
}
