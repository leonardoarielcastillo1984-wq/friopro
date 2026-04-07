#!/bin/bash

# ================================================
# SCRIPT DE LANZAMIENTO COMPLETO - SGI 360
# Hace TODO: instala, migra, y lanza servidores
# ================================================

set -e

echo "🚀 INICIANDO LANZAMIENTO COMPLETO DE SGI 360"
echo "=============================================="

# Obtener el directorio base
BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$BASE_DIR"

echo "📁 Directorio: $BASE_DIR"

# ================================================
# PASO 1: INSTALAR DEPENDENCIAS
# ================================================
echo ""
echo "📦 PASO 1: Instalando dependencias..."
npm install --legacy-peer-deps 2>&1 | tail -5

# ================================================
# PASO 2: GENERAR CLIENTE PRISMA
# ================================================
echo ""
echo "🔧 PASO 2: Generando cliente Prisma..."
cd apps/api
npm run prisma:generate 2>&1 | tail -5

# ================================================
# PASO 3: APLICAR MIGRACIÓN
# ================================================
echo ""
echo "🗄️ PASO 3: Aplicando migración de base de datos..."
npm run prisma:migrate 2>&1 | tail -10

cd "$BASE_DIR"

# ================================================
# PASO 4: LANZAR API EN BACKGROUND
# ================================================
echo ""
echo "🔌 PASO 4: Lanzando servidor API (puerto 3001)..."
cd apps/api
npm run dev > /tmp/sgi360_api.log 2>&1 &
API_PID=$!
echo $API_PID > "$BASE_DIR/.api_pid"
sleep 3
echo "✅ API iniciada (PID: $API_PID)"
echo "📝 Log: tail -f /tmp/sgi360_api.log"

cd "$BASE_DIR"

# ================================================
# PASO 5: LANZAR WEB EN BACKGROUND
# ================================================
echo ""
echo "🌐 PASO 5: Lanzando servidor Web (puerto 3000)..."
cd apps/web
npm run dev > /tmp/sgi360_web.log 2>&1 &
WEB_PID=$!
echo $WEB_PID > "$BASE_DIR/.web_pid"
sleep 3
echo "✅ Web iniciada (PID: $WEB_PID)"
echo "📝 Log: tail -f /tmp/sgi360_web.log"

cd "$BASE_DIR"

# ================================================
# PASO 6: INFORMACIÓN FINAL
# ================================================
echo ""
echo "=============================================="
echo "✨ ¡LANZAMIENTO COMPLETADO EXITOSAMENTE!"
echo "=============================================="
echo ""
echo "📊 SERVIDORES ACTIVOS:"
echo "  🔌 API:   http://localhost:3001"
echo "  🌐 WEB:   http://localhost:3000"
echo "  🗄️  DB:    postgresql://localhost:5432/sgi_dev"
echo ""
echo "📝 LOGS:"
echo "  API Log:  tail -f /tmp/sgi360_api.log"
echo "  Web Log:  tail -f /tmp/sgi360_web.log"
echo ""
echo "🛑 PARA DETENER LOS SERVIDORES:"
echo "  kill $API_PID  # Detiene API"
echo "  kill $WEB_PID  # Detiene Web"
echo "  Or run: ./DETENER_SERVIDORES.sh"
echo ""
echo "🌍 Abre tu navegador en: http://localhost:3000"
echo ""
