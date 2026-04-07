#!/bin/bash

# ================================================
# LANZAR TODO CON DOCKER (RECOMENDADO)
# ================================================

BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$BASE_DIR"

echo "🐳 LANZANDO SGI 360 CON DOCKER"
echo "==============================="
echo ""
echo "✅ ASEGÚRATE QUE DOCKER DESKTOP ESTÁ ABIERTO"
echo ""

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado o no está en el PATH"
    echo "📥 Descargalo desde: https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo "✅ Docker encontrado: $(docker --version)"
echo ""

# Verificar si docker-compose está disponible
if ! command -v docker-compose &> /dev/null; then
    echo "⚠️ docker-compose no está disponible como comando separado"
    echo "ℹ️ Intentando con 'docker compose'..."
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

echo "🚀 Iniciando servicios con: $COMPOSE_CMD"
echo ""
echo "Esto tardará 1-2 minutos la primera vez (descargando imágenes)"
echo ""

# Lanzar docker-compose
$COMPOSE_CMD up

echo ""
echo "✨ Servicios detenidos"
