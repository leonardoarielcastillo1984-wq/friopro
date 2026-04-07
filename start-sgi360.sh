#!/bin/bash

# ============================================
# SGI 360 - Script de Inicio Automático
# Ejecutar en Terminal: bash start-sgi360.sh
# ============================================

PROJECT_DIR="/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  🚀 SGI 360 - INICIANDO SERVIDORES   ║"
echo "╚════════════════════════════════════════╝"
echo ""

# 1. Detener procesos anteriores
echo "⏹️  Limpiando procesos anteriores..."
pkill -f "node server-data" 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 2

# 2. Iniciar API
echo "🔧 Iniciando API (puerto 3001)..."
cd "$PROJECT_DIR/apps/api"
node server-data.cjs > /tmp/sgi-api.log 2>&1 &
API_PID=$!
echo "   ✅ API PID: $API_PID"

# Esperar a que el API responda
echo "   ⏳ Esperando que API responda..."
for i in {1..10}; do
  if curl -s http://localhost:3001/documents > /dev/null 2>&1; then
    echo "   ✅ API respondiendo correctamente"
    break
  fi
  sleep 1
done

# 3. Iniciar Web
echo ""
echo "🌐 Iniciando Web (puerto 3000)..."
cd "$PROJECT_DIR/apps/web"
./node_modules/.bin/next dev -p 3000 > /tmp/sgi-web.log 2>&1 &
WEB_PID=$!
echo "   ✅ Web PID: $WEB_PID"

# 4. Abrir navegador
echo ""
echo "🌍 Abriendo navegador..."
sleep 5
open http://localhost:3000

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✨ SERVIDORES INICIADOS              ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "🔗 Accesos:"
echo "   Web:  http://localhost:3000"
echo "   API:  http://localhost:3001"
echo ""
echo "👤 Login:"
echo "   Email: admin@sgi360.com"
echo "   Pass:  Admin123!"
echo ""
echo "📋 Para ver logs en tiempo real:"
echo "   API:  tail -f /tmp/sgi-api.log"
echo "   Web:  tail -f /tmp/sgi-web.log"
echo ""
echo "⛔ Para detener: pkill -f 'node server-data' && pkill -f 'next dev'"
echo ""

# Mantener el script corriendo para que no mueran los procesos
wait
