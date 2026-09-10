interface CorpsFiche {
  chemin?: unknown
  total?: unknown
  faites?: unknown
}

/**
 * Enregistre la progression d'une fiche, sous forme d'**instantané** et non de
 * delta : le corps décrit l'état complet des questions trouvées, et remplace
 * l'état en base dans une transaction.
 *
 * L'instantané parce qu'il est idempotent — rejouer après un délai dépassé est
 * sans effet de bord, aucun ordre n'est à préserver — et parce qu'il reproduit
 * exactement ce que faisait l'écriture dans le stockage local, y compris
 * l'élagage des questions disparues du contenu, sans quoi le décompte gonflerait
 * sans fin. La charge utile plafonne autour de 4 Ko : la plus grosse fiche du
 * site porte 87 questions.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)

  const corps = await readBody<CorpsFiche>(event)
  if (typeof corps?.chemin !== 'string' || !corps.chemin.startsWith('/')) {
    throw createError({ statusCode: 400, statusMessage: 'chemin manquant ou invalide' })
  }
  if (typeof corps.total !== 'number' || !Number.isInteger(corps.total) || corps.total < 0) {
    throw createError({ statusCode: 400, statusMessage: 'total manquant ou invalide' })
  }
  if (!corps.faites || typeof corps.faites !== 'object' || Array.isArray(corps.faites)) {
    throw createError({ statusCode: 400, statusMessage: 'faites manquant ou invalide' })
  }

  const chemin = cheminCanonique(corps.chemin)
  const maj = Date.now()

  // On découpe avant d'ouvrir la transaction : une identité qui n'appartient pas
  // à la fiche annoncée est un défaut du client, pas une écriture partielle à
  // valider à moitié.
  const retenues: { bloc: string, label: string, reponse: string }[] = []
  for (const [identite, reponse] of Object.entries(corps.faites as Record<string, unknown>)) {
    if (typeof reponse !== 'string' || !reponse) continue
    const decoupee = decouperIdentite(chemin, identite)
    if (!decoupee) {
      throw createError({ statusCode: 400, statusMessage: `identité étrangère à la fiche : ${identite}` })
    }
    retenues.push({ ...decoupee, reponse })
  }

  const db = useBase()
  db.exec('BEGIN')
  try {
    db.prepare(`
      INSERT INTO fiche (utilisateur_id, chemin, total, maj) VALUES (?, ?, ?, ?)
      ON CONFLICT(utilisateur_id, chemin) DO UPDATE SET total = excluded.total, maj = excluded.maj
    `).run(uid, chemin, corps.total, maj)

    // Élagage : ce que l'instantané ne mentionne plus a disparu du contenu ou a
    // été annulé par une auto-évaluation.
    if (retenues.length) {
      const conditions = retenues.map(() => '(bloc = ? AND label = ?)').join(' OR ')
      db.prepare(`DELETE FROM reussite WHERE utilisateur_id = ? AND chemin = ? AND NOT (${conditions})`)
        .run(uid, chemin, ...retenues.flatMap(r => [r.bloc, r.label]))
    } else {
      db.prepare('DELETE FROM reussite WHERE utilisateur_id = ? AND chemin = ?').run(uid, chemin)
    }

    const inserer = db.prepare(`
      INSERT INTO reussite (utilisateur_id, chemin, bloc, label, reponse, premiere, maj)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(utilisateur_id, chemin, bloc, label) DO UPDATE
        SET reponse = excluded.reponse,
            premiere = MIN(reussite.premiere, excluded.premiere),
            maj = excluded.maj
    `)
    for (const r of retenues) inserer.run(uid, chemin, r.bloc, r.label, r.reponse, maj, maj)

    db.exec('COMMIT')
  } catch (erreur) {
    db.exec('ROLLBACK')
    throw erreur
  }

  return { maj }
})
