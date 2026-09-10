import type { CorrectionQuiz, SessionQuiz } from '~~/shared/types/quiz'

interface CorpsReponse {
  position?: unknown
  lettre?: unknown
}

/**
 * Corrige une réponse, puis fait avancer la file.
 *
 * C'est le cœur du mode : **une faute n'est pas une punition, c'est une dette**.
 * La place ratée retourne à la fin de la file, mais avec une *autre* question du
 * même point de cours — réciter la réponse qu'on vient de lire ne prouverait
 * rien, et revoir la même formulation deux fois n'apprend qu'à la reconnaître.
 * La séance ne se termine donc que lorsque toutes les places ont fini par
 * tomber juste, ce qui peut demander plus de questions qu'on n'en a demandé.
 *
 * La correction complète part avec le verdict, dans la même réponse : la seule
 * chose qui compte après une faute, c'est de comprendre tout de suite, pas
 * d'attendre un second aller-retour.
 *
 * Une question gagnée est en outre reportée sur sa fiche, dans la même
 * transaction que la file : les deux décrivent le même événement, et n'en
 * enregistrer qu'un laisserait une question réussie invisible dans son
 * exercice. Voir `reporterSurLaFiche`.
 *
 * La même transaction tient la **dette** : une faute inscrit la question dans
 * `faute`, une bonne réponse l'éteint. C'est ce qui donne son contenu à la
 * sélection « ce que j'ai raté », et c'est symétrique du report sur la fiche —
 * un quiz réussi solde ce qui avait été raté dans un exercice, et
 * réciproquement.
 */
export default defineEventHandler(async (event): Promise<{ correction: CorrectionQuiz, session: SessionQuiz }> => {
  const uid = await idUtilisateur(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'identifiant de séance invalide' })
  }

  const corps = await readBody<CorpsReponse>(event)
  const position = Number(corps?.position)
  const lettre = typeof corps?.lettre === 'string' ? corps.lettre : null
  if (!Number.isInteger(position) || position < 0 || !lettre) {
    throw createError({ statusCode: 400, statusMessage: 'position et lettre sont requises' })
  }

  const db = useBase()
  const trouvee = lireSession(db, uid, id)
  if (!trouvee) throw createError({ statusCode: 404, statusMessage: 'séance introuvable' })

  const { ligne, etat } = trouvee
  if (ligne.finie_le !== null) {
    throw createError({ statusCode: 409, statusMessage: 'cette séance est close' })
  }

  // Répondre ailleurs qu'à la question en cours, c'est un onglet resté ouvert ou
  // un double clic : on ne corrige rien, on renvoie l'état pour qu'il se remette
  // d'accord avec le serveur.
  if (position !== etat.position) {
    throw createError({
      statusCode: 409,
      statusMessage: 'la séance a avancé depuis cette question',
      data: { session: publier(ligne, etat) }
    })
  }

  const entree = etat.entrees[position]
  if (!entree) throw createError({ statusCode: 409, statusMessage: 'cette séance est close' })

  const banque = await chargerBanque(event)
  const candidate = trouverEntree(banque, entree.question)
  const posee = candidate
    ? await poserQuestion(event, banque, candidate, position, !!entree.rejouee, `${id}:${position}`)
    : null
  if (!candidate || !posee) {
    // La question a disparu du contenu depuis le tirage : on retire la place
    // plutôt que de bloquer la séance sur une question qui n'existe plus.
    etat.entrees.splice(position, 1)
    const maj = Date.now()
    ecrireEtat(db, ligne, etat, maj)
    throw createError({
      statusCode: 409,
      statusMessage: 'cette question n\'existe plus dans le contenu',
      data: { session: publier(ligne, etat) }
    })
  }

  if (!posee.lue.lettres.includes(lettre)) {
    throw createError({ statusCode: 400, statusMessage: 'cette proposition n\'existe pas' })
  }

  const juste = lettre === posee.lue.bonne
  entree.etat = juste ? 'juste' : 'manquee'
  entree.reponse = lettre

  ligne.poses += 1
  if (juste) ligne.justes += 1
  else ligne.fautes += 1

  let reprise: CorrectionQuiz['reprise'] = null
  if (!juste) {
    // Tout ce qui est déjà dans la file est exclu : c'est la promesse « on ne
    // voit jamais deux fois la même question ». Elle ne peut être rompue que
    // lorsque le filtre est épuisé, et le client le dit alors franchement.
    const dejaVues = new Set(etat.entrees.map(e => e.question))
    // La dette est relue ici et non au tirage : une séance « ce que j'ai raté »
    // ouverte il y a une heure ne doit pas piocher sa reprise dans la dette
    // d'alors, et sans elle le filtre ne rendrait aucun candidat.
    const candidats = filtrer(banque.entrees, lireFiltre(ligne.filtre), questionsEnDette(db, uid))
    const similaire = choisirSimilaire(candidats, candidate, dejaVues)
    etat.entrees.push({
      question: similaire.entree.id,
      place: entree.place,
      etat: 'attente',
      rejouee: similaire.rejouee
    })
    reprise = { notionTitre: similaire.entree.notionTitre, rejouee: similaire.rejouee }
  }

  etat.position = position + 1

  const maj = Date.now()
  db.exec('BEGIN')
  try {
    ecrireEtat(db, ligne, etat, maj)
    db.prepare(`
      INSERT INTO quiz_reponse (session_id, ordre, question, theme, notion, section, juste, t)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, ordre) DO NOTHING
    `).run(ligne.id, position, candidate.id, candidate.theme, candidate.notionCle, candidate.section, juste ? 1 : 0, maj)
    const cible = [{ chemin: candidate.chemin, bloc: candidate.bloc, label: candidate.label }]
    if (juste) {
      reporterSurLaFiche(db, uid, candidate, lettre, maj)
      rattraperFautes(db, uid, cible, maj)
    } else {
      enregistrerFautes(db, uid, cible, maj)
    }
    db.exec('COMMIT')
  } catch (erreur) {
    db.exec('ROLLBACK')
    throw erreur
  }

  return {
    correction: {
      juste,
      bonne: posee.lue.bonne,
      donnee: lettre,
      indice: posee.lue.indice,
      solution: posee.lue.solution,
      extrait: posee.lue.extrait,
      reprise
    },
    session: publier(ligne, etat)
  }
})
