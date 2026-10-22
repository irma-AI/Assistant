# The image every deploy ships. Built in CI from a green main, tagged with its commit.
FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build
WORKDIR /app
COPY mise.toml package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# pnpm's version comes from mise.toml, the one place it is pinned.
RUN npm install -g --no-audit --no-fund "pnpm@$(sed -n 's/^pnpm = "\(.*\)"/\1/p' mise.toml)" && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
WORKDIR /app
COPY --from=build /app/.output ./.output
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION NODE_ENV=production PORT=3000
LABEL org.opencontainers.image.source=https://github.com/irma-AI/Assistant
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:3000/version || exit 1
CMD ["node", ".output/server/index.mjs"]
