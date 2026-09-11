import type { MaybeRefOrGetter } from 'vue'
import type { CorrectionQuiz, QuestionQuiz, SessionQuiz } from '~~/shared/types/quiz'

interface ReponseSession {
  session: SessionQuiz
  question: QuestionQuiz | null
}

interface ReponseCorrection {
  correction: CorrectionQuiz
  session: SessionQuiz
}

/** Ce que le serveur glisse dans une 409 pour qu'on se remette d'accord avec lui. */
function sessionDeLErreur(erreur: unknown): SessionQuiz | null {
  const data = (erreur as { data?: { data?: { session?: SessionQuiz } } })?.data?.data
  return data?.session ?? null
}

function messageDeLErreur(erreur: unknown, defaut: string): string {
  const e = erreur as { statusCode?: number, data?: { statusMessage?: string, message?: string } }
  return e?.data?.statusMessage || e?.data?.message || defaut
}

/**
 * Le déroulé d'une séance de quiz.
 *
 * Tout l'état qui compte est **au serveur** : la file, la position, ce qui est
 * acquis. Ce composable n'en tient qu'un reflet, ce qui a deux conséquences
 * heureuses — recharger la page ne perd rien, et la bonne réponse n'arrive
 * jamais avant qu'on ait répondu.
 *
 * Le seul état vraiment local est le **préchargement** de la question suivante.
 * Son rang est connu dès qu'on affiche la question en cours, puisqu'une faute
 * allonge la file par la fin sans rien décaler : on va donc la chercher pendant
 * qu'on réfléchit, et « Question suivante » n'attend plus le réseau. Un
 * préchargement vide — la question en cours était la dernière de la file — ne
 * s'utilise pas : la faute qui vient de tomber a justement créé l'entrée qu'il
 * n'a pas vue.
 */
export function useSessionQuiz(id: MaybeRefOrGetter<number>) {
  const session = ref<SessionQuiz | null>(null)
  const question = ref<QuestionQuiz | null>(null)
  const correction = ref<CorrectionQuiz | null>(null)
  const choisi = ref<string | null>(null)

  const chargement = ref(true)
  const envoi = ref(false)
  const erreur = ref<string | null>(null)

  let prechargee: { position: number, question: QuestionQuiz } | null = null
  let prechargement: Promise<void> | null = null

  function precharger(position: number) {
    prechargee = null
    prechargement = $fetch<{ position: number, question: QuestionQuiz | null }>(
      `/api/quiz/session/${toValue(id)}/question`, { query: { position } }
    ).then((r) => {
      if (r.question) prechargee = { position: r.position, question: r.question }
    }).catch(() => {
      // Le préchargement est un confort : son échec se rattrape tout seul au
      // moment de demander la question suivante.
    })
  }

  function installer(donnees: ReponseSession) {
    session.value = donnees.session
    question.value = donnees.question
    correction.value = null
    choisi.value = null
    if (donnees.question) precharger(donnees.session.position + 1)
  }

  async function charger() {
    chargement.value = true
    erreur.value = null
    try {
      installer(await $fetch<ReponseSession>(`/api/quiz/session/${toValue(id)}`))
    } catch (e) {
      erreur.value = messageDeLErreur(e, 'Séance introuvable.')
    } finally {
      chargement.value = false
    }
  }

  /**
   * Envoie une réponse — une lettre cochée, ou l'aveu qu'on ne sait pas.
   *
   * Les deux suivent le même chemin parce que ce sont la même chose du point de
   * vue de la file : une place traitée. C'est le serveur qui décide de ce
   * qu'elle vaut.
   */
  async function envoyerReponse(corps: { lettre: string } | { passee: true }) {
    if (envoi.value || correction.value || !session.value || !question.value) return
    envoi.value = true
    choisi.value = 'lettre' in corps ? corps.lettre : null
    erreur.value = null
    try {
      const donnees = await $fetch<ReponseCorrection>(`/api/quiz/session/${toValue(id)}/reponse`, {
        method: 'POST',
        body: { position: question.value.position, ...corps }
      })
      correction.value = donnees.correction
      session.value = donnees.session
    } catch (e) {
      const resynchronisee = sessionDeLErreur(e)
      choisi.value = null
      if (resynchronisee) {
        // L'onglet avait un train de retard : on repart de l'état du serveur
        // plutôt que d'insister avec une question qui n'est plus la bonne.
        session.value = resynchronisee
        await suivante()
      } else {
        erreur.value = messageDeLErreur(e, 'La réponse n\'a pas pu être enregistrée.')
      }
    } finally {
      envoi.value = false
    }
  }

  const repondre = (lettre: string) => envoyerReponse({ lettre })

  /** « Je ne sais pas » : la place est manquée, et la correction s'ouvre. */
  const passer = () => envoyerReponse({ passee: true })

  async function suivante() {
    if (!session.value) return
    const position = session.value.position
    correction.value = null
    choisi.value = null

    if (prechargement) await prechargement
    if (prechargee?.position === position) {
      question.value = prechargee.question
      precharger(position + 1)
      return
    }

    chargement.value = true
    try {
      const r = await $fetch<{ position: number, question: QuestionQuiz | null }>(
        `/api/quiz/session/${toValue(id)}/question`, { query: { position } })
      if (r.question) {
        question.value = r.question
        precharger(position + 1)
        return
      }
      // Rien à cette place alors que la séance n'est pas finie : la question a
      // disparu du contenu depuis le tirage. On repasse par la lecture complète
      // de la séance, qui élague les places devenues introuvables — sans quoi
      // l'écran resterait sur son indicateur de chargement pour toujours.
      await charger()
    } catch (e) {
      erreur.value = messageDeLErreur(e, 'La question suivante n\'a pas pu être chargée.')
    } finally {
      chargement.value = false
    }
  }

  /** Clôt la séance sans la finir : elle rejoint l'historique telle quelle. */
  async function clore() {
    try {
      await $fetch(`/api/quiz/session/${toValue(id)}`, { method: 'DELETE' })
    } catch {
      // Rien à sauver : la séance reste simplement ouverte, et se reprend.
    }
  }

  const finie = computed(() => !!session.value?.finie)

  onMounted(charger)

  return { session, question, correction, choisi, chargement, envoi, erreur, finie, repondre, passer, suivante, clore, charger }
}
