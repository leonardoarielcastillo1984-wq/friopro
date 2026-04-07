#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         SGI 360 - Automatic Diagnosis Tool                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Mock API
echo -e "${YELLOW}1. Checking Mock API on port 3001...${NC}"
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Mock API is running${NC}"

  # Test Mock API
  MOCK_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"Test123!@#"}')

  if echo "$MOCK_RESPONSE" | grep -q "accessToken"; then
    echo -e "${GREEN}✅ Mock API responds correctly${NC}"
    echo "   Response has accessToken: $(echo "$MOCK_RESPONSE" | grep -o 'token_[a-z0-9]*' | head -1)"
  else
    echo -e "${RED}❌ Mock API not responding correctly${NC}"
    echo "   Response: $MOCK_RESPONSE"
  fi
else
  echo -e "${RED}❌ Mock API is NOT running${NC}"
  echo "   Start it with: node --experimental-modules mock-api-server.js"
fi

echo ""

# Check Next.js
echo -e "${YELLOW}2. Checking Next.js on port 3000...${NC}"
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Next.js dev server is running${NC}"

  # Test Route Handler
  ROUTE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"Test123!@#"}')

  if echo "$ROUTE_RESPONSE" | grep -q '"token"'; then
    echo -e "${GREEN}✅ Route handler responds correctly${NC}"
    echo "   Response has 'token' field: $(echo "$ROUTE_RESPONSE" | grep -o 'token_[a-z0-9]*' | head -1)"
  else
    echo -e "${RED}❌ Route handler not responding correctly${NC}"
    echo "   Response: $ROUTE_RESPONSE"
  fi
else
  echo -e "${RED}❌ Next.js is NOT running${NC}"
  echo "   Start it with: npm run dev"
fi

echo ""

# Check files
echo -e "${YELLOW}3. Checking required files...${NC}"

PROJECT_DIR="/Users/leonardocastillo/Desktop/APP/SGI 360"

files=(
  "$PROJECT_DIR/apps/web/src/app/api/auth/login/route.ts"
  "$PROJECT_DIR/apps/web/src/app/api/2fa/verify/route.ts"
  "$PROJECT_DIR/apps/web/src/app/api/auth/2fa-complete/route.ts"
  "$PROJECT_DIR/apps/web/mock-api-server.js"
  "$PROJECT_DIR/apps/web/.env.local"
  "$PROJECT_DIR/apps/web/src/app/login/page.tsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅ $(basename "$file")${NC}"
  else
    echo -e "${RED}❌ $(basename "$file") - MISSING${NC}"
  fi
done

echo ""

# Check .env.local
echo -e "${YELLOW}4. Checking environment variables...${NC}"
if grep -q "NEXT_PUBLIC_API_URL=http://localhost:3001" "$PROJECT_DIR/apps/web/.env.local"; then
  echo -e "${GREEN}✅ NEXT_PUBLIC_API_URL is set correctly${NC}"
else
  echo -e "${RED}❌ NEXT_PUBLIC_API_URL not set correctly${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     DIAGNOSIS SUMMARY                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 && lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo -e "${GREEN}✅ ALL SYSTEMS GO! Login should work.${NC}"
  echo ""
  echo "🌐 Open this URL in your browser:"
  echo "   http://localhost:3000/login"
  echo ""
  echo "🔐 Use these credentials:"
  echo "   Email: test@example.com"
  echo "   Password: Test123!@#"
else
  echo -e "${RED}⚠️  Some services are not running${NC}"
  echo ""
  echo "📋 Quick Fix:"
  echo "   Terminal 1: node --experimental-modules mock-api-server.js"
  echo "   Terminal 2: npm run dev"
fi

echo ""
