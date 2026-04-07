import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { PrismaClient } from '@prisma/client';

describe('Auth Routes', () => {
  let app: any;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await buildApp();
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL
        }
      }
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.platformUser.deleteMany();
    await prisma.tenant.deleteMany();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User'
        }
      });

      expect(response.statusCode).toBe(201);
      const result = response.json();
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('test@example.com');
      expect(result).toHaveProperty('accessToken');
    });

    it('should reject registration with invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result).toHaveProperty('error');
    });

    it('should reject registration with weak password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: '123',
          firstName: 'Test',
          lastName: 'User'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result).toHaveProperty('error');
    });

    it('should reject registration with duplicate email', async () => {
      // First registration
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User'
        }
      });

      // Second registration with same email
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password456',
          firstName: 'Another',
          lastName: 'User'
        }
      });

      expect(response.statusCode).toBe(409);
      const result = response.json();
      expect(result).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User'
        }
      });
    });

    it('should login with valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123'
        }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('test@example.com');
      expect(result).toHaveProperty('accessToken');
    });

    it('should reject login with invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'wrong@example.com',
          password: 'password123'
        }
      });

      expect(response.statusCode).toBe(401);
      const result = response.json();
      expect(result).toHaveProperty('error');
    });

    it('should reject login with invalid password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword'
        }
      });

      expect(response.statusCode).toBe(401);
      const result = response.json();
      expect(result).toHaveProperty('error');
    });

    it('should reject login with missing fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com'
          // Missing password
        }
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Create and login a test user
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User'
        }
      });

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123'
        }
      });

      accessToken = loginResponse.json().accessToken;
    });

    it('should return user profile with valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should reject request without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me'
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Create and login a test user
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User'
        }
      });

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123'
        }
      });

      accessToken = loginResponse.json().accessToken;
    });

    it('should logout successfully with valid token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result).toHaveProperty('message');
    });

    it('should reject logout without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout'
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to login attempts', async () => {
      // Make multiple rapid login attempts
      const attempts = [];
      for (let i = 0; i < 15; i++) {
        attempts.push(
          app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
              email: 'test@example.com',
              password: 'wrongpassword'
            }
          })
        );
      }

      const responses = await Promise.all(attempts);
      
      // Some attempts should be rate limited
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});
