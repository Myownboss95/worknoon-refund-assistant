# syntax=docker/dockerfile:1.7
#
# Worknoon Refund Assistant: NestJS API.
# Build context is the repository root (see docker-compose.yml, service api-nest):
#   docker compose build api-nest

# --- Build: install the workspace slice, compile contracts and the app ---------------------------
FROM node:22-alpine AS build
RUN apk add --no-cache openssl && corepack enable
WORKDIR /repo
ENV CI=true PRISMA_HIDE_UPDATE_MESSAGE=1 CHECKPOINT_DISABLE=1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts-ts/package.json packages/contracts-ts/
COPY apps/api-nest/package.json apps/api-nest/
# The app's postinstall runs `prisma generate`, which needs the schema and config.
COPY apps/api-nest/prisma apps/api-nest/prisma
COPY apps/api-nest/prisma.config.ts apps/api-nest/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter "@worknoon/api-nest..."

# Only what the build needs: never the local .env, tests or generated files.
COPY packages/contracts-ts packages/contracts-ts
COPY apps/api-nest/tsconfig.json apps/api-nest/tsconfig.build.json apps/api-nest/nest-cli.json apps/api-nest/
COPY apps/api-nest/src apps/api-nest/src
RUN pnpm --filter @worknoon/contracts build \
    && pnpm --filter @worknoon/api-nest build

# A self-contained production copy of the app with its own node_modules.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm --filter @worknoon/api-nest deploy --prod /out

# --- Runtime ---------------------------------------------------------------------------------------
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production \
    PORT=3001 \
    CONTRACTS_PATH=/srv/contracts \
    POLICY_DOC_PATH=/srv/policy/refund-policy.md \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    CHECKPOINT_DISABLE=1
WORKDIR /app

COPY --from=build --chown=node:node /out ./
COPY contracts /srv/contracts
COPY policy /srv/policy
COPY --chmod=755 apps/api-nest/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER node
EXPOSE 3001
HEALTHCHECK --interval=5s --timeout=3s --retries=30 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
