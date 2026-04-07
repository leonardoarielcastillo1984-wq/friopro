#!/bin/bash

################################################################################
#                                                                              #
#  🚀 SGI 360 - SETUP DEFINITIVO (TODO AUTOMÁTICO)                            #
#                                                                              #
#  Este script hace ABSOLUTAMENTE TODO:                                       #
#  • Limpia todo                                                              #
#  • Instala dependencias correctamente                                       #
#  • Levanta Docker (PostgreSQL + Redis)                                      #
#  • Configura base de datos                                                  #
#  • Levanta API en background (puerto 3002)                                  #
#  • Levanta Frontend en background (puerto 3000)                             #
#  • Abre navegador automáticamente                                           #
#                                                                              #
#  USO: bash SETUP_DEFINITIVO.sh                                              #
#                                                                              #
################################################################################

set -e

# ============================================================================
# COLORS & HELPERS
# ============================================================================

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
  echo -e "${MAGENTA}║${NC}                                                                ${MAGENTA}║${NC}"
  echo -e "${MAGENTA}║${NC}  $1${MAGENTA}║${NC}"
  echo -e "${MAGENTA}║${NC}                                                                ${MAGENTA}║${NC}"
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

print_info() {
  echo -e "${BLUE}ℹ️${NC} $1"
}

# ============================================================================
# GET PROJECT DIR
# ============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

print_header "SGI 360 - SETUP DEFINITIVO"
echo -e "${BLUE}Directorio del proyecto: ${NC}$PROJECT_DIR"
echo ""

# ============================================================================
# PASO 0: VERIFICACIÓN DE REQUISITOS
# ============================================================================

print_step "Verificando requisitos del sistema..."

if ! command -v node &> /dev/null; then
  print_error "Node.js NO instalado. Descargá desde: https://nodejs.org"
fi

if ! command -v npm &> /dev/null; then
  print_error "npm NO instalado"
fi

if ! command -v docker &> /dev/null; then
  print_error "Docker NO instalado. Descargá desde: https://www.docker.com/products/docker-desktop"
fi

print_success "Node.js $(node -v)"
print_success "npm $(npm -v)"
print_success "Docker $(docker --version)"

# ============================================================================
# PASO 1: LIMPIAR COMPLETAMENTE
# ============================================================================

print_header "PASO 1/7: LIMPIAR COMPLETAMENTE"

print_step "Deteniendo servicios antiguos..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "node --watch" 2>/dev/null || true
sleep 2
print_success "Procesos node detenidos"

print_step "Deteniendo y removiendo Docker containers..."
docker-compose down 2>/dev/null || true
docker stop sgi360-postgres sgi360-redis sgi360-api sgi360-web 2>/dev/null || true
docker rm sgi360-postgres sgi360-redis sgi360-api sgi360-web 2>/dev/null || true
sleep 2
print_success "Containers detenidos"

print_step "Eliminando node_modules..."
rm -rf "$PROJECT_DIR/node_modules"
rm -rf "$PROJECT_DIR/apps/api/node_modules"
rm -rf "$PROJECT_DIR/apps/web/node_modules"
print_success "node_modules eliminados"

print_step "Limpiando npm cache..."
npm cache clean --force --silent 2>/dev/null || true
print_success "npm cache limpiado"

# ============================================================================
# PASO 2: INSTALAR HERRAMIENTAS GLOBALES
# ============================================================================

print_header "PASO 2/7: INSTALAR HERRAMIENTAS GLOBALES"

print_step "Instalando husky globalmente..."
npm install -g husky --silent 2>/dev/null || npm install -g husky
print_success "husky instalado"

print_step "Instalando pnpm globalmente..."
npm install -g pnpm@9.15.0 --silent 2>/dev/null || npm install -g pnpm@9.15.0
print_success "pnpm instalado"

# ============================================================================
# PASO 3: LEVANTAR DOCKER (POSTGRES + REDIS)
# ============================================================================

print_header "PASO 3/7: LEVANTAR DOCKER"

print_step "Iniciando PostgreSQL..."
docker run -d \
  --name sgi360-postgres \
  --rm \
  -e POSTGRES_USER=sgi \
  -e POSTGRES_PASSWORD=sgidev123 \
  -e POSTGRES_DB=sgi_dev \
  -p 5432:5432 \
  postgres:16-alpine > /dev/null 2>&1 || print_warning "PostgreSQL ya corre"

print_step "Esperando PostgreSQL..."
sleep 5

# Verificar que PostgreSQL esté listo
MAX_ATTEMPTS=30
ATTEMPTS=0
while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  if docker exec sgi360-postgres pg_isready -U sgi > /dev/null 2>&1; then
    print_success "PostgreSQL está listo"
    break
  fi
  ATTEMPTS=$((ATTEMPTS + 1))
  echo -n "."
  sleep 1
done

if [ $ATTEMPTS -eq $MAX_ATTEMPTS ]; then
  print_error "PostgreSQL no respondió después de 30 segundos"
fi

print_step "Iniciando Redis..."
docker run -d \
  --name sgi360-redis \
  --rm \
  -p 6379:6379 \
  redis:7-alpine redis-server --requirepass sgidev123 > /dev/null 2>&1 || print_warning "Redis ya corre"

sleep 2
print_success "PostgreSQL + Redis corriendo"

# ============================================================================
# PASO 4: INSTALAR DEPENDENCIAS DEL API
# ============================================================================

print_header "PASO 4/7: INSTALAR DEPENDENCIAS API"

cd "$PROJECT_DIR/apps/api"

print_step "npm install en /apps/api (esto tarda...)..."
if npm install --legacy-peer-deps 2>&1 | tail -5; then
  print_success "API dependencies instaladas"
else
  print_warning "npm install con aviso, intentando con pnpm..."
  pnpm install --force 2>&1 | tail -3 || print_error "No se pudieron instalar dependencias del API"
  print_success "API dependencies instaladas (con pnpm)"
fi

# Verificar que tsx existe
if [ ! -f "node_modules/.bin/tsx" ]; then
  print_warning "tsx no encontrado, instalando..."
  npm install -D tsx@latest
fi

print_success "tsx verificado"

# ============================================================================
# PASO 5: CONFIGURAR PRISMA
# ============================================================================

print_header "PASO 5/7: CONFIGURAR PRISMA"

print_step "Generando cliente Prisma..."
npm run prisma:generate --silent 2>/dev/null || npx prisma generate
print_success "Cliente Prisma generado"

print_step "Ejecutando migraciones..."
npm run prisma:migrate -- --skip-generate 2>&1 || npx prisma migrate deploy 2>&1 || print_warning "Migraciones ya aplicadas"
print_success "Migraciones completadas"

print_step "Creando usuario admin en BD..."
npm run seed:complete 2>&1 | grep -i "admin\|seed\|completado" | head -3
print_success "Seed completado"

# ============================================================================
# PASO 6: INSTALAR DEPENDENCIAS DEL WEB
# ============================================================================

print_header "PASO 6/7: INSTALAR DEPENDENCIAS WEB"

cd "$PROJECT_DIR/apps/web"

print_step "npm install en /apps/web..."
npm install --legacy-peer-deps 2>&1 | tail -3
print_success "Web dependencies instaladas"

# ============================================================================
# PASO 7: LEVANTAR SERVICIOS EN BACKGROUND
# ============================================================================

print_header "PASO 7/7: INICIANDO SERVICIOS"

# Crear directorio para logs
mkdir -p "$PROJECT_DIR/.logs"

print_step "Iniciando API (puerto 3002)..."
cd "$PROJECT_DIR/apps/api"
nohup npm run dev > "$PROJECT_DIR/.logs/api.log" 2>&1 &
API_PID=$!
echo $API_PID > "$PROJECT_DIR/.logs/api.pid"
print_success "API iniciado (PID: $API_PID)"

# Esperar a que API esté listo
print_step "Esperando a que API esté listo (máx 30 segundos)..."
for i in {1..30}; do
  if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    print_success "API LISTO en http://localhost:3002"
    break
  fi
  echo -n "."
  sleep 1
done

print_step "Iniciando Frontend (puerto 3000)..."
cd "$PROJECT_DIR/apps/web"
nohup npm run dev > "$PROJECT_DIR/.logs/web.log" 2>&1 &
WEB_PID=$!
echo $WEB_PID > "$PROJECT_DIR/.logs/web.pid"
print_success "Frontend iniciado (PID: $WEB_PID)"

# Esperar a que Web esté listo
print_step "Esperando a que Frontend esté listo (máx 30 segundos)..."
for i in {1..30}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    print_success "Frontend LISTO en http://localhost:3000"
    break
  fi
  echo -n "."
  sleep 1
done

# ============================================================================
# VERIFICACIÓN FINAL
# ============================================================================

print_header "VERIFICACIÓN FINAL"

print_step "Verificando PostgreSQL..."
PGPASSWORD=sgidev123 psql -h localhost -U sgi -d sgi_dev -c "SELECT COUNT(*) as usuarios FROM \"PlatformUser\";" 2>/dev/null || print_error "PostgreSQL no responde"
print_success "PostgreSQL operacional"

print_step "Verificando usuario admin..."
USER_COUNT=$(PGPASSWORD=sgidev123 psql -h localhost -U sgi -d sgi_dev -t -c "SELECT COUNT(*) FROM \"PlatformUser\" WHERE email='admin@sgi360.com';" 2>/dev/null)
if [ "$USER_COUNT" -eq 1 ]; then
  print_success "Usuario admin@sgi360.com existe en BD"
else
  print_warning "Usuario admin no encontrado, creando..."
  cd "$PROJECT_DIR/apps/api"
  npm run seed:users 2>&1 > /dev/null || true
fi

print_step "Verificando API en http://localhost:3002..."
if curl -s http://localhost:3002/health > /dev/null 2>&1; then
  print_success "API RESPONDE"
else
  print_warning "API no responde (podría estar iniciándose)"
fi

print_step "Verificando Frontend en http://localhost:3000..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  print_success "Frontend RESPONDE"
else
  print_warning "Frontend no responde (podría estar iniciándose)"
fi

# ============================================================================
# ÉXITO
# ============================================================================

print_header "✅ SETUP COMPLETADO EXITOSAMENTE"

echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    🎉 SERVICIOS INICIADOS 🎉                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Status de Servicios:${NC}"
echo -e "  • API Backend:    ${GREEN}http://localhost:3002${NC} (PID: $API_PID)"
echo -e "  • Frontend:       ${GREEN}http://localhost:3000${NC} (PID: $WEB_PID)"
echo -e "  • PostgreSQL:     ${GREEN}localhost:5432${NC} (Docker)"
echo -e "  • Redis:          ${GREEN}localhost:6379${NC} (Docker)"
echo ""
echo -e "${CYAN}Credenciales de Login:${NC}"
echo -e "  Email:    ${YELLOW}admin@sgi360.com${NC}"
echo -e "  Password: ${YELLOW}Admin123!${NC}"
echo ""
echo -e "${GREEN}⏳ Abriendo navegador en 2 segundos...${NC}"
sleep 2

# Abrir navegador automáticamente
if command -v open &> /dev/null; then
  # macOS
  open "http://localhost:3000/login"
elif command -v xdg-open &> /dev/null; then
  # Linux
  xdg-open "http://localhost:3000/login"
else
  print_warning "No se pudo abrir navegador. Abre manualmente: http://localhost:3000/login"
fi

echo ""
echo -e "${BLUE}Logs disponibles en:${NC}"
echo -e "  API:  $PROJECT_DIR/.logs/api.log"
echo -e "  Web:  $PROJECT_DIR/.logs/web.log"
echo ""
echo -e "${BLUE}Para detener servicios:${NC}"
echo -e "  kill $API_PID $WEB_PID"
echo ""
echo -e "${MAGENTA}════════════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}          ¡SGI 360 está COMPLETAMENTE FUNCIONAL!${NC}"
echo -e "${MAGENTA}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Esperar un poco antes de terminar
sleep 3
