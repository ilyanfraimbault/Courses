import type { ChapitreProgression, DomaineProgression, ProgressionDomaines } from '~~/shared/types/domaines'

/** Le tas des questions qui ne renvoient à aucun rappel de cours. */
const SANS_RENVOI = 'Sans renvoi au cours'

interface Cumul {
  cle: string | null
  titre: string
  questions: number
  acquises: number
  hesitantes: number
  interrogeables: number
}

/**
 * La progression rangée par domaine, en une requête.
 *
 * Le croisement a lieu **ici** et non au client, pour la même raison que le
 * reste : la table de correspondance question → point de cours est le relevé du
 * build, qui vit côté serveur et pèse quatre-vingts kilo-octets. L'envoyer au
 * navigateur pour qu'il fasse la jointure lui-même coûterait mille fois la
 * réponse — une centaine de lignes, quelques kilo-octets.
 *
 * Trois lectures suffisent, et aucune ne dépend des deux autres :
 *
 * - `reussite` dit ce qui est **acquis**. C'est la même mémoire que les fiches
 *   et que le report du quiz : une question trouvée est une question trouvée,
 *   quel que soit l'écran où elle l'a été.
 * - `quiz_reponse` et `qcm_tentative` disent ce qui a **coûté une faute**. Une
 *   question finalement trouvée mais ratée en chemin reste acquise ; elle
 *   s'affiche seulement d'une autre couleur, parce que « je l'ai eue » et « je
 *   l'ai eue au deuxième essai » ne se révisent pas pareil.
 *
 * L'inverse n'est pas mesurable : une question ratée sur une fiche puis reprise
 * dans la foulée ne laisse aucune trace — la progression d'une fiche s'écrit par
 * instantané de ce qui est trouvé, pas par historique. C'est assumé : le compte
 * des hésitantes est un plancher, jamais un total.
 */
export default defineEventHandler(async (event): Promise<ProgressionDomaines> => {
  const uid = await idUtilisateur(event)
  const banque = await chargerBanque(event)
  const db = useBase()

  const acquises = new Set(
    (db.prepare(`
      SELECT chemin, bloc, label FROM reussite WHERE utilisateur_id = ?
    `).all(uid) as { chemin: string, bloc: string, label: string }[])
      .map(l => composerIdentite(l.chemin, l.bloc, l.label)))

  // Ratées au moins une fois. Le quiz range l'identité entière ; un QCM, lui,
  // ne retient que les repères de ses questions ratées — d'où la recomposition.
  const ratees = new Set(
    (db.prepare(`
      SELECT DISTINCT r.question AS question
      FROM quiz_reponse r
      JOIN quiz_session s ON s.id = r.session_id
      WHERE s.utilisateur_id = ? AND r.juste = 0
    `).all(uid) as { question: string }[]).map(l => l.question))

  for (const t of db.prepare(`
    SELECT chemin, bloc, ratees FROM qcm_tentative WHERE utilisateur_id = ?
  `).all(uid) as { chemin: string, bloc: string, ratees: string }[]) {
    let labels: unknown
    try {
      labels = JSON.parse(t.ratees)
    } catch {
      // Une ligne illisible n'est pas une raison de rendre une page vide : la
      // question comptera comme acquise sans hésitation, ce qui est le pire cas
      // le moins trompeur.
      continue
    }
    if (!Array.isArray(labels)) continue
    for (const label of labels) {
      if (typeof label === 'string') ratees.add(composerIdentite(t.chemin, t.bloc, label))
    }
  }

  // Un cumul par chapitre, et dans chacun un cumul par domaine.
  const parChapitre = new Map<string, { total: Cumul, domaines: Map<string, Cumul> }>()

  for (const entree of banque.entrees) {
    const theme = entree.theme ?? 'divers'
    const chapitre = parChapitre.get(theme) ?? {
      total: { cle: theme, titre: theme, questions: 0, acquises: 0, hesitantes: 0, interrogeables: 0 },
      domaines: new Map<string, Cumul>()
    }
    parChapitre.set(theme, chapitre)

    // Les questions sans renvoi tombent toutes dans le même tas du chapitre :
    // sans lui, le total du chapitre serait plus grand que la somme de ses
    // domaines, et la barre du haut ne collerait plus à celles du bas.
    const cleDomaine = entree.notionCle ?? `${theme}#sans-renvoi`
    const domaine = chapitre.domaines.get(cleDomaine) ?? {
      cle: entree.notionCle,
      titre: entree.notionTitre ?? SANS_RENVOI,
      questions: 0,
      acquises: 0,
      hesitantes: 0,
      interrogeables: 0
    }
    chapitre.domaines.set(cleDomaine, domaine)

    const acquise = acquises.has(entree.id)
    const hesitante = acquise && ratees.has(entree.id)

    for (const cumul of [chapitre.total, domaine]) {
      cumul.questions += 1
      if (entree.interrogeable) cumul.interrogeables += 1
      if (acquise) cumul.acquises += 1
      if (hesitante) cumul.hesitantes += 1
    }
  }

  /** La part acquise, pour trier. Un domaine vide n'existe pas, mais coûte moins cher à garder. */
  const part = (c: Cumul) => (c.questions ? c.acquises / c.questions : 1)

  const chapitres: ChapitreProgression[] = [...parChapitre].map(([cle, c]) => {
    const meta = banque.chapitres.get(cle)
    const domaines: DomaineProgression[] = [...c.domaines.values()]
      // Le moins acquis d'abord : la page répond à « où est-ce que ça coince »,
      // et l'ordre du cours ne répond pas à cette question-là. À part égale, le
      // domaine le plus fourni passe devant — c'est celui qui pèse le plus.
      //
      // Le tas « sans renvoi » ferme la marche quoi qu'il arrive : ce n'est pas
      // un sujet, c'est un reste, et le mettre en tête d'un chapitre parce qu'il
      // est gros ferait passer un fourre-tout pour la priorité du jour.
      .sort((a, b) =>
        Number(a.cle === null) - Number(b.cle === null)
        || part(a) - part(b)
        || b.questions - a.questions
        || a.titre.localeCompare(b.titre, 'fr'))
      .map(d => ({
        cle: d.cle,
        titre: d.titre,
        questions: d.questions,
        acquises: d.acquises,
        hesitantes: d.hesitantes,
        interrogeables: d.interrogeables
      }))

    return {
      cle,
      titre: meta?.titre ?? cle,
      icone: meta?.icone ?? null,
      chemin: meta?.chemin ?? null,
      questions: c.total.questions,
      acquises: c.total.acquises,
      hesitantes: c.total.hesitantes,
      interrogeables: c.total.interrogeables,
      domaines
    }
  })

  // Les chapitres, eux, gardent l'ordre du cours : on révise dans l'ordre où on
  // a appris, et c'est aussi celui du sommaire et du catalogue du quiz.
  chapitres.sort((a, b) =>
    (banque.chapitres.get(a.cle)?.ordre ?? 999) - (banque.chapitres.get(b.cle)?.ordre ?? 999)
    || a.titre.localeCompare(b.titre, 'fr'))

  const total = { questions: 0, acquises: 0, hesitantes: 0, interrogeables: 0 }
  for (const c of chapitres) {
    total.questions += c.questions
    total.acquises += c.acquises
    total.hesitantes += c.hesitantes
    total.interrogeables += c.interrogeables
  }

  return { chapitres, total }
})
