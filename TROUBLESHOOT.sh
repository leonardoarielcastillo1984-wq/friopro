#!/bin/bash

################################################################################
#  TROUBLESHOOTING - Diagnóstico y reparación automática
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║ $1"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

print_check() {
  echo -e "${GREEN}✅${NC} $1"
}

print_error() {
  echo -e "${RED}❌${NC} $1"
}

print_fix() {
  echo -e "${YELLOW}🔧${NC} $1"
}

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

print_header "TROUBLESHOOTING SGI 360"

# ============================================================================
# VERIFICAR PROCESOS
# ============================================================================

print_header "1. PROCESOS"

if pgrep -f "npm run dev.*api" > /dev/null; then
  print_check "API está corriendo"
else
  print_error "API NO está corriendo"
  print_fix "Ejecuta: cd apps/api && npm run dev"
fi

if pgrep -f "npm run dev.*web\|next dev" > /dev/null; then
  print_check "Frontend está corriendo"
else
  print_error "Frontend NO está corriendo"
  print_fix "Ejecuta: cd apps/web && npm run dev"
fi

# ============================================================================
# VERIFICAR PUERTOS
# ============================================================================

print_header "2. PUERTOS"

if curl -s http://localhost:3002/health > /dev/null 2>&1; then
  print_check "API responde en puerto 3002"
else
  print_error "API NO responde en puerto 3002"
  print_fix "Verifica que API está corriendo"
fi

if curl -s http://localhost:3000 > /dev/null 2>&1; then
  print_check "Frontend responde en puerto 3000"
else
  print_error "Frontend NO responde en puerto 3000"
  print_fix "Verifica que Frontend está corriendo"
fi

# ============================================================================
# VERIFICAR DOCKER
# ============================================================================

print_header "3. DOCKER"

if docker ps | grep -q sgi360-postgres; then
  print_check "PostgreSQL corriendo en Docker"
else
  print_error "PostgreSQL NO está corriendo"
  print_fix "Ejecuta: docker run -d --name sgi360-postgres --rm -e POSTGRES_USER=sgi -e POSTGRES_PASSWORD=sgidev123 -e POSTGRES_DB=sgi_dev -p 5432:5432 postgres:16-alpine"
fi

if docker ps | grep -q sgi360-redis; then
  print_check "Redis corriendo en Docker"
else
  print_error "Redis NO está corriendo"
  print_fix "Ejecuta: docker run -d --name sgi360-redis --rm -p 6379:6379 redis:7-alpine redis-server --requirepass sgidev123"
fi

# ============================================================================
# VERIFICAR BASE DE DATOS
# ============================================================================

print_header "4. BASE DE DATOS"

if PGPASSWORD=sgidev123 psql -h localhost -U sgi -d sgi_dev -c "SELECT 1" > /dev/null 2>&1; then
  print_check "PostgreSQL responde"
else
  print_error "PostgreSQL NO responde"
  print_fix "Verifica que Docker está corriendo"
fi

USER_COUNT=$(PGPASSWORD=sgidev123 psql -h localhost -U sgi -d sgi_dev -t -c "SELECT COUNT(*) FROM \"PlatformUser\";" 2>/dev/null || echo "0")
if [ "$USER_COUNT" -gt 0 ]; then
  print_check "Base de datos tiene usuarios ($USER_COUNT)"
else
  print_error "Base de datos está vacía"
  print_fix "Ejecuta: cd apps/api && npm run seed:complete"
fi

if PGPASSWORD=sgidev123 psql -h localhost -U sgi -d sgi_dev -c "SELECT 1 FROM \"PlatformUser\" WHERE email='admin@sgi360.com';" > /dev/null 2>&1; then
  print_check "Usuario admin@sgi360.com existe"
else
  print_error "Usuario admin NO existe"
  print_fix "Ejecuta: cd apps/api && npm run seed:users"
fi

# ============================================================================
# VERIFICAR .env
# ============================================================================

print_header "5. ARCHIVOS .env"

if grep -q "PORT=3002" apps/api/.env; then
  print_check "API PORT=3002"
else
  print_error "API PORT no es 3002"
  print_fix "Edita: apps/api/.env → PORT=3002"
fi

if grep -q "NEXT_PUBLIC_API_URL=http://localhost:3002" apps/web/.env; then
  print_check "Frontend API URL correcto"
else
  print_error "Frontend API URL incorrecto"
  print_fix "Edita: apps/web/.env → NEXT_PUBLIC_API_URL=http://localhost:3002"
fi

# ============================================================================
# VERIFICAR DEPENDENCIAS
# ============================================================================

print_header "6. DEPENDENCIAS"

if [ -d "apps/api/node_modules" ]; then
  print_check "API node_modules existe"
else
  print_error "API node_modules NO existe"
  print_fix "Ejecuta: cd apps/api && npm install"
fi

if [ -f "apps/api/node_modules/.bin/tsx" ]; then
  print_check "tsx instalado"
else
  print_error "tsx NO está instalado"
  print_fix "Ejecuta: cd apps/api && npm install -D tsx"
fi

if [ -d "apps/web/node_modules" ]; then
  print_check "Web node_modules existe"
else
  print_error "Web node_modules NO existe"
  print_fix "Ejecuta: cd apps/web && npm install"
fi

# ============================================================================
# RESUMEN
# ============================================================================

print_header "RESUMEN"

ISSUES=0
[ ! -f apps/api/.env ] && ISSUES=$((ISSUES + 1))
[ ! -d apps/api/node_modules ] && ISSUES=$((ISSUES + 1))
! pgrep -f "npm run dev.*api" > /dev/null && ISSUES=$((ISSUES + 1))
! curl -s http://localhost:3002/health > /dev/null 2>&1 && ISSUES=$((ISSUES + 1))

if [ $ISSUES -eq 0 ]; then
  echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅ TODO ESTÁ EN ORDEN${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
else
  echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  ⚠️  ENCONTRADOS $ISSUES PROBLEMAS${NC}"
  echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
fi

echo ""
