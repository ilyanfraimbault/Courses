import { defineContentConfig, defineCollection, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    // Une seule collection : tout le site est un site de cours. La source est
    // « cours/**/*.md » et non « ** » pour que le chemin d'URL reste identique
    // à celui du portfolio — les fiches vivent sous /cours/a1/…, comme avant.
    cours: defineCollection({
      type: 'page',
      source: 'cours/**/*.md',
      schema: z.object({
        // Affiche les commandes « tout afficher / tout masquer » en tête de page.
        interactif: z.boolean().optional(),
        // Nature de la page, affichée en pastille : cours, exercices du TD, ou
        // fiche d'entraînement progressive. Absente sur les pages de sommaire.
        type: z.enum(['cours', 'exercices', 'entrainement', 'qcm']).optional(),
        annee: z.string().optional(),
        matiere: z.string().optional(),
        ordre: z.number().optional(),
        icone: z.string().optional(),
        // Rempli au build par le hook `content:file:afterParse` de nuxt.config.ts.
        // Ne pas l'écrire à la main dans un frontmatter : il serait écrasé.
        questions: z.number().optional()
      })
    })
  }
})
