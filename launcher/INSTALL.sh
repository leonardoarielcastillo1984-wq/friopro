#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# SGI 360 - Installation Verification Script
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         SGI 360 - Installation Verification                   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Node.js
echo -e "${YELLOW}Checking Node.js...${NC}"
if command -v node &> /dev/null; then
  echo -e "${GREEN}✅ Node.js $(node -v) is installed${NC}"
else
  echo -e "${RED}❌ Node.js is not installed${NC}"
  echo "   Install from: https://nodejs.org"
  exit 1
fi

# Check npm
echo -e "${YELLOW}Checking npm...${NC}"
if command -v npm &> /dev/null; then
  echo -e "${GREEN}✅ npm $(npm -v) is installed${NC}"
else
  echo -e "${RED}❌ npm is not installed${NC}"
  exit 1
fi

# Check project structure
echo ""
echo -e "${YELLOW}Checking project structure...${NC}"
if [ -d "$PROJECT_DIR/apps/web" ]; then
  echo -e "${GREEN}✅ apps/web directory found${NC}"
else
  echo -e "${RED}❌ apps/web directory not found${NC}"
  exit 1
fi

# Check required files
echo ""
echo -e "${YELLOW}Checking required files...${NC}"

files=(
  "apps/web/mock-api-server.js"
  "apps/web/public/auto-login.html"
  "apps/web/src/app/api/auth/login/route.ts"
  "apps/web/src/app/login/page.tsx"
  "apps/web/.env.local"
)

all_found=true
for file in "${files[@]}"; do
  if [ -f "$PROJECT_DIR/$file" ]; then
    echo -e "${GREEN}✅ $file${NC}"
  else
    echo -e "${RED}❌ $file not found${NC}"
    all_found=false
  fi
done

if [ "$all_found" = false ]; then
  exit 1
fi

# Check npm dependencies
echo ""
echo -e "${YELLOW}Checking npm dependencies...${NC}"
cd "$PROJECT_DIR/apps/web"
if [ -d "node_modules" ]; then
  echo -e "${GREEN}✅ node_modules directory found${NC}"
else
  echo -e "${YELLOW}⚠️  node_modules not found, installing dependencies...${NC}"
  npm install --legacy-peer-deps 2>&1 | tail -5
  echo -e "${GREEN}✅ Dependencies installed${NC}"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ Installation verification passed!                ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Now you can run: ${YELLOW}bash launcher/start-app.sh${NC}"
echo ""
