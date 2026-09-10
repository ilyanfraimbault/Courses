import type { FicheResultat, QcmResultat, ResultatsExport, TodoResultat } from '~~/shared/types/resultats'
import { FORMAT_RESULTATS, VERSION_RESULTATS } from '~~/shared/types/resultats'

/**
 * Rassemble tout ce que la base retient, dans le format d'export historique.
 *
 * Le format ne change pas d'un iota : c'est ce qui garantit qu'un export du site
 * d'origine se réimporte ici, et qu'un export d'ici se réimporte à son tour.
 * Les intitulés de fiches (`titre`, `type`) sont ajoutés côté client, qui seul
 * connaît la collection.
 */
export default defineEventHandler(async (event): Promise<ResultatsExport> => {
  const uid = await idUtilisateur(event)

  const db = useBase()

  const fiches: FicheResultat[] = []
  const lignesFiches = db.prepare('SELECT chemin, total, maj FROM fiche WHERE utilisateur_id = ? ORDER BY chemin').all(uid) as
    { chemin: string, total: number, maj: number }[]

  const parFiche = db.prepare('SELECT bloc, label FROM reussite WHERE utilisateur_id = ? AND chemin = ?')
  for (const f of lignesFiches) {
    const questions = (parFiche.all(uid, f.chemin) as { bloc: string, label: string }[])
      .map(q => `${q.bloc}#${q.label}`)
      // Tri naturel : sans lui, « 10. » passerait avant « 2. » et la liste ne
      // suivrait plus l'ordre de la fiche.
      .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }))
    fiches.push({
      chemin: f.chemin,
      total: f.total,
      reussies: questions.length,
      questions,
      maj: new Date(f.maj || Date.now()).toISOString()
    })
  }

  const qcm: QcmResultat[] = []
  const blocs = db.prepare(
    'SELECT DISTINCT chemin, bloc FROM qcm_tentative WHERE utilisateur_id = ? ORDER BY chemin, bloc'
  ).all(uid) as { chemin: string, bloc: string }[]
  const parBloc = db.prepare(
    'SELECT t, justes, total, ratees FROM qcm_tentative WHERE utilisateur_id = ? AND chemin = ? AND bloc = ? ORDER BY t ASC'
  )
  for (const b of blocs) {
    const lignes = parBloc.all(uid, b.chemin, b.bloc) as
      { t: number, justes: number, total: number, ratees: string }[]
    qcm.push({
      chemin: b.chemin,
      bloc: b.bloc,
      tentatives: lignes.map(l => ({
        date: new Date(l.t).toISOString(),
        justes: l.justes,
        total: l.total,
        ratees: JSON.parse(l.ratees) as string[]
      }))
    })
  }

  const todo: TodoResultat[] = listerTodo(db, uid).map(t => ({
    chemin: t.chemin,
    bloc: t.bloc,
    titre: t.titre,
    type: t.type,
    note: t.note,
    fait: !!t.fait_le
  }))

  return {
    format: FORMAT_RESULTATS,
    version: VERSION_RESULTATS,
    exporte_le: new Date().toISOString(),
    fiches,
    qcm,
    todo
  }
})
