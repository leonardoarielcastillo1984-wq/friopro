import type { FastifyPluginAsync } from 'fastify';
import { promises as fs } from 'fs';
import path from 'path';
import net from 'net';

// Verificar PostgreSQL
async function checkDB(app: any): Promise<{ ok: boolean; latency?: number; error?: string }> {
  const start = Date.now();
  try {
    await app.prisma.$queryRaw`SELECT 1`;
    return { ok: true, latency: Date.now() - start };
  } catch (err: any) {
    return { ok: false, error: err.message || 'DB connection failed' };
  }
}

// Verificar Redis (TCP connect)
async function checkRedis(): Promise<{ ok: boolean; latency?: number; error?: string }> {
  const start = Date.now();
  try {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const parsed = new URL(url);
    
    return await new Promise((resolve) => {
      const socket = net.createConnection(
        { host: parsed.hostname, port: Number(parsed.port) || 6379, timeout: 2000 },
        () => {
          socket.destroy();
          resolve({ ok: true, latency: Date.now() - start });
        },
      );
      socket.on('error', () => {
        socket.destroy();
        resolve({ ok: false, error: 'Redis connection failed' });
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ ok: false, error: 'Redis timeout' });
      });
    });
  } catch (err: any) {
    return { ok: false, error: err.message || 'Redis check failed' };
  }
}

// Verificar storage/uploads
async function checkStorage(): Promise<{ ok: boolean; error?: string }> {
  try {
    const storagePath = process.env.STORAGE_LOCAL_PATH || '/app/uploads';
    const testFile = path.join(storagePath, '.ready-check-' + Date.now());
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Storage not writable' };
  }
}

// Verificar OnlyOffice (HTTP reachable)
async function checkOnlyOffice(): Promise<{ ok: boolean; error?: string }> {
  try {
    const ooUrl = process.env.ONLYOFFICE_URL || 'http://onlyoffice:80';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(ooUrl, { 
      method: 'HEAD',
      signal: controller.signal 
    });
    clearTimeout(timeout);
    
    // OnlyOffice responde incluso con 404 en root, solo verificamos que no sea network error
    return { ok: true };
  } catch (err: any) {
    // Si es abort por timeout
    if (err.name === 'AbortError') {
      return { ok: false, error: 'OnlyOffice timeout' };
    }
    // Intentar con URL alternativa (docs.logismart.ar en producción)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      await fetch('http://docs.logismart.ar', { signal: controller.signal });
      clearTimeout(timeout);
      return { ok: true };
    } catch {
      return { ok: false, error: 'OnlyOffice unreachable' };
    }
  }
}

// Verificar variables críticas
function checkEnv(): { ok: boolean; missing: string[] } {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter(v => !process.env[v]);
  return { ok: missing.length === 0, missing };
}

export const readyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/ready', async (_req, reply) => {
    const checks: Record<string, any> = {};
    
    // DB check
    checks.db = await checkDB(app);
    
    // Redis check
    checks.redis = await checkRedis();
    
    // Storage check
    checks.storage = await checkStorage();
    
    // OnlyOffice check
    checks.onlyoffice = await checkOnlyOffice();
    
    // Environment variables check
    checks.env = checkEnv();
    
    // Determine if all critical checks passed
    const allOk = 
      checks.db.ok && 
      checks.redis.ok && 
      checks.storage.ok &&
      checks.env.ok;
    
    // OnlyOffice is optional for basic readiness
    const ready = allOk;
    
    const response = {
      ready,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        db: checks.db.ok ? 'ok' : `error: ${checks.db.error}`,
        redis: checks.redis.ok ? 'ok' : `error: ${checks.redis.error}`,
        storage: checks.storage.ok ? 'ok' : `error: ${checks.storage.error}`,
        onlyoffice: checks.onlyoffice.ok ? 'ok' : `error: ${checks.onlyoffice.error}`,
        env: checks.env.ok ? 'ok' : `missing: ${checks.env.missing.join(', ')}`,
      },
      latencies: {
        db: checks.db.latency,
        redis: checks.redis.latency,
      }
    };
    
    return reply.code(ready ? 200 : 503).send(response);
  });
};
