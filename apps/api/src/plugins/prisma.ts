import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    prismaAuditor: PrismaClient;
  }
}

export const prismaPlugin = fp(async (app: FastifyInstance) => {
  const prisma = new PrismaClient();

  await prisma.$connect();
  app.decorate('prisma', prisma);

  const auditorUrl = process.env.DATABASE_URL_AUDITOR;
  if (auditorUrl) {
    const prismaAuditor = new PrismaClient({
      datasourceUrl: auditorUrl,
    });
    await prismaAuditor.$connect();
    app.decorate('prismaAuditor', prismaAuditor);
    app.addHook('onClose', async () => {
      await prismaAuditor.$disconnect();
    });
  } else {
    app.decorate('prismaAuditor', prisma);
    app.log.warn('DATABASE_URL_AUDITOR not set, using default prisma client as auditor fallback');
  }

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
