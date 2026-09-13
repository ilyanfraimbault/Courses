import type { QuestionCandidate } from '~~/shared/types/mes-qcm'

/**
 * Toutes les questions qu'un QCM de cette matière peut poser, pour les choisir à
 * la main.
 *
 * C'est l'index et non les énoncés : quelques centaines de lignes de quelques
 * dizaines d'octets, que l'écran range par chapitre et par section du cours et
 * filtre sans aller-retour. Lire une question avant de la prendre se demande à
 * part (`/api/mes-qcm/apercu`).
 *
 * L'ordre est celui du cours : le chapitre, puis la section dans le plan, puis
 * l'ordre des fiches — on choisit en parcourant, comme on a appris.
 */
export default defineEventHandler(async (event): Promise<QuestionCandidate[]> => {
  const uid = await idUtilisateur(event)
  const { matiere } = getQuery(event)

  const banque = await chargerBanque(event)
  if (typeof matiere !== 'string' || !banque.matieres.has(matiere)) {
    throw createError({ statusCode: 400, statusMessage: 'matière inconnue' })
  }

  const enDette = questionsEnDette(useBase(), uid)
  const rangChapitre = (e: { theme: string | null }) => (e.theme ? banque.chapitres.get(e.theme)?.ordre ?? 999 : 1000)

  return banque.interrogeables
    .filter(e => e.matiere === matiere)
    // `sort` est stable : à chapitre et section égaux, l'ordre du relevé — celui
    // des questions dans leur fiche — est conservé.
    .sort((a, b) => rangChapitre(a) - rangChapitre(b) || a.sectionOrdre - b.sectionOrdre)
    .map(e => candidate(banque, e, enDette))
})
