export type ModeConnexion = 'connexion' | 'inscription'

/** Ce que dit la fenêtre quand c'est une réponse qui l'a ouverte. */
export const MOTIF_REPONSE = 'Connecte-toi pour répondre : ta progression te suivra d\'un appareil à l\'autre.'

/**
 * Le geste interrompu par la demande de connexion, rejoué une fois connecté.
 *
 * Une variable de module et non un `useState` : une fonction ne se sérialise
 * pas dans la charge utile, et elle n'est jamais posée qu'au clic, donc côté
 * client — le serveur, qui partage ce module entre toutes les requêtes, n'y
 * écrit jamais.
 */
let enAttente: (() => void) | null = null

/**
 * La fenêtre de connexion, ouverte par-dessus la page plutôt qu'à sa place.
 *
 * On n'arrive sur une fiche que connecté, mais la session peut expirer pendant
 * qu'elle est ouverte : c'est alors **répondre** qui redemande un compte, parce
 * qu'une réponse sans compte n'irait nulle part. Quitter la page pour se
 * connecter ferait perdre l'endroit où l'on en était, et le clic qui a tout
 * déclenché : la fenêtre garde l'un et rejoue l'autre.
 */
export function useConnexion() {
  const { loggedIn } = useUserSession()
  const ouverte = useState('connexion-ouverte', () => false)
  const mode = useState<ModeConnexion>('connexion-mode', () => 'connexion')
  const motif = useState<string | null>('connexion-motif', () => null)

  function ouvrir(choix: ModeConnexion = 'connexion', pourquoi: string | null = null) {
    mode.value = choix
    motif.value = pourquoi
    ouverte.value = true
  }

  /**
   * Vrai si l'on peut continuer. Sinon, la fenêtre s'ouvre et l'action attend :
   * l'appelant s'arrête là, et c'est elle qui reprendra une fois connecté.
   */
  function exiger(action: () => void, pourquoi: string = MOTIF_REPONSE): boolean {
    if (loggedIn.value) return true
    enAttente = action
    ouvrir('connexion', pourquoi)
    return false
  }

  /** À appeler une fois la session rafraîchie : `loggedIn` doit déjà être vrai. */
  function reussie() {
    const action = enAttente
    enAttente = null
    ouverte.value = false
    action?.()
  }

  /** Refermer sans se connecter abandonne le geste : le rejouer plus tard surprendrait. */
  function fermer() {
    enAttente = null
    ouverte.value = false
  }

  return { ouverte, mode, motif, ouvrir, exiger, reussie, fermer }
}

/**
 * Relance une lecture au moment où l'on se connecte sans quitter la page. Une
 * lecture faite au montage a échoué en 401 et ne se refera pas d'elle-même :
 * sans cela, la fiche continuerait de se croire hors session, et rien de ce
 * qu'on y répond ne serait enregistré.
 */
export function quandConnecte(relire: () => void) {
  const { loggedIn } = useUserSession()
  watch(loggedIn, (connecte, avant) => {
    if (connecte && !avant) relire()
  })
}
