#!/bin/bash

clear

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              SGI 360 - INICIADOR DE APLICACIÓN                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

PROJECT_PATH="$HOME/Desktop/APP/SGI 360"

echo "[1/5] Limpiando procesos anteriores..."
pkill -9 node 2>/dev/null || true
sleep 2
echo "✓ Procesos limpios"

echo ""
echo "[2/5] Iniciando bases de datos..."
brew services restart postgresql@16 > /dev/null 2>&1
brew services restart redis > /dev/null 2>&1
sleep 5
echo "✓ PostgreSQL y Redis corriendo"

echo ""
echo "[3/5] Iniciando API en puerto 3001..."
cd "$PROJECT_PATH/apps/api"
npm run dev > /tmp/api.log 2>&1 &
API_PID=$!

# Espera a que el API esté listo (puerto 3001)
for i in $(seq 1 20); do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo "✓ API listo (PID: $API_PID)"
        break
    fi
    if [ "$i" -eq 20 ]; then
        echo "✗ Error iniciando API"
        echo "Logs:"
        tail -20 /tmp/api.log
        exit 1
    fi
    sleep 1
done

echo ""
echo "[4/5] Iniciando Web en puerto 3000..."
cd "$PROJECT_PATH/apps/web"
rm -rf .next 2>/dev/null
npm run dev > /tmp/web.log 2>&1 &
WEB_PID=$!

# Espera a que el Web esté listo
for i in $(seq 1 30); do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "✓ Web listo (PID: $WEB_PID)"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "✗ Error iniciando Web"
        echo "Logs:"
        tail -20 /tmp/web.log
        exit 1
    fi
    sleep 1
done

echo ""
echo "[5/5] Abriendo navegador..."
sleep 2
open "http://localhost:3000/login"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✓ APLICACIÓN INICIADA CORRECTAMENTE                          ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  Web:        http://localhost:3000                             ║"
echo "║  API:        http://localhost:3001                             ║"
echo "║                                                                ║"
echo "║  Usuario:    admin@sgi360.com                                  ║"
echo "║  Contraseña: Admin123!                                         ║"
echo "║                                                                ║"
echo "║  Logs:                                                         ║"
echo "║    API:  tail -f /tmp/api.log                                  ║"
echo "║    Web:  tail -f /tmp/web.log                                  ║"
echo "║                                                                ║"
echo "║  Detener: pkill -9 node                                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

wait
