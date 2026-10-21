FROM node:20-alpine
RUN apk add --no-cache curl
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/

RUN pnpm install --no-frozen-lockfile

ARG SOURCE_TIMESTAMP=unknown
RUN echo "Source timestamp: $SOURCE_TIMESTAMP"
COPY apps/web apps/web/

RUN echo "Source timestamp: $SOURCE_TIMESTAMP"

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG BUILD_DATE=unknown
RUN echo "Build date: $BUILD_DATE"
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Producto standalone (Flota360: /flota360 + /flota360-api). Defaults = SGI360.
ARG NEXT_PUBLIC_BASE_PATH=
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ARG NEXT_PUBLIC_PRODUCT=sgi360
ENV NEXT_PUBLIC_PRODUCT=$NEXT_PUBLIC_PRODUCT
ARG NEXT_PUBLIC_STORAGE_PREFIX=
ENV NEXT_PUBLIC_STORAGE_PREFIX=$NEXT_PUBLIC_STORAGE_PREFIX
ARG NEXT_PUBLIC_ONLYOFFICE_URL=https://docs.logismart.ar
ENV NEXT_PUBLIC_ONLYOFFICE_URL=$NEXT_PUBLIC_ONLYOFFICE_URL

WORKDIR /app/apps/web
RUN rm -rf /app/apps/web/.next
# Build de producción (optimizado, minificado). Antes corría en modo dev (lento).
RUN pnpm build

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["pnpm", "start"]
