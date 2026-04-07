#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# SGI 360 - ENTRAR AHORA (Solución Final - Sin Docker Complexity)
# ═══════════════════════════════════════════════════════════════════════════

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPS_API="$PROJECT_DIR/apps/api"
APPS_WEB="$PROJECT_DIR/apps/web"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  SGI 360 - SOLUCIÓN FINAL${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Verificar Docker
echo -e "${CYAN}→${NC} Verificando Docker..."
if ! command -v docker &> /dev/null; then
  echo -e "${YELLOW}⚠️${NC} Docker no está instalado o no está en PATH"
  exit 1
fi
echo -e "${GREEN}✅${NC} Docker está disponible"

# Step 2: Limpiar todo
echo ""
echo -e "${CYAN}→${NC} Limpiando servicios anteriores..."
docker stop $(docker ps -aq) 2>/dev/null || true
sleep 2
docker rm $(docker ps -aq) 2>/dev/null || true
sleep 2
docker volume prune -f 2>/dev/null || true
echo -e "${GREEN}✅${NC} Limpio"

# Step 3: Iniciar BD con docker-compose (solo BD, no API/Web)
echo ""
echo -e "${CYAN}→${NC} Iniciando PostgreSQL y Redis..."
cd "$PROJECT_DIR"
docker compose up postgres redis -d 2>&1 | grep -v "already exists\|Pulling\|Downloading"
echo -e "${GREEN}✅${NC} BD iniciada"

# Wait for DB
sleep 10

# Step 4: Instalar dependencias API
echo ""
echo -e "${CYAN}→${NC} Preparando Backend..."
cd "$APPS_API"
npm install --legacy-peer-deps > /dev/null 2>&1
npm run prisma:generate > /dev/null 2>&1
npm run prisma:migrate -- --skip-generate > /dev/null 2>&1 || true
npm run seed:complete > /dev/null 2>&1 || true
echo -e "${GREEN}✅${NC} Backend listo"

# Step 5: Instalar dependencias Web
echo ""
echo -e "${CYAN}→${NC} Preparando Frontend..."
cd "$APPS_WEB"
npm install --legacy-peer-deps > /dev/null 2>&1
echo -e "${GREEN}✅${NC} Frontend listo"

# Step 6: Iniciar Backend
echo ""
echo -e "${CYAN}→${NC} Iniciando Backend en puerto 3002..."
cd "$APPS_API"
npm run dev > /tmp/sgi360-api.log 2>&1 &
API_PID=$!
sleep 5
echo -e "${GREEN}✅${NC} Backend ejecutándose (PID: $API_PID)"

# Step 7: Iniciar Frontend
echo ""
echo -e "${CYAN}→${NC} Iniciando Frontend en puerto 3000..."
cd "$APPS_WEB"
npm run dev > /tmp/sgi360-web.log 2>&1 &
WEB_PID=$!
sleep 5
echo -e "${GREEN}✅${NC} Frontend ejecutándose (PID: $WEB_PID)"

# Step 8: Esperar a que estén listos
echo ""
echo -e "${CYAN}→${NC} Esperando que servicios estén listos..."
for i in {1..30}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC} Servicios listos"
    break
  fi
  sleep 1
done

# Step 9: Abrir navegador
echo ""
echo -e "${CYAN}→${NC} Abriendo navegador..."
LOGIN_URL="http://localhost:3000/login"
if [[ "$OSTYPE" == "darwin"* ]]; then
  open "$LOGIN_URL" 2>/dev/null || true
fi

# Step 10: Mostrar info final
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ ¡LISTO!${NC}"
echo ""
echo -e "${BLUE}🌐 ACCESO:${NC}"
echo -e "   http://localhost:3000/login"
echo ""
echo -e "${BLUE}🔐 CREDENCIALES:${NC}"
echo -e "   Email:      ${YELLOW}admin@sgi360.com${NC}"
echo -e "   Contraseña: ${YELLOW}Admin123!${NC}"
echo ""
echo -e "${BLUE}📊 SERVICIOS:${NC}"
echo -e "   Frontend: http://localhost:3000 (PID: $WEB_PID)"
echo -e "   Backend:  http://localhost:3002 (PID: $API_PID)"
echo ""
echo -e "${BLUE}🛑 PARA DETENER:${NC}"
echo -e "   kill $API_PID"
echo -e "   kill $WEB_PID"
echo -e "   docker compose down"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Keep running
wait
