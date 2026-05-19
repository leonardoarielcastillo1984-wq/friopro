import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant';

// GET /garantias - Listar todas las garantías
export async function listGarantias(app: FastifyInstance, req: FastifyRequest, reply: FastifyReply) {
  const tenantId = await getEffectiveTenantId(req, app.prisma);
  if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

  const { vehiculoId, status } = req.query as any;
  const where: any = { tenantId };
  if (vehiculoId) where.vehiculoId = vehiculoId;
  if (status) where.status = status;

  const garantias = await (app.prisma as any).garantiaVehiculo.findMany({
    where,
    include: { vehiculo: { select: { dominio: true, marca: true, modelo: true } } },
    orderBy: { fechaFin: 'asc' },
  });

  // Agregar alertas
  const hoy = new Date();

  const garantiasConAlerta = (garantias as any[]).map((g: any) => {
    const diasRestantes = Math.ceil((new Date(g.fechaFin).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    const alerta = g.status === 'VENCIDA' ? 'VENCIDA' :
      diasRestantes <= 0 ? 'VENCIDA' :
      diasRestantes <= 30 ? 'PROXIMA' :
      null;
    return { ...g, diasRestantes, alerta };
  });

  return reply.send({ garantias: garantiasConAlerta });
}

// POST /garantias - Crear garantía
export async function createGarantia(app: FastifyInstance, req: FastifyRequest, reply: FastifyReply) {
  const tenantId = await getEffectiveTenantId(req, app.prisma);
  if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

  const schema = z.object({
    vehiculoId: z.string().uuid(),
    tipo: z.enum(['MOTOR', 'CAJA', 'DIFERENCIAL', 'NEUMATICOS', 'BATERIA', 'OTRO']),
    proveedor: z.string().optional(),
    numero: z.string().optional(),
    fechaInicio: z.string().datetime().optional(),
    fechaFin: z.string().datetime(),
    kilometrajeInicio: z.number().default(0),
    kilometrajeLimite: z.number().optional(),
    descripcion: z.string().optional(),
  });

  const body = schema.safeParse(req.body);
  if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

  const garantia = await (app.prisma as any).garantiaVehiculo.create({
    data: { 
      ...body.data, 
      tenantId, 
      fechaInicio: body.data.fechaInicio ? new Date(body.data.fechaInicio) : new Date() 
    },
  });

  return reply.code(201).send({ garantia });
}

// DELETE /garantias/:id
export async function deleteGarantia(app: FastifyInstance, req: FastifyRequest, reply: FastifyReply) {
  const tenantId = await getEffectiveTenantId(req, app.prisma);
  if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params as any;

  await (app.prisma as any).garantiaVehiculo.deleteMany({ where: { id, tenantId } });
  return reply.send({ ok: true });
}

export default async function garantiasRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => listGarantias(app, req, reply));
  app.post('/', async (req, reply) => createGarantia(app, req, reply));
  app.delete('/:id', async (req, reply) => deleteGarantia(app, req, reply));
}
