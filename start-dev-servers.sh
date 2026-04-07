#!/bin/bash
set -e

echo "🚀 Iniciando servidores SGI 360..."

PROJECT_DIR="/sessions/clever-confident-cerf/mnt/SGI respaldo 360"

# Kill existing processes
echo "⏹️  Deteniendo procesos anteriores..."
pkill -f "node" 2>/dev/null || true
pkill -f "pnpm" 2>/dev/null || true
sleep 2

# Install dependencies if needed
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo "📦 Instalando dependencias globales..."
    cd "$PROJECT_DIR"
    pnpm install 2>/dev/null || npm install 2>/dev/null || true
fi

# Start API
echo "🔧 Iniciando API en puerto 3001..."
cd "$PROJECT_DIR/apps/api"
if [ ! -d "node_modules" ]; then
    pnpm install 2>/dev/null || npm install 2>/dev/null || true
fi

# Use simple-server.ts if available
if [ -f "simple-server.ts" ]; then
    npx tsx simple-server.ts > "$PROJECT_DIR/api.log" 2>&1 &
else
    npm run dev > "$PROJECT_DIR/api.log" 2>&1 &
fi
API_PID=$!
echo "✅ API iniciado (PID: $API_PID)"

# Wait for API
sleep 5

# Start Web
echo "🌐 Iniciando Web en puerto 3000..."
cd "$PROJECT_DIR/apps/web"
if [ ! -d "node_modules" ]; then
    pnpm install 2>/dev/null || npm install 2>/dev/null || true
fi

npm run dev > "$PROJECT_DIR/web.log" 2>&1 &
WEB_PID=$!
echo "✅ Web iniciado (PID: $WEB_PID)"

sleep 3

echo ""
echo "================================"
echo "✨ Servidores inicializados:"
echo "================================"
echo "🔗 API:  http://localhost:3001"
echo "🔗 Web:  http://localhost:3000"
echo ""
echo "📋 Logs:"
echo "   API:  $PROJECT_DIR/api.log"
echo "   Web:  $PROJECT_DIR/web.log"
echo ""
echo "⚠️  Para detener: pkill -f 'node' && pkill -f 'pnpm'"
