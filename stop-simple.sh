#!/bin/bash

# SGI 360 - Script de Parada Simple
echo "🛑 SGI 360 - Deteniendo aplicaciones"
echo "=================================="

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Detener por PID
if [ -f "$ROOT/.api-pid" ]; then
    API_PID=$(cat "$ROOT/.api-pid")
    if ps -p $API_PID > /dev/null 2>&1; then
        echo "🛑 Deteniendo API (PID: $API_PID)..."
        kill $API_PID 2>/dev/null || true
    fi
    rm -f "$ROOT/.api-pid"
fi

if [ -f "$ROOT/.web-pid" ]; then
    WEB_PID=$(cat "$ROOT/.web-pid")
    if ps -p $WEB_PID > /dev/null 2>&1; then
        echo "🛑 Deteniendo Web (PID: $WEB_PID)..."
        kill $WEB_PID 2>/dev/null || true
    fi
    rm -f "$ROOT/.web-pid"
fi

# Liberar puertos
echo "🔧 Liberando puertos..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Detener Docker (opcional)
echo "🐳 Deteniendo Docker containers..."
cd "$ROOT"
docker compose -f infra/docker-compose.yml down

echo ""
echo "✅ Todo detenido correctamente"
echo ""
