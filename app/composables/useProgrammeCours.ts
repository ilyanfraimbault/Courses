import { niveauxDuChemin } from '~~/shared/utils/niveaux'

/**
 * Le plan d'un cours, de quoi y cocher le programme d'un contrôle : chapitres,
 * fiches, et les exercices de chaque fiche.
 *
 * Une clé par nœud, celle que le contrôle retient : le chemin d'un chapitre,
 * celui d'une fiche, ou « /fiche#bloc » pour un exercice — le slug de bloc
 * relevé au build, le même que dans l'identité des questions. Les intitulés,
 * eux, se relisent ici à chaque ouverture : renommer un exercice ne demande
 * pas de réécrire les contrôles.
 */
export interface NoeudProgramme {
  cle: string
  titre: string
  /** La nature d'une fiche (cours, exercices…), pour sa pastille. */
  type?: string | null
  enfants: NoeudProgramme[]
}

interface PageCours {
  path: string
  title: string
  type?: string | null
  ordre?: number | null
  blocs?: Record<string, { titre: string }> | null
}

export function useProgrammeCours(cours: MaybeRefOrGetter<string | null>) {
  const { data: pages, status } = useLazyAsyncData(
    () => `programme:${toValue(cours) ?? ''}`,
    async () => {
      const chemin = toValue(cours)
      if (!chemin) return []
      return await queryCollection('cours')
        .where('path', 'LIKE', `${chemin}/%`)
        .select('path', 'title', 'type', 'ordre', 'blocs')
        .all() as unknown as PageCours[]
    },
    { server: false, watch: [() => toValue(cours)], default: () => [] as PageCours[] }
  )

  const arbre = computed<NoeudProgramme[]>(() => {
    const chemin = toValue(cours)
    if (!chemin) return []
    const lignes = pages.value.map(p => ({ ...p, path: cheminCanonique(p.path) }))
    // Le préfixe numérique des dossiers (« 2.arbres ») disparaît de l'URL :
    // l'ordre se lit dans `ordre` quand la page en a un, sinon dans le chemin.
    const parOrdre = (a: PageCours, b: PageCours) => (a.ordre ?? 999) - (b.ordre ?? 999) || a.path.localeCompare(b.path, 'fr', { numeric: true })

    const chapitres = lignes.filter(p => niveauxDuChemin(p.path).chapitre === p.path).sort(parOrdre)
    const fiches = lignes.filter(p => niveauxDuChemin(p.path).chapitre !== p.path).sort(parOrdre)
    const exercices = (f: PageCours): NoeudProgramme[] => Object.entries(f.blocs ?? {})
      .map(([slug, b]) => ({ cle: `${f.path}#${slug}`, titre: b.titre, enfants: [] }))
    const noeudFiche = (f: PageCours): NoeudProgramme => ({ cle: f.path, titre: f.title, type: f.type, enfants: exercices(f) })

    const noeuds: NoeudProgramme[] = chapitres.map(c => ({
      cle: c.path,
      titre: c.title,
      enfants: fiches.filter(f => niveauxDuChemin(f.path).chapitre === c.path).map(noeudFiche)
    }))
    // Une fiche rangée directement sous la matière, sans chapitre.
    for (const f of fiches) if (!niveauxDuChemin(f.path).chapitre) noeuds.push(noeudFiche(f))
    return noeuds
  })

  /** Clé → intitulé lisible, avec celui du parent pour un exercice ou une fiche. */
  const titres = computed(() => {
    const carte = new Map<string, string>()
    const parcourir = (noeuds: NoeudProgramme[], parent: string | null) => {
      for (const n of noeuds) {
        carte.set(n.cle, parent ? `${parent} › ${n.titre}` : n.titre)
        parcourir(n.enfants, n.titre)
      }
    }
    parcourir(arbre.value, null)
    // La matière entière se désigne par le chemin de son cours.
    const chemin = toValue(cours)
    if (chemin) carte.set(chemin, 'Toute la matière')
    return carte
  })

  return { arbre, titres, charge: computed(() => status.value === 'success') }
}
