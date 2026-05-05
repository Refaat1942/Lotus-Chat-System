### ---------- Stage 1: builder ----------
FROM node:22-alpine AS builder

# Build deps for native modules (bcrypt, pg native, etc.)
RUN apk add --no-cache python3 make g++ libc6-compat

# Use pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY pnpm-workspace.yaml package.json tsconfig.json tsconfig.base.json* ./
COPY .npmrc* ./

# Copy every package.json so pnpm can resolve the workspace graph
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/lotus-crm/package.json   ./artifacts/lotus-crm/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY lib/db/package.json                 ./lib/db/
COPY lib/api-spec/package.json           ./lib/api-spec/
COPY lib/api-zod/package.json            ./lib/api-zod/
COPY lib/api-client-react/package.json   ./lib/api-client-react/
COPY lib/integrations-openai-ai-server/package.json ./lib/integrations-openai-ai-server/
COPY lib/integrations-openai-ai-react/package.json  ./lib/integrations-openai-ai-react/
COPY scripts/package.json                ./scripts/

RUN pnpm install --no-frozen-lockfile

# Copy the rest of the source
COPY . .

# Build-time variables required by Vite & api-server
ENV PORT=8080
ENV BASE_PATH=/

# Build the API and the frontend
RUN pnpm --filter @workspace/api-server run build \
 && pnpm --filter @workspace/lotus-crm run build


### ---------- Stage 2: api runtime ----------
FROM node:22-alpine AS api

# Need bash + postgresql-client for entrypoint (waiting on db, etc.)
RUN apk add --no-cache bash postgresql-client libc6-compat

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy the entire built workspace from builder so drizzle-kit & seed can run
COPY --from=builder /app /app

# Entrypoint script (runs migrations + seed, then starts the API)
COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
