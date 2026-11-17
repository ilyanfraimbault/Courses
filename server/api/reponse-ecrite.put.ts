interface CorpsReponseEcrite {
  chemin?: unknown
  question?: unknown
  texte?: unknown
}

/**
 * La plus longue solution du site — les fonctions de la liste déroulée du TP 1
 * — tient en 3 000 caractères. Le plafond garde aussi l'envoi `keepalive` du
 * départ de page loin des 64 Ko que le navigateur partage avec l'instantané de
 * progression.
 */
const MAX_TEXTE = 20_000

/** Une identité de fiche ne dépasse pas quelques dizaines de caractères. */
const MAX_REPERE = 200

/**
 * Le site porte quelques dizaines de questions à écrire. Le plafond empêche
 * seulement qu'un compte se serve de la route comme d'un entrepôt.
 */
const MAX_REPONSES = 2_000

/**
 * Enregistre le code qu'un élève a écrit sous **une** question.
 *
 * Ce n'est pas un instantané de la fiche, et c'est délibéré : `PUT /api/fiche`
 * décrit les questions trouvées, et y faire voyager les textes obligerait la
 * page à renvoyer tous ses brouillons à chaque réponse — un onglet périmé
 * écraserait alors ceux écrits ailleurs depuis. Ici, chaque envoi ne touche
 * que la question qui l'a produit : rejouer est sans effet, et le pire qu'un
 * onglet ancien puisse faire est de remplacer **ce** texte par une version plus
 * ancienne qu'il était en train de taper.
 *
 * Un texte vide efface la ligne : le client n'en envoie un que si l'élève a
 * lui-même vidé son éditeur.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)

  const corps = await readBody<CorpsReponseEcrite>(event)
  if (typeof corps?.chemin !== 'string' || !corps.chemin.startsWith('/') || corps.chemin.length > MAX_REPERE) {
    throw createError({ statusCode: 400, statusMessage: 'chemin manquant ou invalide' })
  }
  if (typeof corps.question !== 'string' || corps.question.length > 2 * MAX_REPERE) {
    throw createError({ statusCode: 400, statusMessage: 'question manquante ou invalide' })
  }
  if (typeof corps.texte !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'texte manquant ou invalide' })
  }
  if (corps.texte.length > MAX_TEXTE) {
    throw createError({ statusCode: 413, statusMessage: 'texte trop long' })
  }

  const chemin = cheminCanonique(corps.chemin)
  const decoupee = decouperIdentite(chemin, corps.question)
  if (!decoupee) {
    throw createError({ statusCode: 400, statusMessage: `identité étrangère à la fiche : ${corps.question}` })
  }
  const { bloc, label } = decoupee

  const db = useBase()
  if (!corps.texte.trim()) {
    db.prepare('DELETE FROM reponse_ecrite WHERE utilisateur_id = ? AND chemin = ? AND bloc = ? AND label = ?')
      .run(uid, chemin, bloc, label)
    return { maj: Date.now() }
  }

  const existe = db.prepare('SELECT 1 FROM reponse_ecrite WHERE utilisateur_id = ? AND chemin = ? AND bloc = ? AND label = ?')
    .get(uid, chemin, bloc, label)
  if (!existe) {
    const { n } = db.prepare('SELECT count(*) AS n FROM reponse_ecrite WHERE utilisateur_id = ?').get(uid) as { n: number }
    if (n >= MAX_REPONSES) {
      throw createError({ statusCode: 409, statusMessage: 'trop de réponses écrites sur ce compte' })
    }
  }

  const maj = Date.now()
  db.prepare(`
    INSERT INTO reponse_ecrite (utilisateur_id, chemin, bloc, label, texte, maj) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(utilisateur_id, chemin, bloc, label) DO UPDATE SET texte = excluded.texte, maj = excluded.maj
  `).run(uid, chemin, bloc, label, corps.texte, maj)
  return { maj }
})
