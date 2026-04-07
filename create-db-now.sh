#!/bin/bash
set -e

echo "🔧 Creando base de datos SGI 360..."
echo ""

docker exec -it infra-postgres-1 psql -U postgres << 'EOF'
-- Eliminar si existe
DROP DATABASE IF EXISTS sgi;

-- Crear nueva
CREATE DATABASE sgi OWNER postgres ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;

-- Extensiones
\c sgi
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Usuarios
CREATE USER IF NOT EXISTS sgi WITH LOGIN ENCRYPTED PASSWORD 'sgi';
CREATE USER IF NOT EXISTS sgi_auditor WITH LOGIN ENCRYPTED PASSWORD 'sgi_auditor';

-- Permisos
GRANT ALL PRIVILEGES ON DATABASE sgi TO sgi;
GRANT USAGE ON SCHEMA public TO sgi;
GRANT CREATE ON SCHEMA public TO sgi;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sgi;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sgi;

SELECT 'Base de datos lista' as status;
EOF

echo ""
echo "✅ Base de datos creada correctamente"
