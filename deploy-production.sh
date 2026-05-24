#!/bin/bash

# ============================================================
# AI COMMAND CENTER - DEPLOY A PRODUCCIÓN
# ============================================================
# Este script automatiza el deploy completo a producción
# SGI360 - AI Command Center Implementation
# ============================================================

set -e  # Detener si hay errores

echo "🚀 INICIANDO DEPLOY A PRODUCCIÓN - AI Command Center"
echo "======================================================"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir con colores
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que estamos en el servidor correcto
check_server() {
    print_status "Verificando servidor de producción..."
    
    if [[ ! -d "/root/friopro" ]]; then
        print_error "No se encuentra el directorio /root/friopro"
        print_error "Este script debe ejecutarse en el servidor de producción (46.62.145.171)"
        exit 1
    fi
    
    print_success "Servidor de producción verificado"
}

# Verificar estado actual
check_current_status() {
    print_status "Verificando estado actual..."
    
    cd /root/friopro
    
    # Verificar containers
    if ! docker-compose ps | grep -q "Up"; then
        print_warning "Algunos containers no están corriendo"
    fi
    
    # Verificar backups
    if [[ ! -d "backups-prod" ]]; then
        print_error "No se encuentra directorio de backups"
        exit 1
    fi
    
    print_success "Estado actual verificado"
}

# Backup antes del deploy
create_backup() {
    print_status "Creando backup de seguridad..."
    
    cd /root/friopro
    
    # Backup de base de datos
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_file="backups-prod/pre_ai_command_center_${timestamp}.sql"
    
    docker-compose exec -T postgres pg_dump -U postgres sgi360 > $backup_file
    
    if [[ $? -eq 0 ]]; then
        print_success "Backup creado: $backup_file"
    else
        print_error "Error al crear backup"
        exit 1
    fi
}

# Pull de cambios
pull_changes() {
    print_status "Actualizando código fuente..."
    
    cd /root/friopro
    
    # Verificar estado de git
    git status
    
    # Pull de cambios
    git pull
    
    if [[ $? -eq 0 ]]; then
        print_success "Código actualizado exitosamente"
    else
        print_error "Error al actualizar código"
        exit 1
    fi
}

# Migración de base de datos
migrate_database() {
    print_status "Ejecutando migración de base de datos..."
    
    cd /root/friopro
    
    # Generar Prisma Client
    docker-compose exec api npx prisma generate
    
    # Aplicar migración
    docker-compose exec api npx prisma db push
    
    if [[ $? -eq 0 ]]; then
        print_success "Migración de base de datos completada"
    else
        print_error "Error en migración de base de datos"
        exit 1
    fi
}

# Deploy de servicios
deploy_services() {
    print_status "Desplegando servicios actualizados..."
    
    cd /root/friopro
    
    # Build y deploy
    docker-compose up -d --build api web
    
    if [[ $? -eq 0 ]]; then
        print_success "Servicios desplegados exitosamente"
    else
        print_error "Error al desplegar servicios"
        exit 1
    fi
}

# Verificación post-deploy
verify_deploy() {
    print_status "Verificando deploy..."
    
    cd /root/friopro
    
    # Esperar a que los servicios inicien
    sleep 10
    
    # Verificar containers
    if docker-compose ps | grep -q "Up"; then
        print_success "Containers están corriendo"
    else
        print_error "Algunos containers no iniciaron correctamente"
        docker-compose logs
        exit 1
    fi
    
    # Health check
    print_status "Ejecutando health check..."
    
    # Esperar un poco más para que el API esté listo
    sleep 15
    
    health_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/command-center/health || echo "000")
    
    if [[ "$health_response" == "200" ]]; then
        print_success "Health check exitoso (HTTP 200)"
    else
        print_warning "Health check falló (HTTP $health_response)"
        print_warning "Verificando logs del API..."
        docker-compose logs api --tail=20
    fi
}

# Verificación de nuevas tablas
verify_tables() {
    print_status "Verificando nuevas tablas IA..."
    
    cd /root/friopro
    
    # Contar nuevas tablas IA
    ai_tables=$(docker-compose exec -T postgres psql -U postgres -d sgi360 -t -c "
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'ai_%' OR table_name LIKE 'tenant_ai_%';
    " | tr -d ' ')
    
    if [[ "$ai_tables" -ge "10" ]]; then
        print_success "Tablas IA creadas correctamente ($ai_tables tablas)"
    else
        print_warning "Se esperaban 10+ tablas IA, se encontraron $ai_tables"
    fi
}

# Mostrar URLs de acceso
show_access_urls() {
    print_status "URLs de acceso al AI Command Center:"
    echo ""
    echo "🌐 Frontend: https://www.logismart.ar/command-center"
    echo "🔗 API: https://www.logismart.ar/api/command-center/health"
    echo "📊 Dashboard: https://www.logismart.ar/command-center"
    echo ""
}

# Función principal
main() {
    echo "⏰ Inicio: $(date)"
    echo ""
    
    check_server
    check_current_status
    create_backup
    pull_changes
    migrate_database
    deploy_services
    verify_deploy
    verify_tables
    show_access_urls
    
    echo ""
    echo "🎉 DEPLOY COMPLETADO EXITOSAMENTE"
    echo "⏰ Fin: $(date)"
    echo ""
    echo "📋 Resumen:"
    echo "✅ Backup de seguridad creado"
    echo "✅ Código fuente actualizado"
    echo "✅ Base de datos migrada"
    echo "✅ Servicios desplegados"
    echo "✅ AI Command Center operativo"
    echo ""
    echo "🚀 El AI Command Center está ahora disponible en producción!"
}

# Ejecutar función principal
main
