# ── deps ─────────────────────────────────────────────────────────────────────
# Install all dependencies (incl. dev) needed to build and to run migrations.
FROM node:20-slim AS deps
WORKDIR /app
# openssl is required by Prisma's engines.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# Prefer IPv4 — the host has no IPv6 default route.
# --ignore-scripts skips the @prisma/engines postinstall which
# downloads a binary and often fails on this host's network.
COPY node_modules ./node_modules

# ── builder ──────────────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_VAPID_PUBLIC_KEY is safe to bake into the client bundle — it is
# intentionally public. VAPID_PRIVATE_KEY must NEVER appear here as an ARG or ENV.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate the Prisma client, then install engine binaries with the expected names.
# Binaries are pre-staged by the deploy script into .prisma-engines/ so Docker
# never needs network access to binaries.prisma.sh (unreachable on this host).
RUN PRISMA_QUERY_ENGINE_LIBRARY=/app/.prisma-engines/libquery-engine \
    PRISMA_SCHEMA_ENGINE_BINARY=/app/.prisma-engines/schema-engine \
    ./node_modules/.bin/prisma generate \
    && mkdir -p node_modules/.prisma/client \
    && cp .prisma-engines/libquery-engine \
         node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node \
    && cp .prisma-engines/schema-engine \
         node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x \
    && chmod +x \
         node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node \
         node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x
RUN npm run build

# ── runner ───────────────────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Receipts are written here — keep it on a volume, outside the web root.
ENV UPLOAD_DIR=/data/uploads

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Run as a non-root user.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /data/uploads \
  && chown -R nextjs:nodejs /data

# Point Prisma directly at the pre-built binaries so binaryNeedsToBeDownloaded()
# short-circuits at the env var check and never tries to write to root-owned dirs.
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node
ENV PRISMA_SCHEMA_ENGINE_BINARY=/app/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x

# Next standalone server + static assets + public dir.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma: schema + the squashed migrations + the CLI/engines so the container
# can run `prisma migrate deploy` at startup against the production DB.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
VOLUME ["/data"]

# Liveness/DB probe (no curl/wget in slim image — use Node's global fetch).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Apply migrations, then start the server. Never run `migrate dev` in production.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
