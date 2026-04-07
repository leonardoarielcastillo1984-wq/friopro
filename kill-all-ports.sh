#!/bin/bash

echo "🧹 Limpiando todos los puertos de desarrollo..."

# Matar todos los procesos Node.js
echo "📌 Matar procesos Node.js..."
pkill -f node || true

# Matar procesos en puertos comunes
echo "📌 Matar procesos en puertos comunes..."
COMMON_PORTS="3000,3001,3002,3003,3004,3005,8000,8080,5432,27017,6379,5000"
lsof -ti:$COMMON_PORTS | xargs kill -9 2>/dev/null || true

# Matar procesos npm/yarn
echo "📌 Matar procesos npm/yarn..."
pkill -f npm || true
pkill -f yarn || true

# Matar procesos Next.js
echo "📌 Matar procesos Next.js..."
pkill -f next || true

# Matar procesos Fastify
echo "📌 Matar procesos Fastify..."
pkill -f fastify || true

# Esperar un momento
sleep 2

# Verificar qué puertos siguen en uso
echo ""
echo "🔍 Verificando puertos todavía en uso:"
echo "Node.js processes:"
pgrep -f node || echo "   ✅ Ninguno"

echo ""
echo "Puertos 3000-3005:"
for port in 3000 3001 3002 3003 3004 3005; do
    if lsof -i:$port >/dev/null 2>&1; then
        echo "   ⚠️  Puerto $port todavía en uso:"
        lsof -i:$port
    else
        echo "   ✅ Puerto $port libre"
    fi
done

echo ""
echo "✅ Limpieza completada!"
echo "🚀 Ahora puedes iniciar tus servicios:"
