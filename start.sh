#!/bin/bash

# ============================================
# SGI 360 - Script de Inicio Automático
# ============================================

set -e

echo "🚀 SGI 360 - Iniciando..."
echo ""

PROJECT_DIR="/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"
cd "$PROJECT_DIR"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}1️⃣  Limpiando Docker...${NC}"
docker compose -f infra/docker-compose.yml down -v 2>/dev/null || true
sleep 3

echo -e "${BLUE}2️⃣  Iniciando PostgreSQL y Redis...${NC}"
docker compose -f infra/docker-compose.yml up -d
echo "   Esperando a que PostgreSQL esté listo..."
sleep 20

echo "   Verificando servicios..."
docker compose -f infra/docker-compose.yml ps
echo ""

echo -e "${BLUE}3️⃣  Instalando dependencias...${NC}"
pnpm install --frozen-lockfile 2>&1 | tail -3
echo ""

echo -e "${BLUE}4️⃣  Configurando variables de entorno...${NC}"
[ ! -f "apps/api/.env" ] && cp apps/api/.env.example apps/api/.env && echo "   ✓ apps/api/.env"
[ ! -f "apps/web/.env" ] && cp apps/web/.env.example apps/web/.env && echo "   ✓ apps/web/.env"
echo ""

echo -e "${BLUE}5️⃣  Creando base de datos...${NC}"
docker exec infra-postgres-1 bash /docker-entrypoint-initdb.d/00-init.sh > /dev/null 2>&1 || true
sleep 5

echo -e "${BLUE}6️⃣  Configurando Prisma y Migraciones...${NC}"
cd apps/api
npx prisma generate > /dev/null 2>&1
npx prisma migrate reset --force
cd ../..
echo ""

echo -e "${GREEN}✅ ¡Setup completado!${NC}"
echo ""
echo -e "${YELLOW}📝 Próximos pasos - Abre DOS terminales:${NC}"
echo ""
echo -e "${BLUE}Terminal 1:${NC} cd \"$PROJECT_DIR/apps/api\" && pnpm dev"
echo -e "${BLUE}Terminal 2:${NC} cd \"$PROJECT_DIR/apps/web\" && pnpm dev"
echo ""
echo -e "${YELLOW}🌐 Accesos:${NC}"
echo "  Web: http://localhost:3000"
echo "  API: http://localhost:3001"
echo ""
echo -e "${YELLOW}🔐 Login:${NC}"
echo "  admin@sgi360.com / Admin123!"
echo ""
