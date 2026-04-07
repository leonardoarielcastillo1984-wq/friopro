# ── Stage 1: Build ──
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY apps/api apps/api/
RUN pnpm --filter api run build
RUN pnpm --filter api exec prisma generate

# ── Stage 2: Production ──
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

ENV NODE_ENV=production

# Copy built output + dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Create uploads directory
RUN mkdir -p /app/apps/api/uploads

EXPOSE 3001

WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
