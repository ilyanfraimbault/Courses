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
 * Une session ne suffit pas : il faut un compte que l'administration a
 * accepté. Sans quoi n'importe qui s'inscrirait sans code et lirait tout. L'accès
 * est relu en base, comme partout (`compteConnecte`) ; une session dont le
 * compte a disparu reçoit le même 401 que sans session.
 *
 * Le refus a lieu avant le gestionnaire de Nuxt Content. Celui-ci recharge
 * le dump par une requête interne quand sa base locale est périmée, et importe
 * une base vide si cette requête échoue : seule une requête qui a passé cette
 * garde peut donc la déclencher, avec un cookie qui la passera aussi.
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

  const { acces } = await compteConnecte(event)
  if (acces !== 'accorde') {
    throw createError({ statusCode: 403, statusMessage: 'Ce compte attend l\'accord de l\'administration' })
  }
})
