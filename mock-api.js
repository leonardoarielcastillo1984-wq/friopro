const http = require('http');
const url = require('url');

// Mock user database
const users = {
  'test@example.com': {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    password: 'Test123!@#',
    twoFactorEnabled: true,
  },
  'admin@test.com': {
    id: '2',
    email: 'admin@test.com',
    name: 'Admin User',
    password: 'Admin123!@#',
    twoFactorEnabled: false,
  },
};

// Mock sessions for 2FA verification
const sessions = new Map();

// Helper to generate mock tokens
function generateToken() {
  return 'mock_token_' + Math.random().toString(36).substring(2, 15);
}

// Helper to generate mock session token
function generateSessionToken() {
  return 'session_' + Math.random().toString(36).substring(2, 15);
}

// Helper to parse JSON body
function parseBody(req, callback) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      callback(JSON.parse(body));
    } catch (e) {
      callback(null);
    }
  });
}

// CSRF token storage
const csrfTokens = new Map();

// Helper to generate CSRF token
function generateCsrfToken() {
  return 'csrf_' + Math.random().toString(36).substring(2, 15);
}

// CORS headers
function addCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Request handler
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Log incoming request
  console.log(`[${new Date().toISOString()}] ${method} ${pathname}`);

  // CORS preflight
  if (method === 'OPTIONS') {
    addCorsHeaders(res);
    res.writeHead(200);
    res.end();
    return;
  }

  addCorsHeaders(res);

  // GET /auth/csrf
  if (pathname === '/auth/csrf' && method === 'GET') {
    const csrfToken = generateCsrfToken();
    csrfTokens.set(csrfToken, {
      createdAt: Date.now(),
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ csrfToken: csrfToken }));
    console.log(`  → CSRF token generated: ${csrfToken}`);
    return;
  }

  // POST /auth/login
  if (pathname === '/auth/login' && method === 'POST') {
    parseBody(req, (body) => {
      if (!body || !body.email || !body.password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing email or password' }));
        return;
      }

      const user = users[body.email];

      if (!user || user.password !== body.password) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid credentials' }));
        console.log(`  → Login failed for ${body.email}`);
        return;
      }

      if (user.twoFactorEnabled) {
        // User has 2FA enabled
        const sessionToken = generateSessionToken();
        sessions.set(sessionToken, {
          email: user.email,
          userId: user.id,
          createdAt: Date.now(),
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            requires2FA: true,
            sessionToken: sessionToken,
          })
        );
        console.log(`  → 2FA required for ${body.email}`);
      } else {
        // User does not have 2FA enabled
        const token = generateToken();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            token: token,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
            },
          })
        );
        console.log(`  → Login successful for ${body.email}`);
      }
    });
    return;
  }

  // POST /2fa/verify
  if (pathname === '/2fa/verify' && method === 'POST') {
    parseBody(req, (body) => {
      if (!body || !body.sessionToken || !body.code) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: 'Missing sessionToken or code' })
        );
        return;
      }

      const session = sessions.get(body.sessionToken);

      if (!session) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ verified: false, error: 'Invalid session' }));
        console.log(`  → 2FA verification failed: invalid session`);
        return;
      }

      // Check if session expired (5 minutes)
      if (Date.now() - session.createdAt > 5 * 60 * 1000) {
        sessions.delete(body.sessionToken);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ verified: false, error: 'Session expired' }));
        console.log(`  → 2FA verification failed: session expired`);
        return;
      }

      // Accept any 6-digit code for testing
      if (!/^\d{6}$/.test(body.code)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            verified: false,
            error: 'Invalid code format (must be 6 digits)',
          })
        );
        console.log(`  → 2FA verification failed: invalid code format`);
        return;
      }

      // Generate final token and return
      const token = generateToken();
      sessions.delete(body.sessionToken);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          verified: true,
          sessionToken: token,
        })
      );
      console.log(`  → 2FA verification successful for ${session.email}`);
    });
    return;
  }

  // GET /2fa/status
  if (pathname === '/2fa/status' && method === 'GET') {
    const email = parsedUrl.query.email;

    if (!email) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing email parameter' }));
      return;
    }

    const user = users[email];

    if (!user) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not found' }));
      return;
    }

    if (user.twoFactorEnabled) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          enabled: true,
          codesRemaining: 8,
        })
      );
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ enabled: false }));
    }
    console.log(`  → Status: 2FA ${user.twoFactorEnabled ? 'enabled' : 'disabled'}`);
    return;
  }

  // 404 - Unknown endpoint
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
  console.log(`  → 404 Not Found`);
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   Mock API Server Started               ║
║   http://localhost:${PORT}             ║
╚════════════════════════════════════════╝

Test Users:
  • test@example.com / Test123!@# (2FA enabled)
  • admin@test.com / Admin123!@# (2FA disabled)

Endpoints:
  GET /auth/csrf
  POST /auth/login
  POST /2fa/verify
  GET /2fa/status?email=<email>

Press Ctrl+C to stop
  `);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
