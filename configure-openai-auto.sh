#!/bin/bash

# ============================================================
# CONFIGURACIÓN AUTOMÁTICA DE OPENAI EN PRODUCCIÓN
# ============================================================
# Este script configura automáticamente la API key de OpenAI
# en el servidor de producción sin intervención manual
# ============================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Función para verificar si estamos en producción
check_production() {
    if [[ ! -d "/root/friopro" ]]; then
        print_error "Este script debe ejecutarse en producción (/root/friopro)"
        exit 1
    fi
    print_success "Entorno de producción verificado"
}

# Función para verificar docker compose
check_docker() {
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        print_error "Docker Compose no disponible"
        exit 1
    fi
    print_success "Usando: $DOCKER_COMPOSE"
}

# Función para verificar API key
validate_api_key() {
    local api_key="$1"
    if [[ ! "$api_key" =~ ^sk-[a-zA-Z0-9]{48}$ ]]; then
        print_error "API key inválida. Debe tener formato sk-... (51 caracteres)"
        exit 1
    fi
    print_success "API key válida"
}

# Función para hacer backup
backup_files() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    cp docker-compose.yml docker-compose.yml.backup_$timestamp
    print_success "Backup creado: docker-compose.yml.backup_$timestamp"
}

# Función para configurar OpenAI
configure_openai() {
    local api_key="$1"
    
    print_status "Configurando API key de OpenAI..."
    
    # Verificar si OPENAI_API_KEY ya existe
    if grep -q "OPENAI_API_KEY=" docker-compose.yml; then
        print_warning "OPENAI_API_KEY ya existe. Actualizando..."
        # Reemplazar la línea existente
        sed -i "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=$api_key/" docker-compose.yml
    else
        print_status "Agregando nueva OPENAI_API_KEY..."
        # Agregar después de GROQ_API_KEY
        sed -i "/GROQ_API_KEY=/a\\      - OPENAI_API_KEY=$api_key" docker-compose.yml
    fi
    
    print_success "API key de OpenAI configurada"
}

# Función para reconstruir servicios
rebuild_services() {
    print_status "Reconstruyendo servicios..."
    
    $DOCKER_COMPOSE stop api
    print_success "Contenedor API detenido"
    
    $DOCKER_COMPOSE build api
    print_success "Imagen API reconstruida"
    
    $DOCKER_COMPOSE up -d api
    print_success "Contenedor API iniciado"
}

# Función para verificar configuración
verify_configuration() {
    print_status "Verificando configuración..."
    
    # Esperar que el contenedor inicie
    sleep 15
    
    # Verificar que el contenedor está corriendo
    if $DOCKER_COMPOSE ps | grep -q "sgi-api.*Up"; then
        print_success "Contenedor API está corriendo"
    else
        print_error "Contenedor API no está corriendo"
        $DOCKER_COMPOSE logs sgi-api --tail=20
        exit 1
    fi
    
    # Verificar logs para OpenAI
    if $DOCKER_COMPOSE logs sgi-api --tail=50 | grep -q "OPENAI_API_KEY"; then
        print_success "API key de OpenAI cargada correctamente"
    else
        print_warning "No se pudo verificar la API key en los logs (puede ser normal)"
    fi
}

# Función para mostrar URLs finales
show_urls() {
    echo ""
    print_success "🎉 CONFIGURACIÓN COMPLETADA!"
    echo ""
    echo "🌐 URLs de acceso:"
    echo "   • Frontend: https://www.logismart.ar/command-center"
    echo "   • API Health: https://www.logismart.ar/api/command-center/health"
    echo ""
    echo "🔍 Para verificar OpenAI:"
    echo "   docker compose logs sgi-api --tail=20 | grep -i openai"
    echo ""
}

# Función principal
main() {
    echo "🚀 CONFIGURACIÓN AUTOMÁTICA DE OPENAI - PRODUCCIÓN"
    echo "=================================================="
    echo ""
    
    # Verificar entorno
    check_production
    check_docker
    
    # Solicitar API key
    echo -n "🔑 Ingresa tu API key de OpenAI (sk-...): "
    read -s api_key
    echo ""
    
    # Validar API key
    validate_api_key "$api_key"
    
    # Backup
    backup_files
    
    # Configurar
    configure_openai "$api_key"
    
    # Reconstruir
    rebuild_services
    
    # Verificar
    verify_configuration
    
    # Mostrar URLs
    show_urls
}

# Ejecutar función principal
main "$@"
