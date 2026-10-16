import type {
  ChapitreProgression, CompteProgression, DomaineProgression, MatiereProgression, ProgressionDomaines
} from '~~/shared/types/domaines'

/** Le tas des questions qui ne renvoient à aucun rappel de cours. */
const SANS_RENVOI = 'Sans renvoi au cours'

interface Cumul extends CompteProgression {
  cle: string | null
  titre: string
}

const vide = (cle: string | null, titre: string): Cumul =>
  ({ cle, titre, questions: 0, acquises: 0, hesitantes: 0, interrogeables: 0 })

const comptes = (c: CompteProgression): CompteProgression =>
  ({ questions: c.questions, acquises: c.acquises, hesitantes: c.hesitantes, interrogeables: c.interrogeables })

/**
 * La progression rangée par domaine, en une requête.
 *
 * Le croisement a lieu **ici** et non au client, pour la même raison que le
 * reste : la table de correspondance question → point de cours est le relevé du
 * build, qui vit côté serveur et pèse quatre-vingts kilo-octets. L'envoyer au
 * navigateur pour qu'il fasse la jointure lui-même coûterait mille fois la
 * réponse — une centaine de lignes, quelques kilo-octets.
 *
 * Quatre lectures suffisent, et aucune ne dépend des autres :
 *
 * - `reussite` dit ce qui est **acquis**. C'est la même mémoire que les fiches
 *   et que le report du quiz : une question trouvée est une question trouvée,
 *   quel que soit l'écran où elle l'a été.
 * - `quiz_reponse`, `qcm_tentative` et `qcm_compose_copie` disent ce qui a
 *   **coûté une faute**. Une question finalement trouvée mais ratée en chemin
 *   reste acquise ; elle s'affiche seulement d'une autre couleur, parce que « je
 *   l'ai eue » et « je l'ai eue au deuxième essai » ne se révisent pas pareil.
 *
 * L'inverse n'est pas mesurable : une question ratée sur une fiche puis reprise
 * dans la foulée ne laisse aucune trace — la progression d'une fiche s'écrit par
 * instantané de ce qui est trouvé, pas par historique. C'est assumé : le compte
 * des hésitantes est un plancher, jamais un total.
 *
 * Le rangement suit la hiérarchie du site : matière, chapitre, domaine. Deux
 * cours ne partagent pas une barre — « 40 % » sur deux matières mêlées ne dirait
 * rien de l'une ni de l'autre.
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

  // Ratées au moins une fois. Le quiz et les QCM composés rangent l'identité
  // entière ; un QCM de contenu, lui, ne retient que les repères de ses
  // questions ratées — d'où la recomposition.
  const ratees = new Set(
    (db.prepare(`
      SELECT DISTINCT r.question AS question
      FROM quiz_reponse r
      JOIN quiz_session s ON s.id = r.session_id
      WHERE s.utilisateur_id = ? AND r.juste = 0
    `).all(uid) as { question: string }[]).map(l => l.question))

  /** Une liste JSON de chaînes, ou rien : une ligne illisible ne vide pas la page. */
  function lireListe(json: string): string[] {
    try {
      const valeur: unknown = JSON.parse(json)
      return Array.isArray(valeur) ? valeur.filter((v): v is string => typeof v === 'string') : []
    } catch {
      // La question comptera comme acquise sans hésitation : le pire cas le
      // moins trompeur.
      return []
    }
  }

  for (const t of db.prepare(`
    SELECT chemin, bloc, ratees FROM qcm_tentative WHERE utilisateur_id = ?
  `).all(uid) as { chemin: string, bloc: string, ratees: string }[]) {
    for (const label of lireListe(t.ratees)) ratees.add(composerIdentite(t.chemin, t.bloc, label))
  }

  for (const c of db.prepare(`
    SELECT c.ratees FROM qcm_compose_copie c
    JOIN qcm_compose q ON q.id = c.compose_id
    WHERE q.utilisateur_id = ?
  `).all(uid) as { ratees: string }[]) {
    for (const id of lireListe(c.ratees)) ratees.add(id)
  }

  // Ce qui est clos sort de la page : c'est ce qu'on a demandé en le closant.
  // Les clôtures elles-mêmes se lisent en bas de page, de quoi les rouvrir.
  const clos = cheminsClos(db, uid)

  // Une matière, ses chapitres, et dans chacun ses domaines.
  interface CumulChapitre { total: Cumul, domaines: Map<string, Cumul> }
  const parMatiere = new Map<string, { total: Cumul, chapitres: Map<string, CumulChapitre> }>()

  for (const entree of banque.entrees) {
    if (entreeClose(entree, clos)) continue
    const cleMatiere = entree.matiere ?? 'divers'
    const theme = entree.theme ?? 'divers'

    const matiere = parMatiere.get(cleMatiere) ?? { total: vide(cleMatiere, cleMatiere), chapitres: new Map<string, CumulChapitre>() }
    parMatiere.set(cleMatiere, matiere)
    const chapitre = matiere.chapitres.get(theme) ?? { total: vide(theme, theme), domaines: new Map<string, Cumul>() }
    matiere.chapitres.set(theme, chapitre)

    // Les questions sans renvoi tombent toutes dans le même tas du chapitre :
    // sans lui, le total du chapitre serait plus grand que la somme de ses
    // domaines, et la barre du haut ne collerait plus à celles du bas.
    const cleDomaine = entree.notionCle ?? `${theme}#sans-renvoi`
    const domaine = chapitre.domaines.get(cleDomaine) ?? vide(entree.notionCle, entree.notionTitre ?? SANS_RENVOI)
    chapitre.domaines.set(cleDomaine, domaine)

    const acquise = acquises.has(entree.id)
    const hesitante = acquise && ratees.has(entree.id)

    for (const cumul of [matiere.total, chapitre.total, domaine]) {
      cumul.questions += 1
      if (entree.interrogeable) cumul.interrogeables += 1
      if (acquise) cumul.acquises += 1
      if (hesitante) cumul.hesitantes += 1
    }
  }

  /** La part acquise, pour trier. Un domaine vide n'existe pas, mais coûte moins cher à garder. */
  const part = (c: Cumul) => (c.questions ? c.acquises / c.questions : 1)

  function composerChapitre([cle, c]: [string, CumulChapitre]): ChapitreProgression {
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
      .map(d => ({ cle: d.cle, titre: d.titre, ...comptes(d) }))

    return {
      cle,
      titre: meta?.titre ?? cle,
      icone: meta?.icone ?? null,
      chemin: meta?.chemin ?? null,
      ...comptes(c.total),
      domaines
    }
  }

  const matieres: MatiereProgression[] = [...parMatiere].map(([cle, m]) => {
    const meta = banque.matieres.get(cle)
    // Les chapitres, eux, gardent l'ordre du cours : on révise dans l'ordre où
    // on a appris, et c'est aussi celui du sommaire et du catalogue du quiz.
    const chapitres = [...m.chapitres].map(composerChapitre).sort((a, b) =>
      (banque.chapitres.get(a.cle)?.ordre ?? 999) - (banque.chapitres.get(b.cle)?.ordre ?? 999)
      || a.titre.localeCompare(b.titre, 'fr'))
    return {
      cle,
      titre: meta?.titre ?? cle,
      annee: meta?.annee ?? null,
      icone: meta?.icone ?? null,
      chemin: meta?.chemin ?? null,
      ...comptes(m.total),
      chapitres
    }
  })

  matieres.sort((a, b) => {
    const ma = banque.matieres.get(a.cle)
    const mb = banque.matieres.get(b.cle)
    return (ma?.anneeChemin ?? '').localeCompare(mb?.anneeChemin ?? '')
      || (ma?.ordre ?? 999) - (mb?.ordre ?? 999)
      || a.titre.localeCompare(b.titre, 'fr')
  })

  const total: CompteProgression = { questions: 0, acquises: 0, hesitantes: 0, interrogeables: 0 }
  for (const m of matieres) {
    total.questions += m.questions
    total.acquises += m.acquises
    total.hesitantes += m.hesitantes
    total.interrogeables += m.interrogeables
  }

  return { matieres, total }
})
