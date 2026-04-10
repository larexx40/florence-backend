# ── Base image (better than alpine for prisma) ─────────────────────────────
FROM node:20-slim AS base
WORKDIR /app

# ── Install dependencies (cached layer) ────────────────────────────────────
FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# ── Build stage ────────────────────────────────────────────────────────────
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate --schema prisma/schema.prisma
RUN yarn build

# ── Production stage ───────────────────────────────────────────────────────
FROM node:20-slim AS production
WORKDIR /app
ENV NODE_ENV=production

# Copy only what we need
COPY package.json yarn.lock ./

# Install ONLY production deps
RUN yarn install --frozen-lockfile --production

# Copy built app
COPY --from=builder /app/dist ./dist

# Copy prisma client + engines
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Prisma CLI for migrations
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Schema
COPY prisma ./prisma

# Entrypoint
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Non-root
RUN chown -R node:node /app
USER node

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]