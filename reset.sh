#!/bin/bash

echo "🔄 Reset completo de SGI 360..."

# Detener todo
echo "🛑 Deteniendo servicios..."
./stop.sh 2>/dev/null || true

# Limpiar contenedores y volúmenes
echo "🧹 Limpiando Docker..."
docker compose -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.yml rm -f 2>/dev/null || true

# Limpiar node_modules si es necesario
if [ "$1" = "--deep" ]; then
    echo "🧽 Limpiando node_modules..."
    rm -rf node_modules
    rm -rf apps/api/node_modules
    rm -rf apps/web/node_modules
    echo "📦 Reinstalando dependencias..."
    pnpm install
fi

# Iniciar desde cero
echo "🚀 Iniciando desde cero..."
./start.sh
