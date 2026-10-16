import type { HistoriqueQuiz, ResumeSessionQuiz, SectionResistante } from '~~/shared/types/quiz'
import type { LigneSession } from '../../utils/quiz-session.ts'

/** Assez pour voir une tendance, pas assez pour noyer la page. */
const MAX_SESSIONS = 20
const MAX_SECTIONS = 12

/**
 * Les séances passées, et ce qui résiste.
 *
 * « Ce qui résiste » se lit dans la table des **fautes** et non dans les
 * réponses de quiz. C'est un élargissement voulu : le quiz n'est qu'un des trois
 * endroits où l'on se trompe, et de loin le moins fréquenté. Une notion ratée
 * trois fois dans les exercices et jamais au quiz résistait autant, sans que
 * rien ne le dise.
 *
 * L'agrégation par section se fait ici, en mémoire, et non en SQL : la section
 * d'une question vit dans le contenu, pas en base — la recopier à l'écriture la
 * figerait, et un chapitre réorganisé afficherait des sections périmées des mois
 * plus tard.
 *
 * Tout est rendu, toutes matières confondues, avec la matière de chaque ligne :
 * c'est l'écran qui ne montre que celle qu'on a choisie.
 */
export default defineEventHandler(async (event): Promise<HistoriqueQuiz> => {
  const uid = await idUtilisateur(event)
  const db = useBase()

  const lignes = db.prepare(`
    SELECT * FROM quiz_session WHERE utilisateur_id = ? ORDER BY maj DESC LIMIT ?
  `).all(uid, MAX_SESSIONS) as unknown as LigneSession[]

  const banque = await chargerBanque(event)

  function resumer(ligne: LigneSession): ResumeSessionQuiz {
    const etat = lireEtat(ligne.etat)
    const publique = publier(ligne, etat)
    const filtre = publique.filtre
    return {
      id: ligne.id,
      taille: ligne.taille,
      poses: ligne.poses,
      justes: ligne.justes,
      fautes: ligne.fautes,
      acquises: publique.acquises,
      finie: publique.finie,
      commencee_le: ligne.commencee_le,
      maj: ligne.maj,
      filtre,
      themes: intitules(filtre),
      matiereTitre: filtre.matiere ? banque.matieres.get(filtre.matiere)?.titre ?? null : null
    }
  }

  /**
   * Ce sur quoi la séance portait, en clair. Les clés sont des chemins : c'est
   * la banque qui sait les nommer, et une clé qui ne s'y trouve plus vaut mieux
   * affichée telle quelle qu'escamotée.
   */
  function intitules(filtre: ResumeSessionQuiz['filtre']): string[] {
    const noms = [
      ...filtre.themes.map(t => banque.chapitres.get(t)?.titre ?? t),
      ...filtre.sections.map((s) => {
        const e = banque.entrees.find(q => cleSection(q) === s)
        return e ? e.sectionTitre ?? 'Le reste du chapitre' : s
      }),
      ...(filtre.notions ?? []).map(n => banque.entrees.find(e => e.notionCle === n)?.notionTitre ?? n.split('#').pop() ?? n)
    ]
    const tout = filtre.matiere ? 'Toute la matière' : 'Tout le programme'
    if (filtre.erreurs && filtre.aRevoir) return ['Séance du jour', ...noms]
    if (filtre.erreurs) return noms.length ? [...noms, 'ce qui restait en dette'] : ['Ce que j\'ai raté']
    if (filtre.aRevoir) return ['Révisions du jour', ...noms]
    if (filtre.nonAcquises) return noms.length ? [...noms, 'ce qui n\'était pas encore su'] : ['Ce qui n\'était pas encore su']
    return noms.length ? noms : [tout]
  }

  const sessions = lignes.map(resumer)

  const dettes = db.prepare(`
    SELECT chemin, bloc, label, compte FROM faute
    WHERE utilisateur_id = ? AND rattrapee IS NULL
  `).all(uid) as unknown as { chemin: string, bloc: string, label: string, compte: number }[]

  const parSection = new Map<string, SectionResistante>()
  for (const dette of dettes) {
    // Une question ratée puis disparue du contenu n'a plus de section à
    // laquelle se rattacher : on la laisse de côté plutôt que d'inventer une
    // rubrique que rien ne peut plus faire réviser.
    const entree = banque.entrees.find(e => e.id === composerIdentite(dette.chemin, dette.bloc, dette.label))
    if (!entree?.section) continue
    const section = parSection.get(entree.section) ?? {
      cle: entree.section,
      titre: entree.sectionTitre ?? entree.section,
      theme: entree.theme,
      themeTitre: entree.theme ? banque.chapitres.get(entree.theme)?.titre ?? null : null,
      matiere: entree.matiere,
      enDette: 0,
      fautes: 0
    }
    section.enDette += 1
    section.fautes += dette.compte
    parSection.set(entree.section, section)
  }

  const resistent = [...parSection.values()]
    .sort((a, b) => b.enDette - a.enDette || b.fautes - a.fautes || a.titre.localeCompare(b.titre, 'fr'))
    .slice(0, MAX_SECTIONS)

  return {
    sessions,
    encours: sessions.find(s => !s.finie) ?? null,
    resistent
  }
})
