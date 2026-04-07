#!/bin/bash
# Start SGI 360 servers

echo "=== SGI 360 Startup Script ==="

# Kill existing processes
echo "Stopping existing processes..."
pkill -9 node 2>/dev/null
pkill -9 pnpm 2>/dev/null
sleep 3

# Start API
echo "Starting API on port 3001..."
cd "/Users/leonardocastillo/Desktop/APP/SGI 360/apps/api"
npx tsx simple-server.ts > /tmp/api.log 2>&1 &
API_PID=$!
echo "API PID: $API_PID"

# Wait for API to start
sleep 8

# Test API
echo "Testing API..."
curl -s http://localhost:3001/dashboard -H "x-tenant-id: 7efd859d-5c42-4412-9984-3227ccadeff4" > /tmp/test_api.json 2>&1
if [ -s /tmp/test_api.json ]; then
    echo "✅ API is running!"
    cat /tmp/test_api.json | head -20
else
    echo "❌ API failed to start"
    cat /tmp/api.log | tail -20
fi

# Start Web
echo "Starting Web on port 3000..."
cd "/Users/leonardocastillo/Desktop/APP/SGI 360/apps/web"
pnpm dev > /tmp/web.log 2>&1 &
WEB_PID=$!
echo "Web PID: $WEB_PID"

echo ""
echo "=== Servers started ==="
echo "API: http://localhost:3001"
echo "Web: http://localhost:3000"
