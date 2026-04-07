#!/bin/bash

# Kill any existing processes
pkill -9 node 2>/dev/null
sleep 1

# Start PostgreSQL and Redis
brew services restart postgresql@16 2>/dev/null
brew services restart redis 2>/dev/null
sleep 3

# Go to project directory
cd ~/Desktop/APP/SGI\ 360

# Clean installs
echo "Installing API..."
cd apps/api
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps > /dev/null 2>&1

echo "Installing Web..."
cd ../web
rm -rf node_modules package-lock.json .next
npm install --legacy-peer-deps > /dev/null 2>&1

# Start servers in background
echo "Starting servers..."
cd ../api
npm run dev > /tmp/api.log 2>&1 &
sleep 5

cd ../web
npm run dev > /tmp/web.log 2>&1 &
sleep 5

# Open browser
open http://localhost:3000/login

echo ""
echo "✅ Servidores iniciados"
echo ""
echo "Email: admin@sgi360.com"
echo "Contraseña: Admin123!"
echo ""
echo "Logs:"
echo "  API:  tail -f /tmp/api.log"
echo "  Web:  tail -f /tmp/web.log"
