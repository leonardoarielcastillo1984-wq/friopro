#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"
INFRA="$ROOT/infra"

echo "== SGI 360 - Setup local =="
echo ""

# 1. Docker
echo "[1/5] Levantando Docker (postgres + redis)..."
if ! docker info > /dev/null 2>&1; then
  echo "ERROR: Docker no esta corriendo. Abri Docker Desktop y volve a ejecutar."
  exit 1
fi
cd "$INFRA" && docker compose up -d
echo "  Esperando que postgres este healthy..."
until docker compose -f "$INFRA/docker-compose.yml" exec -T postgres pg_isready -U sgi -d sgi > /dev/null 2>&1; do
  sleep 1
done
echo "  Postgres listo."

# 2. Prisma generate
echo ""
echo "[2/5] Generando Prisma Client..."
cd "$API" && npx prisma generate

# 3. Prisma migrate reset
echo ""
echo "[3/5] Aplicando migrations (reset completo)..."
cd "$API" && npx prisma migrate reset --force

# 4. Seeds
echo ""
echo "[4/5] Ejecutando seeds..."
cd "$API" && node --import tsx src/scripts/seedPlans.ts
cd "$API" && node --import tsx src/scripts/seedUsers.ts
cd "$API" && node --import tsx src/scripts/seedDemoData.ts

# 5. Done
echo ""
echo "== Setup completado =="
echo ""
echo "[5/5] Para levantar:"
echo ""
echo "  Terminal 1 (API):  cd apps/api && pnpm dev"
echo "  Terminal 2 (Web):  cd apps/web && pnpm dev"
echo ""
echo "  API:  http://localhost:3001"
echo "  Web:  http://localhost:3000"
echo "  Docs: http://localhost:3001/docs"
echo ""
echo "Credenciales:"
echo "  Super Admin:  admin@sgi360.com  /  Admin123!"
echo "  Usuario Demo: usuario@demo.com  /  User123!"
echo "  Otros:        calidad@demo.com, seguridad@demo.com, ambiente@demo.com, rrhh@demo.com  /  User123!"
