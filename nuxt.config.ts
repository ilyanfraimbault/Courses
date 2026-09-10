// https://nuxt.com/docs/api/configuration/nuxt-config

// Le relevé du contenu a lieu ici, au build, et il a besoin de découper les
// intitulés exactement comme l'application le fait à l'exécution : c'est ce qui
// garantit que le bloc relevé et l'identité « …#exercice-3#12. » écrite en base
// désignent la même chose. Ce fichier n'importe donc pas une copie de
// `slugifier`, il importe **la** fonction — voir l'avertissement en tête de
// `app/utils/cours.ts`, qui doit rester libre de tout import Nuxt.
import { slugifier } from './app/utils/cours'

/** Les trois balises qui posent une question, quel que soit le format de la fiche. */
const BALISES_QUESTION = new Set(['exo-question', 'qcm-question', 'question'])

/** Les balises qui regroupent des questions, et qu'on peut mettre en to-do. */
const BALISES_BLOC = new Set(['exercice', 'qcm'])

/** Les lettres qu'une question peut proposer, dans leur ordre d'affichage. */
const LETTRES = ['a', 'b', 'c', 'd', 'e']

/**
 * Compte les questions d'une page en parcourant son arbre minimark, dont chaque
 * nœud a la forme `['balise', props, ...enfants]`. On préfère ce parcours à une
 * expression rationnelle sur la source : il ignore les blocs de code et suit
 * exactement ce qui sera rendu.
 *
 * Le comptage a lieu au build pour qu'une carte de lien connaisse le
 * dénominateur d'une fiche que l'on n'a jamais ouverte — c'est justement sur
 * l'index qu'on choisit quoi ouvrir.
 */
function compterQuestions(noeuds: unknown): number {
  if (!Array.isArray(noeuds)) return 0
  let total = 0
  for (const noeud of noeuds) {
    if (!Array.isArray(noeud)) continue
    if (typeof noeud[0] === 'string' && BALISES_QUESTION.has(noeud[0])) total += 1
    total += compterQuestions(noeud.slice(2))
  }
  return total
}

/**
 * Relève les blocs d'une page et le nombre de questions de chacun.
 *
 * La to-do se veut plus fine que la fiche : on doit pouvoir se noter
 * « Exercice 3 » sans s'engager sur les neuf autres. Un item ainsi ciblé a
 * besoin d'un dénominateur, et il faut pouvoir proposer la liste des exercices
 * d'une fiche sans l'avoir ouverte — d'où ce relevé au build, à côté du
 * comptage par page.
 */
interface BlocReleve {
  titre: string
  nature: string
  questions: number
}

function releverBlocs(noeuds: unknown, sortie: Record<string, BlocReleve> = {}): Record<string, BlocReleve> {
  if (!Array.isArray(noeuds)) return sortie
  for (const noeud of noeuds) {
    if (!Array.isArray(noeud)) continue
    const balise = typeof noeud[0] === 'string' ? noeud[0] : null
    if (balise && BALISES_BLOC.has(balise)) {
      const titre = (noeud[1] as { titre?: string } | undefined)?.titre
      if (titre) {
        const slug = slugifier(titre)
        sortie[slug] = {
          titre,
          nature: balise,
          questions: compterQuestions(noeud.slice(2))
        }
      }
    }
    releverBlocs(noeud.slice(2), sortie)
  }
  return sortie
}

/* ---------------------------------------------------------------------------
   Le relevé des questions.

   Deux usages tirent sur le même fil. Le mode quiz n'a pas de questions à lui :
   il pioche dans celles des fiches, et il lui faut savoir lesquelles se
   corrigent toutes seules sans ouvrir une seule page. La vue « mes domaines »,
   elle, veut savoir de quoi chaque question parle pour ranger la progression
   par point de cours plutôt que par fiche.

   C'est le même relevé — quelques dizaines d'octets par question, l'énoncé
   restant dans le corps de la fiche, relu à la demande. Il porte **toutes** les
   questions identifiables, et `interrogeable` dit lesquelles le quiz sait poser.
   Deux relevés côte à côte se seraient contredits le jour où l'un aurait changé.
   --------------------------------------------------------------------------- */

interface ExtraitReleve {
  titre: string
  source?: string
}

interface QuestionRelevee {
  bloc: string
  blocTitre: string
  label: string
  nature: string
  choix: number
  /**
   * Vrai quand la question se corrige toute seule : une lettre attendue et au
   * moins deux propositions écrites. Le quiz ne pose que celles-là — une file
   * qui doit savoir si la réponse était juste ne peut rien faire d'une question
   * ouverte. La progression par domaine, elle, les compte toutes.
   */
  interrogeable: boolean
  notion: string | null
  notionTitre: string | null
  theme: string | null
}

/**
 * Les rappels de cours de la page, par identifiant. Un même identifiant peut
 * servir dans deux pages différentes — `cours-quotient` désigne le quotient de
 * fonctions ici, le quotient de complexes ailleurs — d'où un relevé par page,
 * comme la résolution qu'en fait l'application à l'exécution.
 */
function releverExtraits(noeuds: unknown, sortie: Record<string, ExtraitReleve> = {}): Record<string, ExtraitReleve> {
  if (!Array.isArray(noeuds)) return sortie
  for (const noeud of noeuds) {
    if (!Array.isArray(noeud)) continue
    if (noeud[0] === 'extrait-cours') {
      const props = noeud[1] as { id?: string, titre?: string, source?: string } | undefined
      if (props?.id && props.titre) sortie[props.id] = { titre: props.titre, source: props.source }
    }
    releverExtraits(noeud.slice(2), sortie)
  }
  return sortie
}

/**
 * Le chapitre auquel un chemin appartient : « …/trigonometrie/cours » donne
 * « trigonometrie ». C'est l'avant-dernier segment, et non un rang fixe : le
 * jour où une seconde matière existera, la règle tiendra encore.
 */
function chapitreDe(chemin: string | undefined): string | null {
  if (!chemin) return null
  const segments = chemin.split('#')[0]!.split('/').filter(Boolean)
  return segments.length >= 2 ? segments[segments.length - 2]! : null
}

/**
 * Relève les questions d'une page, avec ce qu'il faut pour les trier.
 *
 * Trois décisions méritent d'être écrites.
 *
 * **On ne retient que ce qui porte une identité** : une question hors bloc ou
 * sans repère n'a pas de clé « chemin#bloc#label », donc pas de mémoire — la
 * ranger dans un domaine ferait gonfler un dénominateur que rien ne peut
 * remplir.
 *
 * **`interrogeable` sépare les deux usages** plutôt que deux relevés. Une
 * question sans lettre attendue, ou avec une seule proposition, s'auto-évalue :
 * elle n'a pas sa place dans une file qui doit savoir si la réponse était juste,
 * mais elle compte dans la progression d'un domaine comme n'importe quelle
 * autre.
 *
 * **Le thème vient du cours visé, pas de la page.** Un QCM mélange
 * délibérément les chapitres : le classer par son dossier mettrait ses vingt
 * questions dans un thème « qcm » dont personne ne veut. Chaque question, elle,
 * renvoie au rappel de cours exact qui lui manquait, et ce rappel pointe vers
 * une section d'un chapitre : c'est de là que le thème est déduit. Une question
 * sans rappel retombe sur le chapitre de sa fiche.
 */
function releverQuestions(noeuds: unknown, chemin: string | undefined, extraits: Record<string, ExtraitReleve>, bloc: BlocReleve & { slug: string } | null = null, sortie: QuestionRelevee[] = []): QuestionRelevee[] {
  if (!Array.isArray(noeuds)) return sortie
  const chapitrePage = chapitreDe(chemin)

  for (const noeud of noeuds) {
    if (!Array.isArray(noeud)) continue
    const balise = typeof noeud[0] === 'string' ? noeud[0] : null
    const props = (noeud[1] ?? {}) as Record<string, unknown>

    if (balise && BALISES_BLOC.has(balise) && typeof props.titre === 'string') {
      releverQuestions(noeud.slice(2), chemin, extraits, { slug: slugifier(props.titre), titre: props.titre, nature: balise, questions: 0 }, sortie)
      continue
    }

    if (balise && BALISES_QUESTION.has(balise) && bloc && typeof props.label === 'string') {
      const lettres = new Set<string>()
      for (const enfant of noeud.slice(2)) {
        if (!Array.isArray(enfant) || enfant[0] !== 'template') continue
        const cle = Object.keys((enfant[1] ?? {}) as object).find(c => c.startsWith('v-slot:'))
        const nom = cle?.slice('v-slot:'.length)
        if (nom && LETTRES.includes(nom)) lettres.add(nom)
      }
      const notion = typeof props.cours === 'string' ? props.cours : null
      const extrait = notion ? extraits[notion] : undefined
      sortie.push({
        bloc: bloc.slug,
        blocTitre: bloc.titre,
        label: props.label,
        nature: bloc.nature,
        choix: lettres.size,
        interrogeable: typeof props.bonne === 'string' && lettres.size >= 2,
        notion,
        notionTitre: extrait?.titre ?? null,
        theme: chapitreDe(extrait?.source) ?? chapitrePage
      })
      continue
    }

    releverQuestions(noeud.slice(2), chemin, extraits, bloc, sortie)
  }

  return sortie
}

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/content',
    '@vueuse/nuxt',
    'nuxt-auth-utils'
  ],

  components: [
    // Composants utilisables directement dans le Markdown (MDC).
    { path: '~/components/content', global: true, pathPrefix: false },
    '~/components'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  content: {
    build: {
      markdown: {
        toc: {
          searchDepth: 1
        },
        remarkPlugins: {
          'remark-math': {}
        },
        rehypePlugins: {
          // throwOnError: false => une formule fautive s'affiche en rouge
          // au lieu de faire échouer le build.
          'rehype-katex': {
            throwOnError: false,
            strict: false
          }
        }
      }
    },
    experimental: {
      sqliteConnector: 'native'
    }
  },

  runtimeConfig: {
    // Code exigé pour créer un compte. Vide, les inscriptions sont **fermées** :
    // le site vit sur un domaine public, et une inscription libre invite les
    // robots. Le code se partage à qui de droit.
    codeInscription: '',
    // Répertoire inscriptible et non fichier monté seul : le mode WAL écrit
    // « -wal » et « -shm » à côté de la base.
    baseFichier: '.data/cours.sqlite',
    // À n'activer que derrière un proxy qui réécrit X-Forwarded-For (Caddy).
    // Exposé en direct, cet en-tête est contrôlé par le client.
    trustProxy: false
  },

  experimental: {
    asyncContext: true
  },

  compatibilityDate: '2026-06-30',

  // Serveur Node dans un conteneur : le site n'est plus statique, il a une base.
  nitro: {
    preset: 'node-server'
  },

  hooks: {
    'content:file:afterParse'(ctx: { content?: Record<string, unknown> }) {
      const contenu = ctx.content as {
        path?: string
        body?: { value?: unknown }
        questions?: number
        blocs?: Record<string, unknown>
        releve?: unknown[]
      } | undefined
      if (!contenu?.path?.startsWith('/cours/')) return
      contenu.questions = compterQuestions(contenu.body?.value)
      contenu.blocs = releverBlocs(contenu.body?.value)
      contenu.releve = releverQuestions(contenu.body?.value, contenu.path, releverExtraits(contenu.body?.value))
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
