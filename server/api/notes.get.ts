import type { MesNotes, SemestreNote, UeNotee } from '~~/shared/types/matieres'
import { estParcours } from '~~/shared/types/matieres'

/**
 * Le tableau des moyennes : le programme, semestre par semestre, avec la note
 * que le compte a saisie dans chaque matière. Les UE de l'autre parcours n'y
 * sont pas. Les moyennes d'UE et de semestre ne sont pas calculées ici : la
 * page les recalcule à chaque frappe, avec la même fonction
 * (`shared/utils/moyennes.ts`).
 */
interface LigneNote {
  semestre: number
  ue_code: string
  ue_intitule: string
  ects: number
  parcours: string | null
  ue_ordre: number
  id: number
  code: string
  intitule: string
  coef: number | null
  heures: number | null
  note: number | null
}

export default defineEventHandler(async (event): Promise<MesNotes> => {
  const uid = await idUtilisateur(event)
  const db = useBase()
  const parcours = parcoursDuCompte(db, uid)
  const voir = visiblePour(parcours)

  const lignes = db.prepare(`
    SELECT u.semestre, u.code AS ue_code, u.intitule AS ue_intitule, u.ects, u.parcours, u.ordre AS ue_ordre,
           m.id, m.code, m.intitule, m.coef, m.heures, n.valeur AS note
    FROM ue u
    JOIN matiere m ON m.ue_id = u.id
    LEFT JOIN note n ON n.matiere_id = m.id AND n.utilisateur_id = ?
    ORDER BY u.semestre, u.ordre, m.ordre, m.id
  `).all(uid) as unknown as LigneNote[]

  const semestres = new Map<number, SemestreNote & { parUe: Map<number, UeNotee> }>()
  for (const l of lignes) {
    const p = estParcours(l.parcours) ? l.parcours : null
    if (!voir({ parcours: p })) continue
    const s = semestres.get(l.semestre) ?? { semestre: l.semestre, ues: [] as UeNotee[], parUe: new Map<number, UeNotee>() }
    semestres.set(l.semestre, s)
    let ue = s.parUe.get(l.ue_ordre)
    if (!ue) {
      ue = { code: l.ue_code, intitule: l.ue_intitule, ects: l.ects, parcours: p, matieres: [] }
      s.parUe.set(l.ue_ordre, ue)
      s.ues.push(ue)
    }
    ue.matieres.push({ id: l.id, code: l.code, intitule: l.intitule, coef: l.coef, heures: l.heures, note: l.note })
  }

  return { parcours, semestres: [...semestres.values()].map(({ parUe: _, ...s }) => s) }
})
