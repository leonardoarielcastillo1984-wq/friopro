#!/bin/bash

echo "🔍 Verificando estado de PostgreSQL..."
echo ""

PROJECT_DIR="/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"
cd "$PROJECT_DIR"

echo "1️⃣  Usuarios en PostgreSQL:"
docker exec infra-postgres-1 psql -U postgres -d postgres -c "\du" 2>&1

echo ""
echo "2️⃣  Bases de datos:"
docker exec infra-postgres-1 psql -U postgres -d postgres -c "\l" 2>&1

echo ""
echo "3️⃣  Intentando crear DB como postgres:"
docker exec infra-postgres-1 psql -U postgres -d postgres -c "CREATE DATABASE test_create;" 2>&1

echo ""
echo "4️⃣  Logs del contenedor:"
docker compose -f infra/docker-compose.yml logs postgres | tail -20
