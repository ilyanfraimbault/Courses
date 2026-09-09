import type { ResumeFiche } from '~~/shared/types/resultats'

/**
 * L'état de toutes les fiches, en une requête. Elle alimente aussi bien les
 * quinze cartes de lien d'une page de sommaire que le tableau de bord — là où
 * le stockage local imposait une lecture par carte.
 *
 * Une trentaine de lignes, quelques centaines d'octets.
 */
export default defineEventHandler(async (event): Promise<Record<string, ResumeFiche>> => {
  await requireUserSession(event)

  const lignes = useBase().prepare(`
    SELECT f.chemin, f.total, f.maj, COUNT(r.label) AS reussies
    FROM fiche f
    LEFT JOIN reussite r ON r.chemin = f.chemin
    GROUP BY f.chemin
  `).all() as { chemin: string, total: number, maj: number, reussies: number }[]

  const resume: Record<string, ResumeFiche> = {}
  for (const l of lignes) {
    resume[l.chemin] = { total: l.total, reussies: l.reussies, maj: l.maj }
  }
  return resume
})
