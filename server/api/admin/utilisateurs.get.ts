import type { MatiereAdministration, UtilisateurAdministration, VueAdministration } from '~~/shared/types/administration'

/**
 * Tous les comptes et où ils en sont, en une requête.
 *
 * C'est la seule route du site qui lit au delà du compte connecté, d'où la
 * garde `exigerAdministrateur` en première ligne. Chaque table est lue **une**
 * fois, groupée par compte, plutôt qu'une série de requêtes par utilisateur :
 * le coût ne grandit pas avec le nombre d'inscrits.
 *
 * L'avancée se compte contre le relevé du build, comme « Mes domaines » : une
 * réussite dont la question a disparu du contenu ne compte plus, sans quoi un
 * compte pourrait afficher plus de questions trouvées que la matière n'en a.
 * Les clôtures, elles, sont ignorées : elles disent ce qu'un élève ne veut plus
 * voir, pas ce qu'il a fait.
 */
export default defineEventHandler(async (event): Promise<VueAdministration> => {
  await exigerAdministrateur(event)
  const banque = await chargerBanque(event)
  const db = useBase()

  // La matière de chaque question, et le dénominateur de chaque matière. La
  // matière est celle que retient la banque — déduite du chapitre visé —, la
  // même que dans « Mes domaines » : les deux pages doivent tomber d'accord.
  const matiereDe = new Map<string, string>()
  const totaux = new Map<string, number>()
  for (const e of banque.entrees) {
    const cle = e.matiere ?? 'divers'
    matiereDe.set(e.id, cle)
    totaux.set(cle, (totaux.get(cle) ?? 0) + 1)
  }

  const matieres: MatiereAdministration[] = [...totaux].map(([cle, questions]) => {
    const meta = banque.matieres.get(cle)
    return {
      cle,
      titre: meta?.titre ?? cle,
      annee: meta?.annee ?? null,
      icone: meta?.icone ?? null,
      chemin: meta?.chemin ?? null,
      questions
    }
  }).sort((a, b) => {
    const ma = banque.matieres.get(a.cle)
    const mb = banque.matieres.get(b.cle)
    return (ma?.anneeChemin ?? '').localeCompare(mb?.anneeChemin ?? '')
      || (ma?.ordre ?? 999) - (mb?.ordre ?? 999)
      || a.titre.localeCompare(b.titre, 'fr')
  })

  const admins = pseudosAdministrateurs(event)

  const comptes = db.prepare(`
    SELECT id, pseudo, pseudo_replie, cree_le FROM utilisateur
  `).all() as { id: number, pseudo: string, pseudo_replie: string, cree_le: number }[]

  const vue = new Map<number, UtilisateurAdministration>()
  for (const c of comptes) {
    vue.set(c.id, {
      id: c.id,
      pseudo: c.pseudo,
      admin: admins.has(c.pseudo_replie),
      inscritLe: c.cree_le,
      derniereActivite: null,
      acquises: 0,
      parMatiere: {},
      fichesOuvertes: 0,
      enDette: 0,
      fautes: 0,
      quiz: { seances: 0, reponses: 0, justes: 0 },
      qcm: { copies: 0, composes: 0 },
      controles: 0,
      todo: { total: 0, faites: 0 }
    })
  }

  /** Une ligne par compte, ou rien : une table vide ne laisse pas de trou. */
  function parCompte<T extends { uid: number }>(sql: string, appliquer: (u: UtilisateurAdministration, l: T) => void) {
    for (const ligne of db.prepare(sql).all() as unknown as T[]) {
      const u = vue.get(Number(ligne.uid))
      if (u) appliquer(u, ligne)
    }
  }

  for (const r of db.prepare(`
    SELECT utilisateur_id AS uid, chemin, bloc, label FROM reussite
  `).all() as { uid: number, chemin: string, bloc: string, label: string }[]) {
    const u = vue.get(Number(r.uid))
    const matiere = matiereDe.get(composerIdentite(r.chemin, r.bloc, r.label))
    if (!u || !matiere) continue
    u.acquises += 1
    u.parMatiere[matiere] = (u.parMatiere[matiere] ?? 0) + 1
  }

  parCompte<{ uid: number, n: number }>(`
    SELECT utilisateur_id AS uid, COUNT(*) AS n FROM fiche GROUP BY utilisateur_id
  `, (u, l) => { u.fichesOuvertes = l.n })

  parCompte<{ uid: number, dette: number, fautes: number }>(`
    SELECT utilisateur_id AS uid,
      SUM(rattrapee IS NULL) AS dette,
      SUM(compte) AS fautes
    FROM faute GROUP BY utilisateur_id
  `, (u, l) => {
    u.enDette = l.dette ?? 0
    u.fautes = l.fautes ?? 0
  })

  parCompte<{ uid: number, seances: number }>(`
    SELECT utilisateur_id AS uid, COUNT(*) AS seances FROM quiz_session GROUP BY utilisateur_id
  `, (u, l) => { u.quiz.seances = l.seances })

  parCompte<{ uid: number, reponses: number, justes: number }>(`
    SELECT s.utilisateur_id AS uid, COUNT(*) AS reponses, SUM(r.juste) AS justes
    FROM quiz_reponse r JOIN quiz_session s ON s.id = r.session_id
    GROUP BY s.utilisateur_id
  `, (u, l) => {
    u.quiz.reponses = l.reponses
    u.quiz.justes = l.justes ?? 0
  })

  // Une copie est une copie, qu'elle vienne d'un QCM de fiche ou d'un QCM composé.
  parCompte<{ uid: number, n: number }>(`
    SELECT utilisateur_id AS uid, COUNT(*) AS n FROM qcm_tentative GROUP BY utilisateur_id
  `, (u, l) => { u.qcm.copies += l.n })

  parCompte<{ uid: number, composes: number, copies: number }>(`
    SELECT q.utilisateur_id AS uid, COUNT(DISTINCT q.id) AS composes, COUNT(c.id) AS copies
    FROM qcm_compose q LEFT JOIN qcm_compose_copie c ON c.compose_id = q.id
    GROUP BY q.utilisateur_id
  `, (u, l) => {
    u.qcm.composes = l.composes
    u.qcm.copies += l.copies
  })

  parCompte<{ uid: number, n: number }>(`
    SELECT utilisateur_id AS uid, COUNT(*) AS n FROM controle GROUP BY utilisateur_id
  `, (u, l) => { u.controles = l.n })

  parCompte<{ uid: number, total: number, faites: number }>(`
    SELECT utilisateur_id AS uid, COUNT(*) AS total, COUNT(fait_le) AS faites
    FROM todo GROUP BY utilisateur_id
  `, (u, l) => {
    u.todo.total = l.total
    u.todo.faites = l.faites
  })

  // La dernière trace laissée, où qu'elle soit. Ouvrir une fiche sans y
  // répondre n'en laisse pas : la progression ne s'écrit qu'à la première
  // réponse, et c'est bien d'activité qu'on parle.
  parCompte<{ uid: number, t: number }>(`
    SELECT uid, MAX(t) AS t FROM (
      SELECT utilisateur_id AS uid, maj AS t FROM fiche
      UNION ALL SELECT utilisateur_id, derniere FROM faute
      UNION ALL SELECT utilisateur_id, maj FROM quiz_session
      UNION ALL SELECT utilisateur_id, t FROM qcm_tentative
      UNION ALL SELECT q.utilisateur_id, c.t FROM qcm_compose_copie c JOIN qcm_compose q ON q.id = c.compose_id
      UNION ALL SELECT utilisateur_id, maj FROM qcm_compose
      UNION ALL SELECT utilisateur_id, maj FROM controle
      UNION ALL SELECT utilisateur_id, cree_le FROM todo
      UNION ALL SELECT utilisateur_id, fait_le FROM todo WHERE fait_le IS NOT NULL
    ) GROUP BY uid
  `, (u, l) => { u.derniereActivite = l.t })

  // Les plus récemment actifs d'abord ; un compte jamais servi ferme la marche,
  // rangé par date d'inscription.
  const utilisateurs = [...vue.values()].sort((a, b) =>
    (b.derniereActivite ?? 0) - (a.derniereActivite ?? 0) || b.inscritLe - a.inscritLe)

  return { questions: banque.entrees.length, matieres, utilisateurs }
})
