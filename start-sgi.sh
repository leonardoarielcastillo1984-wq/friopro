#!/bin/bash

echo "🚀 Iniciando SGI 360..."

ROOT_DIR="/Users/leonardocastillo/Desktop/APP/SGI 360"
API_DIR="$ROOT_DIR/apps/api"
WEB_DIR="$ROOT_DIR/apps/web"

kill_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "   ⛔ Liberando puerto $port (PID(s): $pids)"
    kill $pids 2>/dev/null || true
    sleep 1
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "   ⚠️ Forzando cierre en puerto $port"
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

# Detener todos los procesos
echo "🛑 Deteniendo procesos anteriores..."
pkill -f "pnpm dev" 2>/dev/null || true
pkill -f "simple-server-hr.cjs" 2>/dev/null || true
kill_port 3000
kill_port 3001
kill_port 3002
sleep 2

# Iniciar API Principal
echo "🚀 Iniciando API Principal (puerto 3001)..."
cd "$API_DIR"
PORT=3001 pnpm dev &
API_PID=$!
sleep 3

# Iniciar API de RRHH
echo "👥 Iniciando HR API (puerto 3002)..."
node simple-server-hr.cjs &
HR_PID=$!
sleep 2

# Iniciar Frontend
echo "🌐 Iniciando Frontend (puerto 3000)..."
cd "$WEB_DIR"
PORT=3000 pnpm dev &
WEB_PID=$!
sleep 3

echo "✅ Todos los servicios iniciados!"
echo "📊 API Principal: http://localhost:3001"
echo "👥 HR API: http://localhost:3002"
echo "🌐 Frontend: http://localhost:3000"
echo ""
echo "📋 PIDs:"
echo "   API Principal: $API_PID"
echo "   HR API: $HR_PID"
echo "   Frontend: $WEB_PID"
echo ""
echo "🌐 Abriendo navegador..."
open http://localhost:3000

# Esperar a que los procesos terminen
wait $API_PID $HR_PID $WEB_PID
