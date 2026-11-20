import type { DatabaseSync } from 'node:sqlite'
import type { Parcours } from '~~/shared/types/matieres'

/**
 * Le programme de la promotion INFRES 19 (2026-2029), tel que l'école le
 * publie : UE par semestre, matières, heures et coefficients.
 *
 * Recopié des tableaux du « Programme bilingue INFRES 19 » (comité de
 * l'enseignement du 7 avril 2026). Chaque semestre a été recompté contre les
 * totaux du document : 360, 360, 303, 327 et 450 heures d'école, 20, 20, 20, 16
 * et 20 ECTS, parcours par parcours à partir du S7. Un coefficient absent du
 * document (« - » pour DevOps, rien pour le séminaire créativité) reste nul :
 * la matière existe, elle ne compte pas dans la moyenne.
 *
 * Ce fichier **sème** la base, il n'en est pas la source : `semerProgramme`
 * insère au démarrage ce qui manque, et la base garde ensuite aussi les
 * matières ajoutées depuis le site. Le **code** d'une matière est son identité
 * — c'est lui qu'une page de matière du cours désigne (`programme:` dans son
 * frontmatter) et lui que retiennent notes et contrôles. Il est donc écrit en
 * dur et ne se recalcule jamais : corriger un intitulé ne doit rien détacher.
 */

/** [code, intitulé, heures, coefficient] */
type LigneMatiere = [string, string, number | null, number | null]

interface UeProgramme {
  code: string
  intitule: string
  ects: number
  /** Absent : commune aux deux parcours. */
  parcours?: Parcours
  matieres: LigneMatiere[]
}

const MATH = 'UE Mathématiques Outils et Concepts'
const BST = 'UE Bases Scientifiques ou Technologiques'
const ASSI = 'UE Architecture et Sécurité du Système d\'Information'
const DIM = 'UE Développement de l\'Ingénieur Manager'
const LING = 'UE Linguistique'
const DPPA = 'UE Développement Personnel et Professionnel de l\'Apprenti'
const PROJ = 'UE Projet'
const GL = 'UE Génie Logiciel'
const SI = 'UE Systèmes Informatiques'
const RI = 'UE Réseaux Informatiques'
const DEV = 'UE Développement'

/**
 * L'UE Entreprise n'a pas de matière : c'est la période en entreprise, notée
 * d'un bloc. On lui en donne une, du même nom, pour qu'elle ait sa case dans le
 * tableau des moyennes comme toutes les autres.
 */
function entreprise(code: string, intitule: string, heures: number, ects: number, codeMatiere: string, parcours?: Parcours): UeProgramme {
  return { code, intitule, ects, parcours, matieres: [[codeMatiere, intitule.replace(/^UE /, ''), heures, 1]] }
}

/** Les UE du S7 au S9 qui sont identiques d'un parcours à l'autre, déclinées pour l'un. */
function s7Communes(p: Parcours): UeProgramme[] {
  return [
    { code: '7.1 BST', intitule: BST, ects: 3, parcours: p, matieres: [
      [`s7-${p}-analyse-risques-numeriques`, 'Analyse des risques numériques', 24, 1],
      [`s7-${p}-technologie-medias`, 'Technologie des médias', 28, 1]
    ] }
  ]
}

function s7Fin(p: Parcours): UeProgramme[] {
  return [
    { code: '7.5 DIM', intitule: DIM, ects: 3, parcours: p, matieres: [
      [`s7-${p}-gestion-projet-ateliers`, 'Gestion de projet : ateliers électifs', 18, 1],
      [`s7-${p}-droits-social-metier`, 'Droits social et spécifiques au métier (droits informatique)', 20, 1]
    ] },
    { code: '7.6 LING', intitule: LING, ects: 2, parcours: p, matieres: [
      [`s7-${p}-anglais`, 'Anglais ou autre langue vivante', 30, 1]
    ] },
    { code: '7.7 DPPA', intitule: DPPA, ects: 1, parcours: p, matieres: [
      [`s7-${p}-mission-3`, 'Mission 3 : transition de technicien à ingénieur', 20, 1]
    ] },
    entreprise('7.8 EE', 'UE Entreprise : Devenir ingénieur', 525, 10, `s7-${p}-entreprise`, p)
  ]
}

function s8Fin(p: Parcours): UeProgramme[] {
  return [
    { code: '8.3 PROJ', intitule: PROJ, ects: 5, parcours: p, matieres: [
      [`s8-${p}-scrum-master`, 'Scrum Master : préparation à la certification', 24, 2],
      [`s8-${p}-initiation-recherche`, 'Initiation à la Recherche', 30, 3],
      [`s8-${p}-projet-fil-rouge`, 'Projet fil rouge ou projet Recherche', 40, 4]
    ] },
    { code: '8.4 DIM', intitule: DIM, ects: 1, parcours: p, matieres: [
      [`s8-${p}-management`, 'Management entreprise et équipe', 12, 1],
      [`s8-${p}-qualite`, 'Qualité', 18, 1]
    ] },
    { code: '8.5 LING', intitule: LING, ects: 1, parcours: p, matieres: [
      [`s8-${p}-anglais`, 'Anglais ou autre langue vivante', 30, 1]
    ] },
    { code: '8.6 DPPA', intitule: DPPA, ects: 1, parcours: p, matieres: [
      [`s8-${p}-mission-4`, 'Mission 4 : cœur de métier', 20, 1]
    ] },
    entreprise('8.7 EE', 'UE Entreprise : Devenir ingénieur', 560, 14, `s8-${p}-entreprise`, p)
  ]
}

function s9Debut(p: Parcours): UeProgramme {
  return { code: '9.1 BST', intitule: BST, ects: 2, parcours: p, matieres: [
    [`s9-${p}-green-it`, 'Sobriété numérique : Green IT', 12, 1],
    [`s9-${p}-open-source`, 'Open Source', 12, 1],
    [`s9-${p}-veille`, 'Veille technologique', 14, 1]
  ] }
}

function s9Projet(p: Parcours): UeProgramme {
  return { code: '9.6 PROJ', intitule: PROJ, ects: 7, parcours: p, matieres: [
    [`s9-${p}-creation-entreprise`, 'Création d\'entreprise et d\'activités (incubateur technologique)', 20, 1],
    [`s9-${p}-itil`, 'Qualités des services informatiques : ITIL', 18, 1],
    [`s9-${p}-projet-fil-rouge`, 'Projet fil rouge ou projet Recherche', 129, 4]
  ] }
}

export const PROGRAMME: { semestre: number, ues: UeProgramme[] }[] = [
  { semestre: 5, ues: [
    { code: '5.1 MATH', intitule: MATH, ects: 4, matieres: [
      ['s5-mathematiques-ingenieur', 'Mathématiques pour l\'ingénieur', 36, 3],
      ['s5-probabilites-statistiques', 'Probabilités et statistiques', 25, 2],
      ['s5-structures-donnees-algorithmique', 'Structures de données et algorithmique', 12, 1]
    ] },
    { code: '5.2 BST', intitule: BST, ects: 4, matieres: [
      ['s5-devops-fondamentaux', 'DevOps : fondamentaux', 6, null],
      ['s5-langage-fonctionnel', 'Langage de développement fonctionnel', 24, 1],
      ['s5-reseaux-protocoles-1', 'Réseaux et protocoles - 1', 27, 1]
    ] },
    { code: '5.3 BST', intitule: BST, ects: 3, matieres: [
      ['s5-projets-integrateurs', 'Projets intégrateurs', 21, 1],
      ['s5-unix-utilisateurs', 'Unix utilisateurs', 30, 1]
    ] },
    { code: '5.4 BST', intitule: BST, ects: 2, matieres: [
      ['s5-frontend', 'Frontend', 18, 1],
      ['s5-langage-oriente-objet', 'Langage de développement orienté objet', 21, 1]
    ] },
    { code: '5.5 ASSI', intitule: ASSI, ects: 3, matieres: [
      ['s5-ethical-hacking', 'Ethical hacking', 24, 1],
      ['s5-virtualisation-conteneurisation', 'Virtualisation et conteneurisation : fondamentaux', 30, 1]
    ] },
    { code: '5.6 DIM', intitule: DIM, ects: 2, matieres: [
      ['s5-jeu-entreprise', 'Jeu d\'entreprise : initiation à la gestion', 21, 1],
      ['s5-gestion-projet', 'Gestion de projet : outils et méthodes', 18, 1]
    ] },
    { code: '5.7 LING', intitule: LING, ects: 1, matieres: [
      ['s5-anglais', 'Anglais', 27, 1]
    ] },
    { code: '5.8 DPPA', intitule: DPPA, ects: 1, matieres: [
      ['s5-mission-1', 'Mission 1 : projet d\'emploi', 20, 1]
    ] },
    entreprise('5.9 EE', 'UE Entreprise : comprendre le rôle de l\'ingénieur', 455, 10, 's5-entreprise')
  ] },
  { semestre: 6, ues: [
    { code: '6.1 MATH', intitule: MATH, ects: 4, matieres: [
      ['s6-fondements-ia', 'Fondements de l\'IA', 25, 1],
      ['s6-mathematiques-graphes', 'Mathématiques pour l\'ingénieur : graphes, analyse numérique', 24, 1],
      ['s6-traitement-numerique', 'Traitement numérique de l\'information', 23, 1]
    ] },
    { code: '6.2 BST', intitule: BST, ects: 3, matieres: [
      ['s6-gestion-versions', 'Gestion de versions décentralisée', 12, 1],
      ['s6-middleware-telephonie-ip', 'Architectures middleware / Téléphonie IP', 33, 3]
    ] },
    { code: '6.3 ASSI', intitule: ASSI, ects: 3, matieres: [
      ['s6-reseaux-protocoles-2', 'Réseaux et protocoles - 2', 24, 2],
      ['s6-cryptographie', 'Cryptographie', 18, 2],
      ['s6-certificats', 'Gestion du cycle de vie des certificats', 12, 1]
    ] },
    { code: '6.4 ASSI', intitule: ASSI, ects: 3, matieres: [
      ['s6-orchestration-conteneurs', 'Orchestration de conteneur', 25, 1],
      ['s6-sgbdr', 'Bases de données : SGBDR', 30, 1]
    ] },
    { code: '6.5 PROJ', intitule: PROJ, ects: 3, matieres: [
      ['s6-cahier-des-charges', 'Analyse fonctionnelle et rédaction de cahier des charges', 20, 1],
      ['s6-projet', 'Projet', 34, 1]
    ] },
    { code: '6.6 LING', intitule: LING, ects: 3, matieres: [
      ['s6-anglais', 'Anglais', 51, 1]
    ] },
    { code: '6.7 DPPA', intitule: DPPA, ects: 1, matieres: [
      ['s6-seminaire-creativite', 'Séminaire créativité', 12, null],
      ['s6-mission-2', 'Mission 2 : Responsabilité sociétale de l\'ingénieur', 17, 1]
    ] },
    entreprise('6.9 EE', 'UE Entreprise : comprendre le rôle de l\'ingénieur', 490, 10, 's6-entreprise')
  ] },
  { semestre: 7, ues: [
    ...s7Communes('dl'),
    { code: '7.2 ASSI', intitule: ASSI, ects: 3, parcours: 'dl', matieres: [
      ['s7-dl-securite-applicative', 'Sécurité applicative', 30, 1],
      ['s7-dl-infrastructure-as-code', 'Infrastructure as code', 19, 1]
    ] },
    { code: '7.3 GL', intitule: GL, ects: 4, parcours: 'dl', matieres: [
      ['s7-dl-validation-logiciels', 'Validation des logiciels', 30, 1],
      ['s7-dl-bonnes-pratiques', 'Bonnes pratiques de production de code', 34, 1]
    ] },
    { code: '7.4 GL', intitule: GL, ects: 4, parcours: 'dl', matieres: [
      ['s7-dl-microservices-1', 'Architecture logicielle : Microservices - 1', 30, 3],
      ['s7-dl-integration-continue', 'Intégration et déploiement continus', 20, 2]
    ] },
    ...s7Fin('dl'),
    ...s7Communes('sr'),
    { code: '7.2 ASSI', intitule: ASSI, ects: 4, parcours: 'sr', matieres: [
      ['s7-sr-securite-reseaux-systemes', 'Sécurité des réseaux et systèmes', 33, 1],
      ['s7-sr-openstack', 'Infrastructure : OpenStack', 24, 1]
    ] },
    { code: '7.3 SI', intitule: SI, ects: 3, parcours: 'sr', matieres: [
      ['s7-sr-integration-continue', 'Intégration et déploiement continus', 14, 1],
      ['s7-sr-annuaire-windows', 'Service d\'annuaire Windows', 24, 1]
    ] },
    { code: '7.4 RI', intitule: RI, ects: 4, parcours: 'sr', matieres: [
      ['s7-sr-reseaux-avances', 'Réseaux avancés', 34, 1],
      ['s7-sr-services-reseaux', 'Administration des services réseaux', 34, 1]
    ] },
    ...s7Fin('sr')
  ] },
  { semestre: 8, ues: [
    { code: '8.1.a DEV', intitule: DEV, ects: 3, parcours: 'dl', matieres: [
      ['s8-dl-embarque-iot', 'Systèmes embarqués et I.O.T', 29, 1],
      ['s8-dl-informatique-mobile', 'Informatique mobile : développement hybride / cross-plateforme', 36, 1]
    ] },
    { code: '8.1.b DEV', intitule: DEV, ects: 3, parcours: 'dl', matieres: [
      ['s8-dl-ia-modelisation', 'Modélisations et résolutions de problèmes à base d\'IA', 30, 1],
      ['s8-dl-optimisation-code', 'Optimisation de code', 24, 1]
    ] },
    { code: '8.2 GL', intitule: GL, ects: 2, parcours: 'dl', matieres: [
      ['s8-dl-microservices-2', 'Architecture logicielle : Microservices - 2', 20, 1],
      ['s8-dl-metrologie', 'Métrologie', 14, 1]
    ] },
    ...s8Fin('dl'),
    { code: '8.1 SI', intitule: SI, ects: 4, parcours: 'sr', matieres: [
      ['s8-sr-langage-script', 'Langage de script', 30, 3],
      ['s8-sr-administration-linux', 'Administration système Linux', 30, 3],
      ['s8-sr-infrastructure-as-code', 'Infrastructure as code', 27, 2]
    ] },
    { code: '8.2 RI', intitule: RI, ects: 4, parcours: 'sr', matieres: [
      ['s8-sr-securite-reseaux', 'Sécurité des réseaux : outils et équipements dédiés', 24, 2],
      ['s8-sr-supervision-reseaux', 'Supervision et gestion des réseaux', 42, 3]
    ] },
    ...s8Fin('sr')
  ] },
  { semestre: 9, ues: [
    s9Debut('dl'),
    { code: '9.2 DEV', intitule: DEV, ects: 5, parcours: 'dl', matieres: [
      ['s9-dl-mlops', 'Machine Learning Opérations (MLOps)', 20, 2],
      ['s9-dl-aspnet', 'Environnement ASP .Net', 36, 3],
      ['s9-dl-apprentissage-profond', 'Intelligence artificielle : apprentissage profond', 45, 4]
    ] },
    { code: '9.3 GL', intitule: GL, ects: 1, parcours: 'dl', matieres: [
      ['s9-dl-dependances-maintenabilite', 'Gestion des dépendances, risques et maintenabilité', 20, 1],
      ['s9-dl-ux-ui', 'Expérience utilisateur : UX et UI Design', 14, 1]
    ] },
    { code: '9.4 GL', intitule: GL, ects: 2, parcours: 'dl', matieres: [
      ['s9-dl-nosql', 'Base de données NoSQL', 28, 1],
      ['s9-dl-big-data', 'Big data et modélisation', 22, 1]
    ] },
    { code: '9.5 ASSI', intitule: ASSI, ects: 2, parcours: 'dl', matieres: [
      ['s9-dl-solutions-clouds', 'Solutions Clouds', 20, 1],
      ['s9-dl-faas-baas', 'Function & Back-end as a service : FaaS & BaaS', 20, 1]
    ] },
    s9Projet('dl'),
    { code: '9.7 DPPA', intitule: DPPA, ects: 1, parcours: 'dl', matieres: [
      ['s9-dl-mission-5', 'Mission 5 : bilan de compétences', 20, 1]
    ] },
    entreprise('9.8 EE', 'UE Entreprise : Agir en ingénieur', 350, 10, 's9-dl-entreprise', 'dl'),
    s9Debut('sr'),
    { code: '9.2 SI', intitule: SI, ects: 2, parcours: 'sr', matieres: [
      ['s9-sr-gestion-parc', 'Gestion de parc', 18, 1],
      ['s9-sr-microservices', 'Microservices', 20, 1]
    ] },
    { code: '9.3 SI', intitule: SI, ects: 2, parcours: 'sr', matieres: [
      ['s9-sr-virtualisation-stockage', 'Virtualisation de stockage', 18, 2],
      ['s9-sr-donnees-informatiques', 'Gestion et traitement des données informatiques', 34, 3]
    ] },
    { code: '9.4 RI', intitule: RI, ects: 3, parcours: 'sr', matieres: [
      ['s9-sr-reseaux-mobiles-iot', 'Réseaux mobiles et IOT', 34, 1],
      ['s9-sr-wifi', 'Réseaux WiFi', 35, 1]
    ] },
    { code: '9.5 ASSI', intitule: ASSI, ects: 3, parcours: 'sr', matieres: [
      ['s9-sr-solutions-clouds', 'Solutions Clouds', 20, 2],
      ['s9-sr-automatisation-reseaux', 'Automatisation réseaux', 30, 3],
      ['s9-sr-forensics', 'Forensics et preuves numériques', 16, 2]
    ] },
    s9Projet('sr'),
    { code: '9.8 DPPA', intitule: DPPA, ects: 1, parcours: 'sr', matieres: [
      ['s9-sr-mission-5', 'Mission 5 : bilan de compétences', 20, 1]
    ] },
    entreprise('9.9 EE', 'UE Entreprise : Agir en ingénieur', 350, 10, 's9-sr-entreprise', 'sr')
  ] },
  { semestre: 10, ues: [
    { code: '10.1 DPPA', intitule: DPPA, ects: 10, matieres: [
      ['s10-mission-6', 'Mission 6 : bilan de formation', null, 1]
    ] },
    entreprise('10.2 EE', 'UE Entreprise : Agir en ingénieur', 910, 20, 's10-entreprise')
  ] }
]

/**
 * Les matières du cours qui n'existent pas au programme : une remise à niveau
 * que l'école ne note pas. Elles ont une ligne comme les autres — un contrôle
 * peut porter sur elles — mais ni UE ni coefficient.
 */
export const HORS_PROGRAMME: [string, string][] = [
  ['remise-a-niveau-maths', 'Remise à niveau en maths']
]

/**
 * Insère ce qui manque du programme, sans rien modifier de ce qui existe.
 *
 * Idempotent, et appelé à chaque démarrage : ajouter une matière à ce fichier
 * la fait apparaître au déploiement suivant, sans migration. Une ligne déjà en
 * base n'est jamais réécrite — la base a pu être corrigée depuis.
 */
export function semerProgramme(db: DatabaseSync) {
  const maintenant = Date.now()
  const trouverUe = db.prepare('SELECT id FROM ue WHERE semestre = ? AND code = ? AND COALESCE(parcours, \'\') = ?')
  const creerUe = db.prepare('INSERT INTO ue (semestre, code, intitule, ects, parcours, ordre) VALUES (?, ?, ?, ?, ?, ?)')
  const creerMatiere = db.prepare(`
    INSERT INTO matiere (code, intitule, ue_id, coef, heures, ordre, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (code) DO NOTHING
  `)
  db.exec('BEGIN')
  try {
    let ordreUe = 0
    for (const { semestre, ues } of PROGRAMME) {
      for (const ue of ues) {
        ordreUe += 1
        let ligne = trouverUe.get(semestre, ue.code, ue.parcours ?? '') as { id: number } | undefined
        if (!ligne) {
          const r = creerUe.run(semestre, ue.code, ue.intitule, ue.ects, ue.parcours ?? null, ordreUe)
          ligne = { id: Number(r.lastInsertRowid) }
        }
        ue.matieres.forEach(([code, intitule, heures, coef], i) => {
          creerMatiere.run(code, intitule, ligne!.id, coef, heures, i, maintenant)
        })
      }
    }
    HORS_PROGRAMME.forEach(([code, intitule], i) => creerMatiere.run(code, intitule, null, null, null, i, maintenant))
    db.exec('COMMIT')
  } catch (erreur) {
    db.exec('ROLLBACK')
    throw erreur
  }
}
