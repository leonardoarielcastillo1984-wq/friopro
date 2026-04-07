#!/bin/bash
# Script para corregir permisos de PostgreSQL en SGI 360

set -e

echo "🔐 Corrigiendo permisos de PostgreSQL..."
echo "========================================="

PROJECT_DIR="/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"
cd "$PROJECT_DIR"

# 1. Conectar a PostgreSQL como postgres (superuser) y otorgar permisos
echo ""
echo "1️⃣  Verificando y corrigiendo permisos del usuario 'sgi'..."

docker exec infra-postgres-1 psql -U postgres -d postgres << 'EOF'
-- Asegurar que el usuario sgi existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgi') THEN
    CREATE ROLE sgi WITH LOGIN PASSWORD 'sgi';
    RAISE NOTICE 'Usuario sgi creado';
  ELSE
    ALTER USER sgi WITH PASSWORD 'sgi';
    RAISE NOTICE 'Usuario sgi ya existe, contraseña actualizada';
  END IF;
END$$;

-- Dar permisos de superuser
ALTER USER sgi WITH SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS;

-- Confirmación
\du+ sgi
EOF

echo ""
echo "2️⃣  Eliminando base de datos 'sgi' si existe (para empezar limpio)..."
docker exec infra-postgres-1 psql -U postgres -d postgres << 'EOF'
DROP DATABASE IF EXISTS sgi;
SELECT 'Base de datos eliminada' as resultado;
EOF

echo ""
echo "3️⃣  Esperando 2 segundos..."
sleep 2

echo ""
echo "✅ Permisos corregidos. Ahora ejecutando Prisma..."
echo ""

cd "$PROJECT_DIR/apps/api"
npx prisma migrate reset --force

echo ""
echo "🎉 ¡Completado!"
