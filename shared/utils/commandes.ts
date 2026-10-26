/**
 * La correction d'une commande tapée — ce que l'élève écrira sur sa copie le
 * jour du contrôle de Docker, et qu'un choix entre quatre propositions ne lui
 * apprendrait pas à écrire.
 *
 * Comparer deux chaînes ne suffit pas : `docker run -dit alpine`,
 * `docker run -d -it alpine` et `docker container run --detach -it alpine:latest`
 * sont **la même commande**, et refuser l'une d'elles apprendrait le faux — que
 * l'ordre des options compterait, ou qu'il n'y aurait qu'une façon de l'écrire.
 * On ramène donc chaque commande à une forme canonique : la sous-commande sans
 * ses alias, les options courtes et longues confondues, les options sans
 * valeur rangées en ensemble, les valeurs normalisées quand Docker les lit de
 * plusieurs façons (`src=` et `source=` dans un `--mount`, `alpine` et
 * `alpine:latest`). Les arguments qui suivent l'image d'un `docker run`, eux,
 * gardent leur ordre : ce sont ceux du conteneur.
 *
 * Ce qu'on ne sait pas trancher par le calcul — `~/pagesweb` contre
 * `$PWD/pagesweb`, qui ne désignent le même dossier que depuis le répertoire
 * personnel — se règle dans le contenu, qui énumère les variantes admises.
 *
 * Trois modes : `shell` (une ou plusieurs commandes), `dockerfile` (des
 * instructions) et `yaml` (un morceau de `compose.yaml`).
 *
 * Aucun import : ce fichier sert au composant, au contrôle du contenu, et
 * servira au serveur le jour où le quiz posera ces questions.
 */

export type ModeCommande = 'shell' | 'dockerfile' | 'yaml'

export interface VerdictCommande {
  juste: boolean
  /**
   * Ce qui cloche, en clair, sans donner la réponse : « il manque une option »
   * plutôt que « il manque -d ». Les noms cités sont ceux que l'élève a tapés.
   */
  remarques: string[]
}

/* ---------------------------------------------------------------------------
   Le découpage d'une ligne de shell.
   --------------------------------------------------------------------------- */

class ErreurSaisie extends Error {}

/**
 * Découpe un texte en commandes, puis chaque commande en segments de tube, puis
 * chaque segment en mots — guillemets retirés, comme le shell les retire.
 * Une commande se termine à la fin d'une ligne (hors `\` final), à `&&` ou à
 * `;` : « arrête puis supprime » s'écrit aussi bien sur deux lignes que sur une.
 */
function decouperShell(texte: string): string[][][] {
  const commandes: string[][][] = []
  let segments: string[][] = []
  let mots: string[] = []
  let mot = ''
  let enCours = false
  let guillemet: '\'' | '"' | null = null

  const finirMot = () => {
    if (enCours) mots.push(mot)
    mot = ''
    enCours = false
  }
  const finirSegment = () => {
    finirMot()
    if (mots.length) segments.push(mots)
    mots = []
  }
  const finirCommande = () => {
    finirSegment()
    if (segments.length) commandes.push(segments)
    segments = []
  }

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]!
    if (guillemet === '\'') {
      if (c === '\'') guillemet = null
      else mot += c
      continue
    }
    if (guillemet === '"') {
      if (c === '"') guillemet = null
      else if (c === '\\' && /["\\$`]/.test(texte[i + 1] ?? '')) mot += texte[++i]
      else mot += c
      continue
    }
    if (c === '\\') {
      const suivant = texte[i + 1]
      // Une barre oblique en fin de ligne prolonge la commande sur la suivante.
      if (suivant === '\n' || (suivant === '\r' && texte[i + 2] === '\n')) {
        i += suivant === '\r' ? 2 : 1
        continue
      }
      if (suivant !== undefined) {
        mot += suivant
        enCours = true
        i++
      }
      continue
    }
    if (c === '\'' || c === '"') {
      guillemet = c
      enCours = true
      continue
    }
    if (c === '\n' || c === ';') {
      finirCommande()
      continue
    }
    if (c === '&' && texte[i + 1] === '&') {
      finirCommande()
      i++
      continue
    }
    if (c === '|' && texte[i + 1] !== '|') {
      finirSegment()
      continue
    }
    if (c === '>' || c === '<') {
      finirMot()
      const double = texte[i + 1] === c
      mots.push(double ? c + c : c)
      if (double) i++
      continue
    }
    if (/\s/.test(c)) {
      finirMot()
      continue
    }
    mot += c
    enCours = true
  }
  if (guillemet) throw new ErreurSaisie('Un guillemet n\'est pas refermé.')
  finirCommande()
  return commandes
}

/* ---------------------------------------------------------------------------
   Ce que Docker sait de ses propres options.
   --------------------------------------------------------------------------- */

interface SpecCommande {
  /** Forme longue (ou ancienne) → forme retenue, la courte quand elle existe. */
  alias?: Record<string, string>
  /** Les options qui prennent une valeur, sous leur forme retenue. */
  valeurs?: string[]
  /**
   * Les options s'arrêtent au premier argument : ce qui suit l'image d'un
   * `docker run` appartient au conteneur, `-d` compris.
   */
  arret?: boolean
  /** Les arguments forment un ensemble : `docker stop web db` vaut `docker stop db web`. */
  ensemble?: boolean
  /** Les arguments qui désignent une image : tous, ou le premier seulement. */
  images?: 'tous' | 'premier'
  /** Les options dont la valeur est une image : `docker build -t`. */
  optionsImage?: string[]
}

const OPTIONS_RUN: SpecCommande = {
  alias: {
    '--detach': '-d', '--interactive': '-i', '--tty': '-t', '--publish': '-p', '--volume': '-v',
    '--env': '-e', '--hostname': '-h', '--user': '-u', '--workdir': '-w', '--publish-all': '-P',
    '--memory': '-m', '--label': '-l', '--attach': '-a', '--net': '--network'
  },
  valeurs: [
    '--name', '-p', '-v', '-e', '--env-file', '--mount', '--network', '--restart', '-h', '-u', '-w',
    '--entrypoint', '--platform', '-m', '--cpus', '-l', '-a', '--add-host', '--dns', '--ip', '--tmpfs',
    '--network-alias', '--pull', '--log-driver', '--expose', '--link', '--cap-add', '--cap-drop', '--device'
  ],
  arret: true,
  images: 'premier'
}

const OPTIONS_BUILD: SpecCommande = {
  alias: { '--tag': '-t', '--file': '-f', '--quiet': '-q', '--output': '-o' },
  valeurs: ['-t', '-f', '-o', '--build-arg', '--platform', '--target', '--label', '--network', '--progress', '--builder'],
  optionsImage: ['-t']
}

const OPTIONS_EXEC: SpecCommande = {
  alias: { '--detach': '-d', '--interactive': '-i', '--tty': '-t', '--env': '-e', '--user': '-u', '--workdir': '-w' },
  valeurs: ['-e', '--env-file', '-u', '-w'],
  arret: true
}

const SPECS: Record<string, SpecCommande> = {
  'run': OPTIONS_RUN,
  'create': OPTIONS_RUN,
  'exec': OPTIONS_EXEC,
  'ps': {
    alias: { '--all': '-a', '--latest': '-l', '--quiet': '-q', '--size': '-s', '--filter': '-f', '--last': '-n' },
    valeurs: ['-f', '--format', '-n']
  },
  'logs': {
    alias: { '--follow': '-f', '--timestamps': '-t', '--tail': '-n' },
    valeurs: ['-n', '--since', '--until']
  },
  'stop': { alias: { '--time': '-t', '--timeout': '-t', '--signal': '-s' }, valeurs: ['-t', '-s'], ensemble: true },
  'restart': { alias: { '--time': '-t', '--timeout': '-t', '--signal': '-s' }, valeurs: ['-t', '-s'], ensemble: true },
  'start': { alias: { '--attach': '-a', '--interactive': '-i' }, ensemble: true },
  'rm': { alias: { '--force': '-f', '--volumes': '-v', '--link': '-l' }, ensemble: true },
  'kill': { alias: { '--signal': '-s' }, valeurs: ['-s'], ensemble: true },
  'rmi': { alias: { '--force': '-f' }, ensemble: true, images: 'tous' },
  'images': { alias: { '--all': '-a', '--quiet': '-q', '--filter': '-f' }, valeurs: ['-f', '--format'] },
  'pull': { alias: { '--all-tags': '-a', '--quiet': '-q' }, valeurs: ['--platform'], images: 'tous' },
  'push': { alias: { '--all-tags': '-a', '--quiet': '-q' }, images: 'tous' },
  'tag': { images: 'tous' },
  'build': OPTIONS_BUILD,
  'buildx build': OPTIONS_BUILD,
  'buildx create': { valeurs: ['--name', '--driver', '--platform'] },
  'history': { alias: { '--human': '-H', '--quiet': '-q' }, valeurs: ['--format'], images: 'tous' },
  'inspect': { alias: { '--format': '-f', '--size': '-s' }, valeurs: ['-f', '--type'], ensemble: true },
  'top': { arret: true },
  'login': { alias: { '--username': '-u', '--password': '-p' }, valeurs: ['-u', '-p'] },
  'commit': { alias: { '--message': '-m', '--author': '-a', '--change': '-c' }, valeurs: ['-m', '-a', '-c'] },
  'search': { alias: { '--filter': '-f' }, valeurs: ['-f', '--limit', '--format'] },
  'version': { alias: { '--format': '-f' }, valeurs: ['-f'] },
  'info': { alias: { '--format': '-f' }, valeurs: ['-f'] },
  'system prune': { alias: { '--all': '-a', '--force': '-f' }, valeurs: ['--filter'] },
  'system df': { alias: { '--verbose': '-v' } },
  'image prune': { alias: { '--all': '-a', '--force': '-f' }, valeurs: ['--filter'] },
  'container prune': { alias: { '--force': '-f' }, valeurs: ['--filter'] },
  'volume create': { alias: { '--driver': '-d', '--opt': '-o' }, valeurs: ['-d', '-o', '--label'] },
  'volume ls': { alias: { '--quiet': '-q', '--filter': '-f' }, valeurs: ['-f', '--format'] },
  'volume inspect': { alias: { '--format': '-f' }, valeurs: ['-f'], ensemble: true },
  'volume rm': { alias: { '--force': '-f' }, ensemble: true },
  'volume prune': { alias: { '--all': '-a', '--force': '-f' }, valeurs: ['--filter'] },
  'network create': { alias: { '--driver': '-d', '--opt': '-o' }, valeurs: ['-d', '-o', '--subnet', '--gateway', '--ip-range', '--label'] },
  'network ls': { alias: { '--quiet': '-q', '--filter': '-f' }, valeurs: ['-f', '--format'] },
  'network inspect': { alias: { '--format': '-f' }, valeurs: ['-f'], ensemble: true },
  'network rm': { alias: { '--force': '-f' }, ensemble: true },
  'network prune': { alias: { '--force': '-f' }, valeurs: ['--filter'] },
  'network connect': { valeurs: ['--ip', '--alias'] },
  'network disconnect': { alias: { '--force': '-f' } },
  'compose up': { alias: { '--detach': '-d' }, ensemble: true },
  'compose down': { alias: { '--volumes': '-v', '--timeout': '-t' }, valeurs: ['--rmi', '-t'] },
  'compose ps': { alias: { '--all': '-a', '--quiet': '-q' }, ensemble: true },
  'compose logs': { alias: { '--follow': '-f', '--timestamps': '-t', '--tail': '-n' }, valeurs: ['-n'], ensemble: true },
  'compose exec': { alias: { '--detach': '-d', '--user': '-u', '--workdir': '-w', '--env': '-e' }, valeurs: ['-u', '-w', '-e'], arret: true },
  'compose run': { alias: { '--detach': '-d', '--user': '-u', '--workdir': '-w', '--env': '-e', '--publish': '-p', '--volume': '-v' }, valeurs: ['-u', '-w', '-e', '-p', '-v', '--name'], arret: true },
  'compose stop': { ensemble: true },
  'compose start': { ensemble: true },
  'compose restart': { ensemble: true },
  'compose pull': { ensemble: true },
  'compose build': { ensemble: true }
}

/**
 * Les synonymes d'une sous-commande. Docker a réorganisé sa ligne de commande
 * par objets (`docker container ls`) sans retirer les anciennes formes
 * (`docker ps`) : les deux s'écrivent, les deux sont justes.
 */
const SYNONYMES: Record<string, string> = {
  'container run': 'run', 'container create': 'create', 'container ls': 'ps', 'container list': 'ps',
  'container ps': 'ps', 'container start': 'start', 'container stop': 'stop', 'container restart': 'restart',
  'container rm': 'rm', 'container remove': 'rm', 'container kill': 'kill', 'container logs': 'logs',
  'container exec': 'exec', 'container inspect': 'inspect', 'container top': 'top', 'container cp': 'cp',
  'container commit': 'commit', 'container attach': 'attach', 'container port': 'port', 'container stats': 'stats',
  'image ls': 'images', 'image list': 'images', 'image pull': 'pull', 'image push': 'push', 'image rm': 'rmi',
  'image remove': 'rmi', 'image tag': 'tag', 'image build': 'build', 'image history': 'history',
  'image inspect': 'inspect', 'builder build': 'build',
  'volume list': 'volume ls', 'volume remove': 'volume rm',
  'network list': 'network ls', 'network remove': 'network rm',
  'compose ls': 'compose ls'
}

/** Les sous-commandes qui en attendent une autre : `docker volume create`. */
const GROUPES = new Set(['container', 'image', 'volume', 'network', 'system', 'compose', 'buildx', 'builder', 'context', 'manifest'])

/** Les options de `docker compose` qui se placent avant la sous-commande. */
const OPTIONS_COMPOSE: SpecCommande = {
  alias: { '--file': '-f', '--project-name': '-p' },
  valeurs: ['-f', '-p', '--project-directory', '--env-file']
}

/* ---------------------------------------------------------------------------
   La forme canonique.
   --------------------------------------------------------------------------- */

interface Segment {
  /** `docker`, ou le programme d'une commande lancée dans le conteneur. */
  programme: string
  /** La sous-commande Docker, synonymes résolus : `['volume', 'create']`. */
  chemin: string[]
  drapeaux: string[]
  options: [string, string][]
  arguments: string[]
  /** La spécification qui a servi à lire le segment, pour nommer ses arguments. */
  spec: SpecCommande
}

/** `alpine`, `docker.io/library/alpine` et `alpine:latest` désignent la même image. */
export function normaliserImage(reference: string): string {
  let r = reference.replace(/^(?:docker\.io|index\.docker\.io)\/(?:library\/)?/, '')
  const dernier = r.split('/').pop() ?? ''
  if (!dernier.includes(':') && !r.includes('@')) r += ':latest'
  return r
}

/**
 * `--mount` se lit en paires `clé=valeur` dans n'importe quel ordre, et chaque
 * clé a ses synonymes : `src` et `source`, `dst`, `destination` et `target`.
 * Sans `type`, Docker monte un volume.
 */
function normaliserMount(valeur: string): string {
  const paires = new Map<string, string>()
  for (const morceau of valeur.split(',')) {
    if (!morceau) continue
    const [cle, ...reste] = morceau.split('=')
    const v = reste.join('=')
    const k = cle!.trim().toLowerCase()
    if (k === 'src' || k === 'source') paires.set('source', v)
    else if (k === 'dst' || k === 'destination' || k === 'target') paires.set('target', v)
    else if (k === 'ro' || k === 'readonly') {
      if (!/^(false|0)$/i.test(v)) paires.set('readonly', 'true')
    } else paires.set(k, v)
  }
  if (!paires.has('type')) paires.set('type', 'volume')
  return [...paires].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join(',')
}

/** `$HOME/x`, `${HOME}/x` et `~/x` ; `$(pwd)` et `${PWD}` : le même dossier, écrit autrement. */
function normaliserChemin(valeur: string): string {
  return valeur
    .replace(/^(?:\$\{HOME\}|\$HOME)(?=\/|$)/, '~')
    .replace(/(?:\$\{PWD\}|\$\(pwd\))/g, '$PWD')
}

function normaliserValeur(option: string, valeur: string, spec: SpecCommande): string {
  if (option === '--mount') return normaliserMount(valeur)
  if (option === '-p' || option === '--expose') return valeur.replace(/\/tcp$/i, '')
  if (option === '-v') return normaliserChemin(valeur)
  if (option === '--restart') return valeur.toLowerCase()
  if (option === '--platform') {
    return valeur.split(',').map(p => p.trim().replace(/^linux\/arm64\/v8$/, 'linux/arm64')).sort().join(',')
  }
  if (spec.optionsImage?.includes(option)) return normaliserImage(valeur)
  return valeur
}

/** `bash`, `/bin/bash`, `/usr/bin/bash` : le même shell, que le `PATH` du conteneur retrouve. */
function normaliserProgramme(mot: string): string {
  return mot.replace(/^\/(?:usr\/)?bin\/(bash|sh)$/, '$1')
}

/** Lit les options et les arguments d'une sous-commande selon sa spécification. */
function lireOptions(mots: string[], spec: SpecCommande, segment: Segment) {
  const valeurs = new Set(spec.valeurs ?? [])
  const alias = spec.alias ?? {}
  const drapeaux = new Set(segment.drapeaux)
  let fini = false

  for (let i = 0; i < mots.length; i++) {
    const mot = mots[i]!
    if (fini) {
      segment.arguments.push(mot)
      continue
    }
    if (mot === '--') {
      fini = true
      continue
    }
    if (mot.startsWith('--') && mot.length > 2) {
      const egal = mot.indexOf('=')
      const nom = egal > 0 ? mot.slice(0, egal) : mot
      const retenu = alias[nom] ?? nom
      if (egal > 0) segment.options.push([retenu, mot.slice(egal + 1)])
      else if (valeurs.has(retenu)) {
        const valeur = mots[++i]
        if (valeur === undefined) throw new ErreurSaisie(`L'option « ${nom} » attend une valeur.`)
        segment.options.push([retenu, valeur])
      } else drapeaux.add(retenu)
      continue
    }
    if (mot.startsWith('-') && mot.length > 1 && !/^-\d/.test(mot)) {
      // Des options courtes groupées : `-dit` vaut `-d -i -t`. La première qui
      // attend une valeur prend le reste du mot, ou le mot suivant.
      const lettres = mot.slice(1)
      for (let j = 0; j < lettres.length; j++) {
        const court = '-' + lettres[j]
        const retenu = alias[court] ?? court
        if (valeurs.has(retenu)) {
          const reste = lettres.slice(j + 1)
          const valeur = reste ? reste.replace(/^=/, '') : mots[++i]
          if (valeur === undefined) throw new ErreurSaisie(`L'option « ${court} » attend une valeur.`)
          segment.options.push([retenu, valeur])
          break
        }
        drapeaux.add(retenu)
      }
      continue
    }
    segment.arguments.push(mot)
    if (spec.arret) fini = true
  }
  segment.drapeaux = [...drapeaux]
}

function lireDocker(mots: string[]): Segment {
  const segment: Segment = { programme: 'docker', chemin: [], drapeaux: [], options: [], arguments: [], spec: {} }
  let i = 0
  // Les options globales placées avant la sous-commande : `docker --help`.
  while (i < mots.length && mots[i]!.startsWith('-')) {
    const m = mots[i]!
    segment.drapeaux.push(m === '-h' ? '--help' : m === '-v' ? '--version' : m)
    i++
  }
  const premier = mots[i]
  if (premier === undefined) return segment
  let chemin = [premier]
  i++
  if (GROUPES.has(premier)) {
    // `docker compose -f autre.yaml up` : les options de compose précèdent sa sous-commande.
    if (premier === 'compose') {
      const avant: string[] = []
      const avecValeur = new Set(OPTIONS_COMPOSE.valeurs)
      while (i < mots.length && mots[i]!.startsWith('-')) {
        const m = mots[i++]!
        avant.push(m)
        if (avecValeur.has(OPTIONS_COMPOSE.alias?.[m] ?? m) && i < mots.length) avant.push(mots[i++]!)
      }
      lireOptions(avant, OPTIONS_COMPOSE, segment)
    }
    const second = mots[i]
    if (second !== undefined && !second.startsWith('-')) {
      chemin = [premier, second]
      i++
    }
  }
  const cle = SYNONYMES[chemin.join(' ')] ?? chemin.join(' ')
  segment.chemin = cle.split(' ')
  const spec = SPECS[cle] ?? {}
  segment.spec = spec
  lireOptions(mots.slice(i), spec, segment)

  const args = segment.arguments
  if (spec.images === 'tous') segment.arguments = args.map(normaliserImage)
  else if (spec.images === 'premier' && args.length) segment.arguments = [normaliserImage(args[0]!), ...args.slice(1)]
  // Le contexte de construction : `./` et `.` désignent le même dossier.
  if (spec === OPTIONS_BUILD) segment.arguments = segment.arguments.map(a => a.replace(/^(\.?\.)\/$/, '$1'))
  if (spec.arret && segment.arguments.length > 1) {
    segment.arguments[1] = normaliserProgramme(segment.arguments[1]!)
  }
  if (spec.ensemble) segment.arguments = [...segment.arguments].sort()
  segment.options = segment.options
    .map(([o, v]) => [o, normaliserValeur(o, v, spec)] as [string, string])
    .sort(([a, va], [b, vb]) => a.localeCompare(b) || va.localeCompare(vb))
  segment.drapeaux = [...new Set(segment.drapeaux)].sort()
  return segment
}

function lireSegment(mots: string[]): Segment {
  let m = mots
  // L'invite recopiée avec la commande, et `sudo`, ne changent pas la commande.
  if (m[0] === '$' || m[0] === '#') m = m.slice(1)
  if (m[0] === 'sudo') m = m.slice(1)
  if (m[0] === 'docker-compose') m = ['docker', 'compose', ...m.slice(1)]
  if (m[0] === 'docker') return lireDocker(m.slice(1))
  return { programme: m[0] ?? '', chemin: [], drapeaux: [], options: [], arguments: m.slice(1), spec: {} }
}

function cleSegment(s: Segment): string {
  return JSON.stringify([s.programme, s.chemin, s.drapeaux, s.options, s.arguments])
}

/* ---------------------------------------------------------------------------
   Les remarques : dire ce qui cloche sans souffler la réponse.
   --------------------------------------------------------------------------- */

function pluriel(n: number, mot: string): string {
  return `${n === 1 ? 'une' : n} ${mot}${n > 1 ? 's' : ''}`
}

/** Pour enchaîner une remarque après « Commande 2 : ». Les guillemets ouvrants ne bougent pas. */
function minuscule(phrase: string): string {
  return phrase.charAt(0).toLowerCase() + phrase.slice(1)
}

function comparerSegments(s: Segment, a: Segment): string[] {
  if (s.programme !== a.programme) {
    if (a.programme === 'docker') return ['Une commande Docker commence par « docker ».']
    return [`Ce n'est pas « ${s.programme} » qu'il faut lancer ici.`]
  }
  if (s.chemin.join(' ') !== a.chemin.join(' ')) {
    if (!s.chemin.length) return ['Il manque la sous-commande, après « docker ».']
    return [`« docker ${s.chemin.join(' ')} » n'est pas la sous-commande qui fait cela.`]
  }
  if (s.programme !== 'docker') {
    return cleSegment(s) === cleSegment(a) ? [] : ['La commande n\'est pas tout à fait la bonne.']
  }

  const remarques: string[] = []
  const nomsS = new Set([...s.drapeaux, ...s.options.map(([o]) => o)])
  const nomsA = new Set([...a.drapeaux, ...a.options.map(([o]) => o)])
  const manquantes = [...nomsA].filter(n => !nomsS.has(n))
  const enTrop = [...nomsS].filter(n => !nomsA.has(n))
  // `docker run alpine -dit` : les options ne manquent pas, elles sont mal
  // placées — la remarque sur les arguments le dira, sans compter de travers.
  const malPlacees = !!a.spec.arret && s.arguments.slice(1).some(m => m.startsWith('-'))
  if (manquantes.length && !malPlacees) remarques.push(`Il manque ${pluriel(manquantes.length, 'option')}.`)
  if (enTrop.length) remarques.push(`En trop : ${enTrop.map(n => `« ${n} »`).join(', ')}.`)
  for (const nom of nomsA) {
    if (!nomsS.has(nom)) continue
    const vs = s.options.filter(([o]) => o === nom).map(([, v]) => v)
    const va = a.options.filter(([o]) => o === nom).map(([, v]) => v)
    if (JSON.stringify(vs) !== JSON.stringify(va)) remarques.push(`La valeur donnée à « ${nom} » n'est pas la bonne.`)
  }

  if (JSON.stringify(s.arguments) !== JSON.stringify(a.arguments)) {
    const suite = s.arguments.slice(1)
    if (a.spec.arret && suite.some(m => m.startsWith('-')) && !a.arguments.slice(1).some(m => m.startsWith('-'))) {
      remarques.push('Une option est placée après l\'image ou le conteneur : elle part au programme lancé dedans, pas à Docker. Les options de Docker se placent avant.')
    } else if (a.spec.images && s.arguments[0] !== a.arguments[0]) {
      remarques.push('L\'image visée n\'est pas la bonne.')
    } else if (a.spec.arret && s.arguments[0] === a.arguments[0]) {
      remarques.push('La commande passée au conteneur n\'est pas la bonne.')
    } else {
      remarques.push(a.arguments.length > s.arguments.length
        ? 'Il manque un argument.'
        : 'Les arguments ne sont pas les bons.')
    }
  }
  return remarques
}

function comparerShell(saisie: string[][][], attendue: string[][][]): string[] {
  if (saisie.length !== attendue.length) {
    return attendue.length === 1
      ? ['Une seule commande suffit.']
      : [`Il faut ${attendue.length} commandes, une par ligne.`]
  }
  const remarques: string[] = []
  saisie.forEach((tube, k) => {
    const prefixe = attendue.length > 1 ? `Commande ${k + 1} : ` : ''
    const at = attendue[k]!
    if (tube.length !== at.length) {
      remarques.push(prefixe + (at.length > tube.length
        ? 'la sortie doit passer dans une autre commande, avec « | ».'
        : 'le tube « | » n\'est pas attendu ici.'))
      return
    }
    tube.forEach((mots, j) => {
      for (const r of comparerSegments(lireSegment(mots), lireSegment(at[j]!))) {
        remarques.push(prefixe ? prefixe + minuscule(r) : r)
      }
    })
  })
  return remarques
}

function cleShell(commandes: string[][][]): string {
  return JSON.stringify(commandes.map(tube => tube.map(mots => cleSegment(lireSegment(mots)))))
}

/* ---------------------------------------------------------------------------
   Le Dockerfile, instruction par instruction.
   --------------------------------------------------------------------------- */

interface Instruction {
  mot: string
  cle: string
  /** `json` pour la forme tableau, `shell` sinon : deux formes qui ne lancent pas la même chose. */
  forme: 'json' | 'shell'
}

function lireInstructions(texte: string): Instruction[] {
  const lignes: string[] = []
  let courante = ''
  for (const brute of texte.split(/\r?\n/)) {
    const ligne = brute.trim()
    if (!courante && (!ligne || ligne.startsWith('#'))) continue
    if (courante && ligne.startsWith('#')) continue
    if (ligne.endsWith('\\')) {
      courante += ligne.slice(0, -1) + ' '
      continue
    }
    courante += ligne
    if (courante.trim()) lignes.push(courante.trim())
    courante = ''
  }
  if (courante.trim()) lignes.push(courante.trim())

  return lignes.map((ligne) => {
    const espace = ligne.search(/\s/)
    const mot = (espace < 0 ? ligne : ligne.slice(0, espace)).toUpperCase()
    const reste = espace < 0 ? '' : ligne.slice(espace).trim()
    if (reste.startsWith('[')) {
      try {
        const tableau = JSON.parse(reste)
        if (Array.isArray(tableau)) return { mot, cle: JSON.stringify(tableau.map(String)), forme: 'json' as const }
      } catch {
        throw new ErreurSaisie(`« ${mot} » : le tableau n'est pas du JSON valide — des guillemets doubles autour de chaque élément.`)
      }
    }
    return { mot, cle: cleArguments(mot, reste), forme: 'shell' as const }
  })
}

function cleArguments(mot: string, reste: string): string {
  const mots = reste ? (decouperShell(reste)[0]?.[0] ?? []) : []
  switch (mot) {
    case 'RUN':
      return cleShell(decouperShell(reste))
    case 'FROM': {
      const sansPlateforme = mots.filter(m => !m.startsWith('--platform'))
      const [image, as, nom] = sansPlateforme
      return JSON.stringify([normaliserImage(image ?? ''), as?.toUpperCase() ?? '', nom?.toLowerCase() ?? ''])
    }
    case 'LABEL':
    case 'ENV': {
      // `ENV CLE valeur`, l'ancienne forme, vaut `ENV CLE=valeur`.
      const paires = mots[0] && !mots[0].includes('=') ? [`${mots[0]}=${mots.slice(1).join(' ')}`] : mots
      return JSON.stringify([...paires].sort())
    }
    case 'EXPOSE':
      return JSON.stringify(mots.map(m => m.replace(/\/tcp$/i, '')).sort())
    case 'COPY':
    case 'ADD': {
      const options: string[] = []
      const args: string[] = []
      for (let i = 0; i < mots.length; i++) {
        const m = mots[i]!
        if (m.startsWith('--')) options.push(m.includes('=') ? m : `${m}=${mots[++i] ?? ''}`)
        else args.push(m)
      }
      return JSON.stringify([options.sort(), args])
    }
    default:
      return JSON.stringify(mots)
  }
}

function comparerDockerfile(saisie: Instruction[], attendue: Instruction[]): string[] {
  if (saisie.length !== attendue.length) {
    return attendue.length === 1
      ? ['Une seule instruction est attendue.']
      : [`Il faut ${attendue.length} instructions.`]
  }
  const remarques: string[] = []
  saisie.forEach((s, k) => {
    const a = attendue[k]!
    let r: string | null = null
    if (s.mot !== a.mot) r = `Ce n'est pas « ${s.mot} » qu'il faut ici.`
    else if (s.forme !== a.forme) {
      r = a.forme === 'json'
        ? `« ${a.mot} » s'écrit ici sous forme de tableau JSON : ["…", "…"].`
        : `« ${a.mot} » s'écrit ici sans tableau JSON.`
    } else if (s.cle !== a.cle) r = `Les arguments de « ${a.mot} » ne sont pas les bons.`
    if (r) remarques.push(attendue.length > 1 ? `Instruction ${k + 1} : ${minuscule(r)}` : r)
  })
  return remarques
}

/* ---------------------------------------------------------------------------
   Un morceau de compose.yaml.

   Le YAML de Compose n'emploie qu'une petite partie de la norme : des
   correspondances, des listes de scalaires, des scalaires entre guillemets ou
   non. On lit ce sous-ensemble plutôt que d'embarquer un parseur complet, et
   l'on compare des **arbres** : l'ordre des clés n'y compte pas, ni les
   guillemets autour de "8080:80".
   --------------------------------------------------------------------------- */

type Noeud = string | Noeud[] | { [cle: string]: Noeud }

interface LigneYaml { retrait: number, texte: string, numero: number }

function sansCommentaire(ligne: string): string {
  let guillemet: string | null = null
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i]!
    if (guillemet) {
      if (c === guillemet) guillemet = null
    } else if (c === '"' || c === '\'') guillemet = c
    else if (c === '#' && (i === 0 || /\s/.test(ligne[i - 1]!))) return ligne.slice(0, i)
  }
  return ligne
}

function scalaire(texte: string): Noeud {
  const t = texte.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('\'') && t.endsWith('\''))) return t.slice(1, -1)
  if (t.startsWith('[') && t.endsWith(']')) {
    const dedans = t.slice(1, -1).trim()
    return dedans ? dedans.split(',').map(x => scalaire(x) as string) : []
  }
  return t
}

/** Sépare `clé: valeur` ; nul si la ligne n'est pas une paire. */
function paire(texte: string): [string, string] | null {
  const m = /^("[^"]*"|'[^']*'|[^\s:][^:]*?)\s*:(?:\s+(.*))?$/.exec(texte)
  if (!m) return null
  return [scalaire(m[1]!) as string, m[2] ?? '']
}

function lireBloc(lignes: LigneYaml[], debut: number, retrait: number): [Noeud, number] {
  const premiere = lignes[debut]
  if (!premiere) return ['', debut]
  if (premiere.texte === '-' || premiere.texte.startsWith('- ')) {
    const liste: Noeud[] = []
    let i = debut
    while (i < lignes.length && lignes[i]!.retrait === retrait && (lignes[i]!.texte === '-' || lignes[i]!.texte.startsWith('- '))) {
      const reste = lignes[i]!.texte.slice(1).trim()
      if (!reste) {
        const [valeur, suite] = lireBloc(lignes, i + 1, lignes[i + 1]?.retrait ?? retrait + 2)
        liste.push(valeur)
        i = suite
      } else if (paire(reste) && !/^["']/.test(reste)) {
        // `- cle: valeur` ouvre une correspondance dont les clés suivantes sont
        // alignées sur le texte après le tiret.
        const decalees = [{ retrait: retrait + 2, texte: reste, numero: lignes[i]!.numero }]
        let j = i + 1
        while (j < lignes.length && lignes[j]!.retrait > retrait) decalees.push(lignes[j++]!)
        liste.push(lireBloc(decalees, 0, retrait + 2)[0])
        i = j
      } else {
        liste.push(scalaire(reste))
        i++
      }
    }
    return [liste, i]
  }

  const objet: { [cle: string]: Noeud } = {}
  let i = debut
  while (i < lignes.length && lignes[i]!.retrait === retrait) {
    const ligne = lignes[i]!
    const p = paire(ligne.texte)
    if (!p) throw new ErreurSaisie(`Ligne ${ligne.numero} : on attend « clé: valeur ».`)
    const [cle, valeur] = p
    if (valeur.trim()) {
      objet[cle] = scalaire(valeur)
      i++
      continue
    }
    const suivante = lignes[i + 1]
    // Une liste peut s'écrire au même retrait que sa clé : `volumes:` puis `- a`.
    if (suivante && (suivante.retrait > retrait || (suivante.retrait === retrait && suivante.texte.startsWith('-')))) {
      const [enfant, suite] = lireBloc(lignes, i + 1, suivante.retrait)
      objet[cle] = enfant
      i = suite
    } else {
      objet[cle] = ''
      i++
    }
  }
  if (i < lignes.length && lignes[i]!.retrait > retrait) {
    throw new ErreurSaisie(`Ligne ${lignes[i]!.numero} : le retrait ne tombe pas juste.`)
  }
  return [objet, i]
}

/** Les listes de Compose dont l'ordre ne compte pas, et `environment` sous ses deux formes. */
function normaliserYaml(noeud: Noeud, cle = ''): Noeud {
  if (typeof noeud === 'string') return cle === 'image' ? normaliserImage(noeud) : noeud
  if (Array.isArray(noeud)) {
    if (cle === 'environment' && noeud.every(x => typeof x === 'string' && x.includes('='))) {
      // Repassée par la normalisation, la correspondance obtenue trie ses clés :
      // `- B=2` puis `- A=1` vaut `A: 1` puis `B: 2`.
      return normaliserYaml(Object.fromEntries((noeud as string[]).map((x) => {
        const [k, ...v] = x.split('=')
        return [k!, v.join('=')]
      })), cle)
    }
    const liste = noeud.map(x => normaliserYaml(x))
    const ordonnee = ['command', 'entrypoint', 'test'].includes(cle)
    return ordonnee ? liste : [...liste].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  }
  return Object.fromEntries(Object.keys(noeud).sort().map(k => [k, normaliserYaml(noeud[k]!, k)]))
}

function lireYaml(texte: string): Noeud {
  const lignes: LigneYaml[] = []
  texte.split(/\r?\n/).forEach((brute, k) => {
    if (/^\t| \t/.test(brute.match(/^\s*/)?.[0] ?? '')) {
      throw new ErreurSaisie(`Ligne ${k + 1} : YAML refuse les tabulations — des espaces pour le retrait.`)
    }
    const ligne = sansCommentaire(brute).replace(/\s+$/, '')
    const t = ligne.trim()
    if (!t || t === '---' || t === '...') return
    lignes.push({ retrait: ligne.length - ligne.trimStart().length, texte: t, numero: k + 1 })
  })
  if (!lignes.length) return ''
  const [arbre, fin] = lireBloc(lignes, 0, lignes[0]!.retrait)
  if (fin < lignes.length) throw new ErreurSaisie(`Ligne ${lignes[fin]!.numero} : le retrait ne tombe pas juste.`)
  return normaliserYaml(arbre)
}

function comparerYaml(s: Noeud, a: Noeud, chemin: string[] = []): string[] {
  const ou = chemin.length ? ` sous « ${chemin.join(' › ')} »` : ''
  if (typeof a === 'string' || typeof s === 'string' || Array.isArray(a) !== Array.isArray(s)) {
    return JSON.stringify(s) === JSON.stringify(a)
      ? []
      : [chemin.length ? `La valeur de « ${chemin.join(' › ')} » n'est pas la bonne.` : 'Ce n\'est pas le bon contenu.']
  }
  if (Array.isArray(a) && Array.isArray(s)) {
    if (JSON.stringify(s) === JSON.stringify(a)) return []
    return [s.length !== a.length
      ? `La liste${ou} n'a pas le bon nombre d'éléments.`
      : `Un élément de la liste${ou} n'est pas le bon.`]
  }
  const os = s as { [cle: string]: Noeud }
  const oa = a as { [cle: string]: Noeud }
  const remarques: string[] = []
  const manquantes = Object.keys(oa).filter(k => !(k in os))
  const enTrop = Object.keys(os).filter(k => !(k in oa))
  if (manquantes.length) remarques.push(`Il manque ${pluriel(manquantes.length, 'clé')}${ou}.`)
  for (const k of enTrop) remarques.push(`« ${[...chemin, k].join(' › ')} » n'est pas attendu.`)
  for (const k of Object.keys(oa)) if (k in os) remarques.push(...comparerYaml(os[k]!, oa[k]!, [...chemin, k]))
  return remarques
}

/* ---------------------------------------------------------------------------
   L'entrée.
   --------------------------------------------------------------------------- */

function lire(texte: string, mode: ModeCommande): unknown {
  if (mode === 'dockerfile') return lireInstructions(texte)
  if (mode === 'yaml') return lireYaml(texte)
  return decouperShell(texte)
}

function cle(lu: unknown, mode: ModeCommande): string {
  if (mode === 'dockerfile') return JSON.stringify((lu as Instruction[]).map(i => [i.mot, i.forme, i.cle]))
  if (mode === 'yaml') return JSON.stringify(lu)
  return cleShell(lu as string[][][])
}

function comparer(saisie: unknown, attendue: unknown, mode: ModeCommande): string[] {
  if (mode === 'dockerfile') return comparerDockerfile(saisie as Instruction[], attendue as Instruction[])
  if (mode === 'yaml') return comparerYaml(saisie as Noeud, attendue as Noeud)
  return comparerShell(saisie as string[][][], attendue as string[][][])
}

/**
 * Corrige une saisie contre les réponses admises. Juste si elle équivaut à
 * l'une d'elles ; sinon, les remarques de la réponse admise la plus proche.
 */
export function corrigerCommande(saisie: string, attendues: string[], mode: ModeCommande = 'shell'): VerdictCommande {
  if (!saisie.trim()) return { juste: false, remarques: [mode === 'shell' ? 'Tape une commande.' : 'Écris ta réponse.'] }
  let lue: unknown
  try {
    lue = lire(saisie, mode)
  } catch (e) {
    if (e instanceof ErreurSaisie) return { juste: false, remarques: [e.message] }
    throw e
  }
  const cleSaisie = cle(lue, mode)
  let meilleure: string[] | null = null
  for (const attendue of attendues) {
    const lueAttendue = lire(attendue, mode)
    if (cle(lueAttendue, mode) === cleSaisie) return { juste: true, remarques: [] }
    const remarques = comparer(lue, lueAttendue, mode)
    if (!meilleure || remarques.length < meilleure.length) meilleure = remarques
  }
  return { juste: false, remarques: meilleure?.length ? meilleure : ['Ce n\'est pas la réponse attendue.'] }
}

/**
 * Le contrôle du contenu : une réponse admise qui ne se lit pas rendrait la
 * question impossible à réussir, sans rien afficher d'anormal.
 */
export function erreurAttendue(attendue: string, mode: ModeCommande = 'shell'): string | null {
  try {
    lire(attendue, mode)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}
