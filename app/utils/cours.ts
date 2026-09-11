/**
 * Utilitaires du contenu, partagés par l'application **et par `nuxt.config.ts`**,
 * qui importe `slugifier` pour son relevé au build. C'est ce qui garantit que le
 * bloc relevé au build et l'identité écrite en base désignent la même chose.
 *
 * ⚠️ Ce fichier doit rester libre de tout import Nuxt : il est chargé au moment
 * de lire la configuration, hors de toute application.
 */

/**
 * Nature d'une page de la section « cours ». Une matière mélange plusieurs sortes
 * de pages qui ne se lisent pas de la même façon : on les distingue par une
 * pastille, dans les listes de liens comme en tête de la page elle-même.
 */
export type CoursType = 'cours' | 'exercices' | 'entrainement' | 'qcm' | 'formulaire'

export interface CoursTypeInfo {
  label: string
  icone: string
  couleur: 'primary' | 'neutral' | 'success' | 'warning' | 'error' | 'info'
  /** Une ligne qui dit à quoi sert cette sorte de page. */
  aide: string
}

export const coursTypes: Record<CoursType, CoursTypeInfo> = {
  cours: {
    label: 'Cours',
    icone: 'i-lucide-book-open-text',
    couleur: 'info',
    aide: 'Le cours du chapitre, à lire ou à consulter au besoin.'
  },
  exercices: {
    label: 'Exercices',
    icone: 'i-lucide-pencil-line',
    couleur: 'primary',
    aide: 'Les exercices du TD, corrigés, avec indice et solution en fenêtre.'
  },
  entrainement: {
    label: 'Entraînement',
    icone: 'i-lucide-list-checks',
    couleur: 'success',
    aide: 'Des questions en paliers de difficulté croissante, à faire dans l\'ordre.'
  },
  qcm: {
    label: 'QCM',
    icone: 'i-lucide-circle-check-big',
    couleur: 'warning',
    aide: 'Vingt questions à choix unique : on répond à tout, puis on corrige d\'un coup.'
  },
  // Une page sans questions, qu'on garde ouverte à côté des exercices : la
  // pastille « Cours » promettrait une lecture suivie qu'elle ne propose pas.
  formulaire: {
    label: 'Formulaire',
    icone: 'i-lucide-book-marked',
    couleur: 'neutral',
    aide: 'Toutes les formules du chapitre, chacune avec un exemple : une page à consulter, pas à lire dans l\'ordre.'
  }
}

export function coursTypeInfo(type?: string | null): CoursTypeInfo | null {
  if (!type) return null
  return coursTypes[type as CoursType] ?? null
}

/**
 * Réduit un intitulé à un identifiant lisible et stable : « Exercice 3 — Études
 * de fonctions » devient « exercice-3-etudes-de-fonctions ». Sert à composer les
 * clés de mémoire, qui doivent survivre à un rebuild du site — d'où le refus des
 * identifiants engendrés à la volée par `useId()`.
 *
 * `nuxt.config.ts` l'importe pour relever les blocs et la banque du quiz au
 * build : il n'en existe qu'une implémentation, et c'est celle-ci.
 */
export function slugifier(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Chemin de fiche sous sa forme canonique, sans barre oblique finale : GitHub
 * Pages redirige « /page » vers « /page/ », alors qu'une carte de lien pointe
 * vers la forme nue. Sans ce passage obligé, une même fiche aurait deux mémoires.
 */
export function cheminCanonique(chemin: string): string {
  return chemin.replace(/\/+$/, '') || '/'
}

/** Identité d'une question, unique dans tout le site et stable entre deux builds. */
export function identiteQuestion(chemin: string, bloc: string | null, label?: string): string | null {
  if (!bloc || !label) return null
  return `${cheminCanonique(chemin)}#${bloc}#${label}`
}
