# ─── Build stage ────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Copy manifests first so the dependency layer is cached across code changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
COPY packages/content/package.json packages/content/

RUN npm ci

COPY . .

# The shared package is built first because the server imports its compiled
# types, and the client build typechecks against them.
RUN npm run build --workspace @skillmap/shared \
 && npm run build --workspace @skillmap/server \
 && npm run build --workspace @skillmap/client

# ─── Runtime stage ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

# wget is used by the healthcheck; nothing else is added to the image.
RUN apk add --no-cache wget

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/content/package.json packages/content/

# Production dependencies only, and only for the server workspace.
RUN npm ci --omit=dev --workspace @skillmap/server --include-workspace-root \
 && npm cache clean --force

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/server/package.json packages/server/
COPY --from=build /app/packages/content/src packages/content/src
COPY --from=build /app/packages/content/package.json packages/content/

# Uploads live outside the app so they survive a redeploy.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
VOLUME ["/app/uploads"]

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

CMD ["node", "packages/server/dist/index.js"]
