#!/bin/bash

# ============================================
# SGI 360 - Database Initialization
# ============================================

set -e

echo "🚀 SGI 360 - Initializing Database..."
echo ""

PROJECT_DIR="/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"
cd "$PROJECT_DIR"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${BLUE}1️⃣  Stopping Docker containers...${NC}"
docker compose -f infra/docker-compose.yml down -v 2>/dev/null || true
sleep 2

echo -e "${BLUE}2️⃣  Starting PostgreSQL and Redis...${NC}"
docker compose -f infra/docker-compose.yml up -d
echo "   ⏳ Waiting for PostgreSQL to initialize..."
sleep 15

echo ""
echo -e "${BLUE}3️⃣  Running Prisma migrations...${NC}"
cd apps/api
npx prisma migrate deploy
cd ../..

echo ""
echo -e "${GREEN}✅ Database ready!${NC}"
echo ""
echo -e "${BLUE}📝 To start the API, run:${NC}"
echo "   cd \"$PROJECT_DIR/apps/api\" && pnpm dev"
echo ""
echo -e "${BLUE}📝 To start the Web, run (in another terminal):${NC}"
echo "   cd \"$PROJECT_DIR/apps/web\" && pnpm dev"
echo ""
