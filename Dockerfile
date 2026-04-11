# ─────────────────────────────────────────────
# 1. BASE IMAGE
# ─────────────────────────────────────────────
FROM node:20-slim AS base

WORKDIR /app

# Install system dependencies (Prisma + native builds)
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*


# ─────────────────────────────────────────────
# 2. DEPENDENCIES (CACHED)
# ─────────────────────────────────────────────
FROM base AS deps

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile


# ─────────────────────────────────────────────
# 3. BUILD STAGE
# ─────────────────────────────────────────────
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build NestJS app
RUN yarn build

# Install ONLY production deps (clean)
RUN rm -rf node_modules
RUN yarn install --frozen-lockfile --production


# ─────────────────────────────────────────────
# 4. PRODUCTION IMAGE
# ─────────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app
ENV NODE_ENV=production

# Runtime system deps (Prisma needs OpenSSL)
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*


# Copy production node_modules
COPY --from=builder /app/node_modules ./node_modules

# Copy built app
COPY --from=builder /app/dist ./dist

# Prisma runtime files
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

# Copy package metadata (optional but good practice)
COPY package.json ./

# Entrypoint
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Security: non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]