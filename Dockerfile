# De Vrije Hond — web (Next.js API + site + admin) for Dokku.
#
# Single image that builds the pnpm/turbo monorepo and keeps the workspace so
# the release phase can run migrations (`zen migrate deploy` needs the dev CLI).
# Dokku builds this automatically when a Dockerfile is present at the repo root.
#
# NEXT_PUBLIC_* are inlined at build time, so the browser-facing values come in
# as build args (wire them via `dokku docker-options:add ... build`).

FROM node:24-bookworm-slim AS app
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# Copy the whole workspace (the .dockerignore keeps out node_modules, the 1GB
# apps/mobile/ios prebuild, .next, .git). The full tree keeps the lockfile's
# workspace members intact so --frozen-lockfile resolves.
COPY . .
RUN pnpm install --frozen-lockfile

# Browser-facing config (must be present at build; defaults are safe for prod).
ARG NEXT_PUBLIC_APP_URL=https://www.devrijehond.nl
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

RUN pnpm --filter web build

ENV NODE_ENV=production
EXPOSE 3000

# `next start` honours $PORT (Dokku maps host 80 → container 3000 via ports:add).
CMD ["sh", "-c", "pnpm --filter web exec next start -p ${PORT:-3000} -H 0.0.0.0"]
