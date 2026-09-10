import type { HistoriqueQuiz, NotionResistante, ResumeSessionQuiz } from '~~/shared/types/quiz'
import type { LigneSession } from '../../utils/quiz-session.ts'

/** Assez pour voir une tendance, pas assez pour noyer la page. */
const MAX_SESSIONS = 20
const MAX_NOTIONS = 12

/**
 * Les séances passées, et ce qui résiste.
 *
 * « Ce qui résiste » se lit dans `quiz_reponse` et non dans les files : une
 * notion ratée trois fois sur quatre séances ne se voit qu'en agrégeant, et
 * agréger trente JSON désérialisés pour l'apprendre serait absurde quand SQL
 * le fait en une ligne.
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
      themes: filtre.themes.length || filtre.notions.length
        ? [
            ...filtre.themes.map(t => banque.chapitres.get(t)?.titre ?? t),
            ...filtre.notions.map(n => n.split('/').slice(1).join('/'))
          ]
        : ['Tout le programme']
    }
  }

  const sessions = lignes.map(resumer)

  const resistent: NotionResistante[] = (db.prepare(`
    SELECT r.notion AS notion, r.theme AS theme,
           COUNT(*) AS posees, SUM(1 - r.juste) AS fautes
    FROM quiz_reponse r
    JOIN quiz_session s ON s.id = r.session_id
    WHERE s.utilisateur_id = ? AND r.notion IS NOT NULL
    GROUP BY r.notion
    HAVING fautes > 0
    ORDER BY fautes DESC, posees DESC
    LIMIT ?
  `).all(uid, MAX_NOTIONS) as unknown as { notion: string, theme: string | null, posees: number, fautes: number }[])
    .map((l) => {
      // L'intitulé lisible vit dans le contenu, pas en base : le recopier à
      // l'écriture le figerait, et une notion renommée dans le cours
      // s'afficherait encore sous son ancien nom des mois plus tard.
      const entree = banque.entrees.find(e => e.notionCle === l.notion)
      return {
        cle: l.notion,
        titre: entree?.notionTitre ?? l.notion.split('/').slice(1).join('/'),
        theme: l.theme,
        posees: l.posees,
        fautes: l.fautes
      }
    })

  return {
    sessions,
    encours: sessions.find(s => !s.finie) ?? null,
    resistent
  }
})
