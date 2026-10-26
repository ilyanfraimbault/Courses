interface CorpsFiche {
  chemin?: unknown
  total?: unknown
  faites?: unknown
  questions?: unknown
  annulees?: unknown
}

/**
 * Enregistre la progression d'une fiche, sous forme d'**instantané** et non de
 * delta : le corps décrit l'état des questions trouvées tel que la page le
 * connaît, et l'écrit en base dans une transaction.
 *
 * L'instantané parce qu'il est idempotent — rejouer après un délai dépassé est
 * sans effet de bord, aucun ordre n'est à préserver. La charge utile plafonne
 * autour de 8 Ko : la plus grosse fiche du site porte 87 questions.
 *
 * Mais une page ne connaît que ce qu'elle a lu à son montage. Un onglet resté
 * ouvert sur un autre appareil ignore tout ce qui a été trouvé depuis, et son
 * instantané, s'il remplaçait l'état en base, l'effacerait : c'est ainsi que
 * vingt-six réponses d'une feuille ont disparu d'un clic. On n'efface donc
 * jamais une réussite au seul motif que l'instantané ne la mentionne pas ; on
 * efface ce que la page dit avoir retiré (`annulees`, une auto-évaluation
 * dédite), et ce qu'elle ne déclare plus du tout (`questions`), l'élagage des
 * questions disparues du contenu sans lequel le décompte gonflerait sans fin.
 * Un corps qui ne porte pas ces listes — un onglet chargé avant cette règle —
 * n'efface rien.
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
  const questions = listeIdentites(chemin, corps.questions, 'questions')
  const annulees = listeIdentites(chemin, corps.annulees, 'annulees')
    .filter(a => !retenues.some(r => r.bloc === a.bloc && r.label === a.label))

  const db = useBase()
  db.exec('BEGIN')
  try {
    db.prepare(`
      INSERT INTO fiche (utilisateur_id, chemin, total, maj) VALUES (?, ?, ?, ?)
      ON CONFLICT(utilisateur_id, chemin) DO UPDATE SET total = excluded.total, maj = excluded.maj
    `).run(uid, chemin, corps.total, maj)

    // Élagage : ce que la page ne déclare plus a disparu du contenu. Une liste
    // vide ne veut rien dire — une page sans question n'écrit pas — et ne doit
    // surtout pas valoir « tout a disparu ».
    if (questions.length) {
      const conditions = questions.map(() => '(bloc = ? AND label = ?)').join(' OR ')
      db.prepare(`DELETE FROM reussite WHERE utilisateur_id = ? AND chemin = ? AND NOT (${conditions})`)
        .run(uid, chemin, ...questions.flatMap(q => [q.bloc, q.label]))
    }
    const retirer = db.prepare('DELETE FROM reussite WHERE utilisateur_id = ? AND chemin = ? AND bloc = ? AND label = ?')
    for (const a of annulees) retirer.run(uid, chemin, a.bloc, a.label)

    const inserer = db.prepare(`
      INSERT INTO reussite (utilisateur_id, chemin, bloc, label, reponse, premiere, maj)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(utilisateur_id, chemin, bloc, label) DO UPDATE
        SET reponse = excluded.reponse,
            premiere = MIN(reussite.premiere, excluded.premiere),
            maj = excluded.maj
    `)
    for (const r of retenues) inserer.run(uid, chemin, r.bloc, r.label, r.reponse, maj, maj)

    // Retrouver une question éteint la dette qu'elle avait laissée — d'un
    // exercice, d'un QCM ou d'une séance de quiz, peu importe où la faute a été
    // faite. L'instantané est rejoué à chaque visite, mais `rattraperFautes` ne
    // touche que ce qui est encore en dette : les visites suivantes n'écrivent
    // rien et ne rajeunissent aucune date.
    rattraperFautes(db, uid, retenues.map(r => ({ chemin, bloc: r.bloc, label: r.label })), maj)

    db.exec('COMMIT')
  } catch (erreur) {
    db.exec('ROLLBACK')
    throw erreur
  }

  return { maj }
})

/**
 * Une liste d'identités de la fiche, découpée. Absente, elle vaut vide — c'est
 * le corps d'un client antérieur, qui n'efface donc rien ; mal formée ou
 * étrangère à la fiche, c'est un défaut du client, refusé comme pour `faites`.
 */
function listeIdentites(chemin: string, valeur: unknown, nom: string) {
  if (valeur === undefined) return []
  if (!Array.isArray(valeur)) {
    throw createError({ statusCode: 400, statusMessage: `${nom} invalide` })
  }
  return valeur.map((identite) => {
    const decoupee = typeof identite === 'string' ? decouperIdentite(chemin, identite) : null
    if (!decoupee) {
      throw createError({ statusCode: 400, statusMessage: `identité étrangère à la fiche : ${String(identite)}` })
    }
    return decoupee
  })
}
