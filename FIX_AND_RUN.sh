#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT="/Users/leonardocastillo/Desktop/APP/SGI 360"
APPS_WEB="$PROJECT/apps/web"

echo -e "${YELLOW}════════════════════════════════════════${NC}"
echo -e "${YELLOW}  SGI 360 - Fix and Run${NC}"
echo -e "${YELLOW}════════════════════════════════════════${NC}"
echo ""

# Kill old processes
echo -e "${YELLOW}1️⃣ Matando procesos antiguos...${NC}"
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2
echo -e "${GREEN}✅ Procesos limpios${NC}"
echo ""

# Clean cache
echo -e "${YELLOW}2️⃣ Limpiando caché...${NC}"
cd "$APPS_WEB"
rm -rf .next node_modules/.cache .turbo
echo -e "${GREEN}✅ Caché limpiado${NC}"
echo ""

# Start Mock API
echo -e "${YELLOW}3️⃣ Iniciando Mock API...${NC}"
node --experimental-modules mock-api-server.js > /tmp/mock-api.log 2>&1 &
MOCK_PID=$!
sleep 3

if curl -s http://localhost:3001/auth/csrf > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Mock API OK${NC}"
else
  echo -e "${RED}❌ Mock API falla${NC}"
  cat /tmp/mock-api.log
  exit 1
fi
echo ""

# Start Next.js
echo -e "${YELLOW}4️⃣ Iniciando Next.js...${NC}"
npm run dev &
NEXT_PID=$!
sleep 15

if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Next.js OK${NC}"
else
  echo -e "${RED}❌ Next.js no responde${NC}"
  exit 1
fi
echo ""

# Test login flow
echo -e "${YELLOW}5️⃣ Testeando login...${NC}"
LOGIN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}')

if echo "$LOGIN" | grep -q '"token"'; then
  echo -e "${GREEN}✅ Login funciona${NC}"
  TOKEN=$(echo "$LOGIN" | jq -r '.token' 2>/dev/null)
  echo -e "${GREEN}   Token: $TOKEN${NC}"
else
  echo -e "${RED}❌ Login falla${NC}"
  echo "Response: $LOGIN"
  exit 1
fi
echo ""

echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ TODO ESTÁ LISTO${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Abre en tu navegador:${NC}"
echo -e "${GREEN}   http://localhost:3000/login${NC}"
echo ""
echo -e "${YELLOW}Haz click en INGRESAR${NC}"
echo ""
echo -e "${YELLOW}Deberías ir al dashboard automáticamente ✅${NC}"
echo ""
