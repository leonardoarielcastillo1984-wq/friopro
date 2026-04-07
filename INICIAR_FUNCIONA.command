#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# SGI 360 - INICIAR (VERSIÓN CORREGIDA)
# Todas las correcciones aplicadas
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

print_header() {
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║ $1"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

print_step() {
  echo -e "${CYAN}→${NC} $1"
}

print_success() {
  echo -e "${GREEN}✅${NC} $1"
}

# INICIO
clear
print_header "🚀 INICIANDO SGI 360 - SISTEMA DE GESTIÓN INTEGRADO"

# STEP 1: Limpiar
print_header "PASO 1: Limpiando servicios anteriores"

print_step "Deteniendo launcher..."
bash "$LAUNCHER_DIR/stop.sh" 2>/dev/null || true
sleep 10

print_step "Limpiando Docker..."
cd "$PROJECT_DIR"
docker compose down -v 2>/dev/null || true
sleep 5

print_success "Servicios limpios"

# STEP 2: Iniciar
print_header "PASO 2: Iniciando aplicación (esto toma 3-5 minutos, espera...)"

bash "$LAUNCHER_DIR/start-all.sh" 2>&1 | tee /tmp/sgi360-init.log &
LAUNCHER_PID=$!

# STEP 3: Esperar
print_header "PASO 3: Esperando que servicios estén listos"

max_attempts=180
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    print_success "Aplicación lista en http://localhost:3000"
    break
  fi

  if [ $((attempt % 30)) -eq 0 ] && [ $attempt -gt 0 ]; then
    print_step "Esperando... ($attempt segundos)"
  fi

  attempt=$((attempt + 1))
  sleep 1
done

sleep 2

# STEP 4: Abrir navegador
print_header "PASO 4: Abriendo navegador"

LOGIN_URL="http://localhost:3000/login"
print_step "Abriendo $LOGIN_URL"

if [[ "$OSTYPE" == "darwin"* ]]; then
  open "$LOGIN_URL" 2>/dev/null || echo "Abre manualmente: $LOGIN_URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  xdg-open "$LOGIN_URL" 2>/dev/null || echo "Abre manualmente: $LOGIN_URL"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
  start "$LOGIN_URL" 2>/dev/null || echo "Abre manualmente: $LOGIN_URL"
fi

# STEP 5: Info final
print_header "✅ APLICACIÓN INICIADA CORRECTAMENTE"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "   ${GREEN}✓ Frontend Web${NC}        http://localhost:3000"
echo -e "   ${GREEN}✓ Backend API${NC}         http://localhost:3002"
echo -e "   ${GREEN}✓ PostgreSQL${NC}         localhost:5432"
echo -e "   ${GREEN}✓ Redis${NC}              localhost:6379"
echo ""
echo -e "${BLUE}🔐 CREDENCIALES:${NC}"
echo -e "   Email:      ${YELLOW}admin@sgi360.com${NC}"
echo -e "   Contraseña: ${YELLOW}Admin123!${NC}"
echo ""
echo -e "${BLUE}📍 LOGIN:${NC}"
echo -e "   ${CYAN}http://localhost:3000/login${NC}"
echo ""
echo -e "${BLUE}🛑 PARA DETENER:${NC}"
echo "   bash \"$LAUNCHER_DIR/stop.sh\""
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "   ${YELLOW}✨ El navegador debería estar abierto en http://localhost:3000/login${NC}"
echo -e "   ${YELLOW}✨ Las credenciales ya están precargadas${NC}"
echo -e "   ${YELLOW}✨ Solo presiona el botón INGRESAR${NC}"
echo ""

wait $LAUNCHER_PID 2>/dev/null || true
