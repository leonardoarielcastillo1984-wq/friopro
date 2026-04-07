#!/bin/bash

echo "🛑 SGI 360 - Deteniendo Servicios Automáticos"
echo "=========================================="

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Función para detener proceso por PID
stop_process() {
    local pid_file=$1
    local service_name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${YELLOW}🛑 Deteniendo $service_name (PID: $pid)...${NC}"
            kill $pid
            sleep 3
            
            # Forzar si no se detiene
            if ps -p $pid > /dev/null 2>&1; then
                echo -e "${RED}🔨 Forzando detención de $service_name...${NC}"
                kill -9 $pid 2>/dev/null || true
            fi
            
            echo -e "${GREEN}✅ $service_name detenido${NC}"
        else
            echo -e "${YELLOW}⚠️ $service_name no estaba corriendo${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}⚠️ No se encontró PID para $service_name${NC}"
    fi
}

# Detener servicios por PID
echo -e "${BLUE}[1/4] Deteniendo servicios por PID...${NC}"
stop_process "$ROOT/.api-pid" "API"
stop_process "$ROOT/.web-pid" "Web"

# Liberar puertos por si acaso
echo -e "${BLUE}[2/4] Liberando puertos...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Detener contenedores Docker
echo -e "${BLUE}[3/4] Deteniendo Docker...${NC}"
cd "$ROOT"
docker compose -f infra/docker-compose.yml down

# Limpiar logs (opcional)
echo -e "${BLUE}[4/4] Limpiando...${NC}"
rm -f "$ROOT/.api-pid" "$ROOT/.web-pid" 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Todo detenido correctamente${NC}"
echo ""
echo -e "${BLUE}📋 Para iniciar nuevamente:${NC}"
echo -e "   ${YELLOW}./auto-start.sh${NC}"
echo ""
