#!/bin/bash

echo "🔄 Reiniciando servicios SGI 360..."

# Cerrar procesos en puertos 3000 y 3001
echo "📌 Cerrando procesos en puertos 3000 y 3001..."
lsof -ti:3000,3001 | xargs kill -9 2>/dev/null || true

# Esperar un momento
sleep 2

# Verificar que los puertos estén libres
echo "✅ Verificando que los puertos estén libres..."
if lsof -i:3000 >/dev/null 2>&1; then
    echo "⚠️ El puerto 3000 todavía está en uso"
else
    echo "✅ Puerto 3000 libre"
fi

if lsof -i:3001 >/dev/null 2>&1; then
    echo "⚠️ El puerto 3001 todavía está en uso"
else
    echo "✅ Puerto 3001 libre"
fi

# Iniciar API
echo "🚀 Iniciando API..."
cd "/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/apps/api"
npm run dev &
API_PID=$!

# Esperar a que la API inicie
sleep 5

# Iniciar Web
echo "🌐 Iniciando Web..."
cd "/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/apps/web"
npm run dev &
WEB_PID=$!

echo ""
echo "✅ Servicios iniciados:"
echo "   📡 API: http://localhost:3001 (PID: $API_PID)"
echo "   🌐 Web: http://localhost:3000 (PID: $WEB_PID)"
echo ""
echo "Para detener los servicios:"
echo "   kill $API_PID $WEB_PID"
echo "   o usa: lsof -ti:3000,3001 | xargs kill -9"

# Mantener el script corriendo
wait
