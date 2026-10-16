import type { Cloture } from '~~/shared/types/clotures'
import { niveauxDuChemin } from '~~/shared/utils/niveaux'

/**
 * Les clôtures du compte, nommées. Lue au montage seulement, comme toute
 * donnée d'utilisateur : le sommaire grisé et le bandeau d'une page close ne
 * passent jamais par le rendu serveur.
 */
export default defineEventHandler(async (event): Promise<Cloture[]> => {
  const uid = await idUtilisateur(event)
  const banque = await chargerBanque(event)
  const lignes = useBase().prepare(`
    SELECT chemin, close_le FROM cloture WHERE utilisateur_id = ? ORDER BY close_le DESC
  `).all(uid) as unknown as { chemin: string, close_le: number }[]

  return lignes.map((l) => {
    // Un chemin qui ne désigne plus rien — un chapitre renommé depuis — reste
    // affiché tel quel : le cacher empêcherait de le rouvrir, donc d'effacer la
    // ligne.
    const connu = natureDuChemin(banque, l.chemin)
    return {
      chemin: l.chemin,
      nature: connu?.nature ?? 'chapitre',
      titre: connu?.titre ?? l.chemin,
      matiere: niveauxDuChemin(l.chemin).matiere,
      close_le: l.close_le
    }
  })
})
