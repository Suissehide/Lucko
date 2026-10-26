# Image de production de l'API Lucko (NestJS + Prisma)
# Build depuis la racine du dépôt : docker build -f deploy/api/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# 1. Ne garder que ce dont l'API a besoin dans le monorepo
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.6 prune @lucko/api --docker

# 2. Installer les dépendances (couche mise en cache tant que le lockfile ne change pas), puis builder
FROM base AS builder
# URL factice : `prisma generate` n'a pas besoin d'une vraie base
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# Fichiers racine non inclus par `turbo prune`
COPY tsconfig.base.json ./
RUN pnpm turbo run build --filter=@lucko/api
# Retire les dépendances de développement (Nest CLI, TypeScript, Vitest…) avant l'image finale.
# `prisma` reste : `migrate deploy` tourne au démarrage du conteneur.
RUN CI=true pnpm install --prod --frozen-lockfile --offline

# 3. Image finale
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app /app
WORKDIR /app/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${API_PORT:-3000}/health || exit 1
# Applique les migrations en attente puis démarre l'API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
