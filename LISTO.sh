#!/bin/bash
set -e

clear
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              SGI 360 - SETUP FINAL DEFINITIVO               ║"
echo "║           (Este script soluciona TODO de una vez)           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

PROJECT_DIR="/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"
cd "$PROJECT_DIR"

echo "PASO 1: Limpiando..."
docker compose -f infra/docker-compose.yml down -v 2>/dev/null || true
sleep 3

echo "PASO 2: Levantando Docker..."
docker compose -f infra/docker-compose.yml up -d
echo "Esperando 45 segundos..."
sleep 45

echo "PASO 3: Creando base de datos y permisos..."
docker exec infra-postgres-1 psql -U postgres << 'SQLCREATE'
-- Crear BD
DROP DATABASE IF EXISTS sgi;
CREATE DATABASE sgi OWNER postgres ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;

-- Cambiar a sgi y crear extensiones
\c sgi
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Usuarios
CREATE USER IF NOT EXISTS sgi WITH SUPERUSER LOGIN ENCRYPTED PASSWORD 'sgi';
CREATE USER IF NOT EXISTS sgi_auditor WITH LOGIN ENCRYPTED PASSWORD 'sgi_auditor';

-- Permisos completos
ALTER DATABASE sgi OWNER TO sgi;
GRANT ALL PRIVILEGES ON DATABASE sgi TO sgi;
GRANT ALL PRIVILEGES ON SCHEMA public TO sgi;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sgi;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sgi;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO sgi;

SELECT 'Database ready' as status;
SQLCREATE

echo "PASO 4: Instalando dependencias..."
pnpm install --frozen-lockfile > /dev/null 2>&1

echo "PASO 5: Ejecutando Prisma..."
cd apps/api
npx prisma generate > /dev/null 2>&1
npx prisma migrate reset --force --skip-generate > /dev/null 2>&1

echo ""
clear
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              ✅  ¡COMPLETAMENTE LISTO!                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🚀 INICIANDO SERVIDOR API..."
echo "   Acceso en: http://localhost:3001"
echo ""
pnpm dev
