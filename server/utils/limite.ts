/**
 * Garde-fou contre la force brute, en mémoire et par IP.
 *
 * Nitro n'applique aucune limitation de débit par défaut, et la vérification
 * d'un mot de passe est bon marché : sans ce compteur, qui peut joindre le port
 * peut essayer des milliers de mots de passe par seconde. Un seul processus
 * sert le site, un compteur local suffit ; un déploiement à plusieurs
 * instances demanderait un magasin partagé.
 */
const essais = new Map<string, { compte: number, finFenetre: number }>()

export function tropDEssais(cle: string, max: number, fenetreMs: number): boolean {
  const maintenant = Date.now()
  // On purge au passage, sinon la table garderait un enregistrement périmé par
  // IP source pour toute la vie du processus.
  for (const [k, e] of essais) {
    if (maintenant > e.finFenetre) essais.delete(k)
  }
  const entree = essais.get(cle)
  if (!entree || maintenant > entree.finFenetre) {
    essais.set(cle, { compte: 1, finFenetre: maintenant + fenetreMs })
    return false
  }
  entree.compte += 1
  return entree.compte > max
}

export function oublierEssais(cle: string): void {
  essais.delete(cle)
}
