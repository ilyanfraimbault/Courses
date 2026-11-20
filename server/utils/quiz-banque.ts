import type { H3Event } from 'h3'
import type {
  CatalogueQuiz, ExtraitQuiz, FiltreQuiz, FragmentContenu, MatiereCatalogue,
  NatureQuestion, NotionCatalogue, QuestionQuiz, QuestionRelevee, SectionCatalogue, ThemeCatalogue
} from '~~/shared/types/quiz'
import { niveauxDuChemin } from '~~/shared/utils/niveaux'

/** Bornes du tirage. Au-delà, la file cesse d'être une séance et devient une corvée. */
export const TAILLE_MIN = 5
export const TAILLE_MAX = 60

/** Une question de la banque, telle que le tirage la manipule. */
export interface EntreeBanque extends QuestionRelevee {
  /** Identité « /chemin#bloc#label », la même que celle de la progression. */
  id: string
  chemin: string
  ficheTitre: string
  /**
   * Nombre de questions de la fiche, compté au build. Il sert de dénominateur
   * quand le quiz est le premier à écrire quelque chose pour cette fiche : sans
   * lui, on créerait une ligne à `total = 0` et le tableau de bord compterait
   * une fiche « commencée » sans savoir sur combien.
   */
  ficheQuestions: number
  /**
   * Chemin de la matière, déduit du chapitre. Une question de QCM qui vise le
   * cours d'un chapitre appartient à la matière de ce chapitre — c'est la même
   * déduction que pour le thème, un niveau plus haut.
   */
  matiere: string | null
  /**
   * Clé de la notion, préfixée par le thème : le même identifiant d'extrait sert
   * dans deux chapitres — `cours-quotient` désigne le quotient de fonctions ici,
   * le quotient de complexes ailleurs — et les confondre ferait proposer une
   * question de complexes à qui vient de rater une dérivée.
   */
  notionCle: string | null
  /** Intitulé de la section du cours, résolu sur la page qui porte l'ancre. */
  sectionTitre: string | null
  /** Rang de la section dans le plan de sa page, pour ordonner le catalogue. */
  sectionOrdre: number
}

/**
 * Le repos d'une question : au-delà, on la considère comme oubliée et digne
 * d'être reposée. En deçà, le tirage lui préfère du neuf — réciter une réponse
 * lue avant-hier ne prouve rien.
 */
export const REPOS = 14 * 24 * 60 * 60 * 1000

/**
 * Le rang d'un candidat au tirage : plus il est bas, plus la question passe
 * devant. C'est la seule chose que le tirage sait de l'histoire de
 * l'utilisateur, et elle lui vient du dehors — la banque, elle, n'appartient à
 * personne.
 */
export type RangCandidat = (entree: EntreeBanque) => number

interface SectionRelevee {
  titre: string
  ordre: number
}

interface PageContenu {
  path: string
  title: string
  icone?: string | null
  ordre?: number | null
  questions?: number | null
  sections?: Record<string, SectionRelevee> | null
  releve?: QuestionRelevee[] | null
}

/** Ce qu'une page d'index apprend d'un niveau : son nom, son icône, son rang. */
export interface MetaNiveau {
  titre: string
  icone: string | null
  /** Chemin de la page d'index, nul quand le dossier n'en a pas. */
  chemin: string | null
  ordre: number
}

export interface MetaMatiere extends MetaNiveau {
  /** Intitulé de l'année : « Première année ». */
  annee: string | null
  /** Chemin de l'année, qui ordonne les matières d'une année à l'autre. */
  anneeChemin: string | null
}

interface Banque {
  /**
   * Toutes les questions identifiables du site, questions ouvertes comprises.
   * C'est la vue dont la progression par domaine a besoin : elle range en
   * domaines ce que la mémoire sait, et la mémoire ignore, elle, si une question
   * se corrigeait toute seule.
   */
  entrees: EntreeBanque[]
  /**
   * Celles que le quiz sait poser. C'est **cette** liste que le tirage, les
   * filtres et le catalogue voient : le reste ne se corrige pas tout seul.
   */
  interrogeables: EntreeBanque[]
  /** Chemin du chapitre → intitulé, icône et rang, relevés sur sa page d'index. */
  chapitres: Map<string, MetaNiveau>
  /** Chemin de la matière → la même chose, et son année. */
  matieres: Map<string, MetaMatiere>
}

/**
 * La banque, chargée une fois.
 *
 * Ce qu'on garde en mémoire est **l'index** relevé au build : quatre cent douze
 * entrées, quatre-vingt-quatre kilo-octets. Les énoncés, eux, ne sont jamais
 * mis en cache : les vingt-sept fiches pèsent vingt-sept mégaoctets d'arbre une
 * fois désérialisées, et les tenir au chaud pour épargner dix millisecondes de
 * `JSON.parse` serait un mauvais échange sur un VPS à deux gigaoctets.
 *
 * En développement le contenu change sous les pieds du serveur, d'où la
 * péremption courte.
 */
let banque: { valeur: Banque, expire: number } | null = null

const PEREMPTION = import.meta.dev ? 5_000 : Number.POSITIVE_INFINITY

/**
 * La collection `cours`, interrogée côté serveur.
 *
 * Nitro auto-importe `queryCollection`, et sa variante serveur prend l'événement
 * en premier argument. Mais le programme TypeScript de l'**application** relit
 * les routes serveur pour typer `$fetch`, et y résout la variante *client*, à un
 * seul argument : `pnpm typecheck` échoue là où le programme serveur, lui, passe.
 * D'où ce retypage, tenu en un seul endroit.
 *
 * Ce qu'il ne faut **pas** faire à la place, c'est importer
 * `@nuxt/content/server` pour retrouver la bonne signature. Ce second chemin
 * vers le même module lui donne une autre identité aux yeux de Rollup, qui
 * embarque alors deux fois le runtime de Nuxt Content — dump de la base de
 * contenu compris — et le pic mémoire du build franchit les 2 Go.
 *
 * Mesuré, tas plafonné à 2048 Mo : `master` passe, l'import explicite échoue sur
 * « JavaScript heap out of memory » pendant l'assemblage Nitro, ce retypage
 * passe. Avec le tas par défaut de 8 Go, les trois passent — cette panne-là ne
 * se voit qu'en bridant la mémoire.
 *
 * Cela ne suffisait pas pour autant à rendre la CI verte : l'assemblage tenait
 * déjà de justesse sous les 2 Go du runner avant ce mode, et le build y reçoit
 * désormais 4 Go explicitement. Voir `.claude/pieges.md`.
 */
type RequeteCours = ReturnType<typeof queryCollection>

export function collectionCours(event: H3Event): RequeteCours {
  const interroger = queryCollection as (event: H3Event, collection: 'cours') => RequeteCours
  return interroger(event, 'cours')
}

/** Une ancre rendue à peu près lisible, faute de mieux : « _4-les-valeurs » → « 4 les valeurs ». */
function lisible(ancre: string): string {
  const texte = ancre.replace(/^_/, '').replace(/-/g, ' ').trim()
  return texte ? texte.charAt(0).toUpperCase() + texte.slice(1) : ancre
}

export async function chargerBanque(event: H3Event): Promise<Banque> {
  if (banque && Date.now() < banque.expire) return banque.valeur

  const pages = await collectionCours(event)
    .select('path', 'title', 'icone', 'ordre', 'questions', 'sections', 'releve')
    .all() as unknown as PageContenu[]

  // Le plan de chaque page, pour donner son intitulé à une section. Une section
  // est nommée « /chemin/de/la/page#ancre » : elle appartient donc souvent à une
  // **autre** page que celle où la question est écrite — une question de QCM
  // relève d'une section du cours. D'où cette table, qui rassemble les plans de
  // toutes les pages avant de résoudre quoi que ce soit.
  const plans = new Map<string, Record<string, SectionRelevee>>()
  for (const page of pages) plans.set(cheminCanonique(page.path), page.sections ?? {})

  const entrees: EntreeBanque[] = []
  for (const page of pages) {
    const chemin = cheminCanonique(page.path)
    for (const q of page.releve ?? []) {
      const [pageSection, ancre] = (q.section ?? '').split('#')
      const releve = pageSection && ancre ? plans.get(pageSection)?.[ancre] : undefined
      entrees.push({
        ...q,
        id: composerIdentite(chemin, q.bloc, q.label),
        chemin,
        ficheTitre: page.title,
        ficheQuestions: page.questions ?? 0,
        matiere: niveauxDuChemin(q.theme ?? chemin).matiere,
        notionCle: q.notion ? `${q.theme ?? '?'}#${q.notion}` : null,
        // Une ancre qui ne se résout pas est un titre renommé sans que les
        // `source` qui le visaient aient suivi. On garde la section quand même,
        // sous une forme lisible : la faire disparaître du catalogue rendrait
        // ses questions introuvables sans rien signaler.
        sectionTitre: releve?.titre ?? (ancre ? lisible(ancre) : null),
        sectionOrdre: releve?.ordre ?? 999
      })
    }
  }

  // Un chapitre et une matière sont nommés par leur page d'index — celle dont le
  // chemin est le leur. C'est elle qui leur donne intitulé, icône et rang,
  // plutôt qu'une table écrite à la main qui vieillirait en silence.
  const parChemin = new Map(pages.map(p => [cheminCanonique(p.path), p]))
  const meta = (chemin: string): MetaNiveau => {
    const page = parChemin.get(chemin)
    return {
      titre: page?.title ?? lisible(chemin.split('/').pop() ?? chemin),
      icone: page?.icone ?? null,
      chemin: page ? chemin : null,
      ordre: page?.ordre ?? 999
    }
  }

  const chapitres = new Map<string, MetaNiveau>()
  const matieres = new Map<string, MetaMatiere>()
  for (const e of entrees) {
    if (e.theme && !chapitres.has(e.theme)) chapitres.set(e.theme, meta(e.theme))
    if (e.matiere && !matieres.has(e.matiere)) {
      const annee = niveauxDuChemin(e.matiere).annee
      matieres.set(e.matiere, {
        ...meta(e.matiere),
        annee: annee ? parChemin.get(annee)?.title ?? null : null,
        anneeChemin: annee
      })
    }
  }

  const valeur: Banque = { entrees, interrogeables: entrees.filter(e => e.interrogeable), chapitres, matieres }
  banque = { valeur, expire: Date.now() + PEREMPTION }
  return valeur
}

/**
 * Les questions retenues par un filtre.
 *
 * Deux axes, qui ne se comportent pas pareil.
 *
 * **Les chapitres et les sections s'additionnent** au lieu de se croiser :
 * cocher un chapitre puis une section d'un autre chapitre demande les deux, pas
 * leur intersection — qui serait vide, et qui rendrait la case à cocher
 * incompréhensible. Rien de coché des deux côtés prend tout.
 *
 * **La dette, elle, se croise** : « ce que j'ai raté » restreint ce qui a été
 * choisi au-dessus, et prend toute la dette quand rien n'est coché. C'est ce
 * qu'on attend d'une case « seulement » — et l'écran l'écrit ainsi.
 */
export function filtrer(
  entrees: EntreeBanque[],
  filtre: FiltreQuiz,
  enDette?: Set<string>,
  trouvees?: Set<string>,
  aRevoir?: Set<string>,
  clos?: string[]
): EntreeBanque[] {
  // La matière n'est pas un axe de plus : c'est le cadre. Elle se croise avec
  // tout le reste, si bien que « rien de coché » prend la matière entière et
  // non le site entier — et que la dette d'une autre matière ne s'invite pas.
  if (filtre.matiere) entrees = entrees.filter(e => e.matiere === filtre.matiere)

  const themes = new Set(filtre.themes)
  const sections = new Set(filtre.sections)
  // Un point de cours précis. Il ne se coche plus à la main, mais « Mes
  // domaines » en désigne un par lien, et les séances ouvertes avant que la
  // sélection ne passe au plan du chapitre en portaient : sans cette ligne
  // elles se retrouveraient sans candidats et ne pourraient plus se terminer.
  const notions = new Set(filtre.notions ?? [])

  // Ce qui est clos sort du « tout », pas du « coché » : un chapitre coché à
  // la main est pris en entier. Voir `docs/clotures.md`.
  const fermes = filtre.ignorerClotures ? [] : (clos ?? [])
  const choisies = !themes.size && !sections.size && !notions.size
    ? entrees.filter(e => !entreeClose(e, fermes))
    : entrees.filter(e =>
        (e.theme && themes.has(e.theme))
        || sections.has(cleSection(e))
        || (e.notionCle && notions.has(e.notionCle)))

  // La dette, les révisions du jour — ce qui est su et dont l'échéance est
  // tombée —, et le neuf. Demandés ensemble, ils s'additionnent : c'est la
  // séance du jour de l'accueil, qui pose la dette, puis ce qui revient, puis
  // de quoi avancer, en une seule fois plutôt qu'en trois boutons.
  if (filtre.erreurs || filtre.aRevoir || filtre.nouvelles) {
    return choisies.filter(e =>
      (filtre.erreurs && !!enDette?.has(e.id))
      || (filtre.aRevoir && !!aRevoir?.has(e.id))
      || (filtre.nouvelles && estNouvelle(e, enDette, trouvees)))
  }
  // « Ce qui me manque » : jamais trouvée, ou trouvée puis ratée depuis. C'est
  // le tamis de la séance du jour d'un contrôle, qui doit poser ce qui reste à
  // apprendre et non ce qui est déjà su. Sans la mémoire des réussites, on ne
  // sait rien écarter : on garde tout plutôt que de ne rien servir.
  if (filtre.nonAcquises && trouvees) return choisies.filter(e => !trouvees.has(e.id) || !!enDette?.has(e.id))
  return choisies
}

/**
 * Une question qu'on n'a jamais trouvée, et qui n'est pas en dette : du neuf.
 * Sans la mémoire des réussites, on ne sait pas ce qui est neuf, et on n'en
 * promet pas — l'inverse de `nonAcquises`, parce qu'ici le neuf **s'ajoute** :
 * tout prendre ferait passer la matière entière pour inédite.
 */
function estNouvelle(e: EntreeBanque, enDette?: Set<string>, trouvees?: Set<string>): boolean {
  return !!trouvees && !trouvees.has(e.id) && !enDette?.has(e.id)
}

/** La case du catalogue où tombent les questions sans section. */
const RESTE = 'reste'

/**
 * La case du plan où tombe une question : sa section, ou le reste de son
 * chapitre. Le catalogue et le filtre la calculent au même endroit — sans quoi
 * la case « le reste du chapitre », une fois cochée, ne retiendrait rien.
 */
export function cleSection(e: EntreeBanque): string {
  return e.section ?? `${e.theme ?? 'divers'}#${RESTE}`
}

/**
 * Le catalogue : les chapitres, leurs sections, et de quoi les compter.
 *
 * Le second niveau suit le **plan du chapitre** et non l'intitulé du rappel de
 * cours visé. Les rappels ne formaient pas une nomenclature : deux d'entre eux,
 * écrits dans deux fiches, portent souvent le même titre, si bien que le même
 * intitulé apparaissait deux fois dans la liste sans rien pour les distinguer —
 * six fois dans les chapitres « fonctions dérivées » et « complexes ». Et les
 * questions qui ne visent aucun rappel n'apparaissaient nulle part : sur les 77
 * questions de trigonométrie, 29 seulement étaient atteignables autrement qu'en
 * cochant le chapitre entier.
 *
 * D'où deux règles ici : une section par case du plan, et **une case de reste**
 * par chapitre, pour que la somme des sections fasse toujours le compte du
 * chapitre. Un chiffre qui ne s'additionne pas est pire qu'un chiffre absent.
 */
export function composerCatalogue(
  banque: Banque,
  enDette?: Set<string>,
  aRevoir?: Set<string>,
  clos: string[] = [],
  trouvees?: Set<string>
): CatalogueQuiz {
  interface Cumul { questions: number, ratees: number, aRevoir: number, nouvelles: number }
  interface Compte extends Cumul {
    titre: string
    ordre: number
    /** Les points de cours de la section, pour résoudre un lien venu de « Mes domaines ». */
    notions: Map<string, NotionCatalogue>
  }
  interface Chapitre { total: Cumul, sections: Map<string, Compte> }
  const parMatiere = new Map<string, { total: Cumul, themes: Map<string, Chapitre> }>()
  const zero = (): Cumul => ({ questions: 0, ratees: 0, aRevoir: 0, nouvelles: 0 })
  const ajouter = (c: Cumul, ratee: number, due: number, neuve: number) => {
    c.questions += 1
    c.ratees += ratee
    c.aRevoir += due
    c.nouvelles += neuve
  }
  // Le compte du site entier, qui suit la même règle que celui d'une matière.
  const site = zero()

  // Les questions ouvertes n'entrent pas au catalogue : annoncer « 18 questions »
  // sur une notion dont le quiz ne sait en poser que 12 ferait une séance qui
  // s'arrête plus tôt que promis.
  for (const e of banque.interrogeables) {
    const theme = e.theme ?? 'divers'
    const ratee = enDette?.has(e.id) ? 1 : 0
    const due = aRevoir?.has(e.id) ? 1 : 0
    const neuve = estNouvelle(e, enDette, trouvees) ? 1 : 0

    const matiere = parMatiere.get(e.matiere ?? 'divers') ?? { total: zero(), themes: new Map<string, Chapitre>() }
    parMatiere.set(e.matiere ?? 'divers', matiere)
    const chapitre = matiere.themes.get(theme) ?? { total: zero(), sections: new Map<string, Compte>() }
    matiere.themes.set(theme, chapitre)
    // La matière compte ce que donne « rien de coché », donc sans le clos ; le
    // chapitre et ses sections comptent ce que donne leur case, donc tout.
    if (!entreeClose(e, clos)) {
      ajouter(matiere.total, ratee, due, neuve)
      ajouter(site, ratee, due, neuve)
    }
    ajouter(chapitre.total, ratee, due, neuve)

    const sections = chapitre.sections
    const cle = cleSection(e)
    const compte = sections.get(cle) ?? {
      titre: e.section ? e.sectionTitre ?? cle : 'Le reste du chapitre',
      ordre: e.section ? e.sectionOrdre : 1000,
      ...zero(),
      notions: new Map<string, NotionCatalogue>()
    }
    ajouter(compte, ratee, due, neuve)
    if (e.notionCle) {
      const notion = compte.notions.get(e.notionCle)
        ?? { cle: e.notionCle, titre: e.notionTitre ?? e.notion!, ...zero() }
      ajouter(notion, ratee, due, neuve)
      compte.notions.set(e.notionCle, notion)
    }
    sections.set(cle, compte)
  }

  const composerTheme = ([cle, { total, sections: comptes }]: [string, Chapitre]): ThemeCatalogue => {
    const chapitre = banque.chapitres.get(cle)
    const sections: SectionCatalogue[] = [...comptes]
      .map(([c, s]) => ({
        cle: c,
        titre: s.titre,
        ordre: s.ordre,
        questions: s.questions,
        ratees: s.ratees,
        aRevoir: s.aRevoir,
        nouvelles: s.nouvelles,
        // « /page#ancre », ou « /chapitre#reste » : le reste du chapitre n'a
        // pas de page à lui, il suit son chapitre.
        clos: sousClos(c.split('#')[0], clos),
        notions: [...s.notions.values()].sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
      }))
      // L'ordre du plan, pas celui du stock : on révise dans l'ordre où on a
      // appris. Le reste du chapitre ferme la marche, par son rang de mille.
      .sort((a, b) => a.ordre - b.ordre || a.titre.localeCompare(b.titre, 'fr'))
      .map(({ ordre: _ordre, ...section }) => section)

    return {
      cle,
      titre: chapitre?.titre ?? cle,
      icone: chapitre?.icone ?? null,
      chemin: chapitre?.chemin ?? null,
      questions: total.questions,
      ratees: total.ratees,
      aRevoir: total.aRevoir,
      nouvelles: total.nouvelles,
      clos: sousClos(cle, clos),
      sections
    }
  }

  const matieres: MatiereCatalogue[] = [...parMatiere].map(([cle, m]) => {
    const meta = banque.matieres.get(cle)
    const themes = [...m.themes].map(composerTheme).sort((a, b) =>
      (banque.chapitres.get(a.cle)?.ordre ?? 999) - (banque.chapitres.get(b.cle)?.ordre ?? 999)
      || a.titre.localeCompare(b.titre, 'fr'))
    return {
      cle,
      titre: meta?.titre ?? cle,
      annee: meta?.annee ?? null,
      icone: meta?.icone ?? null,
      chemin: meta?.chemin ?? null,
      questions: m.total.questions,
      ratees: m.total.ratees,
      aRevoir: m.total.aRevoir,
      nouvelles: m.total.nouvelles,
      clos: sousClos(cle, clos),
      themes
    }
  })

  // L'année d'abord, puis l'ordre de la matière dans son année : c'est l'ordre
  // du sommaire.
  matieres.sort((a, b) => {
    const ma = banque.matieres.get(a.cle)
    const mb = banque.matieres.get(b.cle)
    return (ma?.anneeChemin ?? '').localeCompare(mb?.anneeChemin ?? '')
      || (ma?.ordre ?? 999) - (mb?.ordre ?? 999)
      || a.titre.localeCompare(b.titre, 'fr')
  })

  return {
    total: site.questions,
    // La dette se compte, elle aussi, sur les seules questions que le quiz sait
    // poser : annoncer « 14 à revoir » dont trois sont des questions ouvertes
    // promettrait une séance plus longue que celle qu'on peut servir.
    ratees: site.ratees,
    aRevoir: site.aRevoir,
    nouvelles: site.nouvelles,
    matieres,
    tailleMin: TAILLE_MIN,
    tailleMax: TAILLE_MAX
  }
}

/**
 * Mélange **déterministe** : la même graine rend toujours le même ordre.
 *
 * Il sert à brasser les propositions d'une question. Le déterminisme n'est pas
 * un luxe : la même question est lue au moins deux fois — une fois pour
 * l'afficher, une fois pour la corriger, et souvent une troisième au
 * préchargement. Un mélange tiré à chaque lecture ferait changer l'ordre des
 * propositions sous les doigts entre le moment où on lit et celui où on clique.
 *
 * L'algorithme est un mulberry32 amorcé par un FNV-1a de la graine : cinq
 * lignes, aucune dépendance, et une suite assez brassée pour quatre
 * propositions.
 */
function melangerAvecGraine<T>(liste: T[], graine: string): T[] {
  let etat = 0x811c9dc5
  for (let i = 0; i < graine.length; i++) {
    etat = Math.imul(etat ^ graine.charCodeAt(i), 0x01000193) >>> 0
  }
  const suivant = () => {
    etat = (etat + 0x6d2b79f5) >>> 0
    let t = etat
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const copie = [...liste]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(suivant() * (i + 1))
    const tampon = copie[i]!
    copie[i] = copie[j]!
    copie[j] = tampon
  }
  return copie
}

function melanger<T>(liste: T[]): T[] {
  const copie = [...liste]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tampon = copie[i]!
    copie[i] = copie[j]!
    copie[j] = tampon
  }
  return copie
}

/**
 * Tire `taille` questions parmi les candidates, en les étalant.
 *
 * Un tirage uniforme donnerait volontiers six questions sur la même formule de
 * dérivation, simplement parce qu'elle est la plus représentée — ce qui est
 * l'inverse de ce qu'on demande à une séance de révision. On tourne donc à deux
 * niveaux : un thème après l'autre, et dans chacun une notion après l'autre.
 * Les groupes épuisés sortent du tour, si bien qu'un thème pauvre ne bloque pas
 * le tirage : il donne ce qu'il a, les autres complètent.
 *
 * `rang` décide de l'ordre **à l'intérieur** d'un groupe : d'abord ce qu'on a
 * raté et pas encore retrouvé, puis ce qu'on n'a jamais vu, puis ce qui a eu le
 * temps d'être oublié. Sans lui, une banque de quatre cent trente-deux
 * questions finirait par reposer avant-hier ce qu'on a vu hier, et une séance
 * n'apprendrait plus qu'à reconnaître des énoncés. Le mélange a lieu **avant**
 * le tri, et le tri est stable : à rang égal, l'ordre reste aléatoire.
 */
export function tirer(candidats: EntreeBanque[], taille: number, rang?: RangCandidat): EntreeBanque[] {
  const parTheme = new Map<string, Map<string, EntreeBanque[]>>()
  for (const e of candidats) {
    const theme = e.theme ?? 'divers'
    const notions = parTheme.get(theme) ?? new Map<string, EntreeBanque[]>()
    parTheme.set(theme, notions)
    const cle = e.notionCle ?? `${theme}/(sans notion)`
    notions.set(cle, [...(notions.get(cle) ?? []), e])
  }

  // Les groupes se vident par la fin (`pop`), d'où le tri décroissant : le rang
  // le plus bas se retrouve en dernier, et sort le premier.
  const ordonner = (liste: EntreeBanque[]) =>
    rang ? melanger(liste).sort((a, b) => rang(b) - rang(a)) : melanger(liste)

  const themes = melanger([...parTheme].map(([, notions]) =>
    melanger([...notions.values()].map(ordonner))))

  const tirees: EntreeBanque[] = []
  let curseurTheme = 0
  const curseurs = new Map<number, number>()

  while (tirees.length < taille && themes.some(t => t.length)) {
    const theme = themes[curseurTheme % themes.length]!
    if (theme.length) {
      const i = (curseurs.get(curseurTheme % themes.length) ?? 0) % theme.length
      const groupe = theme[i]!
      const question = groupe.pop()
      if (question) tirees.push(question)
      if (!groupe.length) theme.splice(i, 1)
      curseurs.set(curseurTheme % themes.length, i + 1)
    }
    curseurTheme += 1
  }

  return tirees
}

/**
 * La question à poser à la place d'une question ratée.
 *
 * On ne repose jamais la même : réciter la réponse qu'on vient de lire ne prouve
 * rien. On cherche donc, dans l'ordre, une question **du même point de cours**,
 * puis du même exercice, puis de la même **section du cours**, puis du même
 * chapitre, puis n'importe laquelle du filtre — et toujours une qu'on n'a pas
 * encore vue dans cette session.
 *
 * Le palier « même bloc » ne vaut que pour un **exercice** : ses questions
 * portent sur un même sujet par construction, et la voisine de la question
 * ratée est souvent le meilleur substitut qui soit. Un QCM, lui, mélange les
 * chapitres exprès — proposer « une autre question du QCM 1 » reviendrait à
 * tirer au hasard, ce que le palier suivant fait déjà mieux en restant dans le
 * chapitre.
 *
 * Quand il ne reste rien, on repose la question manquée, en le disant : c'est
 * la seule façon de tenir la promesse « ça continue tant que tout n'est pas
 * acquis » quand la banque est à sec.
 */
export function choisirSimilaire(
  candidats: EntreeBanque[],
  manquee: EntreeBanque,
  exclues: Set<string>
): { entree: EntreeBanque, rejouee: boolean } {
  const libres = candidats.filter(e => !exclues.has(e.id))

  const paliers: EntreeBanque[][] = [
    manquee.notionCle ? libres.filter(e => e.notionCle === manquee.notionCle) : [],
    manquee.nature === 'exercice'
      ? libres.filter(e => e.chemin === manquee.chemin && e.bloc === manquee.bloc)
      : [],
    manquee.section ? libres.filter(e => e.section === manquee.section) : [],
    manquee.theme ? libres.filter(e => e.theme === manquee.theme) : [],
    libres
  ]

  for (const palier of paliers) {
    if (palier.length) return { entree: palier[Math.floor(Math.random() * palier.length)]!, rejouee: false }
  }

  return { entree: manquee, rejouee: true }
}

/* ---------------------------------------------------------------------------
   La lecture d'un énoncé, à la demande.
   --------------------------------------------------------------------------- */

const BALISES_QUESTION = new Set(['exo-question', 'qcm-question', 'question'])
const BALISES_BLOC = new Set(['exercice', 'qcm'])
const LETTRES = ['a', 'b', 'c', 'd', 'e']

type Noeud = [string, Record<string, unknown>, ...unknown[]]

function estNoeud(valeur: unknown): valeur is Noeud {
  return Array.isArray(valeur) && typeof valeur[0] === 'string'
}

/** Le premier nœud qui satisfait `test`, en profondeur. */
function chercher(noeuds: unknown, test: (n: Noeud) => boolean): Noeud | null {
  if (!Array.isArray(noeuds)) return null
  for (const noeud of noeuds) {
    if (!estNoeud(noeud)) continue
    if (test(noeud)) return noeud
    const trouve = chercher(noeud.slice(2), test)
    if (trouve) return trouve
  }
  return null
}

/** Les slots d'un nœud MDC, par nom : `#a`, `#indice`, `#solution`. */
function slots(noeud: Noeud): Record<string, FragmentContenu> {
  const sortie: Record<string, FragmentContenu> = {}
  for (const enfant of noeud.slice(2)) {
    if (!estNoeud(enfant) || enfant[0] !== 'template') continue
    const cle = Object.keys(enfant[1] ?? {}).find(c => c.startsWith('v-slot:'))
    if (!cle) continue
    sortie[cle.slice('v-slot:'.length)] = enfant.slice(2)
  }
  return sortie
}

/**
 * Renomme, dans une correction ou un indice, les lettres de la fiche en repères
 * affichés.
 *
 * La correction est écrite pour la fiche, où les propositions gardent l'ordre
 * de leur écriture : « **a** et **b** ont une hypothèse fausse… Réponse : d ».
 * Le quiz les brasse ; lue telle quelle sous des propositions remises dans un
 * autre ordre, elle désignait la mauvaise ligne et se contredisait avec le
 * verdict « Juste ». Réécrire les ~260 corrections sans lettres aurait appauvri
 * la fiche, où elles sont exactes ; on les traduit donc au moment de les
 * envoyer.
 *
 * Deux écritures seulement désignent une proposition dans le contenu : une
 * lettre seule en gras, et une réponse encadrée `\boxed{\text{d}}`. Ailleurs un
 * « a » est une variable — $(a+b)^2$ — et n'a pas à bouger.
 */
function renommerLettres(fragment: FragmentContenu | null, reperes: Record<string, string>): FragmentContenu | null {
  if (!fragment) return null

  // Une lettre de la fiche, ou rien : on ne renomme qu'une proposition qui
  // existe, pour ne pas toucher un « **e** » qui serait autre chose.
  const repere = (texte: unknown) =>
    typeof texte === 'string' && Object.hasOwn(reperes, texte.trim()) ? reperes[texte.trim()]! : null

  // Dans une formule, la lettre apparaît deux fois — en MathML pour les
  // lecteurs d'écran et en HTML pour l'œil — plus dans l'annotation TeX : tout
  // ce qui la porte change ensemble, sans quoi la copie d'une formule rendrait
  // l'ancienne réponse.
  const remplacerFeuilles = (valeur: unknown, ancienne: string, nouvelle: string): unknown => {
    if (typeof valeur === 'string') return valeur === ancienne ? nouvelle : valeur
    if (!estNoeud(valeur)) return valeur
    const [balise, attributs, ...enfants] = valeur
    if (balise === 'annotation') {
      return [balise, attributs, ...enfants.map(e => typeof e === 'string' ? e.replace(`{${ancienne}}`, `{${nouvelle}}`) : e)]
    }
    return [balise, attributs, ...enfants.map(e => remplacerFeuilles(e, ancienne, nouvelle))]
  }

  const parcourir = (valeur: unknown): unknown => {
    if (!estNoeud(valeur)) return valeur
    const [balise, attributs, ...enfants] = valeur

    if (balise === 'strong' && enfants.length === 1) {
      const nouvelle = repere(enfants[0])
      if (nouvelle) return [balise, attributs, nouvelle]
    }

    const classes = attributs?.className
    if (balise === 'span' && Array.isArray(classes) && classes.includes('katex')) {
      const annotation = chercher(enfants, n => n[0] === 'annotation')
      const tex = typeof annotation?.[2] === 'string' ? annotation[2].trim() : ''
      const lettre = /^\\boxed\{\\text\{([a-z])\}\}$/.exec(tex)?.[1]
      const nouvelle = lettre ? repere(lettre) : null
      return lettre && nouvelle ? remplacerFeuilles(valeur, lettre, nouvelle) : valeur
    }

    return [balise, attributs, ...enfants.map(parcourir)]
  }

  return fragment.map(parcourir)
}

/** Le contenu par défaut d'un nœud : ses enfants, slots exclus. */
function corps(noeud: Noeud): FragmentContenu {
  return noeud.slice(2).filter(enfant => !(estNoeud(enfant) && enfant[0] === 'template'))
}

export interface QuestionLue {
  label: string
  bonne: string
  nature: NatureQuestion
  blocTitre: string
  ficheTitre: string
  lettres: string[]
  enonceBloc: FragmentContenu | null
  enonce: FragmentContenu
  choix: Record<string, FragmentContenu>
  indice: FragmentContenu | null
  solution: FragmentContenu | null
  extrait: ExtraitQuiz | null
}

/**
 * Relit une question dans le corps de sa fiche.
 *
 * C'est ici que le quiz emprunte au contenu au lieu de le dupliquer : l'énoncé,
 * les propositions, l'indice, la solution rédigée et jusqu'au rappel de cours
 * visé sont ceux de la fiche, à l'octet près. Une correction du cours corrige le
 * quiz, sans rien à resynchroniser.
 */
/** Le corps d'une fiche, tel que la lecture d'une question en a besoin. */
interface PageLue {
  title?: string
  body?: { value?: unknown }
}

/**
 * Les fiches déjà lues pendant une même requête.
 *
 * Une séance de quiz ne lit qu'une question à la fois, mais un QCM composé en
 * pose vingt d'un coup, souvent prises dans trois ou quatre fiches : relire la
 * même fiche vingt fois, c'est désérialiser vingt fois un mégaoctet d'arbre. Le
 * cache ne vit que le temps de la requête — la règle « les énoncés ne sont
 * jamais tenus au chaud » reste vraie d'une requête à l'autre.
 */
export type CachePages = Map<string, Promise<PageLue | null>>

function lirePage(event: H3Event, chemin: string, cache?: CachePages): Promise<PageLue | null> {
  const dejaLue = cache?.get(chemin)
  if (dejaLue) return dejaLue
  const lecture = collectionCours(event).path(chemin).first() as Promise<PageLue | null>
  cache?.set(chemin, lecture)
  return lecture
}

export async function lireQuestion(event: H3Event, entree: EntreeBanque, cache?: CachePages): Promise<QuestionLue | null> {
  const page = await lirePage(event, entree.chemin, cache)
  if (!page?.body?.value) return null

  // On retrouve le bloc par son **intitulé exact**, celui-là même que le relevé
  // du build a rangé dans l'index. Repasser par `slugifier` obligerait le
  // serveur à embarquer une fonction de l'application pour retrouver ce qu'il
  // sait déjà.
  const bloc = chercher(page.body.value, n =>
    BALISES_BLOC.has(n[0]) && n[1]?.titre === entree.blocTitre)
  if (!bloc) return null

  const question = chercher(bloc.slice(2), n =>
    BALISES_QUESTION.has(n[0]) && n[1]?.label === entree.label)
  if (!question) return null

  const bonne = question[1]?.bonne
  if (typeof bonne !== 'string') return null

  const parts = slots(question)
  const lettres = LETTRES.filter(l => parts[l])
  const choix: Record<string, FragmentContenu> = {}
  for (const lettre of lettres) choix[lettre] = parts[lettre]!

  // L'énoncé commun du bloc : ce qui précède sa première question.
  //
  // « Donner l'affixe du vecteur M₂M₄ » est insoluble sans « les points lus sur
  // la figure sont M₁(2,1), M₂(0,3)… », qui est écrit une fois en tête de
  // l'exercice et vaut pour toutes ses questions. Poser la question sans lui,
  // c'est demander de deviner.
  //
  // Tous les entêtes ne sont pas des énoncés pour autant : un palier
  // d'entraînement s'ouvre sur la méthode à suivre, et la rappeler au-dessus de
  // chaque question reviendrait à souffler la réponse. Le bloc le dit lui-même,
  // par `entete="introduction"` — un attribut explicite plutôt qu'une
  // heuristique, parce qu'une heuristique qui se trompe rend une question
  // insoluble sans le dire. L'absence d'attribut vaut « c'est un énoncé » :
  // c'est le défaut sûr, l'oubli ne coûte alors qu'un peu de bruit.
  //
  // On s'arrête à la première question : ce qui vient après appartient à une
  // autre. Aucun `extrait-cours` ne vit dans un bloc — vérifié sur les 111 du
  // site —, il n'y a donc pas de rappel de cours à écarter au passage.
  const enonceBloc: FragmentContenu = []
  if (bloc[1]?.entete !== 'introduction') {
    for (const enfant of bloc.slice(2)) {
      if (estNoeud(enfant) && BALISES_QUESTION.has(enfant[0])) break
      if (estNoeud(enfant) && enfant[0] === 'template') continue
      // Les blancs entre deux nœuds arrivent en texte : les garder ferait passer
      // pour un énoncé un bloc qui n'en a pas.
      if (typeof enfant === 'string' && !enfant.trim()) continue
      enonceBloc.push(enfant)
    }
  }

  // Le rappel de cours vit ailleurs sur la page, et plusieurs questions le
  // partagent : on le retrouve par son identifiant, exactement comme le bouton
  // « Cours » d'une fiche.
  let extrait: ExtraitQuiz | null = null
  const idExtrait = question[1]?.cours
  if (typeof idExtrait === 'string') {
    const noeud = chercher(page.body.value, n => n[0] === 'extrait-cours' && n[1]?.id === idExtrait)
    if (noeud && typeof noeud[1]?.titre === 'string') {
      extrait = {
        titre: noeud[1].titre,
        source: typeof noeud[1].source === 'string' ? noeud[1].source : null,
        corps: corps(noeud)
      }
    }
  }

  return {
    label: entree.label,
    bonne,
    nature: entree.nature,
    blocTitre: typeof bloc[1]?.titre === 'string' ? bloc[1].titre : entree.blocTitre,
    ficheTitre: page.title ?? entree.ficheTitre,
    lettres,
    enonceBloc: enonceBloc.length ? enonceBloc : null,
    enonce: corps(question),
    choix,
    indice: parts.indice ?? null,
    solution: parts.solution ?? null,
    extrait
  }
}

/**
 * Assemble la question à afficher.
 *
 * La bonne réponse **ne part pas** avec elle : elle reste au serveur jusqu'à ce
 * qu'on ait répondu. C'est la seule façon d'empêcher qu'on la lise dans la
 * charge utile de la page, et c'est cohérent avec le reste — le plafond de
 * tentatives, l'unicité d'une cible de to-do : une règle vit à un seul endroit,
 * et cet endroit est le serveur.
 */
export async function poserQuestion(
  event: H3Event,
  banque: Banque,
  entree: EntreeBanque,
  position: number,
  rejouee: boolean,
  graine: string,
  cache?: CachePages
): Promise<{ question: QuestionQuiz, lue: QuestionLue } | null> {
  const lu = await lireQuestion(event, entree, cache)
  if (!lu) return null

  const lettres = melangerAvecGraine(lu.lettres, `${graine}:${entree.id}`)
  // La correction suit l'ordre brassé : elle nomme les propositions comme
  // l'écran les a montrées. `bonne` et `lettres`, eux, restent ceux de la
  // fiche — ce sont eux qu'on compare à la réponse et qu'on reporte.
  const reperes = reperesQuiz(lettres)
  const lue: QuestionLue = {
    ...lu,
    indice: renommerLettres(lu.indice, reperes),
    solution: renommerLettres(lu.solution, reperes)
  }

  return {
    lue,
    question: {
      id: entree.id,
      label: lue.label,
      theme: entree.theme,
      themeTitre: entree.theme ? banque.chapitres.get(entree.theme)?.titre ?? null : null,
      matiereTitre: entree.matiere ? banque.matieres.get(entree.matiere)?.titre ?? null : null,
      sectionTitre: entree.sectionTitre,
      notionTitre: entree.notionTitre,
      nature: entree.nature,
      fiche: {
        chemin: entree.chemin,
        titre: lue.ficheTitre,
        bloc: entree.bloc,
        blocTitre: lue.blocTitre
      },
      // Les propositions partent dans un ordre **tiré**, propre à cette place de
      // cette séance. Une question posée dans le cours l'est toujours dans
      // l'ordre où elle est écrite, et la bonne réponse d'un exercice donné
      // finit par se retenir comme « c'est la c » plutôt que par son contenu.
      // Le client, lui, ne voit que des repères de position : la lettre écrite
      // dans la fiche ne transparaît nulle part — pas même dans la correction.
      lettres,
      enonceBloc: lue.enonceBloc,
      enonce: lue.enonce,
      choix: lue.choix,
      rejouee,
      position
    }
  }
}

/** L'entrée de banque d'une identité, ou null si le contenu ne la porte plus. */
export function trouverEntree(banque: Banque, id: string): EntreeBanque | null {
  return banque.entrees.find(e => e.id === id) ?? null
}

export type { Banque }
