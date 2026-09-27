import type { Revisions, RevisionsMatiere } from '~~/shared/types/revisions'
import { jourDe, fuseauValide } from '~~/shared/utils/jours'

/**
 * Ce qui revient aujourd'hui, matière par matière.
 *
 * Seules les questions que le quiz sait poser comptent : une révision se fait
 * en séance, et annoncer « 12 à revoir » dont trois questions ouvertes ferait
 * une séance plus courte que promis. Les matières ne se mélangent pas — une
 * séance de révisions reste dans la sienne, comme toute séance.
 *
 * `?fuseau=` : « aujourd'hui » et « demain » se comptent chez l'élève.
 */
export default defineEventHandler(async (event): Promise<Revisions> => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  const banque = await chargerBanque(event)
  const moment = maintenantPour(event)
  const fuseau = fuseauValide(getQuery(event).fuseau)
  const finDemain = moment.fin + 24 * 60 * 60 * 1000

  const etats = etatsRevision(db, uid, banque)
  const enDette = questionsEnDette(db, uid)

  const parMatiere = new Map<string, RevisionsMatiere & { prochaineT: number }>()
  for (const e of banque.interrogeables) {
    if (!e.matiere) continue
    const meta = banque.matieres.get(e.matiere)
    const m = parMatiere.get(e.matiere) ?? {
      cle: e.matiere,
      titre: meta?.titre ?? e.matiere,
      annee: meta?.annee ?? null,
      icone: meta?.icone ?? null,
      aRevoir: 0,
      demain: 0,
      suivies: 0,
      enDette: 0,
      prochaine: null,
      prochaineT: Number.POSITIVE_INFINITY
    }
    parMatiere.set(e.matiere, m)
    if (enDette.has(e.id)) m.enDette += 1
    const etat = etats.get(e.id)
    if (!etat) continue
    m.suivies += 1
    if (etat.echeance < moment.fin) m.aRevoir += 1
    else if (etat.echeance < finDemain) m.demain += 1
    else m.prochaineT = Math.min(m.prochaineT, etat.echeance)
  }

  const matieres = [...parMatiere.values()]
    .map(({ prochaineT, ...m }) => ({
      ...m,
      prochaine: m.aRevoir || m.demain || !Number.isFinite(prochaineT) ? null : jourDe(prochaineT, fuseau)
    }))
    .sort((a, b) => {
      const ma = banque.matieres.get(a.cle)
      const mb = banque.matieres.get(b.cle)
      return (ma?.anneeChemin ?? '').localeCompare(mb?.anneeChemin ?? '')
        || (ma?.ordre ?? 999) - (mb?.ordre ?? 999)
        || a.titre.localeCompare(b.titre, 'fr')
    })

  return { matieres, aujourdhui: moment.aujourdhui }
})
