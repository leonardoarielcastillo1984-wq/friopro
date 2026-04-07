#!/bin/bash
set -e

clear
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   SGI 360 - SETUP FINAL                    ║"
echo "║              Configuración completa en progreso...         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

PROJECT_DIR="/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"
cd "$PROJECT_DIR"

# ============ PASO 1: LIMPIAR TODO ============
echo "⏳ PASO 1/6: Limpieza completa..."
docker compose -f infra/docker-compose.yml down 2>/dev/null || true
sleep 2
docker volume rm infra_postgres_data infra_redis_data 2>/dev/null || true
sleep 2
echo "   ✅ Limpieza completada"
echo ""

# ============ PASO 2: INICIAR DOCKER ============
echo "⏳ PASO 2/6: Iniciando servicios Docker..."
docker compose -f infra/docker-compose.yml up -d
echo "   Esperando a que PostgreSQL esté listo (40 segundos)..."
sleep 40
echo "   ✅ Docker iniciado"
echo ""

# ============ PASO 3: CREAR BASE DE DATOS ============
echo "⏳ PASO 3/6: Inicializando PostgreSQL..."
docker exec infra-postgres-1 psql -U postgres -d postgres << 'SQLBLOCK'
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
SQLBLOCK
echo "   ✅ PostgreSQL configurado"
echo ""

# ============ PASO 4: INSTALAR DEPENDENCIAS ============
echo "⏳ PASO 4/6: Instalando dependencias (esto puede tomar un minuto)..."
pnpm install --frozen-lockfile > /dev/null 2>&1
echo "   ✅ Dependencias instaladas"
echo ""

# ============ PASO 5: CONFIGURAR VARIABLES ============
echo "⏳ PASO 5/6: Configurando variables de entorno..."
[ ! -f "apps/api/.env" ] && cp apps/api/.env.example apps/api/.env
[ ! -f "apps/web/.env" ] && cp apps/web/.env.example apps/web/.env
echo "   ✅ Variables configuradas"
echo ""

# ============ PASO 6: PRISMA SETUP ============
echo "⏳ PASO 6/6: Configurando Prisma y base de datos..."
cd apps/api
npx prisma generate > /dev/null 2>&1
npx prisma migrate reset --force --skip-generate > /dev/null 2>&1
cd ../..
echo "   ✅ Prisma completado"
echo ""

# ============ COMPLETADO ============
clear
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              ✅  SETUP COMPLETADO CON ÉXITO               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📝 PRÓXIMOS PASOS - Abre DOS terminales nuevas:"
echo ""
echo "┌─ Terminal 1 (API) ──────────────────────────────────────┐"
echo "│ cd \"$PROJECT_DIR/apps/api\"                              │"
echo "│ pnpm dev                                                │"
echo "└─────────────────────────────────────────────────────────┘"
echo ""
echo "┌─ Terminal 2 (Web) ──────────────────────────────────────┐"
echo "│ cd \"$PROJECT_DIR/apps/web\"                              │"
echo "│ pnpm dev                                                │"
echo "└─────────────────────────────────────────────────────────┘"
echo ""
echo "🌐 ACCESOS:"
echo "   • Web:       http://localhost:3000"
echo "   • API:       http://localhost:3001"
echo "   • API Docs:  http://localhost:3001/docs"
echo ""
echo "🔐 CREDENCIALES:"
echo "   • Admin: admin@sgi360.com / Admin123!"
echo "   • Demo:  usuario@demo.com / User123!"
echo ""
echo "🎉 ¡Listo para desarrollar!"
echo ""
