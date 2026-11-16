export type ModeConnexion = 'connexion' | 'inscription' | 'demande'

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
  const autorise = useAccesAccorde()
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
    if (autorise.value) return true
    enAttente = action
    // Connecté sans accès, se reconnecter n'y changerait rien : la fenêtre
    // montre où en est la demande.
    if (loggedIn.value) ouvrir('demande')
    else ouvrir('connexion', pourquoi)
    return false
  }

  /**
   * À appeler une fois la session rafraîchie : `loggedIn` doit déjà être vrai.
   * Un compte sans accès ne reprend pas le geste — il passe à la demande, et le
   * geste attend que l'accès vienne pendant que la fenêtre est ouverte.
   */
  function reussie() {
    if (!autorise.value) {
      mode.value = 'demande'
      motif.value = null
      return
    }
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
 * Connecté **et** accepté par l'administration : la seule condition qui ouvre
 * les pages de travail et les réponses. Être connecté ne suffit plus — un
 * compte créé sans code d'invitation n'a que de quoi demander l'accès.
 *
 * Confort d'affichage seulement : c'est `idUtilisateur` qui refuse les données.
 */
export function useAccesAccorde() {
  const { loggedIn, user } = useUserSession()
  return computed(() => loggedIn.value && user.value?.acces === 'accorde')
}

/**
 * Relance une lecture au moment où l'on se connecte sans quitter la page. Une
 * lecture faite au montage a échoué en 401 et ne se refera pas d'elle-même :
 * sans cela, la fiche continuerait de se croire hors session, et rien de ce
 * qu'on y répond ne serait enregistré.
 */
export function quandConnecte(relire: () => void) {
  // Sur l'accès et non sur la seule connexion : un compte sans accès a lu en
  // 403, et c'est le jour où l'accès lui est accordé qu'il faut relire.
  const autorise = useAccesAccorde()
  watch(autorise, (ouvert, avant) => {
    if (ouvert && !avant) relire()
  })
}
