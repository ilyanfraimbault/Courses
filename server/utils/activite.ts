import type { DatabaseSync } from 'node:sqlite'
import type { ActiviteChapitre, ActiviteFiche, ActiviteMatiere } from '~~/shared/types/activite'
import { niveauxDuChemin } from '~~/shared/utils/niveaux'
import type { Banque } from './quiz-banque.ts'

/**
 * Les jours travaillés, et ce qu'on y a travaillé.
 *
 * Rien ne retient « j'ai travaillé ce jour-là » : comme la révision espacée,
 * cela se **déduit** de l'histoire, et c'est la même histoire —
 * `lireHistorique`, qui relit réussites, fautes, réponses au quiz et copies de
 * QCM. Les points du calendrier et le détail d'un jour en sortent tous deux :
 * un jour marqué ne peut pas ouvrir un détail vide, ni l'inverse.
 */

/** L'instant `t` et l'identité qu'il concerne. */
interface Geste {
  id: string
  t: number
}

function gestes(db: DatabaseSync, uid: number, banque: Banque): Geste[] {
  const liste: Geste[] = []
  for (const [id, evenements] of lireHistorique(db, uid, banque)) {
    for (const e of evenements) liste.push({ id, t: e.t })
  }
  return liste
}

/** Les jours, dans le fuseau de l'élève, où il s'est passé quelque chose. */
export function joursTravailles(db: DatabaseSync, uid: number, banque: Banque, fuseau: string): string[] {
  // Un seul formateur : `jourDe` en construit un par appel, et un compte actif
  // porte des milliers de réponses au quiz.
  const format = new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' })
  const jours = new Set<string>()
  for (const g of gestes(db, uid, banque)) jours.add(format.format(new Date(g.t)))
  return [...jours].sort()
}

/** Découpe « /chemin#bloc#label » sur le premier « # » : un slug de bloc n'en contient pas. */
function eclater(id: string): { chemin: string, bloc: string } | null {
  const i = id.indexOf('#')
  if (i <= 0) return null
  const reste = id.slice(i + 1)
  const j = reste.indexOf('#')
  if (j <= 0) return null
  return { chemin: id.slice(0, i), bloc: reste.slice(0, j) }
}

/** Le dernier segment d'un chemin, lisible à défaut de titre. */
function nomDuChemin(chemin: string): string {
  const segment = chemin.split('/').filter(Boolean).pop() ?? chemin
  return segment.replace(/^\d+\./, '').replace(/-/g, ' ')
}

/**
 * Ce qui a été travaillé entre `debut` et `fin`, rangé matière › chapitre ›
 * fiche › exercice. Chaque niveau compte les **questions distinctes** touchées :
 * une question ratée puis retrouvée dans la même séance n'en fait qu'une.
 */
export function activiteEntre(db: DatabaseSync, uid: number, banque: Banque, debut: number, fin: number): ActiviteMatiere[] {
  const parId = new Map(banque.entrees.map(e => [e.id, e]))
  const touchees = new Set<string>()
  for (const g of gestes(db, uid, banque)) if (g.t >= debut && g.t < fin) touchees.add(g.id)

  const matieres = new Map<string, ActiviteMatiere & { chapitresParCle: Map<string, ActiviteChapitre & { fichesParChemin: Map<string, ActiviteFiche> }> }>()

  for (const id of touchees) {
    const entree = parId.get(id)
    const morceaux = entree ? { chemin: entree.chemin, bloc: entree.bloc } : eclater(id)
    if (!morceaux) continue
    // La matière et le chapitre se lisent dans le chemin de la **fiche**, pas
    // dans le thème de la question : un QCM qui mélange les chapitres a été
    // travaillé là où il vit.
    const niveaux = niveauxDuChemin(morceaux.chemin)
    const cleMatiere = niveaux.matiere ?? ''
    const metaMatiere = niveaux.matiere ? banque.matieres.get(niveaux.matiere) : undefined
    const matiere = matieres.get(cleMatiere) ?? {
      chemin: niveaux.matiere,
      titre: metaMatiere?.titre ?? (niveaux.matiere ? nomDuChemin(niveaux.matiere) : 'Contenu retiré'),
      questions: 0,
      chapitres: [],
      chapitresParCle: new Map()
    }
    matieres.set(cleMatiere, matiere)
    matiere.questions += 1

    const cleChapitre = niveaux.chapitre ?? ''
    const metaChapitre = niveaux.chapitre ? banque.chapitres.get(niveaux.chapitre) : undefined
    const chapitre = matiere.chapitresParCle.get(cleChapitre) ?? {
      chemin: niveaux.chapitre,
      titre: metaChapitre?.titre ?? (niveaux.chapitre ? nomDuChemin(niveaux.chapitre) : 'Hors chapitre'),
      questions: 0,
      fiches: [],
      fichesParChemin: new Map()
    }
    matiere.chapitresParCle.set(cleChapitre, chapitre)
    chapitre.questions += 1

    const fiche: ActiviteFiche = chapitre.fichesParChemin.get(morceaux.chemin) ?? {
      chemin: morceaux.chemin,
      titre: entree?.ficheTitre ?? nomDuChemin(morceaux.chemin),
      questions: 0,
      exercices: []
    }
    chapitre.fichesParChemin.set(morceaux.chemin, fiche)
    fiche.questions += 1

    let exercice = fiche.exercices.find(x => x.bloc === morceaux.bloc)
    if (!exercice) {
      exercice = { bloc: morceaux.bloc, titre: entree?.blocTitre ?? nomDuChemin(morceaux.bloc), questions: 0 }
      fiche.exercices.push(exercice)
    }
    exercice.questions += 1
  }

  // Dans l'ordre du cours : les matières par rang de leur page d'index, le
  // reste par chemin — les préfixes numériques des dossiers (« 2.arbres »)
  // donnent l'ordre du professeur.
  const parChemin = (a: { chemin: string | null }, b: { chemin: string | null }) =>
    (a.chemin ?? '￿').localeCompare(b.chemin ?? '￿', 'fr', { numeric: true })
  return [...matieres.values()]
    .sort((a, b) => (banque.matieres.get(a.chemin ?? '')?.ordre ?? 999) - (banque.matieres.get(b.chemin ?? '')?.ordre ?? 999) || parChemin(a, b))
    .map(({ chapitresParCle, ...m }) => ({
      ...m,
      chapitres: [...chapitresParCle.values()].sort(parChemin).map(({ fichesParChemin, ...c }) => ({
        ...c,
        fiches: [...fichesParChemin.values()].sort(parChemin)
      }))
    }))
}
