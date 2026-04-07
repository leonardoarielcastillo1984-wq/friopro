#!/bin/bash

# ============================================
# 🚀 SGI 360 - SCRIPT DE INICIO AUTOMÁTICO
# ============================================
# Simplemente ejecuta este archivo y listo
# ============================================

set -e

PROJECT_DIR="$HOME/Desktop/APP/SGI 360"
API_DIR="$PROJECT_DIR/apps/api"
WEB_DIR="$PROJECT_DIR/apps/web"

echo "🚀 Iniciando SGI 360..."
echo ""

# ============================================
# PASO 1: Verificar que PostgreSQL está corriendo
# ============================================
echo "1️⃣  Verificando PostgreSQL..."
if ! brew services list | grep postgresql@16 | grep -q started; then
    echo "   ⚠️  PostgreSQL no está corriendo. Iniciando..."
    brew services start postgresql@16
    sleep 3
else
    echo "   ✅ PostgreSQL corriendo"
fi

# ============================================
# PASO 2: Verificar que Redis está corriendo
# ============================================
echo "2️⃣  Verificando Redis..."
if ! brew services list | grep redis | grep -q started; then
    echo "   ⚠️  Redis no está corriendo. Iniciando..."
    brew services start redis
    sleep 2
else
    echo "   ✅ Redis corriendo"
fi

# ============================================
# PASO 3: Matar procesos previos en los puertos
# ============================================
echo "3️⃣  Limpiando procesos previos..."
pkill -9 -f "npm run dev" 2>/dev/null || true
sleep 1

# ============================================
# PASO 4: Abrir Terminal 1 - API
# ============================================
echo "4️⃣  Iniciando API (Terminal 1)..."
osascript <<EOF
tell application "Terminal"
    activate
    do script "cd '$API_DIR' && npm run dev"
end tell
EOF
sleep 4

# ============================================
# PASO 5: Abrir Terminal 2 - Frontend
# ============================================
echo "5️⃣  Iniciando Frontend (Terminal 2)..."
osascript <<EOF
tell application "Terminal"
    do script "cd '$WEB_DIR' && npm run dev"
end tell
EOF
sleep 4

# ============================================
# PASO 6: Abrir navegador en login
# ============================================
echo "6️⃣  Abriendo navegador..."
sleep 2
open "http://localhost:3000/login"

echo ""
echo "✅ ¡SGI 360 está listo!"
echo ""
echo "📝 Credenciales:"
echo "   Email: admin@sgi360.com"
echo "   Contraseña: Admin123!"
echo ""
echo "🔗 URL: http://localhost:3000/login"
echo ""
echo "💡 Tip: Las terminales se abren automáticamente en nuevas ventanas"
echo ""

exit 0
