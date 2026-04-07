#!/bin/bash

################################################################################
#  DIAGNÓSTICO COMPLETO - VALIDA QUE TODO ESTÁ EN ORDEN ANTES DE INICIAR
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║ $1"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

print_check() {
  echo -e "${GREEN}✅${NC} $1"
}

print_error() {
  echo -e "${RED}❌${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠️${NC} $1"
}

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

print_header "DIAGNÓSTICO SGI 360"

echo -e "${CYAN}Proyecto:${NC} $PROJECT_DIR"
echo ""

# ============================================================================
# VERIFICAR ESTRUCTURA
# ============================================================================

print_header "1. ESTRUCTURA DEL PROYECTO"

if [ -d "apps/api" ]; then
  print_check "apps/api existe"
else
  print_error "apps/api NO existe"
  exit 1
fi

if [ -d "apps/web" ]; then
  print_check "apps/web existe"
else
  print_error "apps/web NO existe"
  exit 1
fi

if [ -f "apps/api/package.json" ]; then
  print_check "apps/api/package.json existe"
else
  print_error "apps/api/package.json NO existe"
  exit 1
fi

if [ -f "apps/web/package.json" ]; then
  print_check "apps/web/package.json existe"
else
  print_error "apps/web/package.json NO existe"
  exit 1
fi

# ============================================================================
# VERIFICAR ARCHIVOS .env
# ============================================================================

print_header "2. ARCHIVOS .env"

if [ -f "apps/api/.env" ]; then
  print_check "apps/api/.env existe"
  if grep -q "PORT=3002" apps/api/.env; then
    print_check "PORT=3002 correcto"
  else
    print_error "PORT no es 3002"
  fi
  if grep -q "DATABASE_URL=postgresql://sgi:sgidev123@localhost:5432" apps/api/.env; then
    print_check "DATABASE_URL apunta a localhost"
  else
    print_warning "DATABASE_URL no apunta a localhost (podría ser Docker)"
  fi
else
  print_error "apps/api/.env NO existe"
  exit 1
fi

if [ -f "apps/web/.env" ]; then
  print_check "apps/web/.env existe"
  if grep -q "NEXT_PUBLIC_API_URL=http://localhost:3002" apps/web/.env; then
    print_check "NEXT_PUBLIC_API_URL=http://localhost:3002 correcto"
  else
    print_error "NEXT_PUBLIC_API_URL no es http://localhost:3002"
  fi
else
  print_error "apps/web/.env NO existe"
  exit 1
fi

# ============================================================================
# VERIFICAR HERRAMIENTAS DEL SISTEMA
# ============================================================================

print_header "3. HERRAMIENTAS DEL SISTEMA"

if command -v node &> /dev/null; then
  print_check "Node.js $(node -v)"
else
  print_error "Node.js no instalado"
  exit 1
fi

if command -v npm &> /dev/null; then
  print_check "npm $(npm -v)"
else
  print_error "npm no instalado"
  exit 1
fi

if command -v docker &> /dev/null; then
  print_check "Docker instalado"
else
  print_error "Docker no instalado"
  exit 1
fi

# ============================================================================
# VERIFICAR PERMISOS
# ============================================================================

print_header "4. PERMISOS"

if [ -w "$PROJECT_DIR" ]; then
  print_check "Permiso de escritura en proyecto"
else
  print_error "NO hay permiso de escritura en proyecto"
  exit 1
fi

if [ -w "/tmp" ]; then
  print_check "Permiso de escritura en /tmp"
else
  print_error "NO hay permiso de escritura en /tmp"
  exit 1
fi

# ============================================================================
# VERIFICAR DOCKER
# ============================================================================

print_header "5. DOCKER"

if docker ps &> /dev/null; then
  print_check "Docker daemon está corriendo"
else
  print_error "Docker daemon NO está corriendo"
  echo "Solución: Abre Docker Desktop"
  exit 1
fi

# ============================================================================
# VERIFICAR BASE DE DATOS
# ============================================================================

print_header "6. BASE DE DATOS"

if docker ps | grep -q "sgi360-postgres\|postgres:16"; then
  print_check "PostgreSQL está corriendo"
else
  print_warning "PostgreSQL no está corriendo (se levantará automáticamente)"
fi

if docker ps | grep -q "sgi360-redis\|redis:7"; then
  print_check "Redis está corriendo"
else
  print_warning "Redis no está corriendo (se levantará automáticamente)"
fi

# ============================================================================
# VERIFICAR PUERTOS DISPONIBLES
# ============================================================================

print_header "7. PUERTOS DISPONIBLES"

# Verificar puerto 3002
if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  print_warning "Puerto 3002 OCUPADO (se detendrá automáticamente)"
else
  print_check "Puerto 3002 disponible"
fi

# Verificar puerto 3000
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  print_warning "Puerto 3000 OCUPADO (se detendrá automáticamente)"
else
  print_check "Puerto 3000 disponible"
fi

# Verificar puerto 5432
if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  print_check "Puerto 5432 en uso (PostgreSQL)"
else
  print_warning "Puerto 5432 no en uso"
fi

# ============================================================================
# VERIFICAR ESPACIO EN DISCO
# ============================================================================

print_header "8. ESPACIO EN DISCO"

SPACE=$(df "$PROJECT_DIR" | tail -1 | awk '{print $4}')
if [ "$SPACE" -gt 1000000 ]; then
  print_check "Espacio en disco: $(numfmt --to=iec $((SPACE * 1024)) 2>/dev/null || echo "${SPACE}KB")"
else
  print_error "POCO espacio en disco (< 1GB)"
  exit 1
fi

# ============================================================================
# RESUMEN
# ============================================================================

print_header "✅ DIAGNÓSTICO COMPLETADO"

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Todo está en orden. Puedes ejecutar SETUP.sh${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
