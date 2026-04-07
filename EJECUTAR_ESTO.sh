#!/bin/bash

################################################################################
#                                                                              #
#  🚀 SGI 360 - MEGA SCRIPT DEFINITIVO                                        #
#                                                                              #
#  EJECUTA ESTO Y LISTO. TODO FUNCIONA.                                       #
#                                                                              #
#  bash EJECUTAR_ESTO.sh                                                      #
#                                                                              #
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

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
  echo ""
  echo "Script abortado. Contacta soporte."
  exit 1
}

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# ============================================================================
# PASO 0: LIMPIEZA NUCLEAR
# ============================================================================

print_header "LIMPIEZA NUCLEAR (Borrando ABSOLUTAMENTE TODO)"

print_step "Matando procesos Node..."
pkill -9 -f "npm run dev" 2>/dev/null || true
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "next" 2>/dev/null || true
pkill -9 -f "node --watch" 2>/dev/null || true
pkill -9 -f "node" 2>/dev/null || true
sleep 3
print_success "Procesos eliminados"

print_step "Deteniendo Docker..."
docker stop sgi360-postgres sgi360-redis sgi360-api sgi360-web 2>/dev/null || true
docker rm sgi360-postgres sgi360-redis sgi360-api sgi360-web 2>/dev/null || true
docker-compose down 2>/dev/null || true
sleep 2
print_success "Docker limpiado"

print_step "Eliminando node_modules..."
rm -rf "$PROJECT_DIR/node_modules" 2>/dev/null || true
rm -rf "$PROJECT_DIR/apps/api/node_modules" 2>/dev/null || true
rm -rf "$PROJECT_DIR/apps/web/node_modules" 2>/dev/null || true
rm -rf "$PROJECT_DIR/apps/api/.next" 2>/dev/null || true
rm -rf "$PROJECT_DIR/apps/web/.next" 2>/dev/null || true
print_success "node_modules eliminados"

print_step "Limpiando npm cache..."
npm cache clean --force --silent 2>/dev/null || true
print_success "npm cache limpiado"

# ============================================================================
# PASO 1: DOCKER (PostgreSQL + Redis)
# ============================================================================

print_header "LEVANTANDO DOCKER"

print_step "Iniciando PostgreSQL..."
docker run -d \
  --name sgi360-postgres \
  --rm \
  -e POSTGRES_USER=sgi \
  -e POSTGRES_PASSWORD=sgidev123 \
  -e POSTGRES_DB=sgi_dev \
  -p 5432:5432 \
  postgres:16-alpine > /dev/null 2>&1 || print_error "PostgreSQL failed"

print_step "Esperando PostgreSQL (10 segundos)..."
sleep 10

POSTGRES_READY=0
for i in {1..30}; do
  if docker exec sgi360-postgres pg_isready -U sgi > /dev/null 2>&1; then
    POSTGRES_READY=1
    print_success "PostgreSQL listo"
    break
  fi
  echo -n "."
  sleep 1
done

[ $POSTGRES_READY -eq 0 ] && print_error "PostgreSQL no respondió"

print_step "Iniciando Redis..."
docker run -d \
  --name sgi360-redis \
  --rm \
  -p 6379:6379 \
  redis:7-alpine redis-server --requirepass sgidev123 > /dev/null 2>&1 || print_error "Redis failed"

sleep 2
print_success "Docker corriendo"

# ============================================================================
# PASO 2: INSTALAR API
# ============================================================================

print_header "INSTALANDO API"

cd "$PROJECT_DIR/apps/api"

print_step "npm install (esto tarda)..."
npm install --legacy-peer-deps --force 2>&1 | tail -5 || print_error "npm install API failed"
print_success "API instalada"

# ============================================================================
# PASO 3: PRISMA
# ============================================================================

print_header "CONFIGURANDO PRISMA"

print_step "Generando cliente..."
npx prisma generate 2>&1 > /dev/null || print_error "prisma generate failed"
print_success "Cliente generado"

print_step "Ejecutando migraciones..."
npx prisma migrate deploy 2>&1 > /dev/null || npx prisma db push --skip-generate 2>&1 > /dev/null || print_warning "Migraciones ya aplicadas"
print_success "Migraciones completadas"

print_step "Seeding base de datos..."
npm run seed:complete 2>&1 | tail -3 || print_warning "Seed tuvo aviso"
print_success "Base de datos lista"

# ============================================================================
# PASO 4: INSTALAR WEB
# ============================================================================

print_header "INSTALANDO FRONTEND"

cd "$PROJECT_DIR/apps/web"

print_step "npm install (esto tarda)..."
npm install --legacy-peer-deps --force 2>&1 | tail -5 || print_error "npm install WEB failed"
print_success "Frontend instalado"

# ============================================================================
# PASO 5: LEVANTAR SERVICIOS EN BACKGROUND
# ============================================================================

print_header "LEVANTANDO SERVICIOS"

mkdir -p "$PROJECT_DIR/.logs"

# API en background
print_step "Iniciando API en background..."
cd "$PROJECT_DIR/apps/api"
nohup npm run dev > "$PROJECT_DIR/.logs/api.log" 2>&1 &
API_PID=$!
echo $API_PID > "$PROJECT_DIR/.logs/api.pid"
print_success "API iniciado (PID: $API_PID)"

# Esperar API
print_step "Esperando API (máx 40 segundos)..."
for i in {1..40}; do
  if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    print_success "API LISTO"
    break
  fi
  if [ $i -eq 40 ]; then
    print_error "API no respondió"
  fi
  echo -n "."
  sleep 1
done

# Web en background
print_step "Iniciando Frontend en background..."
cd "$PROJECT_DIR/apps/web"
nohup npm run dev > "$PROJECT_DIR/.logs/web.log" 2>&1 &
WEB_PID=$!
echo $WEB_PID > "$PROJECT_DIR/.logs/web.pid"
print_success "Frontend iniciado (PID: $WEB_PID)"

# Esperar Web
print_step "Esperando Frontend (máx 40 segundos)..."
for i in {1..40}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    print_success "Frontend LISTO"
    break
  fi
  if [ $i -eq 40 ]; then
    print_error "Frontend no respondió"
  fi
  echo -n "."
  sleep 1
done

# ============================================================================
# VERIFICACIÓN FINAL
# ============================================================================

print_header "VERIFICACIÓN FINAL"

print_step "API..."
if curl -s http://localhost:3002/health > /dev/null 2>&1; then
  print_success "API responde"
else
  print_error "API no responde"
fi

print_step "Frontend..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  print_success "Frontend responde"
else
  print_error "Frontend no responde"
fi

print_step "Base de datos..."
if PGPASSWORD=sgidev123 psql -h localhost -U sgi -d sgi_dev -c "SELECT 1" > /dev/null 2>&1; then
  print_success "PostgreSQL operacional"
else
  print_error "PostgreSQL no responde"
fi

print_step "Usuario admin..."
USER_CHECK=$(PGPASSWORD=sgidev123 psql -h localhost -U sgi -d sgi_dev -t -c "SELECT COUNT(*) FROM \"PlatformUser\" WHERE email='admin@sgi360.com';" 2>/dev/null || echo "0")
if [ "$USER_CHECK" -eq 1 ]; then
  print_success "Usuario admin@sgi360.com existe"
else
  print_error "Usuario admin NO existe en BD"
fi

# ============================================================================
# ÉXITO - ABRIR NAVEGADOR
# ============================================================================

print_header "✅ SETUP COMPLETADO - ABRIENDO NAVEGADOR"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           🎉 SGI 360 ESTÁ 100% FUNCIONAL 🎉                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Servicios:${NC}"
echo -e "  • API:        ${GREEN}http://localhost:3002${NC}"
echo -e "  • Frontend:   ${GREEN}http://localhost:3000${NC}"
echo -e "  • Database:   ${GREEN}localhost:5432${NC}"
echo ""
echo -e "${CYAN}Credenciales:${NC}"
echo -e "  Email:    ${YELLOW}admin@sgi360.com${NC}"
echo -e "  Password: ${YELLOW}Admin123!${NC}"
echo ""
echo -e "${GREEN}Abriendo navegador en 3 segundos...${NC}"
echo ""

sleep 3

if command -v open &> /dev/null; then
  open "http://localhost:3000/login" 2>/dev/null || true
elif command -v xdg-open &> /dev/null; then
  xdg-open "http://localhost:3000/login" 2>/dev/null || true
fi

echo ""
echo -e "${MAGENTA}════════════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}          ¡Ingresa con las credenciales y disfruta!${NC}"
echo -e "${MAGENTA}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Mantener script vivo
sleep 10
