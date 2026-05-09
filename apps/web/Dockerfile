FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/

RUN pnpm install --no-frozen-lockfile

ARG SOURCE_TIMESTAMP=unknown
RUN echo "Source timestamp: $SOURCE_TIMESTAMP"
COPY apps/web apps/web/

RUN echo "Source timestamp: $SOURCE_TIMESTAMP"

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ARG BUILD_DATE=unknown
RUN echo "Build date: $BUILD_DATE"
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN rm -rf /app/apps/web/.next
# Skip CSS processing for now - let Next.js handle it in dev mode

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

WORKDIR /app/apps/web
CMD ["pnpm", "dev"]
