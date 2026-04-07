#!/bin/bash

# ============================================================================
# 🚀 Frontend 2FA Installation Script
# Copia automáticamente todos los componentes al proyecto
# ============================================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Solicitar ruta del proyecto
if [ -z "$1" ]; then
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}🚀 Frontend 2FA Installation${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Uso:${NC} $0 /ruta/al/proyecto"
    echo -e "${YELLOW}Ej:${NC}  $0 ~/mi-proyecto"
    echo ""
    exit 1
fi

PROJECT_DIR="$1"
SRC_DIR="$PROJECT_DIR/src"
SOURCE_DIR="/mnt/SGI 360"

# Validar que la ruta existe
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Error: Proyecto no encontrado en $PROJECT_DIR${NC}"
    exit 1
fi

if [ ! -d "$SRC_DIR" ]; then
    echo -e "${RED}❌ Error: No existe carpeta src en $PROJECT_DIR${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 Frontend 2FA Installation${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Proyecto:${NC} $PROJECT_DIR"
echo -e "${YELLOW}Origen:${NC} $SOURCE_DIR"
echo ""

# Step 1: Crear carpetas si no existen
echo -e "${BLUE}Step 1️⃣ Creando carpetas necesarias...${NC}"
mkdir -p "$SRC_DIR/hooks"
mkdir -p "$SRC_DIR/components"
mkdir -p "$SRC_DIR/pages/Settings"
mkdir -p "$SRC_DIR/styles"
echo -e "${GREEN}✓ Carpetas creadas${NC}"
echo ""

# Step 2: Copiar hooks
echo -e "${BLUE}Step 2️⃣ Copiando hooks...${NC}"
cp "$SOURCE_DIR/hooks/use2FA.ts" "$SRC_DIR/hooks/"
cp "$SOURCE_DIR/hooks/useAuth.ts" "$SRC_DIR/hooks/"
echo -e "${GREEN}✓ Hooks copiados (use2FA.ts, useAuth.ts)${NC}"
echo ""

# Step 3: Copiar componentes
echo -e "${BLUE}Step 3️⃣ Copiando componentes...${NC}"
cp "$SOURCE_DIR/components/TwoFactorSetup.tsx" "$SRC_DIR/components/"
cp "$SOURCE_DIR/components/TwoFactorStatus.tsx" "$SRC_DIR/components/"
cp "$SOURCE_DIR/components/TwoFactorDisable.tsx" "$SRC_DIR/components/"
echo -e "${GREEN}✓ Componentes copiados (3 archivos)${NC}"
echo ""

# Step 4: Copiar páginas
echo -e "${BLUE}Step 4️⃣ Copiando páginas...${NC}"
cp "$SOURCE_DIR/pages/LoginWith2FA.tsx" "$SRC_DIR/pages/"
cp "$SOURCE_DIR/pages/Settings/TwoFactorSettings.tsx" "$SRC_DIR/pages/Settings/"
echo -e "${GREEN}✓ Páginas copiadas (LoginWith2FA, TwoFactorSettings)${NC}"
echo ""

# Step 5: Copiar CSS
echo -e "${BLUE}Step 5️⃣ Copiando CSS...${NC}"
cp "$SOURCE_DIR/styles/2fa.css" "$SRC_DIR/styles/"
echo -e "${GREEN}✓ CSS copiado (2fa.css)${NC}"
echo ""

# Step 6: Verificar archivos
echo -e "${BLUE}Step 6️⃣ Verificando archivos...${NC}"
FILES_OK=0
FILES_TOTAL=8

[ -f "$SRC_DIR/hooks/use2FA.ts" ] && ((FILES_OK++)) || echo "❌ Falta: use2FA.ts"
[ -f "$SRC_DIR/hooks/useAuth.ts" ] && ((FILES_OK++)) || echo "❌ Falta: useAuth.ts"
[ -f "$SRC_DIR/components/TwoFactorSetup.tsx" ] && ((FILES_OK++)) || echo "❌ Falta: TwoFactorSetup.tsx"
[ -f "$SRC_DIR/components/TwoFactorStatus.tsx" ] && ((FILES_OK++)) || echo "❌ Falta: TwoFactorStatus.tsx"
[ -f "$SRC_DIR/components/TwoFactorDisable.tsx" ] && ((FILES_OK++)) || echo "❌ Falta: TwoFactorDisable.tsx"
[ -f "$SRC_DIR/pages/LoginWith2FA.tsx" ] && ((FILES_OK++)) || echo "❌ Falta: LoginWith2FA.tsx"
[ -f "$SRC_DIR/pages/Settings/TwoFactorSettings.tsx" ] && ((FILES_OK++)) || echo "❌ Falta: TwoFactorSettings.tsx"
[ -f "$SRC_DIR/styles/2fa.css" ] && ((FILES_OK++)) || echo "❌ Falta: 2fa.css"

echo -e "${GREEN}✓ Archivos verificados ($FILES_OK/$FILES_TOTAL)${NC}"
echo ""

if [ $FILES_OK -ne $FILES_TOTAL ]; then
    echo -e "${RED}❌ Error: No todos los archivos se copiaron correctamente${NC}"
    exit 1
fi

# Step 7: Instrucciones finales
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Instalación completada!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Próximos pasos:${NC}"
echo ""
echo "1️⃣ Importar CSS en tu main.tsx o App.tsx:"
echo -e "${BLUE}   import '@/styles/2fa.css';${NC}"
echo ""
echo "2️⃣ Actualizar rutas - agregar a tu router:"
echo -e "${BLUE}   import { LoginWith2FA } from '@/pages/LoginWith2FA';${NC}"
echo -e "${BLUE}   import { TwoFactorSettings } from '@/pages/Settings/TwoFactorSettings';${NC}"
echo ""
echo -e "${BLUE}   <Route path=\"/login\" element={<LoginWith2FA onLoginSuccess={...} />} />{{NC}"
echo -e "${BLUE}   <Route path=\"/settings/security\" element={<TwoFactorSettings />} />{{NC}"
echo ""
echo "3️⃣ Compilar:"
echo -e "${BLUE}   npm run dev${NC}"
echo ""
echo "4️⃣ Probar:"
echo -e "${BLUE}   http://localhost:3000/login{{NC}"
echo -e "${BLUE}   http://localhost:3000/settings/security{{NC}"
echo ""
echo -e "${GREEN}¡Listo para testing! 🚀${NC}"
echo ""
