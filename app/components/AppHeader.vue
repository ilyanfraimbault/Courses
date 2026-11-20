<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const sommaire = useSommaire()

const { header } = useAppConfig()
const { loggedIn, user, clear } = useUserSession()
const autorise = useAccesAccorde()
const connexion = useConnexion()
const route = useRoute()
const { libelle: parcours, demande: changerParcours } = useProfil()

/**
 * Seuls les deux lieux où l'on travaille restent dans la barre : le cours qu'on
 * lit, le quiz qu'on lance. Tout ce qui est à soi — ce qu'on a composé, prévu ou
 * mesuré — passe sous le profil, comme sur la plupart des sites : sept entrées
 * côte à côte ne tenaient qu'en icônes muettes avant les grands écrans.
 */
const liens = [
  { label: 'Cours', to: '/cours', icon: 'i-lucide-library' },
  { label: 'Quiz', to: '/quiz', icon: 'i-lucide-zap' }
]

const menu = computed<DropdownMenuItem[][]>(() => autorise.value ? menuComplet.value : menuSansAcces.value)

/** Sans accès, rien de ce qui est à soi n'existe encore : seulement la demande. */
const menuSansAcces = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: user.value?.pseudo, icon: 'i-lucide-circle-user' }],
  [{ label: 'Demande d\'accès', to: PAGE_DEMANDE, icon: 'i-lucide-hourglass' }],
  [{ label: 'Se déconnecter', icon: 'i-lucide-log-out', onSelect: deconnecter }]
])

const menuComplet = computed<DropdownMenuItem[][]>(() => [
  [
    { type: 'label', label: [user.value?.prenom, user.value?.nom].filter(Boolean).join(' ') || user.value?.pseudo, icon: 'i-lucide-circle-user' },
    { label: 'Mon profil', icon: 'i-lucide-user-pen', onSelect: () => { changerParcours.value = true } }
  ],
  [
    { label: 'Contrôles', to: '/controles', icon: 'i-lucide-calendar-check' },
    { label: 'Mes QCM', to: '/mes-qcm', icon: 'i-lucide-list-plus' },
    { label: 'Ma to-do', to: '/ma-to-do', icon: 'i-lucide-list-checks' }
  ],
  [
    { label: 'Mes moyennes', to: '/mes-moyennes', icon: 'i-lucide-calculator' },
    { label: 'Mes domaines', to: '/mes-domaines', icon: 'i-lucide-target' },
    { label: 'Mes résultats', to: '/mes-resultats', icon: 'i-lucide-chart-line' }
  ],
  // Le drapeau ne fait qu'afficher l'entrée : le serveur refuse les données à
  // qui n'est pas administrateur, quoi que dise la session du navigateur.
  ...(user.value?.admin
    ? [[
        { type: 'label' as const, label: 'Administration' },
        { label: 'Utilisateurs', to: '/admin', icon: 'i-lucide-users' }
      ]]
    : []),
  [{ label: 'Se déconnecter', icon: 'i-lucide-log-out', onSelect: deconnecter }]
])

/**
 * On recharge l'application plutôt que de naviguer : les lectures faites au
 * montage — progression, to-do, clôtures — vivent dans des états partagés, et
 * le compte suivant à se connecter sur cet onglet hériterait sinon de ce que le
 * précédent y a laissé. Une fiche se lit sans compte : on y reste.
 */
async function deconnecter() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  reloadNuxtApp({ path: estPublique(route.path) ? route.fullPath : '/connexion' })
}
</script>

<template>
  <UHeader
    :ui="{ center: 'flex-1' }"
    :to="header?.to || '/'"
  >
    <UContentSearchButton
      v-if="header?.search"
      :collapsed="false"
      class="w-full"
    />

    <!-- Le parcours, à côté du titre : il dit quelles matières le site montre.
         Hors du lien du titre, pour qu'un clic ouvre le choix au lieu de
         ramener à l'accueil. -->
    <template #left>
      <div class="flex items-center gap-2">
        <ULink
          :to="header?.to || '/'"
          class="font-medium text-highlighted"
        >
          {{ header?.title }}
        </ULink>
        <ClientOnly>
          <UBadge
            v-if="autorise && parcours"
            as="button"
            type="button"
            :label="parcours"
            color="primary"
            variant="subtle"
            size="sm"
            class="cursor-pointer"
            title="Mon profil : parcours, nom"
            @click="changerParcours = true"
          />
        </ClientOnly>
      </div>
    </template>

    <template #right>
      <UContentSearchButton
        v-if="header?.search"
        class="lg:hidden"
      />

      <div
        v-if="autorise"
        class="hidden items-center gap-1 sm:flex"
      >
        <UButton
          v-for="lien of liens"
          :key="lien.to"
          v-bind="lien"
          color="neutral"
          variant="ghost"
          size="sm"
        />
      </div>

      <UColorModeButton v-if="header?.colorMode" />

      <UButton
        v-if="!loggedIn"
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-log-in"
        label="Se connecter"
        :ui="{ label: 'hidden sm:inline' }"
        aria-label="Se connecter"
        @click="connexion.ouvrir()"
      />

      <UDropdownMenu
        v-else
        :items="menu"
        :content="{ align: 'end' }"
        :ui="{ content: 'w-56' }"
      >
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-circle-user"
          :label="user?.pseudo"
          trailing-icon="i-lucide-chevron-down"
          :ui="{ label: 'hidden sm:inline' }"
          :aria-label="`Menu de ${user?.pseudo}`"
        />
      </UDropdownMenu>

      <template v-if="header?.links">
        <UButton
          v-for="(link, index) of header.links"
          :key="index"
          v-bind="{ color: 'neutral', variant: 'ghost', ...link }"
        />
      </template>
    </template>

    <template #body>
      <div
        v-if="autorise"
        class="mb-4 flex flex-col gap-1 sm:hidden"
      >
        <UButton
          v-for="lien of liens"
          :key="lien.to"
          v-bind="lien"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
        />
      </div>

      <ULink
        :to="sommaire.chemin"
        class="mb-2 block"
      >
        <span
          v-if="sommaire.annee"
          class="block text-xs font-medium uppercase tracking-wide text-dimmed"
        >{{ sommaire.annee }}</span>
        <span class="block text-sm font-semibold text-highlighted">{{ sommaire.titre }}</span>
      </ULink>

      <UContentNavigation
        highlight
        :navigation="sommaire.liens"
      />
    </template>
  </UHeader>
</template>
