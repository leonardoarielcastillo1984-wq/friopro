#!/bin/bash

# ================================================
# SCRIPT PARA DETENER LOS SERVIDORES
# ================================================

BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$BASE_DIR"

echo "🛑 Deteniendo servidores SGI 360..."

if [ -f .api_pid ]; then
    API_PID=$(cat .api_pid)
    kill $API_PID 2>/dev/null && echo "✅ API detenida (PID: $API_PID)" || echo "⚠️ API no estaba ejecutándose"
    rm .api_pid
fi

if [ -f .web_pid ]; then
    WEB_PID=$(cat .web_pid)
    kill $WEB_PID 2>/dev/null && echo "✅ Web detenida (PID: $WEB_PID)" || echo "⚠️ Web no estaba ejecutándose"
    rm .web_pid
fi

echo ""
echo "✨ Todos los servidores han sido detenidos"
