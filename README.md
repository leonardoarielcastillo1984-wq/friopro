# SGI 360

**Sistema de Gestión Integrado con IA Auditora** — Plataforma SaaS multi-tenant para gestión de calidad, seguridad, ambiente y seguridad vial (ISO 9001, ISO 14001, ISO 45001, ISO 39001, IATF 16949).

## Arquitectura

| Componente | Stack | Puerto |
|---|---|---|
| `apps/api` | Fastify + Prisma + PostgreSQL | 3001 |
| `apps/web` | Next.js 14 (App Router) | 3000 |
| `infra/` | Docker Compose (Postgres 16, Redis 7) | 5432, 6379 |

### Módulos

- **Documentos** — Gestión documental con versionado y estados
- **Normativos** — Carga de PDFs normativos con extracción automática de cláusulas
- **Auditoría IA** — Análisis de cumplimiento documento vs norma con LLM
- **Chat Auditor** — Consultas en lenguaje natural sobre cumplimiento
- **No Conformidades** — NCRs con workflow de estados y severidad
- **Riesgos** — Matriz 5×5, categorización y planes de mitigación
- **Indicadores (KPI)** — Mediciones periódicas con metas y tendencias
- **Capacitaciones** — Programa de formación con asistencia
- **Reportes** — Generación y exportación PDF de 6 tipos de reporte
- **Notificaciones** — Sistema en tiempo real con webhooks (Slack, Teams)
- **Configuración** — Gestión de miembros, roles y datos del tenant

## Requisitos

- **Node.js** 20+
- **pnpm** 8+
- **Docker Desktop** (para Postgres y Redis)

## Inicio rápido

### 1. Infraestructura

```bash
docker compose -f infra/docker-compose.yml up -d
```

Esperar a que los healthchecks pasen (~10s):
```bash
docker compose -f infra/docker-compose.yml ps
```

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Configurar variables de entorno

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Editar `apps/api/.env` con valores seguros para `JWT_SECRET`. Para IA auditora, configurar `ANTHROPIC_API_KEY` o `OPENAI_API_KEY`.

### 4. Base de datos

```bash
cd apps/api
npx prisma generate
npx prisma migrate reset --force
```

Esto ejecuta todas las migraciones y el seed (Super Admin + planes + datos demo).

### 5. Levantar servicios

```bash
# Terminal 1 — API
cd apps/api && pnpm dev

# Terminal 2 — Web
cd apps/web && pnpm dev
```

### 6. Acceder

- **Web**: http://localhost:3000
- **API**: http://localhost:3001
- **API Docs (Swagger)**: http://localhost:3001/docs
- **Health check**: http://localhost:3001/health

### Credenciales de prueba

| Rol | Email | Contraseña |
|---|---|---|
| Super Admin | `admin@sgi360.com` | `Admin123!` |
| Usuario Demo | `usuario@demo.com` | `User123!` |

## Scripts útiles

```bash
# API
cd apps/api
pnpm dev                    # Desarrollo con hot-reload
npx prisma studio           # UI visual de la BD
npx prisma migrate reset    # Reset completo + seed
npx tsc --noEmit            # Verificar tipos

# Web
cd apps/web
pnpm dev                    # Desarrollo con hot-reload
npx tsc --noEmit            # Verificar tipos
```

## Variables de entorno

Ver `apps/api/.env.example` para la lista completa. Variables clave:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión PostgreSQL |
| `JWT_SECRET` | Secret para JWT (cambiar en producción) |
| `REDIS_URL` | Conexión Redis para BullMQ |
| `CORS_ORIGIN` | Origen(es) permitidos, separados por coma |
| `LLM_PROVIDER` | `anthropic`, `openai` u `ollama` |
| `EMAIL_PROVIDER` | `console` (dev), `resend` o `smtp` |
| `STORAGE_BACKEND` | `local` (dev) o `s3` (producción) |

### Email

| Proveedor | Variables requeridas |
|---|---|
| `console` | Ninguna (imprime en consola) |
| `resend` | `RESEND_API_KEY` |
| `smtp` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |

### Storage

| Backend | Variables requeridas |
|---|---|
| `local` | `STORAGE_LOCAL_PATH` (default: `./uploads`) |
| `s3` | `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |

> Para S3-compatible (MinIO, R2, DigitalOcean Spaces): agregar `S3_ENDPOINT`.

## Producción (Docker)

### Build & deploy con Docker Compose

```bash
# 1. Crear archivo de variables de producción
cat > infra/.env.prod << 'EOF'
POSTGRES_USER=sgi
POSTGRES_PASSWORD=<contraseña-segura>
POSTGRES_DB=sgi
POSTGRES_AUDITOR_PASSWORD=<contraseña-auditor>
JWT_SECRET=<secret-min-32-chars>
JWT_ISSUER=sgi360
CORS_ORIGIN=https://tudominio.com
NEXT_PUBLIC_API_URL=https://api.tudominio.com
EMAIL_PROVIDER=console
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=<tu-api-key>
EOF

# 2. Build y levantar
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d --build

# 3. Ejecutar migraciones
docker compose -f infra/docker-compose.prod.yml exec api \
  npx prisma migrate deploy

# 4. Seed inicial (solo primera vez)
docker compose -f infra/docker-compose.prod.yml exec api \
  node --import tsx src/scripts/seedPlans.ts
```

### Build individual

```bash
# API
docker build -f apps/api/Dockerfile -t sgi360-api .

# Web (pasar API URL al build)
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.tudominio.com \
  -t sgi360-web .
```

## Multi-tenancy

- RLS (Row Level Security) en PostgreSQL para aislamiento de datos
- Roles: `SUPER_ADMIN` (global), `TENANT_ADMIN`, `TENANT_USER`
- Planes: `BASIC`, `PROFESSIONAL`, `PREMIUM` con feature flags
- JWT cookie-based auth con access + refresh tokens + CSRF protection
