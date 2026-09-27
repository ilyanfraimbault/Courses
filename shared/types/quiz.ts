/**
 * Le mode quiz : une question au milieu de l'écran, une seule à la fois, et une
 * file qui ne se vide que lorsque tout est acquis.
 *
 * Les questions ne sont pas écrites pour lui : elles sont **relevées** dans les
 * fiches existantes — exercices, entraînements et QCM confondus. Le relevé a
 * lieu au build (voir le hook `content:file:afterParse` de `nuxt.config.ts`),
 * et c'est lui qui donne au quiz sa banque sans dupliquer une seule question.
 */

/**
 * Un fragment d'arbre minimark, tel que `ContentRenderer` sait le rendre. On ne
 * le manipule jamais autrement que pour le transporter, d'où le type opaque.
 */
export type FragmentContenu = unknown[]

/** Nature du bloc dont la question est tirée. */
export type NatureQuestion = 'exercice' | 'qcm'

/**
 * Une question telle que le relevé du build la connaît : de quoi la **choisir**
 * et la **classer**, jamais de quoi la poser. C'est ce qui tient dans la
 * collection sans la gonfler — l'énoncé, lui, est relu à la demande dans le
 * corps de la fiche.
 */
export interface QuestionRelevee {
  /** Slug du bloc, seconde pièce de l'identité de la question. */
  bloc: string
  /** Intitulé du bloc, tel qu'il s'affiche : « Exercice 3 — Études de fonctions ». */
  blocTitre: string
  /** Repère de la question dans son bloc : « 12. », « a) ». */
  label: string
  nature: NatureQuestion
  /** Nombre de propositions effectivement écrites. */
  choix: number
  /**
   * Vrai quand la question se corrige toute seule. Le relevé porte **toutes**
   * les questions identifiables du site, parce que la progression par domaine
   * les compte toutes ; le quiz, lui, ne tire que dans celles-ci.
   */
  interrogeable: boolean
  /** Identifiant de l'extrait de cours visé, s'il y en a un. */
  notion: string | null
  /** Intitulé de cet extrait, qui sert de nom lisible à la notion. */
  notionTitre: string | null
  /**
   * Chapitre auquel la question se rattache. Il vient de l'extrait de cours
   * qu'elle vise — un QCM mélange les chapitres, mais chacune de ses questions
   * renvoie au cours d'un seul — et, à défaut, du chapitre de la fiche.
   *
   * Désigné par son chemin, « /cours/a1/…/trigonometrie » : deux matières
   * peuvent avoir un chapitre du même nom.
   */
  theme: string | null
  /**
   * Section du cours dont la question relève, sous la forme
   * « /chemin/de/la/page#ancre ». C'est le second niveau de la sélection : le
   * plan du chapitre, tel qu'il est écrit dans la page de cours.
   *
   * Elle vient de l'ancre du rappel de cours visé, et à défaut du titre de
   * niveau 2 qui précède la question dans sa propre page — ce qui rattrape les
   * contrôles express insérés au fil du cours, qui ne visent aucun rappel.
   */
  section: string | null
}

/**
 * Une section du cours dans le catalogue : une case du plan du chapitre.
 *
 * Le second niveau de la sélection a d'abord été l'intitulé du rappel de cours
 * visé. C'était illisible : deux rappels écrits dans deux fiches différentes
 * portent souvent le même titre, si bien que le même intitulé apparaissait deux
 * fois — six fois dans les chapitres « fonctions dérivées » et « complexes » —
 * et les questions qui ne visent aucun rappel n'apparaissaient nulle part. Sur
 * les 77 questions de trigonométrie, 29 seulement étaient atteignables autrement
 * qu'en cochant le chapitre entier.
 */
export interface SectionCatalogue {
  /** « /chemin/de/la/page#ancre », identique au champ `section` des questions. */
  cle: string
  /** L'intitulé de la section, tel qu'il est écrit dans le cours. */
  titre: string
  questions: number
  /** Parmi elles, celles qui sont en dette : ratées et pas encore retrouvées. */
  ratees: number
  /**
   * Les points de cours qui vivent dans cette section. Ils ne s'affichent pas
   * dans la liste — c'est précisément leur ambiguïté qui a fait passer la
   * sélection au plan du chapitre — mais « Mes domaines » raisonne en points de
   * cours, et son lien « m'interroger là-dessus » a besoin de les nommer et de
   * les compter. Un point de cours vit dans une seule section, puisque les deux
   * viennent de la même `source`.
   */
  notions: NotionCatalogue[]
}

/** Un point de cours : l'intitulé d'un rappel, et ce qu'il pèse. */
export interface NotionCatalogue {
  /** « /chemin/du/chapitre#identifiant-extrait » : le même identifiant sert dans deux chapitres. */
  cle: string
  titre: string
  questions: number
  ratees: number
}

export interface ThemeCatalogue {
  /** Chemin du chapitre : « /cours/a1/remise-a-niveau-maths/trigonometrie ». */
  cle: string
  titre: string
  icone: string | null
  /** Chemin de la page de sommaire du chapitre, quand elle existe. */
  chemin: string | null
  questions: number
  ratees: number
  sections: SectionCatalogue[]
}

/**
 * Une matière, premier niveau du catalogue.
 *
 * On ne se fait pas interroger « sur tout » : deux matières mélangées dans une
 * même séance ne révisent ni l'une ni l'autre. La sélection commence donc par
 * la matière, et « rien de coché » y veut dire « toute la matière ».
 */
export interface MatiereCatalogue {
  /** Chemin de la matière : « /cours/a1/remise-a-niveau-maths ». */
  cle: string
  titre: string
  /** Intitulé de l'année qui la porte : « Première année ». */
  annee: string | null
  icone: string | null
  chemin: string | null
  questions: number
  ratees: number
  themes: ThemeCatalogue[]
}

export interface CatalogueQuiz {
  total: number
  /** Questions en dette, toutes matières confondues. */
  ratees: number
  matieres: MatiereCatalogue[]
  /** Bornes acceptées pour la taille d'un tirage, pour que le client n'invente rien. */
  tailleMin: number
  tailleMax: number
}

/** Ce sur quoi on demande à être interrogé. Vide de tout côté = tout le catalogue. */
export interface FiltreQuiz {
  /**
   * Le chemin de la matière. Elle **restreint** tout le reste : rien de coché
   * veut dire toute la matière, et une dette prise seule ne déborde pas sur une
   * autre. Nulle dans les séances ouvertes avant qu'il y ait des matières.
   */
  matiere?: string | null
  themes: string[]
  sections: string[]
  /**
   * Ne tirer que dans les questions en dette — ratées quelque part sur le site
   * et pas encore retrouvées depuis. Se croise avec les chapitres et les
   * sections cochés ; seul, il prend toute la dette.
   */
  erreurs?: boolean
  /**
   * Ne tirer que ce qui n'est pas encore su : jamais trouvé, ou trouvé puis raté
   * depuis. Il ne se coche pas à l'écran du quiz ; c'est la séance du jour d'un
   * contrôle qui le demande, pour poser ce qui reste à apprendre plutôt que ce
   * qu'on sait déjà. Se croise avec la sélection, comme la dette.
   */
  nonAcquises?: boolean
  /**
   * Ne tirer que les révisions du jour : les questions sues dont l'échéance de
   * révision espacée est tombée. Comme `nonAcquises`, il ne se coche pas à
   * l'écran du quiz — c'est la page d'accueil qui ouvre ces séances.
   */
  aRevoir?: boolean
  /**
   * Des points de cours précis. Ils ne se cochent pas à la main — la liste des
   * sections a remplacé la leur — mais un lien venu de « Mes domaines » en
   * désigne un, et les séances ouvertes avant ce changement en portaient. Ils
   * s'additionnent aux chapitres et aux sections comme le reste.
   */
  notions?: string[]
}

/** Une question prête à être posée. La bonne réponse n'y figure pas. */
export interface QuestionQuiz {
  /** Identité « /chemin#bloc#label », la même que celle de la progression. */
  id: string
  label: string
  theme: string | null
  themeTitre: string | null
  matiereTitre: string | null
  /** L'intitulé de la section du cours, tel qu'il s'affiche en tête de question. */
  sectionTitre: string | null
  notionTitre: string | null
  nature: NatureQuestion
  /** D'où elle vient, pour pouvoir y retourner. */
  fiche: { chemin: string, titre: string, bloc: string, blocTitre: string }
  /** Lettres proposées, dans l'ordre d'affichage. */
  lettres: string[]
  /**
   * L'énoncé commun du bloc, quand il y en a un : « Les points lus sur la figure
   * sont M₁(2,1), M₂(0,3)… ». Sans lui, « Donner l'affixe du vecteur M₂M₄ » ne
   * veut rien dire — et c'est le cas de 210 des 432 questions à choix du site.
   *
   * Nul quand le bloc déclare `entete="introduction"` : son entête est alors une
   * introduction pédagogique, pas un énoncé, et la rappeler soufflerait la
   * méthode.
   */
  enonceBloc: FragmentContenu | null
  enonce: FragmentContenu
  choix: Record<string, FragmentContenu>
  /** Vrai quand la file repose une question déjà vue, faute de similaire disponible. */
  rejouee: boolean
  /** Rang de la question dans la file, à renvoyer avec la réponse. */
  position: number
}

/** Le rappel de cours exact que la question visait. */
export interface ExtraitQuiz {
  titre: string
  source: string | null
  corps: FragmentContenu
}

/** Ce qui s'affiche après une réponse : le verdict, puis de quoi comprendre. */
export interface CorrectionQuiz {
  juste: boolean
  /**
   * Vrai quand on a répondu « je ne sais pas ». La place compte alors comme
   * manquée — c'en est une — mais le verdict ne reproche rien : il n'y a pas de
   * mauvaise réponse à montrer, seulement une correction à lire.
   */
  passee: boolean
  bonne: string
  /** Lettre donnée, nulle quand la question a été passée. */
  donnee: string | null
  indice: FragmentContenu | null
  solution: FragmentContenu | null
  extrait: ExtraitQuiz | null
  /**
   * Renseigné quand la faute a fait entrer une question **similaire** dans la
   * file : de quoi annoncer ce qui attend à la fin plutôt que de le subir.
   */
  reprise: { notionTitre: string | null, rejouee: boolean } | null
}

/** État d'une place dans la file, tel que la frise l'affiche. */
export type EtatPlace = 'attente' | 'juste' | 'manquee'

export interface PlaceQuiz {
  etat: EtatPlace
  /** Numéro de la place du tirage initial dont cette entrée descend. */
  place: number
}

/** L'état d'une session, tel que le client a le droit de le connaître. */
export interface SessionQuiz {
  id: number
  filtre: FiltreQuiz
  /** Nombre de questions demandées au départ. */
  taille: number
  /** Places acquises, sur `taille`. */
  acquises: number
  /** Questions posées depuis le début, reprises comprises. */
  poses: number
  justes: number
  fautes: number
  /** Rang de la question en cours dans la file. */
  position: number
  /** Longueur de la file : ce qui reste à poser au minimum. */
  longueur: number
  finie: boolean
  commencee_le: number
  maj: number
  /** Une entrée par place de la file, dans l'ordre. */
  file: PlaceQuiz[]
}

/** Une session close, telle que l'historique la résume. */
export interface ResumeSessionQuiz {
  id: number
  taille: number
  poses: number
  justes: number
  fautes: number
  acquises: number
  finie: boolean
  commencee_le: number
  maj: number
  filtre: FiltreQuiz
  /** Intitulés des thèmes du filtre, résolus côté serveur. */
  themes: string[]
  /** La matière de la séance, en clair. */
  matiereTitre: string | null
}

/**
 * Ce qui résiste : une section du cours, et ce qu'elle doit encore.
 *
 * Elle ne se lit plus dans les seules séances de quiz mais dans la mémoire des
 * fautes, qui couvre aussi les exercices et les QCM — c'est-à-dire l'essentiel
 * de ce qu'on fait sur le site.
 */
export interface SectionResistante {
  cle: string
  titre: string
  theme: string | null
  themeTitre: string | null
  matiere: string | null
  /** Questions de la section ratées et pas encore retrouvées. */
  enDette: number
  /** Fautes accumulées sur ces questions, toutes occasions confondues. */
  fautes: number
}

export interface HistoriqueQuiz {
  sessions: ResumeSessionQuiz[]
  /** La session inachevée, s'il y en a une : c'est elle qu'on propose de reprendre. */
  encours: ResumeSessionQuiz | null
  resistent: SectionResistante[]
}
