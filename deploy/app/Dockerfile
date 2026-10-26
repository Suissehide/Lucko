# Image de production de la version web de l'app Lucko (export statique Expo servi par nginx)
# Build depuis la racine du dépôt : docker build -f deploy/app/Dockerfile --build-arg EXPO_PUBLIC_API_URL=https://api.exemple.fr .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.6 prune @lucko/mobile --docker

FROM base AS builder
# Les variables EXPO_PUBLIC_* sont figées au moment du build
ARG EXPO_PUBLIC_API_URL
ARG EXPO_PUBLIC_SITE_URL
ARG EXPO_PUBLIC_UMAMI_WEBSITE_ID
ARG EXPO_PUBLIC_SENTRY_DSN
ARG EXPO_PUBLIC_SENTRY_ENVIRONMENT
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_SITE_URL=$EXPO_PUBLIC_SITE_URL
ENV EXPO_PUBLIC_UMAMI_WEBSITE_ID=$EXPO_PUBLIC_UMAMI_WEBSITE_ID
ENV EXPO_PUBLIC_SENTRY_DSN=$EXPO_PUBLIC_SENTRY_DSN
ENV EXPO_PUBLIC_SENTRY_ENVIRONMENT=$EXPO_PUBLIC_SENTRY_ENVIRONMENT
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# Fichiers racine non inclus par `turbo prune`
COPY tsconfig.base.json ./
RUN pnpm turbo run build --filter=@lucko/mobile^...
# Worker de MapLibre (build CSP) servi depuis public/, copié depuis node_modules (LKO-122)
RUN cd apps/mobile && pnpm maplibre-worker && pnpm exec expo export --platform web --output-dir dist

FROM nginx:1.29-alpine AS runner
COPY deploy/app/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/app/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=builder /app/apps/mobile/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
