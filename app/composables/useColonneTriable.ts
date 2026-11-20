import type { Column } from '@tanstack/vue-table'
import { UButton } from '#components'

/**
 * Ce qu'il faut à une colonne pour trier au clic, dans les tableaux de
 * l'administration : un en-tête-bouton, et `enableSorting` — c'est lui qui
 * pose `aria-sort` sur la cellule d'en-tête, pour qu'un lecteur d'écran dise
 * dans quel sens la colonne est triée.
 *
 * Le bouton s'importe de `#components` : hors d'un fichier `.vue`,
 * `resolveComponent('UButton')` n'est pas réécrit par Nuxt et rend la chaîne
 * « UButton », qui s'affiche en balise inconnue et vide.
 *
 * Le premier clic trie dans le sens qui intéresse — le plus grand d'abord pour
 * un chiffre, l'ordre alphabétique pour un nom —, le second inverse.
 */
export function useColonneTriable() {
  return function triable<T>(libelle: string, opts: { decroissantDAbord?: boolean } = {}) {
    return {
      enableSorting: true,
      header: ({ column }: { column: Column<T> }) => {
        const tri = column.getIsSorted()
        return h(UButton, {
          color: 'neutral',
          variant: 'ghost',
          size: 'sm',
          label: libelle,
          trailingIcon: tri ? (tri === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow') : 'i-lucide-arrow-up-down',
          class: ['-mx-2.5 font-semibold', tri ? 'text-highlighted' : 'text-muted'],
          ui: { trailingIcon: tri ? 'size-4' : 'size-3.5 opacity-60' },
          onClick: () => column.toggleSorting(tri ? tri === 'asc' : !!opts.decroissantDAbord)
        })
      }
    }
  }
}
