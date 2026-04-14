import 'dotenv/config';

import { buildApp } from './app.js';
import { shutdownQueue } from './jobs/queue.js';
import { systemMonitor } from './services/systemMonitor.js';
import { subscriptionMonitor } from './services/subscriptionMonitor.js';
import { healthMonitor, HealthMonitor } from './services/healthMonitor.js';
import { databaseMonitor } from './services/databaseMonitor.js';

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
  
  // Start subscription monitoring
  const subscriptionInterval = parseInt(process.env.SUBSCRIPTION_MONITOR_INTERVAL || '6', 10);
  subscriptionMonitor.startMonitoring(subscriptionInterval);
  app.log.info(`[SUBSCRIPTION_MONITOR] Started with ${subscriptionInterval} hour intervals`);
  
  // Start health monitoring
  healthMonitor.startMonitoring();
  app.log.info(`[HEALTH_MONITOR] Started with 2 minute intervals`);
  
  // Start database monitoring
  const dbMonitorInterval = parseInt(process.env.DATABASE_MONITOR_INTERVAL || '15', 10);
  databaseMonitor.startMonitoring(dbMonitorInterval);
  app.log.info(`[DATABASE_MONITOR] Started with ${dbMonitorInterval} minute intervals`);
}
