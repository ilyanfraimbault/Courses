/**
 * Les cours ne se lisent qu'avec un compte : ce sont ceux des professeurs, et
 * leur diffusion hors de la classe ne nous appartient pas.
 *
 * La garde est posée ici, sur les données, et non sur les pages. Une fiche n'a
 * rien à elle : son texte, la navigation, la recherche et la banque du quiz
 * passent tous par les routes de Nuxt Content — `query`, que le rendu serveur
 * appelle en relayant les en-têtes de la requête, et `sql_dump.txt`, la base
 * entière que le navigateur télécharge pour interroger en local. Fermer ces deux
 * portes ferme tout ; le middleware de route ne fait ensuite que conduire
 * l'élève à la connexion au lieu d'une page vide.
 *
 * Le dump ne doit pas être prérendu : servi comme fichier statique, il passerait
 * avant ce middleware. Voir le hook `nitro:config` de `nuxt.config.ts`.
 */
export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/__nuxt_content/')) return

  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Connexion requise' })
  }
})
