import type { DatabaseSync } from 'node:sqlite'
import type { RangCandidat } from './quiz-banque.ts'

/**
 * Le rang de chaque candidat au tirage, du plus urgent au moins utile.
 *
 * C'est ce qui empêche une banque de plusieurs centaines de questions de
 * reposer avant-hier ce qu'on a vu hier. Quatre paliers :
 *
 * 0. **en dette** — ratée quelque part et pas encore retrouvée depuis ;
 * 1. **jamais posée au quiz** — du neuf, tant qu'il en reste ;
 * 2. **posée il y a plus de deux semaines** — le temps d'oublier ;
 * 3. **posée récemment** — en dernier recours, faute de mieux dans la sélection.
 *
 * Le tri n'a lieu qu'**à l'intérieur** d'un point de cours : l'étalement du
 * tirage sur les chapitres et les notions reste premier, sans quoi une séance
 * de vingt questions se réduirait aux vingt dettes du même chapitre.
 *
 * Il sert deux tirages : celui d'une séance de quiz, et celui qui propose des
 * questions à qui compose un QCM. Les deux veulent la même chose — ce qui n'est
 * pas su d'abord —, d'où un seul endroit.
 */
export function rangDuTirage(db: DatabaseSync, uid: number, enDette: Set<string>): RangCandidat {
  const vues = new Map<string, number>()
  const lignes = db.prepare(`
    SELECT r.question AS question, MAX(r.t) AS t
    FROM quiz_reponse r
    JOIN quiz_session s ON s.id = r.session_id
    WHERE s.utilisateur_id = ?
    GROUP BY r.question
  `).all(uid) as unknown as { question: string, t: number }[]
  for (const l of lignes) vues.set(l.question, l.t)

  const maintenant = Date.now()
  return (entree) => {
    if (enDette.has(entree.id)) return 0
    const vue = vues.get(entree.id)
    if (vue === undefined) return 1
    return maintenant - vue > REPOS ? 2 : 3
  }
}
