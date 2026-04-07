/**
 * K6 Load Testing Script for SGI 360
 *
 * Test scenarios:
 * - 1000 concurrent users
 * - API endpoints stress test
 * - Database query performance
 *
 * Run with: k6 run tests/performance/k6-load-test.js
 * Run with custom settings: k6 run -u 500 -d 30s tests/performance/k6-load-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Gauge, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const loginLatency = new Trend('login_latency');
const documentLatency = new Trend('document_latency');
const databaseQueryTime = new Trend('database_query_time');
const concurrentUsers = new Gauge('concurrent_users');
const totalRequests = new Counter('total_requests');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'Admin123!@#';

// Export options
export const options = {
  // Ramping up to 1000 virtual users over 5 minutes
  stages: [
    { duration: '30s', target: 50 },    // Ramp up to 50 users
    { duration: '1m', target: 500 },    // Ramp up to 500 users
    { duration: '2m', target: 1000 },   // Ramp up to 1000 users
    { duration: '3m', target: 1000 },   // Stay at 1000 users
    { duration: '2m', target: 500 },    // Ramp down to 500 users
    { duration: '1m', target: 0 },      // Ramp down to 0 users
  ],

  // Thresholds for pass/fail
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95th percentile under 500ms
    'http_req_failed': ['rate<0.1'],                   // Error rate under 10%
    'api_latency': ['p(95)<500', 'p(99)<1000'],
    'login_latency': ['p(95)<1000', 'p(99)<2000'],
    'document_latency': ['p(95)<1500', 'p(99)<3000'],
    'database_query_time': ['p(95)<200'],
  },

  // Test options
  setupTimeout: '30s',
  teardownTimeout: '30s',
  noVUSummary: false,
  noUsageReport: false,
};

// Setup function - runs once at the beginning
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);

  return {
    token: authenticateAdmin(),
  };
}

// Teardown function - runs once at the end
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Total requests: ${totalRequests.value}`);
}

/**
 * Authentication - Get admin token
 */
function authenticateAdmin() {
  const payload = JSON.stringify({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);

  check(res, {
    'authentication successful': (r) => r.status === 200,
    'token returned': (r) => r.json().token !== undefined,
  });

  return res.json().token;
}

/**
 * Main test function
 */
export default function (data) {
  const authToken = data.token;

  // Group 1: Authentication Tests
  group('Authentication Tests', () => {
    authenticationTests();
  });

  // Group 2: Document API Tests
  group('Document API Tests', () => {
    documentApiTests(authToken);
  });

  // Group 3: Department API Tests
  group('Department API Tests', () => {
    departmentApiTests(authToken);
  });

  // Group 4: Search Tests
  group('Search Tests', () => {
    searchTests(authToken);
  });

  // Group 5: Concurrent API Calls
  group('Concurrent API Calls', () => {
    concurrentApiTests(authToken);
  });

  // Record concurrent users
  concurrentUsers.add(__VU);

  // Random sleep between requests (0-2 seconds)
  sleep(Math.random() * 2);
}

/**
 * Test authentication endpoints
 */
function authenticationTests() {
  // Test login endpoint
  const loginPayload = JSON.stringify({
    email: 'test@example.com',
    password: 'ValidPassword123!',
  });

  const loginParams = {
    headers: { 'Content-Type': 'application/json' },
  };

  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    loginPayload,
    loginParams
  );

  const loginSuccess = check(loginRes, {
    'login successful or unauthorized': (r) =>
      r.status === 200 || r.status === 401,
    'valid response time': (r) => r.timings.duration < 1000,
  });

  if (loginSuccess) {
    loginLatency.add(loginRes.timings.duration);
  } else {
    errorRate.add(1);
  }

  totalRequests.add(1);
}

/**
 * Test document API endpoints
 */
function documentApiTests(authToken) {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  // Get documents
  const docsRes = http.get(`${BASE_URL}/api/documents`, { headers });

  check(docsRes, {
    'get documents successful': (r) => r.status === 200,
    'documents response valid': (r) => r.json().data !== undefined,
    'response time acceptable': (r) => r.timings.duration < 1500,
  });

  if (docsRes.status === 200) {
    documentLatency.add(docsRes.timings.duration);
  } else {
    errorRate.add(1);
  }

  totalRequests.add(1);

  // Search documents
  const searchRes = http.get(
    `${BASE_URL}/api/documents?search=test&limit=10&offset=0`,
    { headers }
  );

  check(searchRes, {
    'search documents successful': (r) => r.status === 200,
    'search results valid': (r) => r.json().data !== undefined,
  });

  if (searchRes.status === 200) {
    apiLatency.add(searchRes.timings.duration);
  } else {
    errorRate.add(1);
  }

  totalRequests.add(1);
}

/**
 * Test department API endpoints
 */
function departmentApiTests(authToken) {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  // Get departments
  const deptRes = http.get(`${BASE_URL}/api/departments`, { headers });

  check(deptRes, {
    'get departments successful': (r) => r.status === 200,
    'departments data returned': (r) => r.json().data !== undefined,
    'acceptable response time': (r) => r.timings.duration < 1000,
  });

  if (deptRes.status === 200) {
    apiLatency.add(deptRes.timings.duration);
  } else {
    errorRate.add(1);
  }

  totalRequests.add(1);

  // Get single department
  const deptId = '1'; // Replace with actual ID
  const singleDeptRes = http.get(
    `${BASE_URL}/api/departments/${deptId}`,
    { headers }
  );

  check(singleDeptRes, {
    'get single department': (r) => r.status === 200 || r.status === 404,
    'quick response': (r) => r.timings.duration < 800,
  });

  apiLatency.add(singleDeptRes.timings.duration);
  totalRequests.add(1);
}

/**
 * Test search functionality
 */
function searchTests(authToken) {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  const queries = [
    'document',
    'compliance',
    'procedure',
    'audit',
    'risk',
  ];

  const query = queries[Math.floor(Math.random() * queries.length)];

  const searchRes = http.get(
    `${BASE_URL}/api/documents?search=${query}&limit=20`,
    { headers }
  );

  check(searchRes, {
    'search successful': (r) => r.status === 200,
    'results returned': (r) => {
      const json = r.json();
      return json.data && Array.isArray(json.data);
    },
    'search latency acceptable': (r) => r.timings.duration < 1500,
  });

  if (searchRes.status === 200) {
    apiLatency.add(searchRes.timings.duration);
  } else {
    errorRate.add(1);
  }

  totalRequests.add(1);
}

/**
 * Concurrent API calls test
 */
function concurrentApiTests(authToken) {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  // Make multiple concurrent requests
  const responses = http.batch([
    {
      method: 'GET',
      url: `${BASE_URL}/api/documents?limit=10`,
      params: { headers },
    },
    {
      method: 'GET',
      url: `${BASE_URL}/api/departments`,
      params: { headers },
    },
    {
      method: 'GET',
      url: `${BASE_URL}/api/users/profile`,
      params: { headers },
    },
    {
      method: 'GET',
      url: `${BASE_URL}/api/dashboard/summary`,
      params: { headers },
    },
  ]);

  // Check responses
  responses.forEach((res, idx) => {
    const success = check(res, {
      'batch request successful': (r) =>
        r.status === 200 || r.status === 401,
    });

    if (success) {
      apiLatency.add(res.timings.duration);
    } else {
      errorRate.add(1);
    }

    if (res.timings.duration > 1000) {
      console.warn(`Slow request ${idx}: ${res.timings.duration}ms`);
    }
  });

  totalRequests.add(responses.length);
}

/**
 * Performance insights and analysis
 */
export function handleSummary(data) {
  console.log('========== LOAD TEST SUMMARY ==========');
  console.log(`Total Requests: ${totalRequests.value}`);
  console.log(`Error Rate: ${errorRate.value}%`);
  console.log('=====================================');

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'json': JSON.stringify(data, null, 2),
    'results.json': JSON.stringify(data, null, 2),
  };
}

/**
 * Text summary formatter
 */
function textSummary(data, options) {
  const indent = options.indent || '';
  let summary = '\n' + indent + '==== K6 Test Summary ====\n';

  // Metrics
  const metrics = data.metrics || {};
  for (const [name, metric] of Object.entries(metrics)) {
    if (metric.values) {
      const values = metric.values;
      summary += indent + `${name}:\n`;
      for (const [stat, value] of Object.entries(values)) {
        summary += indent + `  ${stat}: ${value}\n`;
      }
    }
  }

  return summary;
}
