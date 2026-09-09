// https://nuxt.com/docs/api/configuration/nuxt-config

/** Les trois balises qui posent une question, quel que soit le format de la fiche. */
const BALISES_QUESTION = new Set(['exo-question', 'qcm-question', 'question'])

/** Les balises qui regroupent des questions, et qu'on peut mettre en to-do. */
const BALISES_BLOC = new Set(['exercice', 'qcm'])

/**
 * Réduit un intitulé à un identifiant lisible et stable. C'est **le même**
 * calcul que `slugifier` côté application : c'est ce qui garantit que le bloc
 * relevé ici et l'identité « …#exercice-3#12. » écrite en base désignent la
 * même chose. Les deux doivent bouger ensemble.
 */
function slugifier(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

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
    // Le mot de passe du site. Aucune valeur par défaut : sans lui, la connexion
    // renvoie une 500 explicite plutôt que d'accepter la chaîne vide.
    coursMotDePasse: '',
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
      } | undefined
      if (!contenu?.path?.startsWith('/cours/')) return
      contenu.questions = compterQuestions(contenu.body?.value)
      contenu.blocs = releverBlocs(contenu.body?.value)
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
