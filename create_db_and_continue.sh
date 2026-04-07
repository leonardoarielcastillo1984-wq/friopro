#!/bin/bash

echo "✅ Creando base de datos 'sgi'..."

# Conectarse como postgres (superuser) y crear la base de datos sgi
docker exec infra-postgres-1 psql -U postgres -d postgres << SQL
-- Crear la base de datos sgi
CREATE DATABASE sgi OWNER sgi ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C';

-- Conectar a la nueva base de datos
\c sgi

-- Crear extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Dar permisos
GRANT CONNECT ON DATABASE sgi TO sgi;
GRANT CONNECT ON DATABASE sgi TO sgi_auditor;
GRANT USAGE ON SCHEMA public TO sgi;
GRANT USAGE ON SCHEMA public TO sgi_auditor;
GRANT CREATE ON SCHEMA public TO sgi;

SELECT 'Base de datos sgi creada exitosamente' as status;
SQL

echo ""
echo "✅ Base de datos creada. Ahora ejecutando Prisma..."
echo ""

cd apps/api
npx prisma generate
npx prisma migrate reset --force

echo ""
echo "🎉 ¡Todo completado!"
