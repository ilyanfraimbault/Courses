import type { TodoItem } from '~~/shared/types/resultats'

export interface CibleTodo {
  chemin: string
  /** Slug du bloc, ou null pour la fiche entière. */
  bloc?: string | null
  titre: string
  type?: string | null
}

/** Deux cibles désignent le même item si elles visent le même bloc de la même fiche. */
function memeCible(item: TodoItem, cible: CibleTodo): boolean {
  return item.chemin === cheminCanonique(cible.chemin) && (item.bloc ?? '') === (cible.bloc ?? '')
}

/**
 * La to-do, chargée une fois par visite et partagée.
 *
 * Une fiche d'exercices porte dix boutons « ajouter » ; sans état partagé, dix
 * requêtes au montage. `useState` les fond en une.
 */
export function useTodo() {
  const items = useState<TodoItem[]>('todo', () => [])
  const chargee = useState('todo-chargee', () => false)
  const enCours = useState('todo-en-cours', () => false)

  async function charger(force = false) {
    if ((chargee.value || enCours.value) && !force) return
    enCours.value = true
    try {
      items.value = await $fetch<TodoItem[]>('/api/todo')
      chargee.value = true
    } catch {
      // Hors session : les boutons restent inertes plutôt que d'afficher un état faux.
      chargee.value = false
    } finally {
      enCours.value = false
    }
  }

  onMounted(() => {
    charger()
  })

  const contient = (cible: CibleTodo) => items.value.some(i => memeCible(i, cible))
  const trouver = (cible: CibleTodo) => items.value.find(i => memeCible(i, cible)) ?? null

  async function ajouter(cible: CibleTodo) {
    if (contient(cible)) return
    try {
      const item = await $fetch<TodoItem>('/api/todo', {
        method: 'POST',
        body: { chemin: cheminCanonique(cible.chemin), bloc: cible.bloc ?? null, titre: cible.titre, type: cible.type ?? null }
      })
      // On recharge plutôt que d'insérer à l'aveugle : le serveur attribue le
      // rang et calcule les réussites, lui seul sait à quoi ressemble la liste.
      if (!items.value.some(i => i.id === item.id)) items.value = [...items.value, item]
    } catch {
      await charger(true)
    }
  }

  async function retirer(cible: CibleTodo) {
    const item = trouver(cible)
    if (!item) return
    const avant = items.value
    items.value = items.value.filter(i => i.id !== item.id)
    try {
      await $fetch(`/api/todo/${item.id}`, { method: 'DELETE' })
    } catch {
      items.value = avant
    }
  }

  async function basculer(cible: CibleTodo) {
    return contient(cible) ? retirer(cible) : ajouter(cible)
  }

  async function marquer(id: number, fait: boolean) {
    const avant = items.value
    items.value = items.value.map(i => (i.id === id ? { ...i, fait_le: fait ? Date.now() : null } : i))
    try {
      await $fetch(`/api/todo/${id}`, { method: 'PATCH', body: { fait } })
    } catch {
      items.value = avant
    }
  }

  async function supprimer(id: number) {
    const avant = items.value
    items.value = items.value.filter(i => i.id !== id)
    try {
      await $fetch(`/api/todo/${id}`, { method: 'DELETE' })
    } catch {
      items.value = avant
    }
  }

  async function reordonner(ids: number[]) {
    const avant = items.value
    const parId = new Map(items.value.map(i => [i.id, i]))
    items.value = ids.map(id => parId.get(id)!).filter(Boolean)
    try {
      await $fetch('/api/todo/ordre', { method: 'PUT', body: { ids } })
      return true
    } catch {
      items.value = avant
      return false
    }
  }

  return { items, chargee, charger, contient, trouver, ajouter, retirer, basculer, marquer, supprimer, reordonner }
}

/**
 * Les blocs de chaque fiche, relevés au build. Sert de dénominateur aux items de
 * to-do qui visent un bloc, et alimente le sélecteur d'ajout de la page to-do —
 * c'est ce qui permet de proposer « Exercice 3 » sans avoir ouvert la fiche.
 *
 * Clé fixe : une seule requête pour tous les consommateurs de la page.
 */
export function useBlocsFiches() {
  const { data } = useAsyncData('cours-blocs', async () => {
    const lignes = await queryCollection('cours').select('path', 'title', 'type', 'blocs').all()
    return lignes
      .filter(l => l.blocs && Object.keys(l.blocs).length)
      .map(l => ({
        chemin: cheminCanonique(l.path),
        titre: l.title,
        type: l.type,
        blocs: l.blocs as Record<string, { titre: string, nature: string, questions: number }>
      }))
  }, { default: () => [] })

  return data
}

export interface CibleCatalogue {
  /** Identité de la cible : « chemin » ou « chemin#bloc ». */
  cle: string
  chemin: string
  bloc: string | null
  /** Intitulé court et uniforme d'un cours à l'autre. */
  titre: string
  type: string | null
  questions: number
}

export interface FicheCatalogue extends CibleCatalogue {
  blocs: CibleCatalogue[]
}

export interface ChapitreCatalogue extends CibleCatalogue {
  fiches: FicheCatalogue[]
}

/**
 * L'intitulé court d'une fiche, celui de la barre latérale : « Cours »,
 * « Exercices », « Révisions », « Entraînement ». Il vient du frontmatter, donc
 * il est le même d'un chapitre à l'autre — c'est là tout son intérêt, puisque
 * le titre complet, lui, répète le nom du chapitre.
 */
function titreCourt(ligne: { title?: string, navigation?: unknown, path: string }): string {
  const nav = ligne.navigation
  if (nav && typeof nav === 'object' && typeof (nav as { title?: unknown }).title === 'string') {
    return (nav as { title: string }).title
  }
  return ligne.title ?? ligne.path
}

/**
 * Le catalogue de tout ce qu'on peut mettre en to-do, en **trois niveaux** :
 * le chapitre, la fiche, puis le bloc.
 *
 * Chaque niveau se prend d'un seul geste. Cocher « Fonctions usuelles » met le
 * chapitre entier ; le déplier laisse choisir « Exercices » ; déplier celle-ci
 * laisse n'en garder que l'exercice 3.
 *
 * Les fiches portent leur intitulé court, identique d'un chapitre à l'autre :
 * sous « Nombres complexes », la fiche s'appelle « Exercices » et non
 * « Nombres complexes — exercices du TD », que le chapitre annonce déjà.
 */
export function useCatalogueCibles() {
  const { data } = useAsyncData('cours-catalogue', async () => {
    const lignes = await queryCollection('cours')
      .select('path', 'title', 'type', 'questions', 'blocs', 'navigation')
      .all()

    const parChemin = new Map(lignes.map(l => [cheminCanonique(l.path), l]))
    const chapitres = new Map<string, ChapitreCatalogue>()

    for (const ligne of lignes) {
      const chemin = cheminCanonique(ligne.path)
      const segments = chemin.split('/').filter(Boolean)
      const cheminChapitre = '/' + segments.slice(0, -1).join('/')
      const parent = parChemin.get(cheminChapitre)

      // Un sommaire n'est pas une fiche : c'est lui qui nomme son chapitre.
      if (!ligne.type || !parent) continue

      const blocsBruts = (ligne.blocs ?? {}) as Record<string, { titre: string, nature: string, questions: number }>
      const blocs: CibleCatalogue[] = Object.entries(blocsBruts).map(([slug, b]) => ({
        cle: `${chemin}#${slug}`,
        chemin,
        bloc: slug,
        titre: b.titre,
        type: b.nature === 'qcm' ? 'qcm' : 'exercices',
        questions: b.questions
      }))

      const chapitre = chapitres.get(cheminChapitre) ?? {
        cle: cheminChapitre,
        chemin: cheminChapitre,
        bloc: null,
        titre: parent.title ?? cheminChapitre,
        type: null,
        questions: 0,
        fiches: []
      }

      chapitre.fiches.push({
        cle: chemin,
        chemin,
        bloc: null,
        titre: titreCourt(ligne),
        type: ligne.type,
        questions: ligne.questions ?? 0,
        blocs
      })
      // Le chapitre pèse ce que pèsent ses fiches : il n'a pas de questions à lui.
      chapitre.questions += ligne.questions ?? 0
      chapitres.set(cheminChapitre, chapitre)
    }

    return [...chapitres.values()].filter(c => c.fiches.length)
  }, { default: () => [] as ChapitreCatalogue[] })

  return data
}
