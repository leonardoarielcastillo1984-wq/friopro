#!/bin/bash

echo "🔧 Modo desarrollo - Iniciando servicios..."

# Verificar que la infra esté corriendo
if ! docker compose -f infra/docker-compose.yml ps | grep -q "running"; then
    echo "❌ La infraestructura no está corriendo. Ejecutá ./start.sh primero."
    exit 1
fi

# Iniciar API y Web en paralelo
echo "🚀 Iniciando API y Web..."

# Función para iniciar API
start_api() {
    echo "📡 Iniciando API..."
    cd apps/api
    pnpm dev
}

# Función para iniciar Web
start_web() {
    echo "🌐 Iniciando Web..."
    cd apps/web
    pnpm dev
}

# Iniciar en background
start_api &
API_PID=$!
start_web &
WEB_PID=$!

echo "✅ Servicios iniciados!"
echo "🌐 Web: http://localhost:3000"
echo "📡 API: http://localhost:3001"
echo ""
echo "Presioná Ctrl+C para detener todo..."

# Esperar señales
trap "kill $API_PID $WEB_PID 2>/dev/null || true; exit" INT TERM

wait
