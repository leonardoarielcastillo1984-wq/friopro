import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const createSchema = z.object({
  titulo: z.string().min(1),
  descripcion: z.string().min(1),
  tipo: z.enum(['PROCESO', 'ORGANIZACIONAL', 'PRODUCTO_SERVICIO', 'INFRAESTRUCTURA', 'PROVEEDOR', 'NORMATIVO', 'OTRO']),
  origen: z.enum(['AUDITORIA', 'NO_CONFORMIDAD', 'MEJORA', 'CLIENTE', 'LEGAL', 'INTERNO', 'OTRO']),
  impactoCalidad: z.enum(['BAJO', 'MEDIO', 'ALTO']).default('BAJO'),
  impactoSST: z.enum(['BAJO', 'MEDIO', 'ALTO']).default('BAJO'),
  impactoAmbiental: z.enum(['BAJO', 'MEDIO', 'ALTO']).default('BAJO'),
  responsableId: z.string().uuid().optional(),
  aprobadorId: z.string().uuid().optional(),
  fechaPrevista: z.string().optional(),
  recursosNecesarios: z.string().optional(),
  capacitacionRequerida: z.boolean().default(false),
  documentosAfectados: z.string().optional(),
  riesgosIdentificados: z.string().optional(),
});

async function logHistorial(prisma: any, cambioId: string, tenantId: string, accion: string, detalle: string, userId?: string, userName?: string) {
  try {
    await prisma.gestionCambioHistorial.create({
      data: { cambioId, tenantId, accion, detalle, userId: userId || null, userName: userName || null },
    });
  } catch { /* no bloquear */ }
}

async function genCode(prisma: any, tenantId: string): Promise<string> {
  const count = await prisma.gestionCambio.count({ where: { tenantId } });
  return `GC-${String(count + 1).padStart(4, '0')}`;
}

export default async function gestionCambiosRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // GET /gestion-cambios
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { status, tipo } = req.query as any;
    const where: any = { tenantId: req.db.tenantId, deletedAt: null };
    if (status) where.status = status;
    if (tipo) where.tipo = tipo;
    const cambios = await prisma.gestionCambio.findMany({ where, orderBy: { createdAt: 'desc' } });
    return reply.send({ cambios });
  });

  // GET /gestion-cambios/stats
  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const tenantId = req.db.tenantId;
    const [total, solicitados, enRevision, aprobados, implementados, rechazados, cerrados] = await Promise.all([
      prisma.gestionCambio.count({ where: { tenantId, deletedAt: null } }),
      prisma.gestionCambio.count({ where: { tenantId, deletedAt: null, status: 'SOLICITADO' } }),
      prisma.gestionCambio.count({ where: { tenantId, deletedAt: null, status: 'EN_REVISION' } }),
      prisma.gestionCambio.count({ where: { tenantId, deletedAt: null, status: 'APROBADO' } }),
      prisma.gestionCambio.count({ where: { tenantId, deletedAt: null, status: 'IMPLEMENTADO' } }),
      prisma.gestionCambio.count({ where: { tenantId, deletedAt: null, status: 'RECHAZADO' } }),
      prisma.gestionCambio.count({ where: { tenantId, deletedAt: null, status: 'CERRADO' } }),
    ]);
    return reply.send({ total, solicitados, enRevision, aprobados, implementados, rechazados, cerrados });
  });

  // GET /gestion-cambios/:id
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { id } = req.params as { id: string };
    const cambio = await prisma.gestionCambio.findFirst({
      where: { id, tenantId: req.db.tenantId, deletedAt: null },
      include: { historial: { orderBy: { createdAt: 'desc' } } },
    });
    if (!cambio) return reply.code(404).send({ error: 'Cambio no encontrado' });
    return reply.send({ cambio });
  });

  // POST /gestion-cambios
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const tenantId = req.db.tenantId;
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const data = createSchema.parse(body);
    const code = await genCode(prisma, tenantId);
    const cambio = await prisma.gestionCambio.create({
      data: {
        ...data,
        code,
        tenantId,
        fechaPrevista: data.fechaPrevista ? new Date(data.fechaPrevista) : null,
        creadoPor: req.db.userId || null,
      },
    });
    await logHistorial(prisma, cambio.id, tenantId, 'CREADO', `Cambio "${cambio.titulo}" creado`, req.db.userId, req.db.userName);
    return reply.code(201).send({ cambio });
  });

  // PUT /gestion-cambios/:id
  app.put('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const { id: _id, tenantId: _tid, createdAt: _ca, deletedAt: _da, historial: _h, code: _c, ...data } = body;
    const existing = await prisma.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'Cambio no encontrado' });
    if (data.fechaPrevista) data.fechaPrevista = new Date(data.fechaPrevista);
    if (data.fechaAprobacion) data.fechaAprobacion = new Date(data.fechaAprobacion);
    if (data.fechaCierre) data.fechaCierre = new Date(data.fechaCierre);
    const cambio = await prisma.gestionCambio.update({ where: { id }, data });
    await logHistorial(prisma, id, req.db.tenantId, 'ACTUALIZADO', `Estado: ${cambio.status}`, req.db.userId, req.db.userName);
    return reply.send({ cambio });
  });

  // PUT /gestion-cambios/:id/status
  app.put('/:id/status', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const { status, motivoRechazo, verificacion } = body;
    const existing = await prisma.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'Cambio no encontrado' });
    const updateData: any = { status };
    if (status === 'APROBADO') updateData.fechaAprobacion = new Date();
    if (status === 'CERRADO') updateData.fechaCierre = new Date();
    if (motivoRechazo) updateData.motivoRechazo = motivoRechazo;
    if (verificacion) updateData.verificacion = verificacion;
    const cambio = await prisma.gestionCambio.update({ where: { id }, data: updateData });
    await logHistorial(prisma, id, req.db.tenantId, `ESTADO_CAMBIADO`, `Nuevo estado: ${status}${motivoRechazo ? ' — ' + motivoRechazo : ''}`, req.db.userId, req.db.userName);
    return reply.send({ cambio });
  });

  // DELETE /gestion-cambios/:id
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { id } = req.params as { id: string };
    const existing = await prisma.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'Cambio no encontrado' });
    await prisma.gestionCambio.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ ok: true });
  });
}
