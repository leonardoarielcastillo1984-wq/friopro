#!/bin/bash
# Script para limpiar y reiniciar PostgreSQL en SGI 360

set -e  # Exit on error

echo "🔧 SGI 360 - Docker Reset Script"
echo "================================"

# Cambiar a la carpeta del proyecto
PROJECT_DIR="/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"
cd "$PROJECT_DIR"

echo "📁 Directorio: $PROJECT_DIR"
echo ""

# 1. Detener y eliminar containers con volumen
echo "1️⃣  Deteniendo Docker containers..."
docker compose -f infra/docker-compose.yml down -v

# 2. Esperar un poco
echo "   Esperando 5 segundos..."
sleep 5

# 3. Reiniciar
echo ""
echo "2️⃣  Iniciando Docker containers..."
docker compose -f infra/docker-compose.yml up -d

# 4. Esperar a que PostgreSQL esté listo
echo ""
echo "3️⃣  Esperando a que PostgreSQL esté healthy..."
for i in {1..30}; do
  if docker compose -f infra/docker-compose.yml exec -T postgres pg_isready -U sgi -d sgi > /dev/null 2>&1; then
    echo "   ✓ PostgreSQL está listo"
    break
  fi
  echo "   Intento $i/30..."
  sleep 1
done

# 5. Verificar estado
echo ""
echo "4️⃣  Verificando estado de Docker:"
docker compose -f infra/docker-compose.yml ps

# 6. Ejecutar Prisma
echo ""
echo "5️⃣  Ejecutando Prisma setup..."
cd apps/api
npx prisma generate
npx prisma migrate reset --force

echo ""
echo "✅ ¡Setup completado!"
echo ""
echo "📝 Próximos pasos:"
echo "   Terminal 1: cd apps/api && pnpm dev"
echo "   Terminal 2: cd apps/web && pnpm dev"
echo ""
echo "🌐 Accesos:"
echo "   Web: http://localhost:3000"
echo "   API: http://localhost:3001"
