interface CorpsQcm {
  titre?: unknown
  matiere?: unknown
  questions?: unknown
}

/**
 * Compose un QCM : un titre, une matière, et des questions choisies dans les
 * fiches.
 *
 * Tout est vérifié ici, pas au client. Une identité inconnue du contenu, une
 * question que le quiz ne saurait pas corriger — une question ouverte, qui
 * s'auto-évalue — ou une question d'une autre matière sont refusées : un QCM
 * composé ne mélange pas deux cours, et il doit pouvoir se corriger tout seul.
 * L'ordre reçu est celui du QCM, les doublons sont écartés.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)
  const corps = await readBody<CorpsQcm>(event)

  const titre = titreValide(corps?.titre)
  const banque = await chargerBanque(event)

  const matiere = typeof corps?.matiere === 'string' ? corps.matiere : ''
  if (!banque.matieres.has(matiere)) {
    throw createError({ statusCode: 400, statusMessage: 'matière inconnue' })
  }

  const identites = Array.isArray(corps?.questions)
    ? [...new Set(corps.questions.filter((q): q is string => typeof q === 'string' && !!q))]
    : []
  if (identites.length < QCM_MIN || identites.length > QCM_MAX) {
    throw createError({ statusCode: 400, statusMessage: `entre ${QCM_MIN} et ${QCM_MAX} questions` })
  }

  const parId = new Map(banque.interrogeables.map(e => [e.id, e]))
  const refusees = identites.filter(id => parId.get(id)?.matiere !== matiere)
  if (refusees.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `${refusees.length} question${refusees.length > 1 ? 's' : ''} inconnue${refusees.length > 1 ? 's' : ''} ou hors de la matière`
    })
  }

  const maintenant = Date.now()
  const resultat = useBase().prepare(`
    INSERT INTO qcm_compose (utilisateur_id, titre, matiere, questions, cree_le, maj)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uid, titre, matiere, JSON.stringify(identites), maintenant, maintenant)

  setResponseStatus(event, 201)
  return { id: Number(resultat.lastInsertRowid) }
})
