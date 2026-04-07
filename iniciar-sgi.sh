#!/bin/bash
# ============================================
# SGI 360 - Inicio automático
# ============================================

PROJECT_DIR="/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"

echo ""
echo "🚀 ========================================="
echo "   SGI 360 - Iniciando servidores..."
echo "========================================="
echo ""

# 1. Detener procesos previos
echo "⏹️  [1/4] Deteniendo procesos anteriores..."
pkill -f "node.*simple-server" 2>/dev/null
pkill -f "next dev" 2>/dev/null
pkill -f "tsx.*main" 2>/dev/null
sleep 2
echo "   ✅ Limpio"

# 2. Iniciar API
echo ""
echo "🔧 [2/4] Iniciando API en puerto 3001..."
cd "$PROJECT_DIR/apps/api"
npx tsx simple-server.ts > /tmp/sgi-api.log 2>&1 &
API_PID=$!
echo "   PID: $API_PID"

# Esperar a que el API responda
echo "   Esperando API..."
for i in {1..15}; do
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        echo "   ✅ API corriendo en http://localhost:3001"
        break
    fi
    sleep 1
    if [ $i -eq 15 ]; then
        echo "   ⚠️  API tardando... revisando logs:"
        tail -5 /tmp/sgi-api.log
    fi
done

# 3. Iniciar Web
echo ""
echo "🌐 [3/4] Iniciando Web en puerto 3000..."
cd "$PROJECT_DIR/apps/web"
npx next dev -p 3000 > /tmp/sgi-web.log 2>&1 &
WEB_PID=$!
echo "   PID: $WEB_PID"

echo "   Esperando Web..."
for i in {1..20}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "   ✅ Web corriendo en http://localhost:3000"
        break
    fi
    sleep 1
    if [ $i -eq 20 ]; then
        echo "   ⚠️  Web tardando... revisando logs:"
        tail -5 /tmp/sgi-web.log
    fi
done

# 4. Abrir navegador
echo ""
echo "🌍 [4/4] Abriendo navegador..."
open http://localhost:3000

echo ""
echo "========================================="
echo "✨ SGI 360 está corriendo!"
echo "========================================="
echo ""
echo "   🔗 Web:  http://localhost:3000"
echo "   🔗 API:  http://localhost:3001"
echo ""
echo "   👤 Login: admin@sgi360.com"
echo "   🔑 Pass:  Admin123!"
echo ""
echo "   📋 Logs:"
echo "      API → tail -f /tmp/sgi-api.log"
echo "      Web → tail -f /tmp/sgi-web.log"
echo ""
echo "   ⛔ Para detener: pkill -f 'node'"
echo ""
