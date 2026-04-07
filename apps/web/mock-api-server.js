/**
 * Mock API Server for Testing 2FA Login Flow
 * Runs on port 3001
 */

import http from 'http';
import { parse as parseUrl } from 'url';

// Store active 2FA sessions temporarily
const twoFASessions = new Map();

// Test credentials
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123!@#',
  userId: '1',
  name: 'Test User'
};

// Helper function to generate random session token
function generateSessionToken() {
  return 'session_' + Math.random().toString(36).substr(2, 9);
}

// Helper function to generate CSRF token
function generateCsrfToken() {
  return 'csrf_' + Math.random().toString(36).substr(2, 20);
}

// Helper function to parse request body
async function parseBody(req) {
  let body = '';
  return new Promise((resolve, reject) => {
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Helper to send JSON response with CORS headers
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// Handle CORS preflight
function handleCors(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return true;
  }
  return false;
}

// Main request handler
const server = http.createServer(async (req, res) => {
  if (handleCors(req, res)) return;

  const parsedUrl = parseUrl(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  console.log(`[${new Date().toISOString()}] ${method} ${pathname}`);

  try {
    // GET /auth/csrf - Get CSRF token for login
    if (method === 'GET' && pathname === '/auth/csrf') {
      return sendJson(res, 200, {
        csrfToken: generateCsrfToken()
      });
    }

    // GET /auth/me - Get current authenticated user
    if (method === 'GET' && pathname === '/auth/me') {
      return sendJson(res, 200, {
        id: TEST_USER.userId,
        email: TEST_USER.email,
        name: TEST_USER.name
      });
    }

    // POST /api/auth/login - Initial login with email/password
    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await parseBody(req);
      const { email, password } = body;

      // Validate credentials
      if (email === TEST_USER.email && password === TEST_USER.password) {
        // For this demo, 2FA is disabled (simplified login)
        // User logs in directly without 2FA
        return sendJson(res, 200, {
          requires2FA: false,
          accessToken: 'token_' + Math.random().toString(36).substr(2, 9),
          user: {
            id: TEST_USER.userId,
            email: TEST_USER.email,
            name: TEST_USER.name
          }
        });
      } else {
        return sendJson(res, 401, {
          error: 'Invalid credentials'
        });
      }
    }

    // POST /api/2fa/verify - Verify 2FA code (if 2FA is enabled later)
    if (method === 'POST' && pathname === '/api/2fa/verify') {
      const body = await parseBody(req);
      const { sessionToken, token } = body;

      // Any 6-digit number is valid for testing
      if (token && /^\d{6}$/.test(token)) {
        return sendJson(res, 200, {
          valid: true
        });
      } else {
        return sendJson(res, 401, {
          error: 'Invalid 2FA code'
        });
      }
    }

    // POST /api/auth/2fa-complete - Complete 2FA and get tokens
    if (method === 'POST' && pathname === '/api/auth/2fa-complete') {
      return sendJson(res, 200, {
        accessToken: 'token_' + Math.random().toString(36).substr(2, 9),
        user: {
          id: TEST_USER.userId,
          email: TEST_USER.email,
          name: TEST_USER.name
        },
        activeTenant: { id: 'tenant_1', name: 'Test Tenant' },
        tenantRole: 'admin'
      });
    }

    // GET /api/auth/user - Get current user (alternative endpoint)
    if (method === 'GET' && pathname === '/api/auth/user') {
      return sendJson(res, 200, {
        id: TEST_USER.userId,
        email: TEST_USER.email,
        name: TEST_USER.name
      });
    }

    // POST /auth/logout - Logout (just clear server-side session)
    if (method === 'POST' && pathname === '/auth/logout') {
      return sendJson(res, 200, {
        success: true
      });
    }

    // GET /dashboard - Get dashboard data
    if (method === 'GET' && pathname === '/dashboard') {
      return sendJson(res, 200, {
        dashboard: {
          compliance: {
            score: 85,
            effectiveDocs: 12,
            totalDocs: 14
          },
          documents: {
            total: 14,
            effective: 12,
            draft: 2,
            recent: []
          },
          normatives: {
            total: 3,
            ready: 3,
            totalClauses: 245
          },
          ncrs: {
            total: 5,
            open: 2,
            inProgress: 1,
            closed: 2,
            critical: 0,
            overdue: 0
          },
          risks: {
            total: 8,
            critical: 1,
            high: 2,
            medium: 3,
            low: 2
          },
          findings: {
            total: 12,
            open: 5,
            mustOpen: 2
          },
          audits: {
            completed: 3,
            running: 0,
            total: 3
          },
          indicators: [],
          trainings: {
            total: 4,
            upcoming: 1,
            completed: 3
          }
        }
      });
    }

    // Not found
    return sendJson(res, 404, {
      error: 'Endpoint not found: ' + pathname
    });

  } catch (error) {
    console.error('Error:', error);
    return sendJson(res, 500, {
      error: error.message || 'Internal server error'
    });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Mock API Server running on http://localhost:${PORT}`);
  console.log(`📧 Test Credentials:`);
  console.log(`Email: ${TEST_USER.email}`);
  console.log(`Password: ${TEST_USER.password}`);
  console.log(`\n🔐 2FA Code for testing: 123456 (or any 6-digit number)`);
  console.log(`\nEndpoints:`);
  console.log(`  GET /auth/csrf - Get CSRF token`);
  console.log(`  GET /auth/me - Get current user`);
  console.log(`  GET /dashboard - Get dashboard data`);
  console.log(`  POST /auth/logout - Logout`);
  console.log(`  POST /api/auth/login - Login with email/password`);
  console.log(`  POST /api/2fa/verify - Verify 2FA code`);
  console.log(`  POST /api/auth/2fa-complete - Complete 2FA and get tokens`);
});
