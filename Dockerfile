# Trois étages : l'image d'exécution ne reçoit que `.output`, ni sources ni
# dépendances de développement.
FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY . ./
RUN pnpm run build

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

COPY --from=build --chown=node:node /app/.output ./.output

# Deux répertoires inscriptibles, créés ET donnés à `node` AVANT le changement
# d'utilisateur :
#  - /app/.data : Nuxt Content y restaure la base du contenu au démarrage. Sans
#    ce chown, /app appartient à root et le démarrage échoue en SQLITE_CANTOPEN.
#  - /data : point de montage du volume. Docker initialise un volume vide en
#    recopiant le contenu *et les droits* du répertoire présent dans l'image :
#    s'il n'y existe pas, le volume naît root:root et toute écriture échoue.
RUN mkdir -p /app/.data /data && chown -R node:node /app/.data /data

USER node
EXPOSE 3000

# 127.0.0.1 et non localhost : Nitro écoute en IPv4, et localhost résout ::1 en
# premier — la sonde échouerait sur un conteneur parfaitement sain.
# On interroge /api/sante, qui fait un SELECT sur la base : un volume mal monté
# doit rendre le conteneur « unhealthy » plutôt que servir des 500 en silence.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/sante || exit 1

CMD ["node", ".output/server/index.mjs"]
