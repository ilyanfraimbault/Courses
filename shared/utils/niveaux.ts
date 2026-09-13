/**
 * La hiérarchie du site, lue dans le chemin d'une page :
 *
 *     /cours / a1 / remise-a-niveau-maths / trigonometrie / cours
 *              année   matière              chapitre       fiche
 *
 * Elle est **positionnelle**, et c'est voulu. Le dossier est la seule chose
 * qu'on ne peut pas oublier de renseigner : un champ `matiere` dans chaque
 * frontmatter finirait par diverger d'une fiche à l'autre, et une question se
 * retrouverait rangée sous deux matières. Le chemin, lui, est aussi l'URL — il
 * ne ment jamais sur l'endroit où vit une page.
 *
 * Chaque niveau est désigné par **son chemin** et non par son dernier segment.
 * Deux matières peuvent très bien avoir chacune leur chapitre « introduction » :
 * un slug nu les fondrait en un seul thème, questions et dette comprises.
 *
 * ⚠️ `nuxt.config.ts` importe ce fichier pour son relevé au build : il doit
 * rester libre de tout import Nuxt, comme `app/utils/cours.ts`.
 */
export interface NiveauxChemin {
  /** « /cours/a1 » */
  annee: string | null
  /** « /cours/a1/remise-a-niveau-maths » */
  matiere: string | null
  /** « /cours/a1/remise-a-niveau-maths/trigonometrie » */
  chapitre: string | null
}

export function niveauxDuChemin(chemin: string | null | undefined): NiveauxChemin {
  // Une ancre ne change pas de niveau : « …/cours#_4-les-valeurs » vit dans le
  // même chapitre que la page qui la porte.
  const segments = (chemin ?? '').split('#')[0]!.split('/').filter(Boolean)
  if (segments[0] !== 'cours') return { annee: null, matiere: null, chapitre: null }
  const prefixe = (n: number) => (segments.length >= n ? '/' + segments.slice(0, n).join('/') : null)
  return { annee: prefixe(2), matiere: prefixe(3), chapitre: prefixe(4) }
}
