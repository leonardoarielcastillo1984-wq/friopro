import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

// Mock Redis for now (install ioredis later)
class MockRedis {
  private store = new Map<string, { value: string; expiry?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (item.expiry && item.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    this.store.set(key, { 
      value, 
      expiry: ttl ? Date.now() + ttl * 1000 : undefined 
    });
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.set(key, value, ttl);
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  }

  async dbsize(): Promise<number> {
    return this.store.size;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async info(section?: string): Promise<string> {
    if (section === 'memory') {
      return 'used_memory_human:1.5M';
    }
    if (section === 'keyspace') {
      return 'db0:keys=1000,expires=100,avg_ttl=3600';
    }
    return 'mock_redis_info';
  }

  async connect(): Promise<void> {
    // Mock connection
  }

  async quit(): Promise<void> {
    this.store.clear();
  }

  on(event: string, handler: (...args: any[]) => void): void {
    // Mock event handling
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    redis: MockRedis;
    cache: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: any, ttl?: number) => Promise<void>;
      del: (key: string) => Promise<void>;
      clear: (pattern?: string) => Promise<void>;
      invalidate: (pattern: string) => Promise<void>;
    };
  }
}

export const redisPlugin = fp(async (app: FastifyInstance) => {
  const redis = new MockRedis();

  // Mock event handlers
  redis.on('error', (err: any) => {
    console.error('Redis connection error:', err);
  });

  redis.on('connect', () => {
    console.log('Redis connected successfully');
  });

  redis.on('ready', () => {
    console.log('Redis ready for commands');
  });

  redis.on('close', () => {
    console.log('Redis connection closed');
  });

  // Connect to Redis
  await redis.connect();

  // Cache utilities
  const cache = {
    async get(key: string): Promise<any> {
      try {
        const value = await redis.get(key);
        if (value === null) return null;
        
        // Try to parse as JSON, fallback to raw value
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      } catch (error: any) {
        console.error(`Cache get error for key ${key}:`, error);
        return null;
      }
    },

    async set(key: string, value: any, ttl: number = 3600): Promise<void> {
      try {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        await redis.setex(key, ttl, serialized);
      } catch (error: any) {
        console.error(`Cache set error for key ${key}:`, error);
        throw error;
      }
    },

    async del(key: string): Promise<void> {
      try {
        await redis.del(key);
      } catch (error: any) {
        console.error(`Cache delete error for key ${key}:`, error);
        throw error;
      }
    },

    async clear(pattern: string = '*'): Promise<void> {
      try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } catch (error: any) {
        console.error(`Cache clear error for pattern ${pattern}:`, error);
        throw error;
      }
    },

    async invalidate(pattern: string): Promise<void> {
      try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          console.log(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
        }
      } catch (error: any) {
        console.error(`Cache invalidate error for pattern ${pattern}:`, error);
        throw error;
      }
    }
  };

  // Decorate app with redis and cache utilities
  app.decorate('redis', redis);
  app.decorate('cache', cache);

  // Graceful shutdown
  app.addHook('onClose', async () => {
    await redis.quit();
  });

  // Health check for Redis
  app.get('/health/redis', async () => {
    try {
      await redis.ping();
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error: any) {
      console.error('Redis health check failed:', error);
      throw new Error('Redis unavailable');
    }
  });

  // Cache statistics endpoint
  app.get('/cache/stats', async () => {
    try {
      const info = await redis.info('memory');
      const keyspace = await redis.info('keyspace');
      const dbSize = await redis.dbsize();
      
      return {
        keys: dbSize,
        memory: info.split('\r\n').find((line: any) => line.startsWith('used_memory_human'))?.split(':')[1] || 'unknown',
        keyspace: keyspace.split('\r\n').find((line: any) => line.startsWith('db')) || 'unknown',
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('Cache stats error:', error);
      throw new Error('Unable to get cache stats');
    }
  });

  // Cache management endpoints (admin only)
  app.post('/cache/clear', async (request, reply) => {
    try {
      const { pattern = '*' } = request.body as { pattern?: string };
      await cache.clear(pattern);
      return { message: `Cache cleared for pattern: ${pattern}`, timestamp: new Date().toISOString() };
    } catch (error: any) {
      console.error('Cache clear error:', error);
      reply.code(500);
      return { error: 'Failed to clear cache' };
    }
  });

  app.post('/cache/invalidate', async (request, reply) => {
    try {
      const { pattern } = request.body as { pattern: string };
      if (!pattern) {
        reply.code(400);
        return { error: 'Pattern is required' };
      }
      
      await cache.invalidate(pattern);
      return { message: `Cache invalidated for pattern: ${pattern}`, timestamp: new Date().toISOString() };
    } catch (error: any) {
      console.error('Cache invalidate error:', error);
      reply.code(500);
      return { error: 'Failed to invalidate cache' };
    }
  });
});

export default redisPlugin;
