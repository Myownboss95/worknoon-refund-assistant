# syntax=docker/dockerfile:1
# Build context: the repository root (see docker-compose.yml, service "web").

FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable

# Install only what the web app needs, using the workspace lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts-ts/package.json packages/contracts-ts/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter "@worknoon/web..."

# Sources: shared contracts package, scenario data imported by the demo panel, and the app.
COPY packages/contracts-ts packages/contracts-ts
COPY contracts contracts
COPY apps/web apps/web

RUN pnpm --filter @worknoon/contracts build && pnpm --filter @worknoon/web build

FROM nginx:alpine AS runtime
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
