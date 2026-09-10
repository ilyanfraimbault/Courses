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
  /** Identité de la cible, « chemin#bloc » ou « chemin » pour une fiche entière. */
  cle: string
  chemin: string
  bloc: string | null
  titre: string
  type: string | null
  questions: number
  /** La fiche d'où vient un bloc, pour le situer sans ambiguïté. */
  contexte: string
}

export interface GroupeCatalogue {
  chapitre: string
  cibles: CibleCatalogue[]
}

/** Ce qui peut entrer dans une to-do : ni les pages de cours, ni les sommaires. */
const TYPES_CIBLABLES = ['exercices', 'entrainement', 'qcm']

/**
 * Le catalogue de tout ce qu'on peut mettre en to-do, **groupé par chapitre**.
 *
 * Une liste plate de quatre-vingts entrées, aux intitulés tous bâtis sur le même
 * modèle — « Exercice 4 », « Palier 5 » — ne se parcourt pas : rien n'y dit de quel
 * chapitre vient quoi. Le chapitre est donc rendu explicite, et chaque bloc
 * porte le nom de sa fiche.
 */
export function useCatalogueCibles() {
  const { data } = useAsyncData('cours-catalogue', async () => {
    const lignes = await queryCollection('cours')
      .select('path', 'title', 'type', 'questions', 'blocs')
      .all()

    // Les sommaires de chapitre donnent leur nom aux groupes.
    const titreDe = new Map<string, string>()
    for (const l of lignes) titreDe.set(cheminCanonique(l.path), l.title ?? '')

    const groupes = new Map<string, GroupeCatalogue>()

    for (const l of lignes) {
      const chemin = cheminCanonique(l.path)
      const segments = chemin.split('/').filter(Boolean)
      const cheminChapitre = '/' + segments.slice(0, -1).join('/')
      const chapitre = titreDe.get(cheminChapitre) || segments.at(-2) || 'Cours'

      const blocs = (l.blocs ?? {}) as Record<string, { titre: string, nature: string, questions: number }>
      const ciblable = !!l.type && TYPES_CIBLABLES.includes(l.type)
      if (!ciblable && !Object.keys(blocs).length) continue

      const groupe = groupes.get(chapitre) ?? { chapitre, cibles: [] }
      groupes.set(chapitre, groupe)

      // La fiche entière, quand elle se « fait » — une page de cours se lit.
      if (ciblable) {
        groupe.cibles.push({
          cle: chemin,
          chemin,
          bloc: null,
          titre: `${l.title} — toute la fiche`,
          type: l.type ?? null,
          questions: l.questions ?? 0,
          contexte: l.title ?? chemin
        })
      }

      for (const [slug, bloc] of Object.entries(blocs)) {
        groupe.cibles.push({
          cle: `${chemin}#${slug}`,
          chemin,
          bloc: slug,
          titre: bloc.titre,
          type: bloc.nature === 'qcm' ? 'qcm' : 'exercices',
          questions: bloc.questions,
          contexte: l.title ?? chemin
        })
      }
    }

    return [...groupes.values()].filter(g => g.cibles.length)
  }, { default: () => [] as GroupeCatalogue[] })

  return data
}
