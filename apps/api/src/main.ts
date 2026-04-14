import 'dotenv/config';

import { buildApp } from './app.js';
import { shutdownQueue } from './jobs/queue.js';
import { systemMonitor } from './services/systemMonitor.js';

const app = await buildApp();

const port = Number(process.env.PORT ?? 3001);

// Graceful shutdown
async function shutdown(signal: string) {
  app.log.info(`Received ${signal}, shutting down gracefully…`);
  await shutdownQueue();
  await app.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

await app.listen({ port, host: '0.0.0.0' });
app.log.info(`SGI 360 API running on port ${port}`);

// Start system monitoring
if (process.env.NODE_ENV === 'production') {
  const monitorInterval = parseInt(process.env.SYSTEM_MONITOR_INTERVAL || '30', 10);
  systemMonitor.startMonitoring(monitorInterval);
  app.log.info(`[SYSTEM_MONITOR] Started with ${monitorInterval} minute intervals`);
}
