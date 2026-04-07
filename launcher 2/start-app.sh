#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# SGI 360 - Automatic Application Launcher
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Paths
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPS_WEB="$PROJECT_DIR/apps/web"
LAUNCHER_DIR="$PROJECT_DIR/launcher"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         SGI 360 - Sistema de Gestión Integrado                ║${NC}"
echo -e "${BLUE}║              Iniciando Aplicación Web...                      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check dependencies
echo -e "${YELLOW}🔍 Validando dependencias...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js no está instalado${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Node.js: $(node -v)${NC}"

if ! command -v npm &> /dev/null; then
  echo -e "${RED}❌ npm no está instalado${NC}"
  exit 1
fi
echo -e "${GREEN}✅ npm: $(npm -v)${NC}"

# Kill any existing processes
echo ""
echo -e "${YELLOW}🧹 Limpiando procesos antiguos...${NC}"
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1
echo -e "${GREEN}✅ Procesos limpios${NC}"

# Verify project structure
echo ""
echo -e "${YELLOW}🔍 Validando estructura del proyecto...${NC}"
if [ ! -d "$APPS_WEB" ]; then
  echo -e "${RED}❌ No se encontró apps/web${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Estructura válida${NC}"

# Start Mock API
echo ""
echo -e "${YELLOW}🚀 Iniciando Mock API en puerto 3001...${NC}"
cd "$APPS_WEB"
node --experimental-modules mock-api-server.js > "$LAUNCHER_DIR/mock-api.log" 2>&1 &
MOCK_PID=$!
echo $MOCK_PID > "$LAUNCHER_DIR/mock-api.pid"

# Wait for Mock API to be ready
echo -e "${YELLOW}⏳ Esperando que Mock API esté listo...${NC}"
for i in {1..10}; do
  if curl -s http://localhost:3001/auth/csrf > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Mock API está listo${NC}"
    break
  fi
  if [ $i -eq 10 ]; then
    echo -e "${RED}❌ Timeout esperando Mock API${NC}"
    cat "$LAUNCHER_DIR/mock-api.log"
    exit 1
  fi
  sleep 1
done

# Start Next.js
echo ""
echo -e "${YELLOW}🚀 Iniciando Next.js en puerto 3000...${NC}"
cd "$APPS_WEB"
npm run dev > "$LAUNCHER_DIR/nextjs.log" 2>&1 &
NEXT_PID=$!
echo $NEXT_PID > "$LAUNCHER_DIR/nextjs.pid"

# Wait for Next.js to be ready
echo -e "${YELLOW}⏳ Esperando que Next.js esté listo...${NC}"
for i in {1..30}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Next.js está listo${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}❌ Timeout esperando Next.js${NC}"
    cat "$LAUNCHER_DIR/nextjs.log" | tail -20
    exit 1
  fi
  echo -n "."
  sleep 1
done
echo ""

# Test endpoints
echo ""
echo -e "${YELLOW}🧪 Validando endpoints...${NC}"

# Test Mock API
MOCK_TEST=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}')

if echo "$MOCK_TEST" | grep -q "accessToken"; then
  echo -e "${GREEN}✅ Mock API respondiendo correctamente${NC}"
else
  echo -e "${RED}❌ Mock API no está respondiendo correctamente${NC}"
  exit 1
fi

# Test Route Handler
ROUTE_TEST=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}')

if echo "$ROUTE_TEST" | grep -q '"token"'; then
  echo -e "${GREEN}✅ Route Handler respondiendo correctamente${NC}"
else
  echo -e "${RED}❌ Route Handler no está respondiendo correctamente${NC}"
  exit 1
fi

# Open browser
echo ""
echo -e "${BLUE}🌐 Abriendo navegador...${NC}"

# Auto-login page
AUTO_LOGIN_URL="http://localhost:3000/auto-login"

# Detect OS and open browser accordingly
if [[ "$OSTYPE" == "darwin"* ]]; then
  open "$AUTO_LOGIN_URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  xdg-open "$AUTO_LOGIN_URL" 2>/dev/null || echo "Abre manualmente: $AUTO_LOGIN_URL"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
  start "$AUTO_LOGIN_URL"
else
  echo "Abre en tu navegador: $AUTO_LOGIN_URL"
fi

# Summary
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   ✅ APP INICIADA EXITOSAMENTE                 ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 URLs:${NC}"
echo -e "   ${YELLOW}Web App:${NC} http://localhost:3000"
echo -e "   ${YELLOW}Login:${NC} http://localhost:3000/login"
echo -e "   ${YELLOW}Auto-Login:${NC} http://localhost:3000/auto-login"
echo -e "   ${YELLOW}Mock API:${NC} http://localhost:3001"
echo ""
echo -e "${BLUE}🔐 Credenciales de Prueba:${NC}"
echo -e "   ${YELLOW}Email:${NC} test@example.com"
echo -e "   ${YELLOW}Contraseña:${NC} Test123!@#"
echo ""
echo -e "${BLUE}📋 Para detener los servidores:${NC}"
echo -e "   kill $MOCK_PID  (Mock API)"
echo -e "   kill $NEXT_PID  (Next.js)"
echo ""
echo -e "${YELLOW}Presiona Ctrl+C para terminar este script${NC}"
echo ""

# Keep processes running
wait
