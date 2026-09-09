import type { DatabaseSync } from 'node:sqlite'
import type { ResultatsExport } from '../../shared/types/resultats.ts'
import { FORMAT_RESULTATS, VERSION_RESULTATS } from '../../shared/types/resultats.ts'
import { cheminCanonique } from './identites.ts'

export interface RapportImport {
  fiches: { vues: number, ecrites: number }
  questions: { vues: number, inserees: number, dejaPresentes: number, ignorees: number }
  tentatives: { vues: number, inserees: number, dejaPresentes: number }
  /** Détail des entrées qu'on n'a pas su découper, pour ne rien perdre en silence. */
  avertissements: string[]
}

/**
 * Découpe une entrée de `fiches[].questions`.
 *
 * La forme attendue est « bloc#label » : l'export retire le chemin de la fiche,
 * qui figure déjà à côté. Mais il ne le retire que s'il le reconnaît —
 * `id.startsWith(chemin + '#') ? id.slice(…) : id` — si bien qu'une clé écrite
 * avant une normalisation de chemin ressort entière. Le cas n'est pas théorique,
 * et le manquer perdrait des questions sans le dire.
 */
function decouperEntree(entree: string): { bloc: string, label: string } | null {
  let reste = entree
  if (reste.startsWith('/')) {
    // Identité complète : on ne garde que ce qui suit le chemin, c'est-à-dire
    // les deux derniers segments.
    const morceaux = reste.split('#')
    if (morceaux.length < 3) return null
    reste = morceaux.slice(-2).join('#')
  }
  const i = reste.indexOf('#')
  if (i <= 0 || i === reste.length - 1) return null
  return { bloc: reste.slice(0, i), label: reste.slice(i + 1) }
}

/**
 * Verse un export dans la base. C'est une **fusion**, jamais un remplacement :
 * rien n'est supprimé, et rejouer le même fichier n'insère rien.
 *
 * L'export ne porte pas la lettre qui avait été trouvée — seulement la liste des
 * questions réussies. On écrit donc la sentinelle « importe », distincte de
 * « auto ». Elle ne correspond à aucune lettre : aucune proposition ne se
 * rallume, mais la question compte comme trouvée et sa bordure est verte. Aucun
 * composant n'a eu à changer pour ça.
 */
export function importerResultats(
  db: DatabaseSync,
  brut: unknown,
  options: { simulation?: boolean } = {}
): RapportImport {
  const donnees = brut as ResultatsExport | null

  if (!donnees || typeof donnees !== 'object') {
    throw new Error('Fichier illisible : ce n\'est pas un objet JSON.')
  }
  if (donnees.format !== FORMAT_RESULTATS) {
    throw new Error(`Format inattendu : « ${String(donnees.format)} », attendu « ${FORMAT_RESULTATS} ».`)
  }
  if (donnees.version !== VERSION_RESULTATS) {
    throw new Error(`Version inattendue : ${String(donnees.version)}, attendue ${VERSION_RESULTATS}.`)
  }

  const rapport: RapportImport = {
    fiches: { vues: 0, ecrites: 0 },
    questions: { vues: 0, inserees: 0, dejaPresentes: 0, ignorees: 0 },
    tentatives: { vues: 0, inserees: 0, dejaPresentes: 0 },
    avertissements: []
  }

  db.exec('BEGIN')
  try {
    // « maj » ne recule pas : réimporter une archive ne doit pas rétrograder une
    // fiche travaillée depuis.
    const majFiche = db.prepare(`
      INSERT INTO fiche (chemin, total, maj) VALUES (?, ?, ?)
      ON CONFLICT(chemin) DO UPDATE
        SET total = excluded.total, maj = excluded.maj
        WHERE excluded.maj > fiche.maj
    `)
    // « reponse » n'est jamais écrasée : une question déjà trouvée avec sa vraie
    // lettre ne doit pas redevenir « importe ».
    //
    // On interroge avant d'écrire plutôt que de se fier au nombre de lignes
    // modifiées : un `ON CONFLICT DO UPDATE` en compte une même quand la valeur
    // ne bouge pas, et le rapport annoncerait des insertions à chaque rejeu —
    // c'est-à-dire qu'il mentirait exactement là où on l'interroge.
    const existeReussite = db.prepare('SELECT 1 FROM reussite WHERE chemin = ? AND bloc = ? AND label = ?')
    const majReussite = db.prepare(`
      INSERT INTO reussite (chemin, bloc, label, reponse, premiere, maj) VALUES (?, ?, ?, 'importe', ?, ?)
      ON CONFLICT(chemin, bloc, label) DO UPDATE
        SET premiere = MIN(reussite.premiere, excluded.premiere)
    `)
    const majTentative = db.prepare(`
      INSERT INTO qcm_tentative (chemin, bloc, t, justes, total, ratees) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(chemin, bloc, t) DO NOTHING
    `)

    for (const f of donnees.fiches ?? []) {
      if (!f?.chemin) continue
      rapport.fiches.vues += 1
      const chemin = cheminCanonique(f.chemin)
      const maj = Date.parse(f.maj) || Date.now()

      const r = majFiche.run(chemin, f.total ?? 0, maj)
      if (Number(r.changes) > 0) rapport.fiches.ecrites += 1

      // La ligne « fiche » doit exister avant ses réussites : la clé étrangère
      // l'exige, et une fiche dont le « maj » n'a pas été retenu n'a pas été
      // créée par l'appel précédent.
      db.prepare('INSERT INTO fiche (chemin, total, maj) VALUES (?, ?, ?) ON CONFLICT(chemin) DO NOTHING')
        .run(chemin, f.total ?? 0, maj)

      for (const entree of f.questions ?? []) {
        rapport.questions.vues += 1
        const decoupee = decouperEntree(entree)
        if (!decoupee) {
          rapport.questions.ignorees += 1
          rapport.avertissements.push(`entrée illisible sur ${chemin} : « ${entree} »`)
          continue
        }
        const dejaLa = !!existeReussite.get(chemin, decoupee.bloc, decoupee.label)
        majReussite.run(chemin, decoupee.bloc, decoupee.label, maj, maj)
        if (dejaLa) rapport.questions.dejaPresentes += 1
        else rapport.questions.inserees += 1
      }
    }

    for (const q of donnees.qcm ?? []) {
      if (!q?.chemin || !q.bloc) continue
      const chemin = cheminCanonique(q.chemin)
      for (const t of q.tentatives ?? []) {
        rapport.tentatives.vues += 1
        const horodatage = Date.parse(t.date)
        if (!horodatage) {
          rapport.avertissements.push(`date illisible sur ${chemin}#${q.bloc} : « ${t.date} »`)
          continue
        }
        const res = majTentative.run(
          chemin, q.bloc, horodatage, t.justes ?? 0, t.total ?? 0,
          JSON.stringify(Array.isArray(t.ratees) ? t.ratees : [])
        )
        if (Number(res.changes) > 0) rapport.tentatives.inserees += 1
        else rapport.tentatives.dejaPresentes += 1
      }
    }

    db.exec(options.simulation ? 'ROLLBACK' : 'COMMIT')
  } catch (erreur) {
    db.exec('ROLLBACK')
    throw erreur
  }

  return rapport
}
