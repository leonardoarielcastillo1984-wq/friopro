#!/bin/bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ respaldo\ 360

echo "=== Reiniciando servidores SGI 360 ==="

# Detener procesos existentes
echo "[1/4] Deteniendo procesos node..."
pkill -9 node 2>/dev/null
sleep 3

# Iniciar API
echo "[2/4] Iniciando API (puerto 3001)..."
cd apps/api
npm run dev > /tmp/api.log 2>&1 &
sleep 10

# Iniciar Web
echo "[3/4] Iniciando Web (puerto 3000)..."
cd ../web
npm run dev > /tmp/web.log 2>&1 &
sleep 10

# Verificar
echo "[4/4] Verificando..."
sleep 5
ps aux | grep -E "(next|tsx)" | grep -v grep | wc -l
echo "servidores activos"

# Mostrar logs iniciales
echo ""
echo "=== Logs API ==="
tail -3 /tmp/api.log
echo ""
echo "=== Logs Web ==="
tail -3 /tmp/web.log

echo ""
echo "=== Servidores reiniciados ==="
