#!/bin/bash

echo "🚀 SGI 360 - Inicio Automático Completo"
echo "======================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Función para verificar si algo está corriendo
check_port() {
    if lsof -i:$1 > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Función para esperar a que un puerto esté listo
wait_for_port() {
    local port=$1
    local service=$2
    echo -e "${YELLOW}⏳ Esperando que $service esté listo en puerto $port...${NC}"
    
    for i in {1..30}; do
        if check_port $port; then
            echo -e "${GREEN}✅ $service está listo!${NC}"
            return 0
        fi
        sleep 2
        echo -e "${YELLOW}⏳ Esperando... ($i/30)${NC}"
    done
    
    echo -e "${RED}❌ $service no está listo después de 60 segundos${NC}"
    return 1
}

# Función para matar procesos en puertos
kill_port() {
    local port=$1
    if check_port $port; then
        echo -e "${YELLOW}🔪 Liberando puerto $port...${NC}"
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# 1. Verificar Docker
echo -e "${BLUE}[1/8] Verificando Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker no está corriendo. Por favor, iniciá Docker Desktop.${NC}"
    echo -e "${YELLOW}📝 Una vez que Docker Desktop esté listo, ejecutá este script nuevamente.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker está corriendo${NC}"

# 2. Liberar puertos
echo -e "${BLUE}[2/8] Liberando puertos...${NC}"
kill_port 3000
kill_port 3001

# 3. Iniciar infraestructura
echo -e "${BLUE}[3/8] Iniciando PostgreSQL y Redis...${NC}"
cd "$ROOT"
docker compose -f infra/docker-compose.yml down -v 2>/dev/null || true
docker compose -f infra/docker-compose.yml up -d

# 4. Esperar a que PostgreSQL esté healthy
echo -e "${BLUE}[4/8] Esperando PostgreSQL...${NC}"
sleep 15
for i in {1..20}; do
    if docker compose -f infra/docker-compose.yml ps | grep -q "healthy"; then
        echo -e "${GREEN}✅ PostgreSQL está healthy${NC}"
        break
    fi
    if [ $i -eq 20 ]; then
        echo -e "${RED}❌ PostgreSQL no está healthy. Reiniciando...${NC}"
        docker compose -f infra/docker-compose.yml restart postgres
        sleep 10
    fi
    sleep 2
done

# 5. Configurar permisos de base de datos
echo -e "${BLUE}[5/8] Configurando base de datos...${NC}"
docker exec -it sgi360-postgres-1 psql -U postgres -c "CREATE USER sgi WITH PASSWORD 'sgi';" 2>/dev/null || echo "Usuario sgi ya existe"
docker exec -it sgi360-postgres-1 psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE sgi TO sgi;" 2>/dev/null || echo "Permisos sgi ya configurados"
docker exec -it sgi360-postgres-1 psql -U postgres -c "CREATE USER sgi_auditor WITH PASSWORD 'sgi_auditor';" 2>/dev/null || echo "Usuario sgi_auditor ya existe"
docker exec -it sgi360-postgres-1 psql -U postgres -c "GRANT CONNECT ON DATABASE sgi TO sgi_auditor;" 2>/dev/null || echo "Permisos sgi_auditor ya configurados"

# 6. Preparar base de datos
echo -e "${BLUE}[6/8] Preparando base de datos...${NC}"
cd apps/api
npx prisma generate
npx prisma migrate reset --force --skip-seed
npm run seed:all

# 7. Configurar variables de entorno
echo -e "${BLUE}[7/8] Configurando variables de entorno...${NC}"
cd "$ROOT"
echo "NEXT_PUBLIC_API_URL=http://localhost:3000" > apps/web/.env
echo "HOST=127.0.0.1" >> apps/api/.env
echo "CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000" >> apps/api/.env

# 8. Iniciar servicios automáticamente
echo -e "${BLUE}[8/8] Iniciando servicios...${NC}"

# Iniciar API en background
echo -e "${YELLOW}📡 Iniciando API...${NC}"
cd "$ROOT/apps/api"
nohup pnpm dev > api.log 2>&1 &
API_PID=$!

# Esperar a que API esté listo
if wait_for_port 3001 "API"; then
    echo -e "${GREEN}✅ API está corriendo${NC}"
else
    echo -e "${RED}❌ Error al iniciar API. Revisá api.log${NC}"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

# Iniciar Web en background
echo -e "${YELLOW}🌐 Iniciando Web...${NC}"
cd "$ROOT/apps/web"
nohup pnpm dev > web.log 2>&1 &
WEB_PID=$!

# Esperar a que Web esté listo
if wait_for_port 3000 "Web"; then
    echo -e "${GREEN}✅ Web está corriendo${NC}"
else
    echo -e "${RED}❌ Error al iniciar Web. Revisá web.log${NC}"
    kill $API_PID $WEB_PID 2>/dev/null || true
    exit 1
fi

# Guardar PIDs para poder detener después
echo "$API_PID" > "$ROOT/.api-pid"
echo "$WEB_PID" > "$ROOT/.web-pid"

# Resumen final
echo ""
echo -e "${GREEN}🎉 ¡SGI 360 está corriendo automáticamente!${NC}"
echo "======================================="
echo -e "${BLUE}📍 Accesos:${NC}"
echo -e "   🌐 Web: ${YELLOW}http://localhost:3000${NC}"
echo -e "   📡 API: ${YELLOW}http://localhost:3001${NC}"
echo -e "   📚 Docs: ${YELLOW}http://localhost:3001/docs${NC}"
echo ""
echo -e "${BLUE}🔐 Credenciales:${NC}"
echo -e "   👤 Super Admin: ${YELLOW}admin@sgi360.com${NC} / ${YELLOW}Admin123!${NC}"
echo -e "   👤 Usuario Demo: ${YELLOW}usuario@demo.com${NC} / ${YELLOW}User123!${NC}"
echo ""
echo -e "${BLUE}📋 Logs:${NC}"
echo -e "   📡 API: ${YELLOW}api.log${NC}"
echo -e "   🌐 Web: ${YELLOW}web.log${NC}"
echo ""
echo -e "${BLUE}🛑 Para detener todo:${NC}"
echo -e "   ${YELLOW}./auto-stop.sh${NC}"
echo ""

# Abrir navegador automáticamente (opcional)
if command -v open > /dev/null; then
    echo -e "${BLUE}🌐 Abriendo navegador...${NC}"
    sleep 2
    open http://localhost:3000
elif command -v xdg-open > /dev/null; then
    echo -e "${BLUE}🌐 Abriendo navegador...${NC}"
    sleep 2
    xdg-open http://localhost:3000
fi

echo -e "${GREEN}✅ ¡Listo para trabajar!${NC}"
