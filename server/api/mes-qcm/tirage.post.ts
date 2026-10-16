import type { DemandeTirage, QuestionCandidate } from '~~/shared/types/mes-qcm'
import type { FiltreQuiz } from '~~/shared/types/quiz'

function listeDeChaines(valeur: unknown): string[] {
  return Array.isArray(valeur) ? [...new Set(valeur.filter((v): v is string => typeof v === 'string' && !!v))] : []
}

/**
 * Propose des questions pour un QCM, tirées comme une séance de quiz.
 *
 * C'est le même tirage, avec la même sélection — chapitres et sections qui
 * s'additionnent, dette qui restreint — et le même rang : ce qui est en dette
 * d'abord, puis ce qui n'a jamais été posé. La différence est ce qu'on en fait :
 * rien n'est ouvert ni écrit, la liste revient à l'écran de composition, qui la
 * garde, la retouche ou la jette.
 *
 * `exclues` écarte ce qui est déjà retenu, pour qu'un second tirage complète le
 * premier au lieu de le répéter.
 */
export default defineEventHandler(async (event): Promise<QuestionCandidate[]> => {
  const uid = await idUtilisateur(event)
  const corps = await readBody<Partial<Record<keyof DemandeTirage, unknown>>>(event)

  const banque = await chargerBanque(event)
  const matiere = typeof corps?.matiere === 'string' ? corps.matiere : ''
  if (!banque.matieres.has(matiere)) {
    throw createError({ statusCode: 400, statusMessage: 'matière inconnue' })
  }

  const taille = Number(corps?.taille)
  if (!Number.isInteger(taille) || taille < QCM_MIN || taille > QCM_MAX) {
    throw createError({ statusCode: 400, statusMessage: `entre ${QCM_MIN} et ${QCM_MAX} questions` })
  }

  const filtre: FiltreQuiz = {
    matiere,
    themes: listeDeChaines(corps?.themes),
    sections: listeDeChaines(corps?.sections),
    notions: listeDeChaines(corps?.notions),
    erreurs: corps?.erreurs === true
  }
  const exclues = new Set(listeDeChaines(corps?.exclues))

  const db = useBase()
  const enDette = questionsEnDette(db, uid)
  const candidats = filtrer(banque.interrogeables, filtre, enDette, undefined, undefined, cheminsClos(db, uid))
    .filter(e => !exclues.has(e.id))

  return tirer(candidats, Math.min(taille, candidats.length), rangDuTirage(db, uid, enDette))
    .map(e => candidate(banque, e, enDette))
})
