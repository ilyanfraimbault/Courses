import type { InjectionKey, MaybeRefOrGetter, Ref } from 'vue'
import type { ResumeFiche } from '~~/shared/types/resultats'
import type { DonneesFicheApi } from './useDonneesFiche'

export interface ProgressionApi {
  /** Une question se déclare au montage. Une identité nulle n'est pas comptée. */
  declarer: (id: string | null) => void
  oublier: (id: string | null) => void
  /** Signale une question trouvée : la lettre, ou « auto » en auto-évaluation. */
  reussir: (id: string | null, reponse: string) => void
  /**
   * Signale une question ratée. À n'appeler qu'une fois par question et par
   * visite : c'est un événement qui s'ajoute à la mémoire des fautes, pas un
   * état qu'on réécrit.
   */
  rater: (id: string | null) => void
  /** Retire une question de la progression — l'auto-évaluation permet de se dédire. */
  annuler: (id: string | null) => void
  /** Ce que la mémoire sait de cette question, ou null si elle reste à faire. */
  memoire: (id: string | null) => string | null
}

export const progressionKey: InjectionKey<ProgressionApi> = Symbol('progression')

/** Assez pour fondre en un seul envoi la correction d'un QCM de vingt questions. */
const DELAI_ENVOI = 800

// État de module, donc partagé entre les requêtes au serveur : il n'y est jamais
// touché — on n'écrit qu'au client, et le résumé ne se lit qu'au montage.

/**
 * Les écritures de progression parties et pas encore revenues. Quitter une fiche
 * envoie son instantané au démontage, et le sommaire qui se monte aussitôt
 * relit le résumé : sans attendre l'un, l'autre peut le doubler et relire
 * l'état d'avant la réponse.
 */
const ecrituresEnCours = new Set<Promise<unknown>>()

function suivreEcriture<T>(envoi: Promise<T>): Promise<T> {
  ecrituresEnCours.add(envoi)
  envoi.finally(() => ecrituresEnCours.delete(envoi)).catch(() => {})
  return envoi
}

/** La navigation pour laquelle le résumé a été lu, ou est en train de l'être. */
let resumeLuPour: unknown = null

/**
 * Progression d'une fiche : combien de ses questions ont fini par être trouvées.
 *
 * Les blocs déclarent leurs questions au montage et signalent les réussites ; la
 * page n'a ainsi qu'un seul endroit où compter, et le décompte vaut aussi bien
 * pour un exercice à correction immédiate que pour un QCM corrigé d'un bloc.
 */
export function provideProgression(chemin: MaybeRefOrGetter<string>, source?: DonneesFicheApi | null) {
  // Les questions présentes sur la page, et parmi elles celles qui sont trouvées.
  const declarees = reactive(new Set<string>())
  const faites = reactive(new Map<string, string>())

  // Vue ne laisse pas un composant injecter ce qu'il vient lui-même de fournir :
  // `inject` remonte la chaîne des parents. La page appelle les deux `provide`
  // côte à côte, elle passe donc la source explicitement ; l'injection ne sert
  // qu'aux appels faits depuis un composant descendant.
  source ??= useDonneesFiche()
  const chargee = computed(() => source?.chargee.value ?? false)

  // Les enfants se montent avant le parent : les questions sont déjà déclarées
  // quand la réponse du serveur arrive.
  watch(() => source?.donnees.value, (donnees) => {
    if (!donnees) return
    for (const [id, reponse] of Object.entries(donnees.faites)) faites.set(id, reponse)
  }, { immediate: true })

  // Les fautes en attente d'envoi. Elles ne vivent pas dans `faites` : ce sont
  // des événements, envoyés puis oubliés, là où `faites` est un état complet
  // renvoyé en entier à chaque écriture.
  const fautes = reactive(new Set<string>())

  // Ce que la page a retiré d'elle-même, par une auto-évaluation dédite. Le
  // serveur n'efface rien d'autre : une question absente de `faites` peut aussi
  // bien avoir été trouvée ailleurs depuis le montage, et l'instantané d'un
  // onglet périmé ne doit pas la défaire.
  const annulees = reactive(new Set<string>())

  /**
   * Les fautes partent par **lot et par delta**, non par instantané : une page
   * ne connaît que les fautes commises sous ses yeux, jamais celles des visites
   * passées, et un instantané effacerait donc tout le reste.
   *
   * Le lot est vidé avant l'envoi : si celui-ci échoue, la faute est perdue. On
   * s'en accommode — c'est une donnée de confort, et la réenfiler ferait
   * compter deux fois la même erreur au premier succès qui suit.
   */
  const envoyerFautes = useDebounceFn(async () => {
    if (!chargee.value || !fautes.size) return
    const lot = [...fautes]
    fautes.clear()
    try {
      await $fetch('/api/fautes', {
        method: 'POST',
        body: { chemin: cheminCanonique(toValue(chemin)), questions: lot }
      })
    } catch {
      // Idem que la progression : on n'inflige pas un message d'erreur au
      // milieu d'un exercice pour une mémoire d'appoint.
    }
  }, DELAI_ENVOI)

  // Une faute commise avant que la lecture n'aboutisse attend son tour au lieu
  // de partir — c'est le cas de la réponse rejouée juste après une connexion.
  watch(chargee, (lue) => {
    if (lue && fautes.size) envoyerFautes()
  })

  const api: ProgressionApi = {
    declarer: (id) => { if (id) declarees.add(id) },
    oublier: (id) => { if (id) declarees.delete(id) },
    reussir: (id, reponse) => {
      if (!id) return
      faites.set(id, reponse)
      annulees.delete(id)
    },
    rater: (id) => {
      if (!id) return
      fautes.add(id)
      envoyerFautes()
    },
    annuler: (id) => {
      if (!id || !faites.has(id)) return
      faites.delete(id)
      annulees.add(id)
    },
    memoire: id => (id ? faites.get(id) ?? null : null)
  }

  provide(progressionKey, api)

  const total = computed(() => declarees.size)
  const reussies = computed(() => [...declarees].filter(id => faites.has(id)).length)
  const pourcentage = computed(() => total.value ? Math.round(100 * reussies.value / total.value) : 0)

  /**
   * L'instantané à envoyer : ce que la page déclare, parmi cela ce qui est
   * trouvé, et ce qu'elle a retiré. Les questions déclarées servent à élaguer
   * celles qui ont disparu du contenu ; tout le reste de ce que la base sait,
   * la page ne le touche pas.
   */
  function instantane() {
    const retenues: Record<string, string> = {}
    for (const id of declarees) {
      const reponse = faites.get(id)
      if (reponse) retenues[id] = reponse
    }
    return {
      chemin: cheminCanonique(toValue(chemin)),
      total: total.value,
      faites: retenues,
      questions: [...declarees],
      annulees: [...annulees].filter(id => declarees.has(id))
    }
  }

  const envoyer = useDebounceFn(async () => {
    const corps = instantane()
    try {
      await suivreEcriture($fetch('/api/fiche', { method: 'PUT', body: corps }))
      // Un retrait parti n'a plus à repartir : renvoyé plus tard, il déferait
      // une réussite acquise entre-temps sur un autre écran.
      for (const id of corps.annulees) annulees.delete(id)
    } catch {
      // La progression est un confort, pas une donnée à sauver à tout prix : on
      // n'inflige pas un message d'erreur au milieu d'un exercice.
    }
  }, DELAI_ENVOI)

  // On n'écrit qu'une fois la mémoire lue : persister avant reviendrait à
  // effacer ce qu'on n'a pas encore chargé. C'est la garde la plus importante du
  // fichier — `chargee` ne passe à vrai que sur une lecture réussie, si bien
  // qu'une session expirée ou une coupure réseau ne peut pas vider la base.
  // Les entrées dont la question a disparu du contenu sont élaguées au passage,
  // sinon le décompte gonflerait sans fin.
  watch([chargee, total, () => faites.size], () => {
    // Une page sans question — un index, un sommaire — n'a rien à mémoriser, et
    // écrire pour elle sèmerait des lignes vides dans la base.
    if (!chargee.value || !total.value) return
    envoyer()
  })

  // La temporisation gagne des requêtes, mais elle ouvre une fenêtre où quitter
  // la page perdrait la dernière réponse. `keepalive` laisse le navigateur
  // terminer l'envoi après le démontage, là où un `fetch` ordinaire est annulé.
  // On ne prend pas `sendBeacon`, qui n'émet que des POST : il faudrait doubler
  // la route en POST pour lui, alors que la charge utile — quelques kilo-octets —
  // tient très largement dans la limite de 64 Ko de `keepalive`.
  function vider() {
    if (!chargee.value || !total.value) return
    try {
      suivreEcriture(fetch('/api/fiche', {
        method: 'PUT',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(instantane())
      })).catch(() => {})
      if (fautes.size) {
        const lot = [...fautes]
        fautes.clear()
        fetch('/api/fautes', {
          method: 'POST',
          keepalive: true,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chemin: cheminCanonique(toValue(chemin)), questions: lot })
        }).catch(() => {})
      }
    } catch {
      // Idem : un envoi manqué n'est pas une raison d'interrompre la navigation.
    }
  }

  if (import.meta.client) {
    useEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') vider()
    })
    onBeforeUnmount(vider)
  }

  async function oublierProgression() {
    faites.clear()
    annulees.clear()
    try {
      await $fetch('/api/fiche', { method: 'DELETE', query: { chemin: cheminCanonique(toValue(chemin)) } })
    } catch {
      // L'oubli en mémoire suffit pour la session en cours.
    }
  }

  return { total, reussies, pourcentage, oublierProgression }
}

/** Renvoie null hors d'une page de cours. */
export function useProgression(): ProgressionApi | null {
  return inject(progressionKey, null)
}

export interface BlocApi {
  /** Slug du titre du bloc, seconde pièce de l'identité de ses questions. */
  slug: Readonly<Ref<string | null>>
  ajouter: (id: string | null) => void
  retirer: (id: string | null) => void
}

export const blocKey: InjectionKey<BlocApi> = Symbol('bloc-questions')

/**
 * Un bloc de questions — un exercice, un QCM — prête son titre à ses questions
 * pour qu'elles composent une identité stable, et tient la liste de celles qu'il
 * contient afin d'afficher son propre décompte.
 */
export function provideBloc(titre: MaybeRefOrGetter<string | undefined>) {
  const slug = computed(() => {
    const valeur = toValue(titre)
    return valeur ? slugifier(valeur) : null
  })
  const ids = reactive(new Set<string>())

  provide(blocKey, {
    slug,
    ajouter: (id) => { if (id) ids.add(id) },
    retirer: (id) => { if (id) ids.delete(id) }
  })

  return { slug, ids }
}

/** Renvoie null pour une question posée hors d'un bloc. */
export function useBloc(): BlocApi | null {
  return inject(blocKey, null)
}

/**
 * Nombre de questions de chaque fiche, compté au build (voir le hook
 * `content:file:afterParse` de nuxt.config.ts). C'est ce qui permet à une carte
 * d'annoncer « 0 / 34 » sur une fiche jamais ouverte, et de rendre sa barre dès
 * le serveur plutôt que de la faire surgir après l'hydratation.
 *
 * La clé d'`useAsyncData` est fixe : les quinze cartes d'un index partagent donc
 * une seule requête, sérialisée une fois dans la charge utile de la page.
 */
export function useComptesQuestions() {
  const { data } = useAsyncData('cours-comptes', async () => {
    const lignes = await queryCollection('cours').select('path', 'questions').all()
    return Object.fromEntries(lignes.map(l => [cheminCanonique(l.path), l.questions ?? 0]))
  }, { default: () => ({} as Record<string, number>) })

  return data
}

/**
 * L'état de toutes les fiches, relu à chaque page qui l'affiche.
 *
 * Là où le stockage local imposait une lecture par carte de lien, une seule
 * requête sert désormais les quinze cartes d'un sommaire comme le tableau de
 * bord : l'état est partagé par `useState`, et les cartes d'une même page
 * partagent la lecture.
 *
 * Une lecture par navigation, et non une par visite : lu une fois, le résumé
 * restait figé, et le sommaire où l'on revenait par un lien annonçait « 0 / 75 »
 * à côté d'une fiche à 43. Le quiz et les QCM composés cochent aussi les fiches
 * au serveur : seule une relecture voit tout ce qui a changé ailleurs. Elle
 * pèse quelques centaines d'octets.
 */
export function useResumeProgression() {
  const resume = useState<Record<string, ResumeFiche>>('progression-resume', () => ({}))
  const router = useRouter()

  async function charger() {
    // Chaque navigation produit un nouvel objet de route : c'est lui qui dit
    // « déjà lu pour cette page », sans compter sur le chemin, identique
    // quand on revient au sommaire qu'on vient de quitter.
    const navigation = router.currentRoute.value
    if (resumeLuPour === navigation) return
    resumeLuPour = navigation
    await Promise.allSettled([...ecrituresEnCours])
    try {
      resume.value = await $fetch<Record<string, ResumeFiche>>('/api/progression/resume')
    } catch {
      // Hors session : les cartes n'affichent pas de progression, ce qui est
      // exactement l'information juste. La connexion relira.
      if (resumeLuPour === navigation) resumeLuPour = null
    }
  }

  onMounted(charger)
  quandConnecte(charger)

  return resume
}

/**
 * Lecture seule de la progression d'une autre fiche, pour les cartes de lien.
 * Tant que la fiche n'a jamais été ouverte, il n'y a rien à afficher — et c'est
 * exactement l'information juste.
 */
export function useProgressionFiche(chemin: MaybeRefOrGetter<string>) {
  const resume = useResumeProgression()
  const fiche = computed(() => resume.value[cheminCanonique(toValue(chemin))] ?? null)

  const total = computed(() => fiche.value?.total ?? 0)
  const reussies = computed(() => {
    const f = fiche.value
    if (!f) return 0
    // Le total fait foi : une mémoire plus vieille que le contenu ne doit pas
    // afficher « 23 / 20 ».
    return Math.min(f.reussies, f.total)
  })
  const commencee = computed(() => total.value > 0 && reussies.value > 0)

  return { total, reussies, commencee }
}
