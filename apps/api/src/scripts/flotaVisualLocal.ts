/** Standalone, loopback-only visual preview. Never imported by the application. */
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { createServer, request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, join, normalize } from 'node:path';
import fleetOpsRoutes from '../routes/fleet-ops.js';
import flotaRoutes from '../routes/flota.js';
import maintenanceRoutes from '../routes/maintenance.js';
import { inspeccionesRoutes } from '../routes/inspecciones.js';
import { maintenanceInterventionsRoutes } from '../routes/maintenance-interventions.js';
import { driverHubRoutes } from '../routes/driver-hub.js';
import multipart from '@fastify/multipart';

// Configurable por env:
//   FLOTA_DB_URL        → base de datos (default: demo local)
//   FLOTA_TENANT_SLUG   → slug del tenant a usar (default: el que tenga más vehículos; si no hay, el demo)
//   FLOTA_SEED=1        → corre el seed demo al arrancar
const databaseUrl = process.env.FLOTA_DB_URL || 'postgresql://leonardocastillo@localhost:5432/sgi_flota_visual_local_20260916';
// Storage local para uploads del preview (fotos del hub, docs, logos)
const storagePath = resolve(process.cwd(), process.env.STORAGE_LOCAL_PATH || 'uploads-local');
process.env.STORAGE_LOCAL_PATH = storagePath;
process.env.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3010';
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

let tenant: any = null;
const slug = process.env.FLOTA_TENANT_SLUG;
if (slug) tenant = await prisma.tenant.findUnique({ where: { slug } });
if (!tenant) {
  // Elegir el tenant con más vehículos (copia de producción)
  const porTenant = await (prisma as any).vehiculo.groupBy({ by: ['tenantId'], _count: { _all: true } }).catch(() => []);
  const top = (porTenant || []).sort((a: any, b: any) => b._count._all - a._count._all)[0];
  if (top) tenant = await prisma.tenant.findUnique({ where: { id: top.tenantId } });
}
if (!tenant) {
  tenant = await prisma.tenant.upsert({ where: { slug: 'flota-visual-local' }, update: {}, create: { slug: 'flota-visual-local', name: 'Flota 360 · Datos de prueba', status: 'ACTIVE', licensePlan: 'PREMIUM' } });
}
console.log(`Preview tenant: ${tenant.name} (${tenant.slug})`);

const app = Fastify();
app.decorate('prisma', prisma);
app.addHook('onRequest', async (req) => {
  (req as any).db = { tenantId: tenant.id, prisma };
  (req as any).auth = { tenantId: tenant.id, tenantRole: 'TENANT_ADMIN' };
});
await app.register(fleetOpsRoutes, { prefix: '/fleet-ops' });
await app.register(flotaRoutes, { prefix: '/flota' });
await app.register(maintenanceRoutes, { prefix: '/maintenance' });
await app.register(inspeccionesRoutes, { prefix: '/inspecciones' });
await app.register(maintenanceInterventionsRoutes, { prefix: '/maintenance-interventions' });
await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } });
await app.register(driverHubRoutes, { prefix: '/driver-hub' });
await app.ready();

if (process.env.FLOTA_SEED === '1') {
  const seed = await app.inject({ method: 'POST', url: '/fleet-ops/seed-demo' });
  if (seed.statusCode !== 200) throw new Error(`Demo seed failed: ${seed.body}`);
  console.log('Demo data ready:', seed.body);
}

const API_PREFIXES = /^\/api\/(fleet-ops|flota|maintenance|maintenance-interventions|inspecciones|driver-hub)(\/|$)/;

const server = createServer(async (req, res) => {
  const path = (req.url || '/').split('?')[0].replace(/\/$/, '');
  const json = (data: unknown, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  // Servir archivos subidos (fotos del hub, documentos, logos)
  if (path.startsWith('/uploads/')) {
    const rel = normalize(path.replace(/^\/uploads\//, '')).replace(/^(\.\.[/\\])+/, '');
    const filePath = join(storagePath, rel);
    if (!filePath.startsWith(storagePath) || !existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    const mime: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
    try {
      const buf = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': mime[extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' });
      res.end(buf);
    } catch { res.writeHead(500); res.end('Error'); }
    return;
  }
  if (path.startsWith('/api')) {
    if (path === '/api/auth/me') return json({ user: { id: 'local-preview', name: 'Demostración local', email: 'demo@localhost', globalRole: 'SUPER_ADMIN' }, activeTenant: { id: tenant.id, name: tenant.name, slug: tenant.slug }, tenantRole: 'SUPER_ADMIN' });
    if (API_PREFIXES.test(path)) {
      // Reenviar método + body al router real (copia local: escritura habilitada)
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const rawBody = Buffer.concat(chunks);
      const response = await app.inject({
        method: (req.method || 'GET') as any,
        url: (req.url || '').replace(/^\/api/, '').replace(/\/(?=\?|$)/, ''),
        headers: (req.headers['content-type'] || rawBody.length) ? { 'content-type': req.headers['content-type'] || 'application/json' } : {},
        payload: rawBody.length ? rawBody : undefined,
      });
      res.writeHead(response.statusCode, { 'Content-Type': 'application/json' }); res.end(response.body); return;
    }
    return json({});
  }
  const upstream = httpRequest({ hostname: '127.0.0.1', port: 3000, path: req.url, method: req.method, headers: { ...req.headers, host: 'localhost:3010' } }, (response) => { res.writeHead(response.statusCode || 502, response.headers); response.pipe(res); });
  upstream.on('error', () => { res.writeHead(502); res.end('Iniciar la web local en puerto 3000.'); });
  req.pipe(upstream);
});
server.listen(3010, '127.0.0.1', () => console.log(`LOCAL VISUAL PREVIEW http://localhost:3010/flota-360/ — db ${databaseUrl.split('@').pop()} — uploads en ${storagePath} — escritura habilitada (copia local)`));
async function stop() { server.close(); await app.close(); await prisma.$disconnect(); process.exit(0); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
