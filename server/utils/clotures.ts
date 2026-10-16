import type { DatabaseSync } from 'node:sqlite'
import type { NatureCloture } from '~~/shared/types/clotures'
import { niveauxDuChemin } from '~~/shared/utils/niveaux'
import type { Banque, EntreeBanque } from './quiz-banque.ts'

/**
 * Les clôtures : ce que l'élève a déclaré fini. Voir `docs/clotures.md`.
 *
 * Une clôture **retire du « tout »**, pas du « coché ». Une séance lancée sur
 * toute la matière, les révisions du jour, la progression et l'accueil ne
 * voient plus ce qui est clos ; un chapitre coché à la main dans le quiz, lui,
 * est pris en entier, clos ou non. C'est ce qui garde la clôture réversible
 * sans détour : on peut toujours retravailler un chapitre fini sans le rouvrir,
 * et un contrôle qui porte dessus continue de le voir.
 */

/** Les chemins clos du compte. Quelques lignes : un tableau suffit. */
export function cheminsClos(db: DatabaseSync, uid: number): string[] {
  return (db.prepare('SELECT chemin FROM cloture WHERE utilisateur_id = ?')
    .all(uid) as unknown as { chemin: string }[]).map(l => l.chemin)
}

/** Vrai quand `chemin` est clos, ou vit sous un chemin clos. */
export function sousClos(chemin: string | null | undefined, clos: string[]): boolean {
  if (!chemin || !clos.length) return false
  return clos.some(c => chemin === c || chemin.startsWith(c + '/'))
}

/**
 * Une question est close quand sa fiche l'est, ou le chapitre de son rappel de
 * cours, ou sa matière. Le chapitre ne se lit pas seulement dans le chemin de
 * la fiche : une question du QCM final vit dans la fiche du QCM mais relève de
 * la trigonométrie, et clore la trigonométrie doit l'emporter avec elle — c'est
 * la même déduction que pour le thème du quiz.
 */
export function entreeClose(e: EntreeBanque, clos: string[]): boolean {
  if (!clos.length) return false
  return sousClos(e.chemin, clos) || sousClos(e.theme, clos) || sousClos(e.matiere, clos)
}

/**
 * Ce qu'un chemin désigne, s'il désigne quelque chose qu'on peut clore : une
 * matière, un chapitre ou une fiche qui porte des questions. Le reste — une
 * année, une page sans question, un chemin inventé — n'a rien à clore, et la
 * route le refuse plutôt que de garder une ligne qui ne retirerait rien.
 */
export function natureDuChemin(banque: Banque, chemin: string): { nature: NatureCloture, titre: string } | null {
  const matiere = banque.matieres.get(chemin)
  if (matiere) return { nature: 'matiere', titre: matiere.titre }
  const chapitre = banque.chapitres.get(chemin)
  if (chapitre) return { nature: 'chapitre', titre: chapitre.titre }
  for (const e of banque.entrees) {
    if (e.chemin === chemin) return { nature: 'fiche', titre: e.ficheTitre }
  }
  // Un dossier de chapitre qui n'est le thème d'aucune question — le dossier
  // du QCM final, dont chaque question relève d'un autre chapitre — reste un
  // chapitre aux yeux du sommaire, et se clôt comme tel.
  for (const e of banque.entrees) {
    if (niveauxDuChemin(e.chemin).chapitre === chemin) {
      return { nature: 'chapitre', titre: chemin.split('/').pop() ?? chemin }
    }
  }
  return null
}
