/**
 * Les repères affichés à côté des propositions d'une question de quiz.
 *
 * Le quiz brasse l'ordre des propositions à chaque tirage : la bonne réponse
 * d'un exercice donné finissait sinon par se retenir comme « c'est la c »
 * plutôt que par son contenu, ce qui est exactement ce qu'une révision ne doit
 * pas apprendre.
 *
 * Le brassage a lieu au serveur, qui envoie les lettres de la fiche dans
 * l'ordre où il veut les voir posées. L'écran, lui, ne montre jamais ces
 * lettres : il numérote les propositions dans l'ordre où elles s'affichent.
 * Sans cela on lirait « c, a, d, b » dans la marge, et le clavier ne saurait
 * plus quoi désigner.
 *
 * La table vit dans `shared/` parce que le serveur en a besoin aussi : la
 * correction rédigée cite les propositions par la lettre de la fiche (« **b**
 * est le piège »), et c'est lui qui la renomme avant de l'envoyer.
 */
export const REPERES_QUIZ = ['a', 'b', 'c', 'd', 'e']

/** Lettre de la fiche → repère affiché, pour l'ordre donné par le serveur. */
export function reperesQuiz(lettres: readonly string[]): Record<string, string> {
  const sortie: Record<string, string> = {}
  lettres.forEach((lettre, i) => {
    sortie[lettre] = REPERES_QUIZ[i] ?? lettre
  })
  return sortie
}
