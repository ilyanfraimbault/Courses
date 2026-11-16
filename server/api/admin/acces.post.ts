interface CorpsDecision {
  id?: unknown
  decision?: unknown
}

/**
 * Accorder ou refuser l'accès d'un compte.
 *
 * Refuser **supprime** le compte : il n'a jamais rien pu écrire, il n'y a donc
 * rien à perdre, et son pseudo redevient libre. Garder une ligne « refusé »
 * laisserait les comptes de robots s'empiler sous la limite de l'inscription.
 *
 * Les deux ne touchent qu'un compte **sans** accès : cette route ne retire
 * l'accès à personne et ne supprime aucun compte qui a des données. La règle
 * est dans la clause `WHERE`, pas dans l'interface.
 */
export default defineEventHandler(async (event) => {
  await exigerAdministrateur(event)

  const corps = await readBody<CorpsDecision>(event)
  const id = corps?.id
  const decision = corps?.decision
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0 || (decision !== 'accorder' && decision !== 'refuser')) {
    throw createError({ statusCode: 400, statusMessage: 'Décision invalide' })
  }

  const db = useBase()
  const r = decision === 'accorder'
    ? db.prepare('UPDATE utilisateur SET acces = \'accorde\' WHERE id = ? AND acces != \'accorde\'').run(id)
    : db.prepare('DELETE FROM utilisateur WHERE id = ? AND acces != \'accorde\'').run(id)

  if (!r.changes) {
    throw createError({ statusCode: 404, statusMessage: 'Aucune demande pour ce compte' })
  }

  return { ok: true }
})
