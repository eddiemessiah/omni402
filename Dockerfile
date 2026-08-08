# One container: the hub + every lane in lanes.json + the dashboard, on one port.
FROM node:22-slim

# git is handy for some transitive installs; corepack ships pnpm.
RUN corepack enable
WORKDIR /app

# Install deps first (better layer caching). Copy manifests + lockfile.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json .npmrc ./
COPY packages ./packages
COPY apps ./apps
COPY lanes.json ./
RUN pnpm install --frozen-lockfile

# Build the dashboard to dist/ — the hub serves it as static files.
RUN pnpm --filter @glasscelo/dashboard build

ENV HUB_PORT=4021
EXPOSE 4021

# The hub boots the gateways from lanes.json and serves the dashboard.
CMD ["node", "--import", "tsx", "apps/hub/src/serve.ts"]
