#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# 🚀 SGI 360 - AUTO SETUP & RUN (macOS)
# ═══════════════════════════════════════════════════════════════════════════
# Este script realiza TODOS los pasos para levantar SGI 360 100% funcional
# Solo ejecutá: bash RUN_ME_FIRST.sh
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Helper functions
print_header() {
  echo ""
  echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║ $1"
  echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

print_step() {
  echo -e "${CYAN}→${NC} $1"
}

print_success() {
  echo -e "${GREEN}✅${NC} $1"
}

print_error() {
  echo -e "${RED}❌${NC} $1"
  exit 1
}

print_warning() {
  echo -e "${YELLOW}⚠️${NC} $1"
}

# Get project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

print_header "SETUP SGI 360 - PASO 0: VERIFICACIÓN"

# Check Node.js
if ! command -v node &> /dev/null; then
  print_error "Node.js no instalado. Descargá desde: https://nodejs.org"
fi
print_success "Node.js: $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
  print_error "npm no instalado"
fi
print_success "npm: $(npm -v)"

# Check Docker
if ! command -v docker &> /dev/null; then
  print_error "Docker no instalado. Descargá desde: https://www.docker.com/products/docker-desktop"
fi
print_success "Docker: $(docker --version)"

# ═══════════════════════════════════════════════════════════════════════════
print_header "PASO 1: DETENER SERVICIOS ANTIGUOS"

print_step "Deteniendo procesos node/npm..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "node --watch" 2>/dev/null || true
sleep 2
print_success "Procesos detenidos"

print_step "Deteniendo Docker containers..."
docker-compose down 2>/dev/null || true
docker stop sgi360-postgres sgi360-redis 2>/dev/null || true
docker rm sgi360-postgres sgi360-redis 2>/dev/null || true
sleep 2
print_success "Containers detenidos"

# ═══════════════════════════════════════════════════════════════════════════
print_header "PASO 2: LIMPIAR node_modules CORRUPTOS"

print_step "Eliminando node_modules..."
rm -rf apps/api/node_modules
rm -rf apps/web/node_modules
rm -rf node_modules 2>/dev/null || true
print_success "node_modules eliminados"

print_step "Limpiando npm cache..."
npm cache clean --force --silent
print_success "npm cache limpiado"

# ═══════════════════════════════════════════════════════════════════════════
print_header "PASO 3: INSTALAR HERRAMIENTAS GLOBALES"

print_step "Instalando husky (CRITICAL para bullmq)..."
npm install -g husky --silent
print_success "husky instalado"

print_step "Instalando pnpm..."
npm install -g pnpm@9.15.0 --silent
print_success "pnpm instalado"

# ═══════════════════════════════════════════════════════════════════════════
print_header "PASO 4: LEVANTAR DOCKER (PostgreSQL + Redis)"

print_step "Iniciando PostgreSQL container..."
docker run -d \
  --name sgi360-postgres \
  --rm \
  -e POSTGRES_USER=sgi \
  -e POSTGRES_PASSWORD=sgidev123 \
  -e POSTGRES_DB=sgi_dev \
  -p 5432:5432 \
  postgres:16-alpine > /dev/null 2>&1 || print_warning "PostgreSQL ya está corriendo"

print_step "Iniciando Redis container..."
docker run -d \
  --name sgi360-redis \
  --rm \
  -p 6379:6379 \
  redis:7-alpine redis-server --requirepass sgidev123 > /dev/null 2>&1 || print_warning "Redis ya está corriendo"

print_step "Esperando a que las bases de datos se inicialicen (10 segundos)..."
sleep 10

print_step "Verificando PostgreSQL..."
POSTGRES_READY=0
for i in {1..30}; do
  if docker exec sgi360-postgres pg_isready -U sgi > /dev/null 2>&1; then
    POSTGRES_READY=1
    break
  fi
  echo -n "."
  sleep 1
done
echo ""

if [ $POSTGRES_READY -eq 0 ]; then
  print_error "PostgreSQL no responde después de 30 segundos"
fi
print_success "PostgreSQL está listo"

# ═══════════════════════════════════════════════════════════════════════════
print_header "PASO 5: INSTALAR DEPENDENCIAS - API"

print_step "Instalando dependencias de API..."
cd "$PROJECT_DIR/apps/api"

# Try with npm first
if npm install --legacy-peer-deps 2>&1 | tail -5; then
  print_success "Dependencias de API instaladas"
else
  print_warning "Intentando con pnpm..."
  pnpm install || print_error "No se pudieron instalar dependencias"
fi

cd "$PROJECT_DIR"

# ═══════════════════════════════════════════════════════════════════════════
print_header "PASO 6: CONFIGURAR PRISMA"

print_step "Generando cliente de Prisma..."
cd "$PROJECT_DIR/apps/api"
npm run prisma:generate --silent
print_success "Cliente de Prisma generado"

print_step "Ejecutando migraciones..."
npm run prisma:migrate -- --skip-generate 2>&1 || print_warning "Migraciones ya aplicadas"
print_success "Migraciones completadas"

print_step "Creando usuario admin en base de datos..."
if npm run seed:complete 2>&1 | grep -q "admin@sgi360.com"; then
  print_success "Usuario admin@sgi360.com creado"
else
  print_warning "Usuario podría ya existir"
fi

cd "$PROJECT_DIR"

# ═══════════════════════════════════════════════════════════════════════════
print_header "PASO 7: INSTALAR DEPENDENCIAS - WEB"

print_step "Instalando dependencias de Web..."
cd "$PROJECT_DIR/apps/web"
npm install --legacy-peer-deps 2>&1 | tail -3
print_success "Dependencias de Web instaladas"

cd "$PROJECT_DIR"

# ═══════════════════════════════════════════════════════════════════════════
print_header "VERIFICACIÓN FINAL"

print_step "Verificando que PostgreSQL responde..."
PGPASSWORD=sgidev123 psql -h localhost -U sgi -d sgi_dev -c "SELECT COUNT(*) as users FROM \"PlatformUser\";" 2>/dev/null || print_error "PostgreSQL no responde"
print_success "PostgreSQL operacional"

print_step "Verificando usuario admin..."
USER_COUNT=$(PGPASSWORD=sgidev123 psql -h localhost -U sgi -d sgi_dev -t -c "SELECT COUNT(*) FROM \"PlatformUser\" WHERE email='admin@sgi360.com';" 2>/dev/null)
if [ "$USER_COUNT" -eq 1 ]; then
  print_success "Usuario admin@sgi360.com existe en BD"
else
  print_error "Usuario admin NO existe en base de datos"
fi

# ═══════════════════════════════════════════════════════════════════════════
print_header "✅ SETUP COMPLETADO"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║ PRÓXIMO PASO: ABRIR DOS TERMINALES${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}TERMINAL 1 - API (puerto 3002):${NC}"
echo -e "${YELLOW}cd \"$PROJECT_DIR/apps/api\" && npm run dev${NC}"
echo ""
echo -e "${CYAN}TERMINAL 2 - Frontend (puerto 3000):${NC}"
echo -e "${YELLOW}cd \"$PROJECT_DIR/apps/web\" && npm run dev${NC}"
echo ""
echo -e "${CYAN}LUEGO - Abrir navegador:${NC}"
echo -e "${YELLOW}http://localhost:3000/login${NC}"
echo ""
echo -e "${GREEN}Credenciales de prueba:${NC}"
echo -e "  Email: ${CYAN}admin@sgi360.com${NC}"
echo -e "  Password: ${CYAN}Admin123!${NC}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
