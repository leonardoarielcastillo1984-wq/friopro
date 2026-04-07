#!/bin/bash

echo "🛑 Deteniendo SGI 360..."

# Detener contenedores
echo "📦 Deteniendo PostgreSQL y Redis..."
docker compose -f infra/docker-compose.yml down

# Matar procesos en puertos 3000 y 3001
echo "🔪 Liberando puertos..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

echo "✅ Todo detenido!"
