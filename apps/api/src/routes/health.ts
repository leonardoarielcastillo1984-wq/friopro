import type { FastifyPluginAsync } from 'fastify';

async function checkRedis(): Promise<boolean> {
  try {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const parsed = new URL(url);
    return await new Promise((resolve) => {
      void import('node:net')
        .then((net) => {
          const socket = net.createConnection(
            { host: parsed.hostname, port: Number(parsed.port) || 6379, timeout: 2000 },
            () => {
              socket.destroy();
              resolve(true);
            },
          );
          socket.on('error', () => {
            socket.destroy();
            resolve(false);
          });
          socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
          });
        })
        .catch(() => resolve(false));
    });
  } catch {
    return false;
  }
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_req, reply) => {
    const checks: Record<string, string> = {};

    // DB check
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      checks.db = 'ok';
    } catch {
      checks.db = 'error';
    }

    // Redis check (TCP connect)
    checks.redis = (await checkRedis()) ? 'ok' : 'error';

    const allOk = Object.values(checks).every((v) => v === 'ok');
    return reply.code(allOk ? 200 : 503).send({
      ok: allOk,
      uptime: process.uptime(),
      checks,
    });
  });
};
