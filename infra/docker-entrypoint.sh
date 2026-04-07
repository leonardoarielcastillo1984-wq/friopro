#!/bin/bash
set -e

# Ejecutar el entrypoint normal de PostgreSQL en background
docker-entrypoint.sh postgres &
POSTGRES_PID=$!

# Esperar a que PostgreSQL esté COMPLETAMENTE listo
echo "Waiting for PostgreSQL to be fully ready..."
for i in {1..60}; do
  if pg_isready -U postgres -h 127.0.0.1 2>/dev/null; then
    echo "PostgreSQL is ready!"
    break
  fi
  sleep 1
done

# Dar permisos TOTALES a postgres en TODAS las bases de datos
echo "Setting up permissions..."
psql -U postgres -h 127.0.0.1 << 'PSQLCMD'
-- Crear BD sgi si no existe
CREATE DATABASE IF NOT EXISTS sgi OWNER postgres ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;

-- Conectar a sgi
\c sgi

-- GRANT TOTAL a postgres
ALTER DATABASE sgi OWNER TO postgres;
ALTER SCHEMA public OWNER TO postgres;
GRANT ALL PRIVILEGES ON DATABASE sgi TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;

SELECT 'PostgreSQL setup complete' as status;
PSQLCMD

echo "Setup complete. PostgreSQL is ready."

# Keep PostgreSQL running
wait $POSTGRES_PID
