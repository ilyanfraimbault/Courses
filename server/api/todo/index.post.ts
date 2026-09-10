interface CorpsAjout {
  chemin?: unknown
  bloc?: unknown
  titre?: unknown
  type?: unknown
}

/**
 * Ajoute une cible à la to-do. La cible est soit une fiche entière (`bloc`
 * absent), soit un bloc précis — « Exercice 3 » d'une fiche d'exercices : on ne
 * veut pas être obligé de reprendre toute la fiche pour reprendre un exercice.
 *
 * Idempotent grâce à l'index `todo_cible` : rappeler la route sur une cible déjà
 * présente la renvoie telle quelle, avec un 200 plutôt qu'un 201.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)

  const c = await readBody<CorpsAjout>(event)
  if (typeof c?.chemin !== 'string' || !c.chemin.startsWith('/')) {
    throw createError({ statusCode: 400, statusMessage: 'chemin manquant ou invalide' })
  }
  if (typeof c.titre !== 'string' || !c.titre.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'titre manquant' })
  }

  const chemin = cheminCanonique(c.chemin)
  const bloc = typeof c.bloc === 'string' && c.bloc ? c.bloc : null
  const type = typeof c.type === 'string' && c.type ? c.type : null

  const db = useBase()
  const existant = db.prepare(
    'SELECT id FROM todo WHERE utilisateur_id = ? AND chemin = ? AND COALESCE(bloc, \'\') = COALESCE(?, \'\')'
  ).get(uid, chemin, bloc) as { id: number } | undefined

  if (existant) return lireTodo(db, uid, existant.id)

  const { rang } = db
    .prepare('SELECT COALESCE(MAX(rang), 0) + 1 AS rang FROM todo WHERE utilisateur_id = ?')
    .get(uid) as { rang: number }
  const r = db.prepare(
    'INSERT INTO todo (utilisateur_id, chemin, bloc, titre, type, rang, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(uid, chemin, bloc, c.titre.trim(), type, rang, Date.now())

  setResponseStatus(event, 201)
  return lireTodo(db, uid, Number(r.lastInsertRowid))
})
