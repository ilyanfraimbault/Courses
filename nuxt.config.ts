// https://nuxt.com/docs/api/configuration/nuxt-config

/** Les trois balises qui posent une question, quel que soit le format de la fiche. */
const BALISES_QUESTION = new Set(['exo-question', 'qcm-question', 'question'])

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
      const contenu = ctx.content as { path?: string, body?: { value?: unknown }, questions?: number } | undefined
      if (!contenu?.path?.startsWith('/cours/')) return
      contenu.questions = compterQuestions(contenu.body?.value)
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
