<script setup lang="ts">
/**
 * Un arbre dessiné, comme sur les diapos : des nœuds reliés par des flèches qui
 * descendent du parent vers ses fils.
 *
 * Écrit à la main en caractères (`↙ ↘`), un arbre se lisait mal et se cassait à
 * la moindre police ; écrit en ligne (`A → (B → (D, E), C → (·, F))`), il ne se
 * lisait plus du tout — et une question de parcours sans arbre visible est
 * insoluble. La fiche décrit donc l'arbre dans une notation courte, et le
 * dessin se calcule :
 *
 *   A(B(D, E), C(·, F))
 *
 * - un nœud est son étiquette, suivie de ses fils entre parenthèses ;
 * - `·` (ou une place vide) marque un fils **absent** : `C(·, F)` dit que `F`
 *   est le fils **droit** de `C`, ce qu'un arbre binaire doit pouvoir dire ;
 * - une étiquette sans guillemets peut contenir des espaces, affichés tels
 *   quels : les clés d'un nœud d'arbre B (`F L(…)`) ;
 * - une étiquette entre guillemets montre ses espaces, `␣`, parce qu'ils sont
 *   des caractères du texte — les feuilles d'une rope (`"r à"`) ; elle peut
 *   aussi contenir des virgules ou des parenthèses.
 *
 * Rien ne dépend du compte : le dessin est le même au serveur et au client.
 */
const props = defineProps<{
  /** L'arbre, dans la notation ci-dessus. */
  arbre: string
  /** Une légende au-dessus du dessin : « Avant », « Après insertion de G ». */
  titre?: string
}>()

interface Noeud {
  /** Telle qu'affichée : les espaces d'une étiquette entre guillemets y sont déjà des `␣`. */
  etiquette: string
  /** null : une place de fils laissée vide. */
  fils: (Noeud | null)[]
}

/** Lecture de la notation. Une faute de syntaxe lève : `verifier-contenu` la voit au rendu. */
function lire(texte: string): Noeud {
  let i = 0
  const espaces = () => {
    while (i < texte.length && /\s/.test(texte[i]!)) i++
  }
  function etiquette(): string {
    espaces()
    if (texte[i] === '"') {
      const fin = texte.indexOf('"', i + 1)
      if (fin < 0) throw new Error(`arbre : guillemet non fermé dans « ${texte} »`)
      const e = texte.slice(i + 1, fin)
      i = fin + 1
      return e.replace(/ /g, '␣')
    }
    const debut = i
    while (i < texte.length && !'(),'.includes(texte[i]!)) i++
    return texte.slice(debut, i).trim()
  }
  function noeud(): Noeud | null {
    const e = etiquette()
    espaces()
    const fils: (Noeud | null)[] = []
    if (texte[i] === '(') {
      i++
      for (;;) {
        fils.push(noeud())
        espaces()
        if (texte[i] === ',') {
          i++
          continue
        }
        if (texte[i] === ')') {
          i++
          break
        }
        throw new Error(`arbre : « ) » attendue en position ${i} dans « ${texte} »`)
      }
    }
    if ((e === '' || e === '·') && !fils.length) return null
    return { etiquette: e, fils }
  }
  const racine = noeud()
  espaces()
  if (!racine || i !== texte.length) throw new Error(`arbre illisible : « ${texte} »`)
  return racine
}

// Les mesures du dessin, en unités du viewBox.
const HAUTEUR_NOEUD = 30
const ETAGE = 66
const ECART = 14
const CARACTERE = 8.6
const MARGE = 6

interface Place {
  x: number
  y: number
  niveau: number
  largeur: number
  texte: string
  /** Le centre du parent, d'où part la flèche ; null pour la racine. */
  parent: { x: number, y: number } | null
}

function largeurBoite(etiquette: string): number {
  return Math.max(HAUTEUR_NOEUD, etiquette.length * CARACTERE + 18)
}

function largeurFils(n: Noeud): number {
  return n.fils.reduce((s, f) => s + largeurSousArbre(f), 0) + ECART * (n.fils.length - 1)
}

/** La largeur qu'occupe un sous-arbre : celle de ses fils côte à côte, ou la sienne si elle est plus grande. */
function largeurSousArbre(n: Noeud | null): number {
  if (!n) return HAUTEUR_NOEUD
  return Math.max(largeurBoite(n.etiquette) + ECART, n.fils.length ? largeurFils(n) : 0)
}

const dessin = computed(() => {
  const racine = lire(props.arbre)
  const places: Place[] = []
  let profondeur = 0

  // Chaque sous-arbre reçoit une bande horizontale ; un parent se centre entre
  // les centres de son premier et de son dernier fils — places vides
  // comprises, si bien qu'un fils unique droit tombe bien à droite.
  function placer(n: Noeud | null, gauche: number, niveau: number): number {
    const largeur = largeurSousArbre(n)
    if (!n) return gauche + largeur / 2
    profondeur = Math.max(profondeur, niveau)
    const y = MARGE + niveau * ETAGE + HAUTEUR_NOEUD / 2
    const premier = places.length
    let x = gauche + largeur / 2
    if (n.fils.length) {
      let curseur = gauche + (largeur - largeurFils(n)) / 2
      const centres: number[] = []
      for (const f of n.fils) {
        centres.push(placer(f, curseur, niveau + 1))
        curseur += largeurSousArbre(f) + ECART
      }
      x = (centres[0]! + centres[centres.length - 1]!) / 2
    }
    // Les fils directs viennent d'être placés : on leur donne le point de
    // départ de leur flèche, connu seulement maintenant.
    for (let k = premier; k < places.length; k++) {
      if (places[k]!.niveau === niveau + 1) places[k]!.parent = { x, y }
    }
    places.push({ x, y, niveau, largeur: largeurBoite(n.etiquette), texte: n.etiquette, parent: null })
    return x
  }

  placer(racine, MARGE, 0)
  return {
    places,
    largeur: largeurSousArbre(racine) + 2 * MARGE,
    hauteur: 2 * MARGE + profondeur * ETAGE + HAUTEUR_NOEUD
  }
})

const id = useId()

/** La flèche s'arrête au bord de la boîte du fils, pas en son centre. */
function fleche(p: Place) {
  const depart = p.parent!
  const dy = p.y - depart.y
  const dx = p.x - depart.x
  const debut = { x: depart.x + dx * (HAUTEUR_NOEUD / 2) / dy, y: depart.y + HAUTEUR_NOEUD / 2 }
  const fin = { x: p.x - dx * (HAUTEUR_NOEUD / 2 + 3) / dy, y: p.y - HAUTEUR_NOEUD / 2 - 3 }
  return { x1: debut.x, y1: debut.y, x2: fin.x, y2: fin.y }
}

const description = computed(() => props.titre ? `${props.titre} — arbre ${props.arbre}` : `Arbre ${props.arbre}`)
</script>

<template>
  <figure class="arbre my-4 not-prose">
    <figcaption
      v-if="titre"
      class="mb-1 text-center text-sm text-muted"
    >
      {{ titre }}
    </figcaption>
    <svg
      :viewBox="`0 0 ${dessin.largeur} ${dessin.hauteur}`"
      :width="dessin.largeur"
      :height="dessin.hauteur"
      class="mx-auto block h-auto max-w-full"
      role="img"
      :aria-label="description"
    >
      <defs>
        <marker
          :id="`${id}-pointe`"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            style="fill: var(--ui-text-muted)"
          />
        </marker>
      </defs>
      <g style="stroke: var(--ui-text-muted)">
        <line
          v-for="(p, k) in dessin.places.filter(q => q.parent)"
          :key="`l${k}`"
          v-bind="fleche(p)"
          stroke-width="1.5"
          :marker-end="`url(#${id}-pointe)`"
        />
      </g>
      <g
        v-for="(p, k) in dessin.places"
        :key="`n${k}`"
      >
        <rect
          :x="p.x - p.largeur / 2"
          :y="p.y - HAUTEUR_NOEUD / 2"
          :width="p.largeur"
          :height="HAUTEUR_NOEUD"
          :rx="HAUTEUR_NOEUD / 2"
          style="fill: var(--ui-bg-elevated); stroke: var(--ui-text-highlighted)"
          stroke-width="1.5"
        />
        <text
          :x="p.x"
          :y="p.y"
          text-anchor="middle"
          dominant-baseline="central"
          class="font-mono"
          font-size="14"
          style="fill: var(--ui-text-highlighted)"
        >{{ p.texte }}</text>
      </g>
    </svg>
  </figure>
</template>
