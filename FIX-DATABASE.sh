#!/bin/bash

echo "🔧 Creando base de datos sgi..."

docker exec infra-postgres-1 psql -U postgres -d postgres << 'SQL'
-- Crear base de datos
CREATE DATABASE IF NOT EXISTS sgi OWNER sgi TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C';

-- Crear extensiones
\c sgi
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Permisos
GRANT CONNECT ON DATABASE sgi TO sgi;
GRANT CONNECT ON DATABASE sgi TO sgi_auditor;
GRANT USAGE ON SCHEMA public TO sgi;
GRANT CREATE ON SCHEMA public TO sgi;

SELECT 'Database sgi created successfully' as status;
SQL

echo ""
echo "✅ Base de datos creada"
echo ""
echo "Ahora ejecuta en el terminal del API:"
echo "  pnpm dev"
