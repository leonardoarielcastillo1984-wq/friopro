#!/bin/bash
set -e

clear
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          🚀 SGI 360 - SOLUCIÓN DEFINITIVA Y FINAL 🚀          ║"
echo "║              Construyendo imagen personalizada...             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

PROJECT_DIR="/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"
cd "$PROJECT_DIR"

echo "⏳ PASO 1/5: Deteniendo Docker..."
docker compose -f infra/docker-compose.yml down -v 2>/dev/null || true
sleep 3

echo "⏳ PASO 2/5: Construyendo imagen PostgreSQL personalizada..."
docker compose -f infra/docker-compose.yml build --no-cache postgres

echo "⏳ PASO 3/5: Levantando Docker..."
docker compose -f infra/docker-compose.yml up -d
echo "   Esperando 90 segundos..."
sleep 90

echo "⏳ PASO 4/5: Instalando dependencias y ejecutando Prisma..."
cd "$PROJECT_DIR"
pnpm install --frozen-lockfile > /dev/null 2>&1
cd apps/api
npx prisma generate > /dev/null 2>&1
npx prisma migrate deploy 2>&1 || npx prisma migrate reset --force --skip-generate 2>&1

echo ""
clear
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                  ✅ ¡LISTO PARA DESARROLLAR! ✅              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "⏳ PASO 5/5: Iniciando servidor API..."
echo ""
pnpm dev
