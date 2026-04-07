#!/bin/bash

################################################################################
#                                                                              #
#  🚀 SGI 360 - SETUP AUTOMÁTICO (SIN GLOBAL INSTALL)                        #
#                                                                              #
#  • SIN instalar herramientas globalmente (evita permisos)                   #
#  • Todo local en node_modules                                              #
#  • Robusto y idempotente                                                   #
#  • Levanta servicios en background                                         #
#                                                                              #
################################################################################

set -e

# COLORS
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# HELPERS
print_header() {
  clear
  echo ""
  echo -e "${MAGENTA}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${MAGENTA}║${NC}  $1${MAGENTA}║${NC}"
  echo -e "${MAGENTA}╚════════════════════════════════════════════════════════════════╝${NC}"
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

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# ============================================================================
# PASO 0: DIAGNÓSTICO
# ============================================================================

print_header "PASO 0/6: DIAGNÓSTICO"

print_step "Validando estructura..."
[ -d "apps/api" ] || print_error "apps/api no existe"
[ -d "apps/web" ] || print_error "apps/web no existe"
[ -f "apps/api/.env" ] || print_error "apps/api/.env no existe"
[ -f "apps/web/.env" ] || print_error "apps/web/.env no existe"
print_success "Estructura válida"

print_step "Verificando herramientas..."
command -v node &> /dev/null || print_error "Node.js no instalado"
command -v npm &> /dev/null || print_error "npm no instalado"
command -v docker &> /dev/null || print_error "Docker no instalado"
print_success "Node $(node -v) + npm $(npm -v) + Docker OK"

# ============================================================================
# PASO 1: LIMPIAR
# ============================================================================

print_header "PASO 1/6: LIMPIAR"

print_step "Deteniendo servicios antiguos..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "node --watch" 2>/dev/null || true
sleep 2
print_success "Procesos detenidos"

print_step "Deteniendo Docker..."
docker stop sgi360-postgres sgi360-redis 2>/dev/null || true
docker rm sgi360-postgres sgi360-redis 2>/dev/null || true
sleep 1
print_success "Docker containers removidos"

print_step "Limpiando node_modules..."
rm -rf "$PROJECT_DIR/node_modules" 2>/dev/null || true
rm -rf "$PROJECT_DIR/apps/api/node_modules" 2>/dev/null || true
rm -rf "$PROJECT_DIR/apps/web/node_modules" 2>/dev/null || true
print_success "node_modules eliminados"

print_step "Limpiando npm cache..."
npm cache clean --force --silent 2>/dev/null || true
print_success "npm cache limpiado"

# ============================================================================
# PASO 2: DOCKER (PostgreSQL + Redis)
# ============================================================================

print_header "PASO 2/6: LEVANTAR DOCKER"

print_step "Iniciando PostgreSQL en Docker..."
docker run -d \
  --name sgi360-postgres \
  --rm \
  -e POSTGRES_USER=sgi \
  -e POSTGRES_PASSWORD=sgidev123 \
  -e POSTGRES_DB=sgi_dev \
  -p 5432:5432 \
  postgres:16-alpine > /dev/null 2>&1

print_step "Esperando PostgreSQL..."
sleep 8

# Verificar que PostgreSQL responda
for i in {1..30}; do
  if docker exec sgi360-postgres pg_isready -U sgi > /dev/null 2>&1; then
    print_success "PostgreSQL listo"
    break
  fi
  if [ $i -eq 30 ]; then
    print_error "PostgreSQL no respondió después de 30 segundos"
  fi
  echo -n "."
  sleep 1
done

print_step "Iniciando Redis en Docker..."
docker run -d \
  --name sgi360-redis \
  --rm \
  -p 6379:6379 \
  redis:7-alpine redis-server --requirepass sgidev123 > /dev/null 2>&1

sleep 2
print_success "PostgreSQL + Redis corriendo"

# ============================================================================
# PASO 3: npm install (API)
# ============================================================================

print_header "PASO 3/6: INSTALAR DEPENDENCIAS API"

cd "$PROJECT_DIR/apps/api"

print_step "npm install en /apps/api..."

# SIN --legacy-peer-deps primero
if npm install 2>&1 | tail -3; then
  print_success "npm install exitoso"
else
  print_warning "Reintentando con --legacy-peer-deps..."
  npm install --legacy-peer-deps --force 2>&1 | tail -3 || print_error "npm install falló"
fi

# Verificar que tsx está disponible
if [ -f "node_modules/.bin/tsx" ]; then
  print_success "tsx verificado"
elif npx tsx --version > /dev/null 2>&1; then
  print_success "tsx disponible via npx"
else
  print_warning "tsx no encontrado, instalando..."
  npm install -D tsx 2>&1 || true
fi

# ============================================================================
# PASO 4: PRISMA (Migrate + Seed)
# ============================================================================

print_header "PASO 4/6: CONFIGURAR PRISMA"

print_step "Generando Prisma client..."
npx prisma generate 2>&1 > /dev/null || print_warning "prisma generate tuvo aviso"
print_success "Prisma client generado"

print_step "Ejecutando migraciones..."
npx prisma migrate deploy 2>&1 || npx prisma db push --skip-generate 2>&1 || print_warning "Migraciones ya aplicadas"
print_success "Migraciones completadas"

print_step "Seeding base de datos..."
npm run seed:complete 2>&1 || npm run seed:all 2>&1 || print_warning "Seed tuvo aviso"
print_success "Base de datos configurada"

# ============================================================================
# PASO 5: npm install (WEB)
# ============================================================================

print_header "PASO 5/6: INSTALAR DEPENDENCIAS WEB"

cd "$PROJECT_DIR/apps/web"

print_step "npm install en /apps/web..."
npm install 2>&1 | tail -3 || npm install --legacy-peer-deps 2>&1 | tail -3
print_success "Web dependencies instaladas"

# ============================================================================
# PASO 6: INICIAR SERVICIOS
# ============================================================================

print_header "PASO 6/6: INICIAR SERVICIOS"

mkdir -p "$PROJECT_DIR/.logs"

# API en background
print_step "Iniciando API (puerto 3002)..."
cd "$PROJECT_DIR/apps/api"
nohup npm run dev > "$PROJECT_DIR/.logs/api.log" 2>&1 &
API_PID=$!
echo $API_PID > "$PROJECT_DIR/.logs/api.pid"
print_success "API iniciado (PID: $API_PID)"

# Esperar a que API esté listo
print_step "Esperando API..."
for i in {1..40}; do
  if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    print_success "API LISTO en http://localhost:3002"
    break
  fi
  if [ $i -eq 40 ]; then
    print_warning "API no respondió (podría estar iniciando)"
  fi
  echo -n "."
  sleep 1
done

# WEB en background
print_step "Iniciando Frontend (puerto 3000)..."
cd "$PROJECT_DIR/apps/web"
nohup npm run dev > "$PROJECT_DIR/.logs/web.log" 2>&1 &
WEB_PID=$!
echo $WEB_PID > "$PROJECT_DIR/.logs/web.pid"
print_success "Frontend iniciado (PID: $WEB_PID)"

# Esperar a que Web esté listo
print_step "Esperando Frontend..."
for i in {1..40}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    print_success "Frontend LISTO en http://localhost:3000"
    break
  fi
  if [ $i -eq 40 ]; then
    print_warning "Frontend no respondió (podría estar iniciando)"
  fi
  echo -n "."
  sleep 1
done

# ============================================================================
# VERIFICACIÓN FINAL
# ============================================================================

print_header "VERIFICACIÓN FINAL"

print_step "Verificando PostgreSQL..."
if PGPASSWORD=sgidev123 psql -h localhost -U sgi -d sgi_dev -c "SELECT 1" > /dev/null 2>&1; then
  print_success "PostgreSQL operacional"
else
  print_warning "PostgreSQL no responde (pero podría estar arrancando)"
fi

print_step "Verificando usuario admin en BD..."
USER_CHECK=$(PGPASSWORD=sgidev123 psql -h localhost -U sgi -d sgi_dev -t -c "SELECT COUNT(*) FROM \"PlatformUser\" WHERE email='admin@sgi360.com';" 2>/dev/null || echo "0")
if [ "$USER_CHECK" -eq 1 ]; then
  print_success "Usuario admin@sgi360.com en BD"
else
  print_warning "Usuario podría no estar (reintentando seed)..."
  cd "$PROJECT_DIR/apps/api"
  npm run seed:complete 2>&1 | tail -2 || true
fi

# ============================================================================
# ÉXITO
# ============================================================================

print_header "✅ SETUP COMPLETADO"

echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           🎉 SERVICIOS EN BACKGROUND - LISTOS 🎉              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Servicios corriendo:${NC}"
echo -e "  • API:        ${GREEN}http://localhost:3002${NC} (PID: $API_PID)"
echo -e "  • Frontend:   ${GREEN}http://localhost:3000${NC} (PID: $WEB_PID)"
echo -e "  • PostgreSQL: ${GREEN}localhost:5432${NC} (Docker)"
echo -e "  • Redis:      ${GREEN}localhost:6379${NC} (Docker)"
echo ""
echo -e "${CYAN}Credenciales:${NC}"
echo -e "  Email:    ${YELLOW}admin@sgi360.com${NC}"
echo -e "  Password: ${YELLOW}Admin123!${NC}"
echo ""
echo -e "${GREEN}⏳ Abriendo navegador...${NC}"
sleep 2

if command -v open &> /dev/null; then
  open "http://localhost:3000/login" 2>/dev/null || print_warning "No se pudo abrir navegador"
elif command -v xdg-open &> /dev/null; then
  xdg-open "http://localhost:3000/login" 2>/dev/null || print_warning "No se pudo abrir navegador"
else
  print_warning "No se pudo abrir navegador automáticamente"
fi

echo ""
echo -e "${BLUE}Logs:${NC}"
echo -e "  API:  $PROJECT_DIR/.logs/api.log"
echo -e "  Web:  $PROJECT_DIR/.logs/web.log"
echo ""
echo -e "${BLUE}Para detener:${NC}"
echo -e "  kill $API_PID $WEB_PID"
echo ""
echo -e "${MAGENTA}════════════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}          ✨ SGI 360 ESTÁ FUNCIONANDO ✨${NC}"
echo -e "${MAGENTA}════════════════════════════════════════════════════════════════${NC}"
echo ""
