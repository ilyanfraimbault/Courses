/**
 * Supprime un contrôle. Son examen blanc reste dans « Mes QCM » : c'est un QCM
 * composé comme un autre, avec ses copies — et ce qu'il a fait gagner est dans
 * la progression des fiches, qui n'appartient à aucun contrôle.
 */
export default defineEventHandler(async (event) => {
  const uid = await idUtilisateur(event)
  const resultat = useBase().prepare('DELETE FROM controle WHERE id = ? AND utilisateur_id = ?')
    .run(idControle(event), uid)
  if (!resultat.changes) throw createError({ statusCode: 404, statusMessage: 'contrôle introuvable' })
  return { ok: true }
})
