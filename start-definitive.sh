#!/bin/bash

# SGI 360 - Script de Inicio Definitivo (Solución Completa)
set -e

echo "🚀 SGI 360 - Inicio Definitivo"
echo "============================="

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}1. Verificando Docker...${NC}"
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker no está corriendo. Iniciá Docker Desktop primero.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker está corriendo${NC}"

echo -e "${BLUE}2. Reiniciando infraestructura...${NC}"
cd "$ROOT"
docker compose -f infra/docker-compose.yml down
docker compose -f infra/docker-compose.yml up -d

echo -e "${YELLOW}⏳ Esperando 20 segundos...${NC}"
sleep 20

echo -e "${BLUE}3. Configurando base de datos desde cero...${NC}"
# Eliminar y recrear base de datos completamente
docker exec -it infra-postgres-1 psql -U sgi -d postgres -c "DROP DATABASE IF EXISTS sgi;" >/dev/null 2>&1 || true
docker exec -it infra-postgres-1 psql -U sgi -d postgres -c "CREATE DATABASE sgi;" >/dev/null 2>&1 || true

echo -e "${BLUE}4. Configurar API...${NC}"
cd "$ROOT/apps/api"

# Verificar .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📋 Creando .env desde .env.example${NC}"
    cp .env.example .env
fi

echo -e "${YELLOW}   Generando Prisma...${NC}"
pnpm prisma:generate

echo -e "${YELLOW}   Aplicando migraciones desde cero...${NC}"
# Usar db push en lugar de migrate reset para evitar problemas
pnpm prisma db push --force-reset

echo -e "${YELLOW}   Cargando datos...${NC}"
pnpm seed:all

echo -e "${BLUE}5. Iniciar servicios...${NC}"

# Matar procesos existentes
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Iniciar API
echo -e "${YELLOW}   Iniciando API (puerto 3001)...${NC}"
cd "$ROOT/apps/api"
nohup pnpm dev > "$ROOT/api.log" 2>&1 &
API_PID=$!
echo $API_PID > "$ROOT/.api-pid"

# Iniciar Web
echo -e "${YELLOW}   Iniciando Web (puerto 3000)...${NC}"
cd "$ROOT/apps/web"
nohup pnpm dev > "$ROOT/web.log" 2>&1 &
WEB_PID=$!
echo $WEB_PID > "$ROOT/.web-pid"

echo -e "${YELLOW}⏳ Esperando 10 segundos...${NC}"
sleep 10

# Verificar que los servicios estén corriendo
if ! ps -p $(cat "$ROOT/.api-pid") > /dev/null 2>&1; then
    echo -e "${RED}❌ API no inició correctamente${NC}"
    echo -e "${YELLOW}📋 Revisá los logs en: $ROOT/api.log${NC}"
    exit 1
fi

if ! ps -p $(cat "$ROOT/.web-pid") > /dev/null 2>&1; then
    echo -e "${RED}❌ Web no inició correctamente${NC}"
    echo -e "${YELLOW}📋 Revisá los logs en: $ROOT/web.log${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 ¡Aplicaciones iniciadas correctamente!${NC}"
echo ""
echo -e "${BLUE}📋 Accesos:${NC}"
echo -e "   ${YELLOW}• Web App:${NC} http://localhost:3000"
echo -e "   ${YELLOW}• API:${NC}     http://localhost:3001"
echo ""
echo -e "${BLUE}👤 Usuarios:${NC}"
echo -e "   ${YELLOW}• Admin:${NC}   admin@sgi360.com / Admin123!"
echo -e "   ${YELLOW}• Usuario:${NC} usuario@demo.com / User123!"
echo ""
echo -e "${BLUE}🛑 Para detener:${NC}"
echo -e "   ${YELLOW}./stop-simple.sh${NC}"
echo ""

open http://localhost:3000
