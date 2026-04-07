#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# SGI 360 - Ejecutable Principal (Launcher Actualizado)
# ═══════════════════════════════════════════════════════════════════════════

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         SGI 360 - Sistema de Gestión Integrado               ║"
echo "║                 Iniciando Aplicación...                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_step() {
  echo -e "${CYAN}→${NC} $1"
}

print_success() {
  echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠️${NC} $1"
}

print_header() {
  echo ""
  echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║ $1"
  echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

# STEP 1: Limpiar procesos antiguos
print_header "STEP 1: Limpiando procesos antiguos..."

print_step "Deteniendo launcher anterior..."
bash "$PROJECT_DIR/launcher/stop.sh" 2>/dev/null || true
sleep 5

print_step "Limpiando contenedores Docker..."
cd "$PROJECT_DIR"
docker compose down -v 2>/dev/null || true
sleep 5

print_success "Procesos limpios"

# STEP 2: Iniciar launcher
print_header "STEP 2: Iniciando aplicación..."

print_step "Ejecutando launcher principal..."
bash "$PROJECT_DIR/launcher/start-all.sh" &
LAUNCHER_PID=$!

# Esperar a que la aplicación esté lista
print_step "Esperando que la aplicación esté lista (esto puede tomar 3-5 minutos)..."
sleep 120

# STEP 3: Abrir navegador
print_header "STEP 3: Abriendo navegador..."

LOGIN_URL="http://localhost:3000/login"

if [[ "$OSTYPE" == "darwin"* ]]; then
  open "$LOGIN_URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  xdg-open "$LOGIN_URL" 2>/dev/null || true
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
  start "$LOGIN_URL"
fi

print_success "Navegador abierto"

# Mostrar info final
print_header "✅ APLICACIÓN INICIADA"

echo -e "${BLUE}📋 INFORMACIÓN:${NC}"
echo ""
echo -e "   ${CYAN}URL Principal:${NC} http://localhost:3000"
echo -e "   ${CYAN}Login:${NC} http://localhost:3000/login"
echo -e "   ${CYAN}Backend API:${NC} http://localhost:3002"
echo ""
echo -e "${BLUE}🔐 Credenciales:${NC}"
echo -e "   ${YELLOW}Email:${NC} admin@sgi360.com"
echo -e "   ${YELLOW}Contraseña:${NC} Admin123!"
echo ""
echo -e "${BLUE}🛑 Para detener todo:${NC}"
echo -e "   ${YELLOW}bash${NC} \"$PROJECT_DIR/launcher/stop.sh\""
echo ""
echo -e "${BLUE}📝 Notas:${NC}"
echo -e "   • La aplicación está corriendo en background"
echo -e "   • Si necesitas ver los logs, abre otra terminal"
echo -e "   • Presiona Ctrl+C en la terminal del launcher para detener"
echo ""

# Mantener el proceso corriendo
wait $LAUNCHER_PID 2>/dev/null || true
