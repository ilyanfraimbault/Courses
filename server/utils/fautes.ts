import type { DatabaseSync } from 'node:sqlite'

/**
 * La mémoire des fautes : ce qu'on a raté, où, et si on l'a retrouvé depuis.
 *
 * Le site ne retenait jusqu'ici que ce qui était **trouvé**. Une faute
 * d'exercice mourait dans le navigateur, une faute de QCM ne survivait que dans
 * le résumé d'une copie, et le quiz ne savait rien de ce qui s'était passé
 * ailleurs. « M'interroger sur ce que j'ai raté » ne pouvait donc pas exister.
 *
 * Une faute est un **événement**, pas un état : on l'ajoute, on ne la
 * réécrit pas. C'est l'inverse de la progression d'une fiche, qui s'écrit par
 * instantané — et c'est pour cette raison que les fautes ne voyagent pas dans
 * le corps de `PUT /api/fiche`, qui effacerait ce que la page ne connaît pas.
 *
 * Une bonne réponse **éteint** la dette au lieu d'effacer la ligne : le compte
 * des fautes reste, et distingue l'étourderie d'une notion qui ne passe pas.
 * Une nouvelle faute rouvre la dette.
 */
export interface CibleFaute {
  chemin: string
  bloc: string
  label: string
}

/**
 * Enregistre des fautes. Idempotent au sens qui compte : rejouer l'appel
 * incrémente le compte, ce qui est la vérité — la question a bien été ratée
 * deux fois — et ne peut rien casser.
 */
export function enregistrerFautes(db: DatabaseSync, uid: number, cibles: CibleFaute[], t: number) {
  if (!cibles.length) return
  const requete = db.prepare(`
    INSERT INTO faute (utilisateur_id, chemin, bloc, label, compte, derniere, rattrapee)
    VALUES (?, ?, ?, ?, 1, ?, NULL)
    ON CONFLICT(utilisateur_id, chemin, bloc, label) DO UPDATE
      SET compte = faute.compte + 1,
          derniere = excluded.derniere,
          rattrapee = NULL
  `)
  for (const c of cibles) requete.run(uid, c.chemin, c.bloc, c.label, t)
}

/**
 * Éteint la dette des questions retrouvées.
 *
 * On ne touche qu'aux lignes encore en dette : repasser sur une question déjà
 * rattrapée ne doit pas rajeunir sa date, sans quoi « rattrapée le » finirait
 * par dire « à la dernière visite de la page » pour tout le monde.
 */
export function rattraperFautes(db: DatabaseSync, uid: number, cibles: CibleFaute[], t: number) {
  if (!cibles.length) return
  const requete = db.prepare(`
    UPDATE faute SET rattrapee = ?
    WHERE utilisateur_id = ? AND chemin = ? AND bloc = ? AND label = ? AND rattrapee IS NULL
  `)
  for (const c of cibles) requete.run(t, uid, c.chemin, c.bloc, c.label)
}

/**
 * Les identités « /chemin#bloc#label » encore en dette.
 *
 * Un `Set` plutôt qu'une requête par question : le quiz s'en sert pour compter
 * le catalogue chapitre par chapitre et pour trier les candidats au tirage,
 * soit quatre cent trente-deux appartenances à décider d'un coup. La dette
 * d'un compte se compte en dizaines de lignes, elle tient sans peine en
 * mémoire.
 */
export function questionsEnDette(db: DatabaseSync, uid: number): Set<string> {
  const lignes = db.prepare(`
    SELECT chemin, bloc, label FROM faute WHERE utilisateur_id = ? AND rattrapee IS NULL
  `).all(uid) as unknown as CibleFaute[]
  return new Set(lignes.map(l => composerIdentite(l.chemin, l.bloc, l.label)))
}
