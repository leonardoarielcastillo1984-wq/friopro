#!/bin/bash
set -e

echo "☢️  NUCLEAR RESET - Limpiando todo..."

PROJECT_DIR="/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"
cd "$PROJECT_DIR"

echo "1️⃣  Deteniendo Docker..."
docker compose -f infra/docker-compose.yml down 2>/dev/null || true

echo "2️⃣  Eliminando volúmenes..."
docker volume rm infra_postgres_data 2>/dev/null || true
docker volume rm infra_redis_data 2>/dev/null || true

echo "3️⃣  Esperando 5 segundos..."
sleep 5

echo "4️⃣  Levantando Docker limpio..."
docker compose -f infra/docker-compose.yml up -d

echo "5️⃣  Esperando 30 segundos..."
sleep 30

echo "6️⃣  Creando base de datos..."
docker exec infra-postgres-1 psql -U postgres -d postgres << 'SQL'
CREATE USER IF NOT EXISTS sgi WITH SUPERUSER LOGIN PASSWORD 'sgi' CREATEDB CREATEROLE;
CREATE USER IF NOT EXISTS sgi_auditor WITH LOGIN PASSWORD 'sgi_auditor';
CREATE DATABASE sgi OWNER sgi TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C';
\c sgi
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
GRANT CONNECT ON DATABASE sgi TO sgi;
GRANT CONNECT ON DATABASE sgi TO sgi_auditor;
GRANT USAGE ON SCHEMA public TO sgi;
GRANT USAGE ON SCHEMA public TO sgi_auditor;
GRANT CREATE ON SCHEMA public TO sgi;
SELECT 'Database created' as status;
SQL

echo ""
echo "7️⃣  Ejecutando Prisma..."
cd apps/api
npx prisma generate
npx prisma migrate reset --force

echo ""
echo "✅ ¡COMPLETADO!"
