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
        questions: z.number().optional(),
        // Idem : les blocs de la page, indexés par le slug de leur titre, avec
        // le nombre de questions de chacun. C'est ce qui donne un dénominateur
        // à un item de to-do qui vise « Exercice 3 » plutôt que la fiche.
        blocs: z.record(z.string(), z.object({
          titre: z.string(),
          nature: z.enum(['exercice', 'qcm']),
          questions: z.number()
        })).optional(),
        // Idem : une entrée par question identifiable de la page — de quoi la
        // choisir et la classer, jamais de quoi la poser : l'énoncé reste dans
        // le corps de la fiche, relu à la demande. Sans ce relevé, tirer
        // quarante questions au hasard demanderait d'ouvrir les vingt-sept
        // fiches, soit vingt-sept mégaoctets d'arbre à parcourir, et ranger la
        // progression par point de cours coûterait autant.
        //
        // `interrogeable` sépare les deux usages : le quiz ne pose que les
        // questions à choix, la vue « mes domaines » les compte toutes.
        releve: z.array(z.object({
          bloc: z.string(),
          blocTitre: z.string(),
          label: z.string(),
          nature: z.enum(['exercice', 'qcm']),
          choix: z.number(),
          interrogeable: z.boolean(),
          notion: z.string().nullable(),
          notionTitre: z.string().nullable(),
          theme: z.string().nullable()
        })).optional()
      })
    })
  }
})
