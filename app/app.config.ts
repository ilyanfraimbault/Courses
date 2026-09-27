type LienBarre = { 'icon': string, 'to': string, 'target'?: string, 'label'?: string, 'aria-label'?: string }

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      // zinc, un gris neutre, comme les modèles de Nuxt UI. slate tirait sur le
      // bleu, et le fond sombre se lisait bleu nuit plutôt que gris.
      neutral: 'zinc'
    },
    footer: {
      slots: {
        root: 'border-t border-default',
        left: 'text-sm text-muted'
      }
    }
  },
  seo: {
    siteName: 'Cours'
  },
  header: {
    title: 'Cours',
    to: '/',
    search: true,
    colorMode: true,
    links: [] as LienBarre[]
  },
  footer: {
    credits: `Cahier de révisions • © ${new Date().getFullYear()}`,
    colorMode: false,
    links: [] as LienBarre[]
  },
  toc: {
    title: 'Sur cette page'
  }
})
