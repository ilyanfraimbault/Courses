/**
 * Sonde du HEALTHCHECK Docker. Elle interroge la base, et pas seulement le
 * serveur HTTP : un volume mal monté doit rendre le conteneur « unhealthy »
 * plutôt que de le laisser servir des 500 en silence.
 */
export default defineEventHandler(() => {
  useBase().prepare('SELECT 1').get()
  return { ok: true }
})
