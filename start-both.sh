#!/bin/bash
# SGI 360 - Script de inicio unificado

echo "=== SGI 360 Server Startup ==="

# Detener procesos existentes
echo "1. Deteniendo procesos..."
pkill -9 node 2>/dev/null || true
pkill -9 pnpm 2>/dev/null || true
sleep 3

# Iniciar API
echo "2. Iniciando API en puerto 3001..."
cd "/Users/leonardocastillo/Desktop/APP/SGI 360/apps/api" || exit 1
node --import tsx simple-server.ts &
API_PID=$!
echo "   API PID: $API_PID"

# Esperar API
sleep 10

# Verificar API
echo "3. Verificando API..."
if curl -s http://localhost:3001/dashboard -H "x-tenant-id: 7efd859d-5c42-4412-9984-3227ccadeff4" > /dev/null 2>&1; then
    echo "   ✅ API respondiendo"
else
    echo "   ⚠️ API no responde todavía"
fi

# Iniciar Web
echo "4. Iniciando Web en puerto 3000..."
cd "/Users/leonardocastillo/Desktop/APP/SGI 360/apps/web" || exit 1
pnpm dev &
WEB_PID=$!
echo "   Web PID: $WEB_PID"

# Esperar Web
sleep 10

echo ""
echo "=== SERVIDORES INICIADOS ==="
echo "API: http://localhost:3001"
echo "Web: http://localhost:3000"
echo "Panel: http://localhost:3000/panel"
echo ""
echo "Tus 16 documentos deberían aparecer en el Panel General"
echo ""
echo "Para detener: pkill -9 node; pkill -9 pnpm"
