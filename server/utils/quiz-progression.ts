import type { DatabaseSync } from 'node:sqlite'
import type { EntreeBanque } from './quiz-banque.ts'

/**
 * Reporte sur sa fiche une question gagnée au quiz.
 *
 * Une question trouvée est une question trouvée : la retrouver dans son
 * exercice cochée en vert est ce qu'on attend, et devoir la refaire sur la
 * fiche pour qu'elle compte serait une punition sans objet.
 *
 * Le report ne peut pas passer par `PUT /api/fiche`, qui écrit un **instantané**
 * de la fiche entière : le quiz, qui n'a pas ouvert la page, n'en connaît ni le
 * total ni les autres questions, et son instantané effacerait tout le reste.
 * On écrit donc la seule ligne concernée, ici, côté serveur.
 *
 * Trois précautions, chacune pour une raison précise.
 *
 * **Le dénominateur vient du contenu.** `reussite` référence `fiche`, qui doit
 * donc exister. Si le quiz est le premier à écrire pour cette fiche, on la crée
 * avec le nombre de questions compté au build — pas avec zéro, qui ferait
 * afficher « 1 / 0 » au tableau de bord.
 *
 * **Une fiche déjà connue garde son total.** C'est la page qui fait foi : elle
 * le réécrit à chaque visite, et le quiz n'a pas à trancher entre les deux.
 *
 * **Une question déjà trouvée garde sa réponse.** Même principe qu'à l'import :
 * la lettre gagnée sur la fiche ne se fait pas remplacer, et `premiere` retient
 * la plus ancienne des deux dates.
 *
 * L'inverse n'existe pas : une faute au quiz n'efface jamais rien. C'est le
 * même contrat que le QCM, qui écrit ce qu'il réussit sans jamais relire cette
 * mémoire — sans quoi une séance arriverait pré-remplie.
 */
export function reporterSurLaFiche(
  db: DatabaseSync,
  uid: number,
  entree: EntreeBanque,
  lettre: string,
  maj: number
) {
  db.prepare(`
    INSERT INTO fiche (utilisateur_id, chemin, total, maj) VALUES (?, ?, ?, ?)
    ON CONFLICT(utilisateur_id, chemin) DO UPDATE SET maj = excluded.maj
  `).run(uid, entree.chemin, entree.ficheQuestions, maj)

  db.prepare(`
    INSERT INTO reussite (utilisateur_id, chemin, bloc, label, reponse, premiere, maj)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(utilisateur_id, chemin, bloc, label) DO UPDATE
      SET premiere = MIN(reussite.premiere, excluded.premiere),
          maj = excluded.maj
  `).run(uid, entree.chemin, entree.bloc, entree.label, lettre, maj, maj)
}

/**
 * Les identités « /chemin#bloc#label » trouvées un jour, où que ce soit.
 *
 * Le quiz ne s'en sert pas pour composer sa file — il repose volontiers une
 * question déjà trouvée, et une séance n'arrive jamais pré-remplie. Elle ne sert
 * qu'à **choisir** quand on le demande : la séance du jour d'un contrôle veut ce
 * qui reste à apprendre, pas ce qui est su.
 */
export function questionsTrouvees(db: DatabaseSync, uid: number): Set<string> {
  const lignes = db.prepare(`
    SELECT chemin, bloc, label FROM reussite WHERE utilisateur_id = ?
  `).all(uid) as unknown as { chemin: string, bloc: string, label: string }[]
  return new Set(lignes.map(l => composerIdentite(l.chemin, l.bloc, l.label)))
}
