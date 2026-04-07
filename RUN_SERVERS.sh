#!/bin/bash

set -e

PROJECT_DIR="/Users/leonardocastillo/Desktop/APP/SGI 360"
APPS_WEB="$PROJECT_DIR/apps/web"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         SGI 360 - Starting Development Servers                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Kill any existing processes on ports 3000, 3001, 8000
echo "🧹 Cleaning up any existing processes..."
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:8000 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

# Start Mock API Server
echo "🚀 Starting Mock API Server on port 3001..."
cd "$APPS_WEB"
node --experimental-modules mock-api-server.js &
MOCK_PID=$!
echo "✅ Mock API started (PID: $MOCK_PID)"
sleep 3

# Test Mock API
echo ""
echo "🧪 Testing Mock API..."
MOCK_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}')

if echo "$MOCK_RESPONSE" | grep -q "accessToken"; then
  echo "✅ Mock API is working!"
  echo "Response: $MOCK_RESPONSE"
else
  echo "❌ Mock API test failed!"
  echo "Response: $MOCK_RESPONSE"
  kill $MOCK_PID
  exit 1
fi

# Start Next.js Dev Server
echo ""
echo "🚀 Starting Next.js Dev Server on port 3000..."
cd "$APPS_WEB"
npm run dev &
NEXT_PID=$!
echo "✅ Next.js started (PID: $NEXT_PID)"
sleep 10

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ ALL SERVERS RUNNING                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 Login Page:   http://localhost:3000/login"
echo "📍 Mock API:     http://localhost:3001"
echo ""
echo "🧪 Test Credentials:"
echo "   Email:    test@example.com"
echo "   Password: Test123!@#"
echo ""
echo "📋 To stop servers, press Ctrl+C or kill PIDs:"
echo "   Mock API:  kill $MOCK_PID"
echo "   Next.js:   kill $NEXT_PID"
echo ""
echo "═" 64
echo ""

# Keep script running
wait
