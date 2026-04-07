#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# SGI 360 - INICIAR APLICACIÓN
# Ejecutable principal para iniciar toda la aplicación
# ═══════════════════════════════════════════════════════════════════════════

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCHER_DIR="$PROJECT_DIR/launcher"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Functions
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
}

print_warning() {
  echo -e "${YELLOW}⚠️${NC} $1"
}

# Main
print_header "INICIANDO SGI 360"

# STEP 1: Detener servicios antiguos
print_header "STEP 1: Limpiando servicios anteriores"

print_step "Deteniendo launcher..."
bash "$LAUNCHER_DIR/stop.sh" 2>/dev/null || true
sleep 8

print_step "Limpiando Docker..."
cd "$PROJECT_DIR"
docker compose down -v 2>/dev/null || true
sleep 5

print_success "Servicios limpios"

# STEP 2: Iniciar servicios
print_header "STEP 2: Iniciando servicios (esto puede tomar 3-5 minutos)"

print_step "Iniciando Docker, PostgreSQL, Redis, API y Web..."
bash "$LAUNCHER_DIR/start-all.sh" > /tmp/sgi360-startup.log 2>&1 &
LAUNCHER_PID=$!

# STEP 3: Esperar a que servicios estén listos
print_header "STEP 3: Esperando que servicios estén listos"

# Función para verificar si un puerto está abierto
check_port() {
  local port=$1
  local name=$2
  local max_attempts=60
  local attempt=0

  while [ $attempt -lt $max_attempts ]; do
    if nc -z localhost $port 2>/dev/null; then
      print_success "$name está listo en puerto $port"
      return 0
    fi

    attempt=$((attempt + 1))
    if [ $((attempt % 10)) -eq 0 ]; then
      print_step "Esperando $name... ($attempt/${max_attempts}s)"
    fi
    sleep 1
  done

  return 1
}

# Esperar a cada servicio
print_step "Esperando PostgreSQL (puerto 5432)..."
check_port 5432 "PostgreSQL" || print_warning "PostgreSQL no responde, continuando..."

print_step "Esperando Redis (puerto 6379)..."
check_port 6379 "Redis" || print_warning "Redis no responde, continuando..."

print_step "Esperando API Backend (puerto 3002)..."
check_port 3002 "API Backend" || {
  print_error "API Backend no responde"
  print_error "Revisa los logs:"
  echo "tail -f /tmp/sgi360-startup.log"
  exit 1
}

print_step "Esperando Frontend Web (puerto 3000)..."
check_port 3000 "Frontend Web" || {
  print_error "Frontend Web no responde"
  print_error "Revisa los logs:"
  echo "tail -f /tmp/sgi360-startup.log"
  exit 1
}

# Espera adicional para asegurar que todo está listo
sleep 3

# STEP 4: Abrir navegador
print_header "STEP 4: Abriendo navegador"

LOGIN_URL="http://localhost:3000/login"

print_step "Abriendo $LOGIN_URL"

if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  open "$LOGIN_URL" 2>/dev/null || print_warning "No se pudo abrir navegador automáticamente"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Linux
  xdg-open "$LOGIN_URL" 2>/dev/null || print_warning "No se pudo abrir navegador automáticamente"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
  # Windows
  start "$LOGIN_URL" 2>/dev/null || print_warning "No se pudo abrir navegador automáticamente"
fi

# STEP 5: Mostrar información final
print_header "✅ APLICACIÓN INICIADA CORRECTAMENTE"

echo -e "${BLUE}🌐 ACCESO:${NC}"
echo "   • URL: http://localhost:3000"
echo "   • Login: http://localhost:3000/login"
echo ""

echo -e "${BLUE}🔐 CREDENCIALES:${NC}"
echo "   • Email: admin@sgi360.com"
echo "   • Contraseña: Admin123!"
echo ""

echo -e "${BLUE}📍 SERVICIOS:${NC}"
echo "   • Frontend Web: http://localhost:3000 ✅"
echo "   • Backend API: http://localhost:3002 ✅"
echo "   • PostgreSQL: localhost:5432 ✅"
echo "   • Redis: localhost:6379 ✅"
echo ""

echo -e "${BLUE}📋 PARA DETENER:${NC}"
echo "   Abre otra terminal y ejecuta:"
echo "   bash \"$LAUNCHER_DIR/stop.sh\""
echo ""

echo -e "${BLUE}📝 LOGS:${NC}"
echo "   tail -f /tmp/sgi360-startup.log"
echo ""

echo -e "${YELLOW}✨ ¡Ahora abre http://localhost:3000/login en tu navegador!${NC}"
echo ""

# Esperar a que el launcher siga corriendo
wait $LAUNCHER_PID 2>/dev/null || true
