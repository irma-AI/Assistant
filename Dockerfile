# The image every deploy ships. Built in CI from a green main, tagged with its commit.
FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS base
WORKDIR /app
COPY mise.toml package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# pnpm's version comes from mise.toml, the one place it is pinned.
RUN npm install -g --no-audit --no-fund "pnpm@$(sed -n 's/^pnpm = "\(.*\)"/\1/p' mise.toml)"

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# The migration runner needs kysely and pg at run time; the server bundle carries its own.
FROM base AS prod-deps
RUN pnpm install --prod --frozen-lockfile

FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
COPY package.json ./
COPY migrations ./migrations
COPY scripts/migrate.ts ./scripts/
COPY src/server/migrate.server.ts ./src/server/
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION NODE_ENV=production PORT=3000
LABEL org.opencontainers.image.source=https://github.com/irma-AI/Assistant
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:${PORT}/version || exit 1
# Pending migrations first: if one fails, the container exits, never turns healthy, and the deploy rolls back.
CMD ["sh", "-c", "node scripts/migrate.ts && exec node .output/server/index.mjs"]
