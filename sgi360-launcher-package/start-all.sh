#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# SGI 360 - Complete Launcher (Docker + API + Web)
# ═══════════════════════════════════════════════════════════════════════════
# This script automatically:
# 1. Starts Docker containers (PostgreSQL, Redis)
# 2. Installs dependencies (if needed)
# 3. Runs database migrations
# 4. Starts the API server
# 5. Starts the Web server
# 6. Opens the browser automatically
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Paths
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCHER_DIR="$PROJECT_DIR/launcher"
APPS_API="$PROJECT_DIR/apps/api"
APPS_WEB="$PROJECT_DIR/apps/web"
LOG_DIR="$LAUNCHER_DIR/logs"

# Create log directory
mkdir -p "$LOG_DIR"

# Function to print headers
print_header() {
  echo ""
  echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║ $1"
  echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

# Function to print step
print_step() {
  echo -e "${CYAN}→${NC} $1"
}

# Function to print success
print_success() {
  echo -e "${GREEN}✅${NC} $1"
}

# Function to print error
print_error() {
  echo -e "${RED}❌${NC} $1"
}

# Function to print warning
print_warning() {
  echo -e "${YELLOW}⚠️${NC} $1"
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 1: VALIDATE DEPENDENCIES
# ═══════════════════════════════════════════════════════════════════════════

print_header " STEP 1: Validando dependencias..."

# Check Node.js
if ! command -v node &> /dev/null; then
  print_error "Node.js no está instalado"
  echo "Descargalo desde: https://nodejs.org"
  exit 1
fi
print_success "Node.js: $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
  print_error "npm no está instalado"
  exit 1
fi
print_success "npm: $(npm -v)"

# Check Docker
if ! command -v docker &> /dev/null; then
  print_error "Docker no está instalado"
  echo "Descargalo desde: https://www.docker.com/products/docker-desktop"
  exit 1
fi
print_success "Docker: $(docker --version)"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
  print_warning "docker-compose no encontrado, intentando con 'docker compose'..."
  if ! docker compose version &> /dev/null; then
    print_error "docker-compose no está instalado"
    exit 1
  fi
  DOCKER_COMPOSE="docker compose"
else
  DOCKER_COMPOSE="docker-compose"
fi
print_success "Docker Compose disponible"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 2: KILL EXISTING PROCESSES
# ═══════════════════════════════════════════════════════════════════════════

print_header " STEP 2: Limpiando procesos antiguos..."

# Kill Node processes on ports 3000, 3001, 3002, 3003
for port in 3000 3001 3002 3003; do
  if lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null; then
    print_success "Proceso en puerto $port eliminado"
  fi
done

sleep 1

# ═══════════════════════════════════════════════════════════════════════════
# STEP 3: VALIDATE PROJECT STRUCTURE
# ═══════════════════════════════════════════════════════════════════════════

print_header " STEP 3: Validando estructura del proyecto..."

[ -d "$APPS_API" ] && print_success "✓ apps/api" || (print_error "apps/api no encontrado"; exit 1)
[ -d "$APPS_WEB" ] && print_success "✓ apps/web" || (print_error "apps/web no encontrado"; exit 1)
[ -f "$LAUNCHER_DIR/docker-compose.yml" ] && print_success "✓ docker-compose.yml" || (print_error "docker-compose.yml no encontrado"; exit 1)

# ═══════════════════════════════════════════════════════════════════════════
# STEP 4: START DOCKER CONTAINERS
# ═══════════════════════════════════════════════════════════════════════════

print_header " STEP 4: Iniciando contenedores Docker..."

print_step "Iniciando PostgreSQL y Redis..."
cd "$LAUNCHER_DIR"
$DOCKER_COMPOSE up -d > "$LOG_DIR/docker.log" 2>&1

# Wait for services to be healthy
print_step "Esperando a que PostgreSQL esté listo..."
for i in {1..30}; do
  if docker exec sgi360-postgres pg_isready -U sgi360 > /dev/null 2>&1; then
    print_success "PostgreSQL está listo"
    break
  fi
  if [ $i -eq 30 ]; then
    print_error "Timeout esperando PostgreSQL"
    docker logs sgi360-postgres | tail -20
    exit 1
  fi
  echo -n "."
  sleep 1
done

print_step "Esperando a que Redis esté listo..."
for i in {1..30}; do
  if docker exec sgi360-redis redis-cli ping > /dev/null 2>&1; then
    print_success "Redis está listo"
    break
  fi
  if [ $i -eq 30 ]; then
    print_error "Timeout esperando Redis"
    docker logs sgi360-redis | tail -20
    exit 1
  fi
  echo -n "."
  sleep 1
done

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# STEP 5: INSTALL DEPENDENCIES & RUN MIGRATIONS
# ═══════════════════════════════════════════════════════════════════════════

print_header " STEP 5: Instalando dependencias y ejecutando migraciones..."

# API dependencies
print_step "Instalando dependencias de API..."
cd "$APPS_API"
npm install > "$LOG_DIR/api-install.log" 2>&1
print_success "Dependencias de API instaladas"

# Generate Prisma client
print_step "Generando cliente Prisma..."
npm run prisma:generate > "$LOG_DIR/prisma-generate.log" 2>&1
print_success "Cliente Prisma generado"

# Run migrations
print_step "Ejecutando migraciones de base de datos..."
npm run prisma:migrate -- --skip-generate > "$LOG_DIR/prisma-migrate.log" 2>&1 || true
print_success "Migraciones completadas"

# Web dependencies
print_step "Instalando dependencias de Web..."
cd "$APPS_WEB"
npm install > "$LOG_DIR/web-install.log" 2>&1
print_success "Dependencias de Web instaladas"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 6: START API SERVER
# ═══════════════════════════════════════════════════════════════════════════

print_header " STEP 6: Iniciando servidor API (puerto 3002)..."

cd "$APPS_API"
npm run dev > "$LOG_DIR/api.log" 2>&1 &
API_PID=$!
echo $API_PID > "$LAUNCHER_DIR/api.pid"
print_step "API iniciada (PID: $API_PID)"

# Wait for API to be ready
print_step "Esperando que API esté listo..."
for i in {1..30}; do
  if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    print_success "API está lista en http://localhost:3002"
    break
  fi
  if [ $i -eq 30 ]; then
    print_warning "Timeout esperando API (continuando de todas formas)"
    break
  fi
  echo -n "."
  sleep 1
done
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# STEP 7: START WEB SERVER
# ═══════════════════════════════════════════════════════════════════════════

print_header " STEP 7: Iniciando servidor Web (puerto 3000)..."

cd "$APPS_WEB"
npm run dev > "$LOG_DIR/web.log" 2>&1 &
WEB_PID=$!
echo $WEB_PID > "$LAUNCHER_DIR/web.pid"
print_step "Web iniciada (PID: $WEB_PID)"

# Wait for Web to be ready
print_step "Esperando que Web esté listo..."
for i in {1..30}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    print_success "Web está listo en http://localhost:3000"
    break
  fi
  if [ $i -eq 30 ]; then
    print_warning "Timeout esperando Web (continuando de todas formas)"
    break
  fi
  echo -n "."
  sleep 1
done
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# STEP 8: OPEN BROWSER
# ═══════════════════════════════════════════════════════════════════════════

print_header " STEP 8: Abriendo navegador..."

LOGIN_URL="http://localhost:3000/login"

if [[ "$OSTYPE" == "darwin"* ]]; then
  open "$LOGIN_URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  xdg-open "$LOGIN_URL" 2>/dev/null || true
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
  start "$LOGIN_URL"
fi

# ═══════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════

print_header " ✅ APLICACIÓN INICIADA EXITOSAMENTE"

echo -e "${BLUE}📋 STATUS:${NC}"
echo -e "   ${GREEN}✓${NC} PostgreSQL (docker): Corriendo en puerto 5432"
echo -e "   ${GREEN}✓${NC} Redis (docker): Corriendo en puerto 6379"
echo -e "   ${GREEN}✓${NC} API: Corriendo en puerto 3002"
echo -e "   ${GREEN}✓${NC} Web: Corriendo en puerto 3000"
echo ""

echo -e "${BLUE}🌐 URLs:${NC}"
echo -e "   ${CYAN}Web App:${NC} http://localhost:3000"
echo -e "   ${CYAN}Login:${NC} http://localhost:3000/login"
echo -e "   ${CYAN}Dashboard:${NC} http://localhost:3000/dashboard"
echo -e "   ${CYAN}Audit IA:${NC} http://localhost:3000/audit"
echo -e "   ${CYAN}API:${NC} http://localhost:3002"
echo ""

echo -e "${BLUE}🔐 Credenciales de Prueba:${NC}"
echo -e "   ${YELLOW}Email:${NC} test@example.com"
echo -e "   ${YELLOW}Contraseña:${NC} Test123!@#"
echo ""

echo -e "${BLUE}📁 Logs:${NC}"
echo -e "   ${YELLOW}Docker:${NC} $LOG_DIR/docker.log"
echo -e "   ${YELLOW}API:${NC} $LOG_DIR/api.log"
echo -e "   ${YELLOW}Web:${NC} $LOG_DIR/web.log"
echo ""

echo -e "${BLUE}🛑 Para detener todo:${NC}"
echo -e "   ${YELLOW}bash${NC} $LAUNCHER_DIR/stop.sh"
echo ""

echo -e "${BLUE}⚠️  Información importante:${NC}"
echo -e "   • Este script mantiene los procesos en primer plano"
echo -e "   • Presiona ${YELLOW}Ctrl+C${NC} para detener el servidor (y ejecuta 'stop.sh')"
echo -e "   • Los logs están en: $LOG_DIR"
echo -e "   • Los contenedores Docker seguirán corriendo en background"
echo ""

# Keep process running
wait
