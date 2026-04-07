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

  const auditorUrl = process.env.DATABASE_URL_AUDITOR;
  if (!auditorUrl) throw new Error('DATABASE_URL_AUDITOR is required');
  const prismaAuditor = new PrismaClient({
    datasourceUrl: auditorUrl,
  });

  await prisma.$connect();
  await prismaAuditor.$connect();

  app.decorate('prisma', prisma);
  app.decorate('prismaAuditor', prismaAuditor);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    await prismaAuditor.$disconnect();
  });
});
