import { estParcours, type Parcours } from '~~/shared/types/matieres'

/**
 * Dire qui l'on est : prénom, nom, parcours — au premier passage, dans une
 * fenêtre qu'on ne ferme pas sans répondre, puis depuis le badge de l'en-tête.
 * Le tout s'envoie ensemble : la fenêtre montre les trois.
 */
function nomPropre(valeur: unknown, champ: string): string {
  const texte = typeof valeur === 'string' ? valeur.trim().replace(/\s+/g, ' ') : ''
  if (!texte) throw createError({ statusCode: 400, statusMessage: `il faut un ${champ}` })
  if (texte.length > 60) throw createError({ statusCode: 400, statusMessage: `${champ} trop long (60 caractères au plus)` })
  return texte
}

export default defineEventHandler(async (event): Promise<{ prenom: string, nom: string, parcours: Parcours }> => {
  const uid = await idUtilisateur(event)
  const corps = await readBody<{ prenom?: unknown, nom?: unknown, parcours?: unknown }>(event)
  const prenom = nomPropre(corps?.prenom, 'prénom')
  const nom = nomPropre(corps?.nom, 'nom')
  if (!estParcours(corps?.parcours)) throw createError({ statusCode: 400, statusMessage: 'Parcours inconnu : « dl » ou « sr »' })
  useBase().prepare('UPDATE utilisateur SET prenom = ?, nom = ?, parcours = ? WHERE id = ?').run(prenom, nom, corps.parcours, uid)
  return { prenom, nom, parcours: corps.parcours }
})
