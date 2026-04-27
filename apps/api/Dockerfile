FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache openssl
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma/
COPY prisma/schema.prisma prisma/

RUN pnpm install --no-frozen-lockfile

RUN rm -rf /app/apps/api/node_modules
COPY apps/api apps/api/
RUN cp /app/prisma/schema.prisma /app/apps/api/prisma/

RUN pnpm --filter api exec prisma generate

FROM node:20-slim AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

RUN mkdir -p /app/apps/api/uploads

EXPOSE 3002

WORKDIR /app/apps/api
CMD ["npx", "tsx", "src/main.ts"]
