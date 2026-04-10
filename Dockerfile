# ─────────────────────────────────────────────
# 1. BASE IMAGE
# ─────────────────────────────────────────────
FROM node:20-slim AS base
WORKDIR /app

# Install system dependencies (Prisma + OpenSSL)
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*


# ─────────────────────────────────────────────
# 2. DEPENDENCIES LAYER (CACHED)
# ─────────────────────────────────────────────
FROM base AS deps

COPY package.json yarn.lock ./

# Enable better caching
RUN yarn install --frozen-lockfile


# ─────────────────────────────────────────────
# 3. BUILDER STAGE
# ─────────────────────────────────────────────
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma generate
RUN npx prisma generate

# Build NestJS app
RUN yarn build

# Remove dev dependencies for smaller runtime artifact
RUN yarn install --production --frozen-lockfile
RUN npm prune --omit=dev


# ─────────────────────────────────────────────
# 4. PRODUCTION STAGE (MINIMAL IMAGE)
# ─────────────────────────────────────────────
FROM node:20-slim AS production
WORKDIR /app

ENV NODE_ENV=production

# System deps required by Prisma runtime
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*


# ── Copy ONLY production essentials ──
COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --production

# App build output
COPY --from=builder /app/dist ./dist

# Prisma (ONLY what is needed at runtime)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

# Entrypoint
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Security: run as non-root
RUN useradd -m appuser
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]