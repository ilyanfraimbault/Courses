import type { DonneesFiche, QcmTentative } from '~~/shared/types/resultats'

/**
 * Tout ce qu'une fiche a besoin de savoir, en **une** requête.
 *
 * La page de trigonométrie porte douze blocs de QCM : un appel par bloc ferait
 * douze allers-retours au montage. On fond donc progression et historique dans
 * une seule réponse, que la page fournit à ses descendants.
 */
export default defineEventHandler(async (event): Promise<DonneesFiche> => {
  const uid = await idUtilisateur(event)

  const { chemin: brut } = getQuery(event)
  if (typeof brut !== 'string' || !brut.startsWith('/')) {
    throw createError({ statusCode: 400, statusMessage: 'chemin manquant ou invalide' })
  }
  const chemin = cheminCanonique(brut)

  const db = useBase()

  const fiche = db
    .prepare('SELECT total FROM fiche WHERE utilisateur_id = ? AND chemin = ?')
    .get(uid, chemin) as { total: number } | undefined

  const faites: Record<string, string> = {}
  const lignes = db
    .prepare('SELECT bloc, label, reponse FROM reussite WHERE utilisateur_id = ? AND chemin = ?')
    .all(uid, chemin) as { bloc: string, label: string, reponse: string }[]
  for (const l of lignes) faites[composerIdentite(chemin, l.bloc, l.label)] = l.reponse

  const qcm: Record<string, QcmTentative[]> = {}
  const tentatives = db.prepare(
    'SELECT bloc, t, justes, total, ratees FROM qcm_tentative WHERE utilisateur_id = ? AND chemin = ? ORDER BY t ASC'
  ).all(uid, chemin) as { bloc: string, t: number, justes: number, total: number, ratees: string }[]
  for (const t of tentatives) {
    (qcm[t.bloc] ??= []).push({
      t: t.t,
      justes: t.justes,
      total: t.total,
      ratees: JSON.parse(t.ratees) as string[]
    })
  }

  return { chemin, total: fiche?.total ?? 0, faites, qcm }
})
