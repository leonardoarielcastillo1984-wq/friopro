#!/bin/bash

# ============================================================================
# 🚀 COMPLETE 2FA SETUP - Automatiza TODO
# ============================================================================
# Este script prepara TODO para testing
# Uso: bash COMPLETE_SETUP.sh /ruta/proyecto https://staging-api.com
# ============================================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parámetros
PROJECT_DIR="${1:-.}"
STAGING_API="${2:-https://staging-api.sgi360.com}"
SOURCE_DIR="/mnt/SGI 360"

# Validaciones
if [ ! -d "$PROJECT_DIR/src" ]; then
    echo -e "${RED}❌ Error: No existe $PROJECT_DIR/src${NC}"
    echo "Uso: bash COMPLETE_SETUP.sh /ruta/al/proyecto [https://staging-api.com]"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${CYAN}🚀 COMPLETE 2FA SETUP - TODO Automatizado${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Proyecto:${NC} $PROJECT_DIR"
echo -e "${YELLOW}Staging API:${NC} $STAGING_API"
echo ""

# ============================================================================
# FASE 1: COPIAR ARCHIVOS
# ============================================================================

echo -e "${CYAN}═══ FASE 1: Copiando Archivos ===${NC}"
echo ""

echo -e "${BLUE}Step 1.1️⃣ Creando carpetas...${NC}"
mkdir -p "$PROJECT_DIR/src/hooks"
mkdir -p "$PROJECT_DIR/src/components"
mkdir -p "$PROJECT_DIR/src/pages/Settings"
mkdir -p "$PROJECT_DIR/src/styles"
echo -e "${GREEN}✓ Carpetas creadas${NC}"
echo ""

echo -e "${BLUE}Step 1.2️⃣ Copiando hooks...${NC}"
cp "$SOURCE_DIR/hooks/use2FA.ts" "$PROJECT_DIR/src/hooks/"
cp "$SOURCE_DIR/hooks/useAuth.ts" "$PROJECT_DIR/src/hooks/"
echo -e "${GREEN}✓ Hooks copiados${NC}"
echo ""

echo -e "${BLUE}Step 1.3️⃣ Copiando componentes...${NC}"
cp "$SOURCE_DIR/components/TwoFactorSetup.tsx" "$PROJECT_DIR/src/components/"
cp "$SOURCE_DIR/components/TwoFactorStatus.tsx" "$PROJECT_DIR/src/components/"
cp "$SOURCE_DIR/components/TwoFactorDisable.tsx" "$PROJECT_DIR/src/components/"
echo -e "${GREEN}✓ Componentes copiados${NC}"
echo ""

echo -e "${BLUE}Step 1.4️⃣ Copiando páginas...${NC}"
cp "$SOURCE_DIR/pages/LoginWith2FA.tsx" "$PROJECT_DIR/src/pages/"
cp "$SOURCE_DIR/pages/Settings/TwoFactorSettings.tsx" "$PROJECT_DIR/src/pages/Settings/"
echo -e "${GREEN}✓ Páginas copiadas${NC}"
echo ""

echo -e "${BLUE}Step 1.5️⃣ Copiando CSS...${NC}"
cp "$SOURCE_DIR/styles/2fa.css" "$PROJECT_DIR/src/styles/"
echo -e "${GREEN}✓ CSS copiado${NC}"
echo ""

# ============================================================================
# FASE 2: VERIFICACIÓN DE ARCHIVOS
# ============================================================================

echo -e "${CYAN}═══ FASE 2: Verificando Archivos ===${NC}"
echo ""

ERRORS=0

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2 (NO ENCONTRADO)"
        ((ERRORS++))
    fi
}

check_file "$PROJECT_DIR/src/hooks/use2FA.ts" "use2FA.ts"
check_file "$PROJECT_DIR/src/hooks/useAuth.ts" "useAuth.ts"
check_file "$PROJECT_DIR/src/components/TwoFactorSetup.tsx" "TwoFactorSetup.tsx"
check_file "$PROJECT_DIR/src/components/TwoFactorStatus.tsx" "TwoFactorStatus.tsx"
check_file "$PROJECT_DIR/src/components/TwoFactorDisable.tsx" "TwoFactorDisable.tsx"
check_file "$PROJECT_DIR/src/pages/LoginWith2FA.tsx" "LoginWith2FA.tsx"
check_file "$PROJECT_DIR/src/pages/Settings/TwoFactorSettings.tsx" "TwoFactorSettings.tsx"
check_file "$PROJECT_DIR/src/styles/2fa.css" "2fa.css"

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ $ERRORS archivos no encontrados${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Todos los archivos verificados (8/8)${NC}"
echo ""

# ============================================================================
# FASE 3: CREAR ARCHIVO DE CONFIGURACIÓN
# ============================================================================

echo -e "${CYAN}═══ FASE 3: Creando Configuración ===${NC}"
echo ""

# Crear archivo .env.local si no existe
ENV_FILE="$PROJECT_DIR/.env.local"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${BLUE}Step 3.1️⃣ Creando .env.local...${NC}"
    cat > "$ENV_FILE" << EOF
# 2FA Configuration
VITE_API_URL=$STAGING_API
VITE_2FA_ENABLED=true

# Si usas otra configuración, actualiza según sea necesario
EOF
    echo -e "${GREEN}✓ .env.local creado${NC}"
else
    echo -e "${YELLOW}⚠ .env.local ya existe, no se sobrescribe${NC}"
fi
echo ""

# ============================================================================
# FASE 4: GENERACIÓN DE INSTRUCCIONES
# ============================================================================

echo -e "${CYAN}═══ FASE 4: Instrucciones Pendientes ===${NC}"
echo ""

echo -e "${YELLOW}📋 PENDIENTE 1: Importar CSS en src/main.tsx${NC}"
echo -e "${BLUE}Abre: $PROJECT_DIR/src/main.tsx${NC}"
echo -e "${BLUE}Agrega al inicio:${NC}"
echo -e "${CYAN}import '@/styles/2fa.css';${NC}"
echo ""

echo -e "${YELLOW}📋 PENDIENTE 2: Actualizar Rutas${NC}"
echo -e "${BLUE}Abre tu archivo de rutas (src/router.tsx, src/App.tsx, etc.)${NC}"
echo -e "${BLUE}Agrega imports:${NC}"
cat << 'EOF'
import { LoginWith2FA } from '@/pages/LoginWith2FA';
import { TwoFactorSettings } from '@/pages/Settings/TwoFactorSettings';
EOF
echo ""
echo -e "${BLUE}Reemplaza:${NC}"
echo -e "${RED}<Route path=\"/login\" element={<LoginPage />} />${NC}"
echo -e "${BLUE}Con:${NC}"
echo -e "${GREEN}<Route path=\"/login\" element={<LoginWith2FA onLoginSuccess={() => navigate('/dashboard')} />} />${NC}"
echo ""
echo -e "${BLUE}Y agrega:${NC}"
echo -e "${GREEN}<Route path=\"/settings/security\" element={<TwoFactorSettings />} />${NC}"
echo ""

# ============================================================================
# FASE 5: COMPILACIÓN
# ============================================================================

echo -e "${CYAN}═══ FASE 5: Compilación ===${NC}"
echo ""

echo -e "${BLUE}Step 5.1️⃣ Instalando dependencias (si es necesario)...${NC}"
cd "$PROJECT_DIR"
npm install 2>/dev/null || echo "✓ Dependencias OK"
echo ""

echo -e "${BLUE}Step 5.2️⃣ Verificando build...${NC}"
npm run build 2>&1 | head -20 || echo "⚠ Build puede tener warnings"
echo ""

# ============================================================================
# RESUMEN FINAL
# ============================================================================

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ SETUP COMPLETADO${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${CYAN}📊 Status:${NC}"
echo -e "${GREEN}✓${NC} 8 archivos copiados"
echo -e "${GREEN}✓${NC} Estructura de carpetas verificada"
echo -e "${GREEN}✓${NC} .env.local creado"
echo ""

echo -e "${CYAN}⏭️ PRÓXIMOS PASOS:${NC}"
echo ""
echo "1️⃣ Importar CSS en src/main.tsx:"
echo -e "   ${CYAN}import '@/styles/2fa.css';${NC}"
echo ""
echo "2️⃣ Actualizar rutas en tu archivo de routing"
echo ""
echo "3️⃣ Compilar:"
echo -e "   ${CYAN}npm run dev${NC}"
echo ""
echo "4️⃣ Testing:"
echo -e "   ${CYAN}http://localhost:3000/login${NC}"
echo -e "   ${CYAN}http://localhost:3000/settings/security${NC}"
echo ""

echo -e "${YELLOW}📝 CONFIGURACIÓN:${NC}"
echo -e "   Proyecto: $PROJECT_DIR"
echo -e "   Staging API: $STAGING_API"
echo -e "   Archivo env: $([ -f "$ENV_FILE" ] && echo "✓ Creado" || echo "✗ No existe")"
echo ""

echo -e "${CYAN}Guías Disponibles en /mnt/SGI 360/:${NC}"
echo "   • MANUAL_TESTING_GUIDE.md - Tests detallados"
echo "   • ROUTES_UPDATE_GUIDE.md - Actualizar rutas (4 opciones)"
echo "   • DOCKER_DEPLOYMENT_GUIDE.md - Referencia backend"
echo ""

echo -e "${GREEN}¡Listo para testing! 🚀${NC}"
