import { PARCOURS, type Parcours } from '~~/shared/types/matieres'

/**
 * Qui est l'élève — prénom, nom, parcours — tel que la session le rapporte,
 * et la fenêtre qui le lui fait dire.
 *
 * La fenêtre s'ouvre d'elle-même tant qu'il manque quelque chose — et ne se
 * ferme alors qu'en répondant —, puis sur demande, depuis le badge de
 * l'en-tête, pour changer de parcours ou corriger son nom.
 */
export function useProfil() {
  const { user, fetch: relireSession } = useUserSession()
  const autorise = useAccesAccorde()
  const demande = useState('profil:modifier', () => false)

  const parcours = computed<Parcours | null>(() => user.value?.parcours ?? null)
  const prenom = computed(() => user.value?.prenom ?? null)
  const nom = computed(() => user.value?.nom ?? null)
  const libelle = computed(() => parcours.value ? PARCOURS[parcours.value].court : null)
  const obligatoire = computed(() => autorise.value && (!parcours.value || !prenom.value || !nom.value))

  async function enregistrer(valeurs: { prenom: string, nom: string, parcours: Parcours }) {
    await $fetch('/api/compte/profil', { method: 'PUT', body: valeurs })
    // La session ne se réécrit pas : c'est sa relecture qui rapporte le
    // profil, depuis la base (`server/plugins/session-administration.ts`).
    await relireSession()
    demande.value = false
  }

  return { parcours, prenom, nom, libelle, obligatoire, demande, enregistrer }
}
