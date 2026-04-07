#!/bin/bash

# SGI 360 Portal Quick Start Script

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       SGI 360 - Enhanced Portal Server                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTAL_FILE="$SCRIPT_DIR/sgi360-portal.html"

# Check if portal file exists
if [ ! -f "$PORTAL_FILE" ]; then
    echo "❌ Error: sgi360-portal.html not found in $SCRIPT_DIR"
    echo ""
    echo "Please ensure the portal file exists at:"
    echo "   $PORTAL_FILE"
    echo ""
    echo "You can copy it from the root directory:"
    echo "   cp ../sgi360-portal.html ."
    exit 1
fi

echo "✅ Portal file found: sgi360-portal.html"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo ""
    echo "Installing with Homebrew..."
    if command -v brew &> /dev/null; then
        brew install node
    else
        echo "Please install Node.js from https://nodejs.org/"
        exit 1
    fi
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js installed: $NODE_VERSION"
echo ""

# Get available port
PORT=3000
MAX_ATTEMPTS=10
ATTEMPT=1

while netstat -tuln 2>/dev/null | grep -q ":$PORT " && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    PORT=$((PORT + 1))
    ATTEMPT=$((ATTEMPT + 1))
done

if netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
    echo "❌ Could not find an available port (tried ports 3000-3009)"
    exit 1
fi

echo "📡 Using port: $PORT"
echo ""

# Create a simple HTTP server script if static-server.js doesn't exist
if [ ! -f "$SCRIPT_DIR/static-server.js" ]; then
    echo "⚠️  static-server.js not found. Creating a simple server..."
    cat > "$SCRIPT_DIR/temp-server.js" << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Route to sgi360-portal.html for root
  let filePath = req.url === '/' ? '/sgi360-portal.html' : req.url;
  filePath = path.join(ROOT, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json'
    }[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n✅ SGI 360 Portal Server running on http://localhost:${PORT}`);
  console.log(`🌐 Portal: http://localhost:${PORT}`);
  console.log(`📝 Files served from: ${ROOT}\n`);
});
EOF
    SERVER_SCRIPT="$SCRIPT_DIR/temp-server.js"
else
    SERVER_SCRIPT="$SCRIPT_DIR/static-server.js"
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   QUICK START GUIDE                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Test Credentials:"
echo "  📧 Email:    test@example.com"
echo "  🔐 Password: Test123!@#"
echo "  🔑 2FA Code: 123456"
echo ""
echo "Opening portal in 3 seconds..."
sleep 3

# Detect OS and open browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open "http://localhost:$PORT"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:$PORT"
    fi
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows
    start "http://localhost:$PORT"
fi

echo ""
echo "🚀 Starting server..."
echo ""

# Handle Ctrl+C gracefully
trap 'echo ""; echo "👋 Server stopped. Goodbye!"; exit 0' INT

# Run the server
PORT=$PORT node "$SERVER_SCRIPT"
