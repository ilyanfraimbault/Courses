import type { ContentNavigationItem } from '@nuxt/content'
import { niveauxDuChemin } from '~~/shared/utils/niveaux'

export interface Sommaire {
  /** Ce que la barre annonce en tête : la matière, ou « Cours » hors d'une matière. */
  titre: string
  /** L'année de la matière, quand on est dans une matière. */
  annee: string | null
  /** La page que ce titre ouvre. */
  chemin: string
  liens: ContentNavigationItem[]
}

/** Le dossier `chemin` de l'arbre. Il partage son chemin avec sa page d'index : on veut celui qui a des enfants. */
function trouverDossier(noeuds: ContentNavigationItem[], chemin: string): ContentNavigationItem | null {
  for (const noeud of noeuds) {
    if (noeud.path === chemin && noeud.children?.length) return noeud
    const trouve = noeud.children?.length ? trouverDossier(noeud.children, chemin) : null
    if (trouve) return trouve
  }
  return null
}

/**
 * Les enfants d'un dossier, sans le lien vers sa propre page d'index : un
 * dossier porte **deux** enfants de même chemin que lui — voir
 * `.claude/pieges.md`. Le titre du sommaire mène déjà à cette page.
 */
function enfants(dossier: ContentNavigationItem): ContentNavigationItem[] {
  return (dossier.children ?? []).filter(e => e.path !== dossier.path)
}

/**
 * Le sommaire de la barre latérale : **la matière de la page, et elle seule**.
 *
 * L'arbre complet s'étage en « Cours › Année › Matière › Chapitre › Fiche ». Tant
 * qu'il n'y avait qu'une matière, on l'aplatissait jusqu'aux chapitres. Avec
 * plusieurs, ni l'un ni l'autre ne tient : l'arbre complet enfouit les fiches
 * sous trois crans d'indentation, et l'aplatir mélangerait les chapitres de
 * deux cours dans la même liste.
 *
 * Dans une matière, la barre montre donc ses chapitres, avec le nom de la
 * matière et de son année en tête. Ailleurs — tableau de bord, quiz, domaines —
 * elle montre les années et leurs matières, sans descendre plus bas : c'est de
 * là qu'on choisit dans quel cours entrer.
 */
/**
 * Ce qui est clos reste dans le sommaire, grisé : le cacher empêcherait de le
 * retrouver, donc de le rouvrir. La liste des clôtures n'arrive qu'au client,
 * si bien que le rendu serveur et le premier rendu client coïncident.
 */
function griser(liens: ContentNavigationItem[], estClos: (chemin: string) => boolean): ContentNavigationItem[] {
  return liens.map(lien => ({
    ...lien,
    ...(estClos(lien.path) ? { class: 'opacity-50' } : {}),
    ...(lien.children?.length ? { children: griser(lien.children, estClos) } : {})
  }))
}

export function useSommaire() {
  const navigation = inject<Ref<ContentNavigationItem[]>>('navigation', ref([]))
  const route = useRoute()
  const { liste, closPar } = useClotures()
  // Les matières de l'autre parcours sortent de la liste des matières. Lu au
  // client seulement, comme les clôtures : le HTML servi reste le même pour
  // tous. Relu quand le parcours change.
  const autorise = useAccesAccorde()
  const { parcours } = useProfil()
  const { data: masquees } = useFetch<string[]>('/api/matieres/masquees', {
    key: 'matieres-masquees',
    server: false,
    immediate: autorise.value,
    watch: [parcours, autorise],
    default: () => []
  })

  const brut = computed<Sommaire>(() => {
    const arbre = navigation.value ?? []
    const niveaux = niveauxDuChemin(route.path)

    const matiere = niveaux.matiere ? trouverDossier(arbre, niveaux.matiere) : null
    if (matiere) {
      const annee = niveaux.annee ? trouverDossier(arbre, niveaux.annee) : null
      return { titre: matiere.title, annee: annee?.title ?? null, chemin: matiere.path, liens: enfants(matiere) }
    }

    const racine = trouverDossier(arbre, '/cours')
    const annees = racine ? enfants(racine) : arbre
    return {
      titre: racine?.title ?? 'Cours',
      annee: null,
      chemin: '/cours',
      liens: annees.map(annee => ({
        ...annee,
        children: annee.children?.length
          ? enfants(annee).filter(m => !masquees.value.includes(m.path)).map(({ children: _enfants, ...m }) => m)
          : undefined
      }))
    }
  })

  return computed<Sommaire>(() => (liste.value.length
    ? { ...brut.value, liens: griser(brut.value.liens, chemin => !!closPar(chemin)) }
    : brut.value))
}
