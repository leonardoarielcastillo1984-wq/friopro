#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# SGI 360 - Stop All Services
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

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          SGI 360 - Deteniendo servicios...                   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Kill Mock API process
if [ -f "$LAUNCHER_DIR/mock-api.pid" ]; then
  MOCK_PID=$(cat "$LAUNCHER_DIR/mock-api.pid")
  if kill -0 $MOCK_PID 2>/dev/null; then
    echo -e "${CYAN}→${NC} Deteniendo Mock API (PID: $MOCK_PID)..."
    kill $MOCK_PID
    rm "$LAUNCHER_DIR/mock-api.pid"
    echo -e "${GREEN}✅${NC} Mock API detenida"
  fi
fi

# Kill API process
if [ -f "$LAUNCHER_DIR/api.pid" ]; then
  API_PID=$(cat "$LAUNCHER_DIR/api.pid")
  if kill -0 $API_PID 2>/dev/null; then
    echo -e "${CYAN}→${NC} Deteniendo API (PID: $API_PID)..."
    kill $API_PID
    rm "$LAUNCHER_DIR/api.pid"
    echo -e "${GREEN}✅${NC} API detenida"
  fi
fi

# Kill Web process
if [ -f "$LAUNCHER_DIR/web.pid" ]; then
  WEB_PID=$(cat "$LAUNCHER_DIR/web.pid")
  if kill -0 $WEB_PID 2>/dev/null; then
    echo -e "${CYAN}→${NC} Deteniendo Web (PID: $WEB_PID)..."
    kill $WEB_PID
    rm "$LAUNCHER_DIR/web.pid"
    echo -e "${GREEN}✅${NC} Web detenida"
  fi
fi

# Kill any Node processes on our ports
echo -e "${CYAN}→${NC} Limpiando procesos Node en puertos 3000-3003..."
for port in 3000 3001 3002 3003; do
  if lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null; then
    echo -e "${GREEN}✅${NC} Proceso en puerto $port eliminado"
  fi
done

sleep 1

# Stop Docker containers
echo ""
echo -e "${CYAN}→${NC} Deteniendo contenedores Docker..."

if command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
  DOCKER_COMPOSE="docker compose"
else
  echo -e "${YELLOW}⚠️${NC} docker-compose no encontrado, saltando contenedores"
  exit 0
fi

cd "$LAUNCHER_DIR"
$DOCKER_COMPOSE down 2>/dev/null || true

echo -e "${GREEN}✅${NC} Contenedores Docker detenidos"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   ✅ SERVICIOS DETENIDOS                      ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Para reiniciar, ejecuta:${NC}"
echo -e "   bash $LAUNCHER_DIR/start-all.sh"
echo ""
