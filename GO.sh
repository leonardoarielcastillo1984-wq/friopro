#!/bin/bash
set -e

clear
echo "🚀 SGI 360 - INICIANDO TODO..."
echo ""

cd "/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"

echo "1️⃣  Limpiando..."
docker compose -f infra/docker-compose.yml down -v 2>/dev/null || true
sleep 2

echo "2️⃣  Construyendo imagen PostgreSQL personalizada..."
docker compose -f infra/docker-compose.yml build --no-cache postgres

echo ""
echo "3️⃣  Levantando servicios..."
docker compose -f infra/docker-compose.yml up -d

echo "4️⃣  Esperando a que PostgreSQL esté listo (40 segundos)..."
sleep 40

echo "5️⃣  Instalando dependencias..."
pnpm install --frozen-lockfile > /dev/null 2>&1

echo "6️⃣  Ejecutando Prisma..."
cd apps/api
npx prisma generate > /dev/null 2>&1
npx prisma migrate reset --force --skip-generate > /dev/null 2>&1
cd ../..

clear
echo "╔════════════════════════════════════════════════════════════╗"
echo "║         ✅ SGI 360 ESTÁ 100% LISTO PARA DESARROLLAR        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 TERMINAL 1 - API:"
echo "   cd \"/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/apps/api\""
echo "   pnpm dev"
echo ""
echo "🎯 TERMINAL 2 - WEB:"
echo "   cd \"/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/apps/web\""
echo "   pnpm dev"
echo ""
echo "🌐 ACCESOS:"
echo "   • http://localhost:3000 (Web)"
echo "   • http://localhost:3001 (API)"
echo ""
echo "🔐 CREDENCIALES:"
echo "   • admin@sgi360.com / Admin123!"
echo "   • usuario@demo.com / User123!"
echo ""
