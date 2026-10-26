import type { ComputedRef, InjectionKey } from 'vue'

/**
 * Le lien entre une question et un composant qui se remplit à la main — une
 * table de vérité, des champs de réponse, une commande à taper. Le composant
 * sait corriger sa saisie ; la question sait ce qu'une réponse juste ou fausse
 * écrit en base. Ni l'un ni l'autre n'a à connaître la règle de l'autre.
 */
export type NatureRemplie = 'table' | 'champs' | 'commande'

export interface QuestionRemplieApi {
  /** La question est déjà trouvée : le composant s'affiche rempli et figé. */
  trouvee: ComputedRef<boolean>
  /**
   * Dit à la question qu'elle ne se corrige ni par lettre ni par
   * auto-évaluation. La nature devient la réponse écrite en base, et choisit le
   * message d'un essai faux.
   */
  inscrire: (nature?: NatureRemplie) => void
  /** Rend le verdict d'une vérification. */
  verifier: (juste: boolean) => void
}

export const questionRemplieKey: InjectionKey<QuestionRemplieApi> = Symbol('question-remplie')

export function provideQuestionRemplie(api: QuestionRemplieApi) {
  provide(questionRemplieKey, api)
}

/** Nul hors d'une question : le composant se corrige alors pour lui seul, sans mémoire. */
export function useQuestionRemplie(): QuestionRemplieApi | null {
  return inject(questionRemplieKey, null)
}
