import type { DatabaseSync } from 'node:sqlite'
import type { TodoItem } from '~~/shared/types/resultats'

/**
 * Les items de la to-do, dans l'ordre choisi.
 *
 * `reussies` est calculé ici : un item qui vise un bloc compte les questions
 * trouvées de ce bloc, un item qui vise la fiche entière compte les siennes. Le
 * **dénominateur**, lui, ne vient pas du serveur — il vient du comptage fait au
 * build, que le client joint. Le serveur ne connaît pas le contenu, et c'est
 * très bien : le contenu est versionné, son compte est déjà calculé.
 */
export function listerTodo(db: DatabaseSync, uid: number): TodoItem[] {
  const lignes = db.prepare(`
    SELECT t.id, t.chemin, t.bloc, t.titre, t.type, t.note, t.fait_le, t.cree_le,
           (
             SELECT COUNT(*) FROM reussite r
             WHERE r.utilisateur_id = t.utilisateur_id
               AND r.chemin = t.chemin
               AND (t.bloc IS NULL OR r.bloc = t.bloc)
           ) AS reussies
    FROM todo t
    WHERE t.utilisateur_id = ?
    ORDER BY t.rang ASC, t.id ASC
  `).all(uid)

  // On recopie champ par champ plutôt que de forcer le type : `node:sqlite`
  // rend des `Record<string, SQLOutputValue>`, et une assertion masquerait une
  // colonne renommée au lieu de la faire remarquer.
  return lignes.map(l => ({
    id: Number(l.id),
    chemin: String(l.chemin),
    bloc: l.bloc === null ? null : String(l.bloc),
    titre: String(l.titre),
    type: l.type === null ? null : String(l.type),
    note: l.note === null ? null : String(l.note),
    fait_le: l.fait_le === null ? null : Number(l.fait_le),
    cree_le: Number(l.cree_le),
    reussies: Number(l.reussies)
  }))
}

export function lireTodo(db: DatabaseSync, uid: number, id: number): TodoItem | undefined {
  return listerTodo(db, uid).find(t => t.id === id)
}
