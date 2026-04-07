#!/bin/bash

# SGI 360 - Script Completo de Prueba y Configuración
# Este script valida y configura todo el proyecto para poder probarlo

set -e  # Detener si hay errores

echo "🚀 SGI 360 - Configuración y Prueba Completa"
echo "=========================================="

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Función para verificar Docker
check_docker() {
    echo -e "${BLUE}[1/8] Verificando Docker...${NC}"
    
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker Desktop no está corriendo${NC}"
        echo -e "${YELLOW}👆 Por favor, iniciá Docker Desktop y esperá 30 segundos${NC}"
        echo -e "${YELLOW}   Luego ejecutá este script nuevamente${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Docker está corriendo${NC}"
}

# Función para liberar puertos
free_ports() {
    echo -e "${BLUE}[2/8] Liberando puertos...${NC}"
    
    lsof -ti:5432 | xargs kill -9 2>/dev/null || true
    lsof -ti:6379 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    
    echo -e "${GREEN}✅ Puertos liberados${NC}"
}

# Función para iniciar infraestructura
start_infra() {
    echo -e "${BLUE}[3/8] Iniciando infraestructura Docker...${NC}"
    
    cd "$ROOT"
    docker compose -f infra/docker-compose.yml down
    docker compose -f infra/docker-compose.yml up -d
    
    echo -e "${YELLOW}⏳ Esperando que la base de datos esté lista...${NC}"
    sleep 15
    
    # Verificar que PostgreSQL esté healthy
    local retries=0
    while [ $retries -lt 30 ]; do
        if docker compose -f infra/docker-compose.yml ps postgres | grep -q "healthy"; then
            echo -e "${GREEN}✅ PostgreSQL está healthy${NC}"
            break
        fi
        sleep 2
        retries=$((retries + 1))
    done
    
    if [ $retries -eq 30 ]; then
        echo -e "${RED}❌ PostgreSQL no está healthy después de 60 segundos${NC}"
        docker compose -f infra/docker-compose.yml logs postgres
        exit 1
    fi
    
    echo -e "${GREEN}✅ Infraestructura iniciada${NC}"
}

# Función para configurar permisos de PostgreSQL
setup_postgres_permissions() {
    echo -e "${BLUE}[4/8] Configurando permisos de PostgreSQL...${NC}"
    
    # Esperar un poco más para asegurar que PostgreSQL esté completamente listo
    sleep 5
    
    # Verificar conexión y configurar permisos
    docker exec -it infra-postgres-1 psql -U sgi -d sgi -c "SELECT current_user;" >/dev/null 2>&1 || {
        echo -e "${RED}❌ No se puede conectar a PostgreSQL${NC}"
        docker compose -f infra/docker-compose.yml logs postgres
        exit 1
    }
    
    # Configurar permisos completos
    docker exec -it infra-postgres-1 psql -U sgi -d sgi -c "
        ALTER USER sgi SUPERUSER;
        GRANT ALL ON SCHEMA public TO sgi;
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sgi;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sgi;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sgi;
    " >/dev/null 2>&1
    
    echo -e "${GREEN}✅ Permisos configurados${NC}"
}

# Función para configurar Prisma
setup_prisma() {
    echo -e "${BLUE}[5/8] Configurando Prisma...${NC}"
    
    cd "$ROOT/apps/api"
    
    # Generar cliente Prisma
    echo -e "${YELLOW}   Generando cliente Prisma...${NC}"
    npx prisma generate
    
    # Resetear y aplicar migraciones
    echo -e "${YELLOW}   Aplicando migraciones...${NC}"
    npx prisma migrate reset --force --skip-seed
    
    echo -e "${GREEN}✅ Prisma configurado${NC}"
}

# Función para cargar datos de seed
load_seed_data() {
    echo -e "${BLUE}[6/8] Cargando datos de prueba...${NC}"
    
    cd "$ROOT/apps/api"
    
    # Cargar planes
    echo -e "${YELLOW}   Cargando planes...${NC}"
    npx tsx scripts/seedPlans.ts
    
    # Cargar usuarios
    echo -e "${YELLOW}   Cargando usuarios...${NC}"
    npx tsx scripts/seedUsers.ts
    
    # Cargar datos de demo
    echo -e "${YELLOW}   Cargando datos de demo...${NC}"
    npx tsx scripts/seedDemoData.ts
    
    echo -e "${GREEN}✅ Datos de prueba cargados${NC}"
}

# Función para iniciar servicios
start_services() {
    echo -e "${BLUE}[7/8] Iniciando servicios API y Web...${NC}"
    
    # Limpiar archivos PID antiguos
    rm -f "$ROOT/.api-pid" "$ROOT/.web-pid"
    
    # Iniciar API en background
    echo -e "${YELLOW}   Iniciando API...${NC}"
    cd "$ROOT/apps/api"
    nohup pnpm dev > "$ROOT/api.log" 2>&1 &
    echo $! > "$ROOT/.api-pid"
    
    # Iniciar Web en background
    echo -e "${YELLOW}   Iniciando Web...${NC}"
    cd "$ROOT/apps/web"
    nohup pnpm dev > "$ROOT/web.log" 2>&1 &
    echo $! > "$ROOT/.web-pid"
    
    # Esperar que los servicios inicien
    echo -e "${YELLOW}⏳ Esperando que los servicios inicien...${NC}"
    sleep 10
    
    # Verificar que los servicios estén corriendo
    if ! ps -p $(cat "$ROOT/.api-pid") > /dev/null 2>&1; then
        echo -e "${RED}❌ API no inició correctamente${NC}"
        echo -e "${YELLOW}📋 Revisá los logs en: $ROOT/api.log${NC}"
        exit 1
    fi
    
    if ! ps -p $(cat "$ROOT/.web-pid") > /dev/null 2>&1; then
        echo -e "${RED}❌ Web no inició correctamente${NC}"
        echo -e "${YELLOW}📋 Revisá los logs en: $ROOT/web.log${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Servicios iniciados${NC}"
}

# Función para probar la aplicación
test_app() {
    echo -e "${BLUE}[8/8] Probando la aplicación...${NC}"
    
    # Probar API health
    echo -e "${YELLOW}   Probando API health...${NC}"
    local api_health=0
    for i in {1..30}; do
        if curl -s http://localhost:3001/health | grep -q "ok"; then
            api_health=1
            break
        fi
        sleep 1
    done
    
    if [ $api_health -eq 0 ]; then
        echo -e "${RED}❌ API health check failed${NC}"
        echo -e "${YELLOW}📋 Revisá los logs en: $ROOT/api.log${NC}"
        exit 1
    fi
    
    # Probar Web
    echo -e "${YELLOW}   Probando Web...${NC}"
    local web_health=0
    for i in {1..30}; do
        if curl -s http://localhost:3000 | grep -q "SGI 360"; then
            web_health=1
            break
        fi
        sleep 1
    done
    
    if [ $web_health -eq 0 ]; then
        echo -e "${RED}❌ Web health check failed${NC}"
        echo -e "${YELLOW}📋 Revisá los logs en: $ROOT/web.log${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Aplicación probada exitosamente${NC}"
}

# Función para mostrar resumen
show_summary() {
    echo ""
    echo -e "${GREEN}🎉 ¡SGI 360 está corriendo correctamente!${NC}"
    echo ""
    echo -e "${BLUE}📋 Accesos:${NC}"
    echo -e "   ${YELLOW}• Web App:${NC} http://localhost:3000"
    echo -e "   ${YELLOW}• API:${NC}     http://localhost:3001"
    echo -e "   ${YELLOW}• API Health:${NC} http://localhost:3001/health"
    echo ""
    echo -e "${BLUE}👤 Usuarios de prueba:${NC}"
    echo -e "   ${YELLOW}• Admin:${NC}   admin@sgi360.com / Admin123!"
    echo -e "   ${YELLOW}• Usuario:${NC} usuario@demo.com / User123!"
    echo ""
    echo -e "${BLUE}📁 Logs:${NC}"
    echo -e "   ${YELLOW}• API:${NC} $ROOT/api.log"
    echo -e "   ${YELLOW}• Web:${NC} $ROOT/web.log"
    echo ""
    echo -e "${BLUE}🛑 Para detener:${NC}"
    echo -e "   ${YELLOW}./stop-all.sh${NC}"
    echo ""
    echo -e "${GREEN}🌐 Abriendo navegador...${NC}"
    open http://localhost:3000
}

# Ejecutar funciones
check_docker
free_ports
start_infra
setup_postgres_permissions
setup_prisma
load_seed_data
start_services
test_app
show_summary
