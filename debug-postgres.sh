#!/bin/bash
# Script de debug para verificar permisos en PostgreSQL

PROJECT_DIR="/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"
cd "$PROJECT_DIR"

echo "🔍 Verificando estado de PostgreSQL..."
echo ""

# 1. Ver estado de docker
echo "1️⃣  Estado de Docker:"
docker compose -f infra/docker-compose.yml ps
echo ""

# 2. Conectar y verificar usuario
echo "2️⃣  Verificando usuario 'sgi':"
docker exec infra-postgres-1 psql -U sgi -d postgres -c "\du+" 2>&1 || echo "❌ Error al conectar"
echo ""

# 3. Intentar crear una base de datos manualmente
echo "3️⃣  Intentando crear base de datos manualmente:"
docker exec infra-postgres-1 psql -U sgi -d postgres -c "CREATE DATABASE test_db;" 2>&1
echo ""

# 4. Ver bases de datos existentes
echo "4️⃣  Bases de datos existentes:"
docker exec infra-postgres-1 psql -U sgi -d postgres -c "\l" 2>&1
echo ""

# 5. Ver archivos de inicialización ejecutados
echo "5️⃣  Archivos en postgres-init:"
ls -la infra/postgres-init/
echo ""

# 6. Ver logs del contenedor
echo "6️⃣  Últimos logs de PostgreSQL:"
docker compose -f infra/docker-compose.yml logs postgres | tail -30
