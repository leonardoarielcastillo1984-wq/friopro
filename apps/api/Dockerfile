# ── Stage 1: Build ──
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma/

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source and generate Prisma client
COPY apps/api apps/api/
RUN pnpm --filter api exec prisma generate
RUN cd apps/api && npx tsc -p tsconfig.json --noEmit false --skipLibCheck true || true

# Ensure .cjs files are copied and executable
COPY apps/api/*.cjs ./apps/api/

# ── Stage 2: Production ──
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

ENV NODE_ENV=production

# Copy built output + dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/*.cjs ./apps/api/
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Create uploads directory
RUN mkdir -p /app/apps/api/uploads

EXPOSE 3002

WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
