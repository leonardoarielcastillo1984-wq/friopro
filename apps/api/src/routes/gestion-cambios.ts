import { isSuperAdmin, getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  DIMENSIONES,
  DIMENSION_TO_COLUMN,
  computeNivelGlobal,
  nivelesDesdeCambio,
  getRecomendaciones,
  nextStatuses,
} from '../services/changeManagement.js';

const nivelEnum = z.enum(['BAJO', 'MEDIO', 'ALTO']);

const createSchema = z.object({
  titulo: z.string().min(1),
  descripcion: z.string().min(1),
  tipo: z.enum(['PROCESO', 'ORGANIZACIONAL', 'PRODUCTO_SERVICIO', 'INFRAESTRUCTURA', 'PROVEEDOR', 'NORMATIVO', 'OTRO']),
  origen: z.enum(['AUDITORIA', 'NO_CONFORMIDAD', 'MEJORA', 'CLIENTE', 'LEGAL', 'INTERNO', 'OTRO']),
  impactoCalidad: nivelEnum.default('BAJO'),
  impactoSST: nivelEnum.default('BAJO'),
  impactoAmbiental: nivelEnum.default('BAJO'),
  // Dimensiones extendidas (aditivas, opcionales)
  impactoOperativo: nivelEnum.optional(),
  impactoTecnologico: nivelEnum.optional(),
  impactoLegal: nivelEnum.optional(),
  impactoContinuidad: nivelEnum.optional(),
  responsableId: z.string().uuid().optional(),
  aprobadorId: z.string().uuid().optional(),
  fechaPrevista: z.string().optional(),
  recursosNecesarios: z.string().optional(),
  capacitacionRequerida: z.boolean().default(false),
  requiereComunicacion: z.boolean().optional(),
  documentosAfectados: z.string().optional(),
  riesgosIdentificados: z.string().optional(),
});

// Recalcula el nivel global a partir de las columnas resumen de un registro.
function recomputeNivel(record: Record<string, any>): string {
  return computeNivelGlobal(nivelesDesdeCambio(record));
}

async function logHistorial(tx: any, cambioId: string, tenantId: string, accion: string, detalle: string, userId?: string, userName?: string) {
  try {
    await tx.gestionCambioHistorial.create({
      data: { cambioId, tenantId, accion, detalle, userId: userId || null, userName: userName || null },
    });
  } catch { /* no bloquear */ }
}

async function genCode(tx: any, tenantId: string): Promise<string> {
  const count = await tx.gestionCambio.count({ where: { tenantId } });
  return `GC-${String(count + 1).padStart(4, '0')}`;
}

export default async function gestionCambiosRoutes(app: FastifyInstance) {
  // GET /gestion-cambios
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { status, tipo } = req.query as any;
    const where: any = { tenantId: req.db.tenantId, deletedAt: null };
    if (status) where.status = status;
    if (tipo) where.tipo = tipo;
    const cambios = await app.runWithDbContext(req, async (tx: any) => {
      return tx.gestionCambio.findMany({ where, orderBy: { createdAt: 'desc' } });
    });
    return reply.send({ cambios });
  });

  // GET /gestion-cambios/stats
  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const stats = await app.runWithDbContext(req, async (tx: any) => {
      const [total, solicitados, enRevision, aprobados, implementados, enVerificacion, rechazados, cerrados] = await Promise.all([
        tx.gestionCambio.count({ where: { tenantId, deletedAt: null } }),
        tx.gestionCambio.count({ where: { tenantId, deletedAt: null, status: 'SOLICITADO' } }),
        tx.gestionCambio.count({ where: { tenantId, deletedAt: null, status: 'EN_REVISION' } }),
        tx.gestionCambio.count({ where: { tenantId, deletedAt: null, status: 'APROBADO' } }),
        tx.gestionCambio.count({ where: { tenantId, deletedAt: null, status: 'IMPLEMENTADO' } }),
        // EN_VERIFICACION incluye el estado legacy VERIFICADO para compatibilidad
        tx.gestionCambio.count({ where: { tenantId, deletedAt: null, status: { in: ['EN_VERIFICACION', 'VERIFICADO'] } } }),
        tx.gestionCambio.count({ where: { tenantId, deletedAt: null, status: 'RECHAZADO' } }),
        tx.gestionCambio.count({ where: { tenantId, deletedAt: null, status: 'CERRADO' } }),
      ]);
      return { total, solicitados, enRevision, aprobados, implementados, enVerificacion, rechazados, cerrados };
    });
    return reply.send(stats);
  });

  // GET /gestion-cambios/:id
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const cambio = await app.runWithDbContext(req, async (tx: any) => {
      return tx.gestionCambio.findFirst({
        where: { id, tenantId: req.db.tenantId, deletedAt: null },
        include: {
          historial: { orderBy: { createdAt: 'desc' } },
          evaluaciones: true,
          procesos: true,
          partes: true,
          riesgos: true,
          documentos: true,
          evidencias: { orderBy: { fecha: 'desc' } },
          verificaciones: { orderBy: { createdAt: 'desc' } },
        },
      });
    });
    if (!cambio) return reply.code(404).send({ error: 'Cambio no encontrado' });
    return reply.send({ cambio });
  });

  // POST /gestion-cambios
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const data = createSchema.parse(body);
    const cambio = await app.runWithDbContext(req, async (tx: any) => {
      const code = await genCode(tx, tenantId);
      const nivelGlobal = recomputeNivel(data);
      const cambio = await tx.gestionCambio.create({
        data: {
          ...data,
          code,
          tenantId,
          nivelGlobal,
          fechaPrevista: data.fechaPrevista ? new Date(data.fechaPrevista) : null,
          creadoPor: req.db.userId || null,
        },
      });
      await logHistorial(tx, cambio.id, tenantId, 'CREADO', `Cambio "${cambio.titulo}" creado`, req.db.userId, req.db.userName);
      return cambio;
    });
    return reply.code(201).send({ cambio });
  });

  // PUT /gestion-cambios/:id
  app.put('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const { id: _id, tenantId: _tid, createdAt: _ca, deletedAt: _da, historial: _h, code: _c, ...data } = body;
    if (data.fechaPrevista) data.fechaPrevista = new Date(data.fechaPrevista);
    if (data.fechaAprobacion) data.fechaAprobacion = new Date(data.fechaAprobacion);
    if (data.fechaCierre) data.fechaCierre = new Date(data.fechaCierre);
    const cambio = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
      if (!existing) throw new Error('Cambio no encontrado');
      // Recalcular nivel global si se tocó alguna dimensión de impacto
      const merged = { ...existing, ...data };
      const nivelGlobal = recomputeNivel(merged);
      if (nivelGlobal !== existing.nivelGlobal) data.nivelGlobal = nivelGlobal;
      const cambio = await tx.gestionCambio.update({ where: { id }, data });
      await logHistorial(tx, id, req.db.tenantId, 'ACTUALIZADO', `Estado: ${cambio.status}`, req.db.userId, req.db.userName);
      return cambio;
    });
    return reply.send({ cambio });
  });

  // PUT /gestion-cambios/:id/status
  app.put('/:id/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const { status, motivoRechazo, verificacion } = body;
    const updateData: any = { status };
    if (status === 'APROBADO') updateData.fechaAprobacion = new Date();
    if (status === 'CERRADO') updateData.fechaCierre = new Date();
    if (motivoRechazo) updateData.motivoRechazo = motivoRechazo;
    if (verificacion) updateData.verificacion = verificacion;
    const cambio = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
      if (!existing) throw new Error('Cambio no encontrado');
      const cambio = await tx.gestionCambio.update({ where: { id }, data: updateData });
      await logHistorial(tx, id, req.db.tenantId, `ESTADO_CAMBIADO`, `Nuevo estado: ${status}${motivoRechazo ? ' — ' + motivoRechazo : ''}`, req.db.userId, req.db.userName);
      return cambio;
    });
    return reply.send({ cambio });
  });

  // PUT /gestion-cambios/:id/evaluaciones
  // Upsert de la evaluación multidimensional detallada. Sincroniza las columnas
  // resumen del cambio y recalcula el nivel global (lógica centralizada).
  app.put('/:id/evaluaciones', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;

    const evalSchema = z.object({
      evaluaciones: z.array(z.object({
        dimension: z.enum(DIMENSIONES),
        nivel: nivelEnum,
        justificacion: z.string().optional().nullable(),
        responsableId: z.string().uuid().optional().nullable(),
        fechaEvaluacion: z.string().optional().nullable(),
        evidencia: z.string().optional().nullable(),
      })),
    });
    const { evaluaciones } = evalSchema.parse(body);

    const cambio = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
      if (!existing) throw new Error('Cambio no encontrado');

      const summaryUpdate: Record<string, any> = {};
      for (const ev of evaluaciones) {
        await tx.gestionCambioEvaluacion.upsert({
          where: { cambioId_dimension: { cambioId: id, dimension: ev.dimension } },
          create: {
            cambioId: id,
            tenantId,
            dimension: ev.dimension,
            nivel: ev.nivel,
            justificacion: ev.justificacion ?? null,
            responsableId: ev.responsableId ?? null,
            fechaEvaluacion: ev.fechaEvaluacion ? new Date(ev.fechaEvaluacion) : null,
            evidencia: ev.evidencia ?? null,
          },
          update: {
            nivel: ev.nivel,
            justificacion: ev.justificacion ?? null,
            responsableId: ev.responsableId ?? null,
            fechaEvaluacion: ev.fechaEvaluacion ? new Date(ev.fechaEvaluacion) : null,
            evidencia: ev.evidencia ?? null,
          },
        });
        // Sincronizar la columna resumen correspondiente
        const col = (DIMENSION_TO_COLUMN as any)[ev.dimension];
        if (col) summaryUpdate[col] = ev.nivel;
      }

      const merged = { ...existing, ...summaryUpdate };
      const nivelGlobal = recomputeNivel(merged);
      summaryUpdate.nivelGlobal = nivelGlobal;

      const updated = await tx.gestionCambio.update({ where: { id }, data: summaryUpdate });
      await logHistorial(tx, id, tenantId, 'EVALUACION_ACTUALIZADA', `Nivel global recalculado: ${nivelGlobal}`, req.db.userId, req.db.userName);

      return tx.gestionCambio.findFirst({
        where: { id },
        include: { evaluaciones: true, historial: { orderBy: { createdAt: 'desc' } } },
      });
    });
    return reply.send({ cambio });
  });

  // GET /gestion-cambios/:id/recommendations
  app.get('/:id/recommendations', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const cambio = await app.runWithDbContext(req, async (tx: any) => {
      return tx.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
    });
    if (!cambio) return reply.code(404).send({ error: 'Cambio no encontrado' });
    const niveles: Record<string, string | null> = {};
    for (const dim of DIMENSIONES) {
      niveles[dim] = cambio[(DIMENSION_TO_COLUMN as any)[dim]] ?? null;
    }
    const nivelGlobal = (cambio.nivelGlobal as any) || recomputeNivel(cambio);
    const recomendaciones = getRecomendaciones(nivelGlobal, niveles);
    return reply.send({ nivelGlobal, niveles, recomendaciones });
  });

  // DELETE /gestion-cambios/:id
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
      if (!existing) throw new Error('Cambio no encontrado');
      await tx.gestionCambio.update({ where: { id }, data: { deletedAt: new Date() } });
    });
    return reply.send({ ok: true });
  });

  // FASE 2: Procesos afectados
  app.put('/:id/procesos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const procesosSchema = z.object({
      procesos: z.array(z.object({
        processId: z.string().uuid().optional().nullable(),
        processName: z.string().min(1),
      })),
    });
    const { procesos } = procesosSchema.parse(body);

    await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
      if (!existing) throw new Error('Cambio no encontrado');
      // Eliminar procesos existentes
      await tx.gestionCambioProceso.deleteMany({ where: { cambioId: id } });
      // Crear nuevos procesos
      for (const proc of procesos) {
        await tx.gestionCambioProceso.create({
          data: {
            cambioId: id,
            tenantId,
            processId: proc.processId ?? null,
            processName: proc.processName,
          },
        });
      }
      await logHistorial(tx, id, tenantId, 'PROCESOS_ACTUALIZADOS', `${procesos.length} procesos afectados`, req.db.userId, req.db.userName);
    });
    return reply.send({ ok: true, count: procesos.length });
  });

  // FASE 2: Partes interesadas
  app.put('/:id/partes', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const partesSchema = z.object({
      partes: z.array(z.object({
        stakeholderId: z.string().uuid().optional().nullable(),
        stakeholderName: z.string().min(1),
      })),
    });
    const { partes } = partesSchema.parse(body);

    await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
      if (!existing) throw new Error('Cambio no encontrado');
      await tx.gestionCambioParte.deleteMany({ where: { cambioId: id } });
      for (const parte of partes) {
        await tx.gestionCambioParte.create({
          data: {
            cambioId: id,
            tenantId,
            stakeholderId: parte.stakeholderId ?? null,
            stakeholderName: parte.stakeholderName,
          },
        });
      }
      await logHistorial(tx, id, tenantId, 'PARTES_ACTUALIZADAS', `${partes.length} partes interesadas`, req.db.userId, req.db.userName);
    });
    return reply.send({ ok: true, count: partes.length });
  });

  // FASE 2: Planificación
  app.put('/:id/planificacion', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const planSchema = z.object({
      objetivoCambio: z.string().optional(),
      alcance: z.string().optional(),
      fechaInicioPrevista: z.string().optional(),
      responsableGeneralId: z.string().uuid().optional().nullable(),
      planComunicacion: z.string().optional(),
      planCapacitacion: z.string().optional(),
      planContingencia: z.string().optional(),
      criteriosAceptacion: z.string().optional(),
      condicionesPrevias: z.string().optional(),
    });
    const data = planSchema.parse(body);
    if (data.fechaInicioPrevista) (data as any).fechaInicioPrevista = new Date(data.fechaInicioPrevista);

    await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
      if (!existing) throw new Error('Cambio no encontrado');
      await tx.gestionCambio.update({ where: { id }, data });
      await logHistorial(tx, id, tenantId, 'PLANIFICACION_ACTUALIZADA', 'Planificación del cambio actualizada', req.db.userId, req.db.userName);
    });
    return reply.send({ ok: true });
  });

  // FASE 3: Riesgos vinculados
  app.put('/:id/riesgos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const riesgosSchema = z.object({
      riesgos: z.array(z.object({
        riskId: z.string().uuid().optional().nullable(),
        riskType: z.enum(['RISK', 'OPPORTUNITY']).default('RISK'),
      })),
    });
    const { riesgos } = riesgosSchema.parse(body);

    await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
      if (!existing) throw new Error('Cambio no encontrado');
      await tx.gestionCambioRiesgo.deleteMany({ where: { cambioId: id } });
      for (const r of riesgos) {
        await tx.gestionCambioRiesgo.create({
          data: { cambioId: id, tenantId, riskId: r.riskId ?? null, riskType: r.riskType },
        });
      }
      await logHistorial(tx, id, tenantId, 'RIESGOS_ACTUALIZADOS', `${riesgos.length} riesgos vinculados`, req.db.userId, req.db.userName);
    });
    return reply.send({ ok: true, count: riesgos.length });
  });

  // FASE 3: Documentos vinculados
  app.put('/:id/documentos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const documentosSchema = z.object({
      documentos: z.array(z.object({
        documentId: z.string().uuid().optional().nullable(),
        estadoFrente: z.enum(['PENDIENTE', 'EN_REVISION', 'ACTUALIZADO', 'OBSOLETO']).default('PENDIENTE'),
      })),
    });
    const { documentos } = documentosSchema.parse(body);

    await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
      if (!existing) throw new Error('Cambio no encontrado');
      await tx.gestionCambioDocumento.deleteMany({ where: { cambioId: id } });
      for (const d of documentos) {
        await tx.gestionCambioDocumento.create({
          data: { cambioId: id, tenantId, documentId: d.documentId ?? null, estadoFrente: d.estadoFrente },
        });
      }
      await logHistorial(tx, id, tenantId, 'DOCUMENTOS_ACTUALIZADOS', `${documentos.length} documentos vinculados`, req.db.userId, req.db.userName);
    });
    return reply.send({ ok: true, count: documentos.length });
  });

  // FASE 4: Proyecto vinculado
  app.put('/:id/proyecto', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const proyectoSchema = z.object({
      requiereProyecto: z.boolean().optional(),
      projectId: z.string().uuid().optional().nullable(),
    });
    const data = proyectoSchema.parse(body);

    await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
      if (!existing) throw new Error('Cambio no encontrado');
      await tx.gestionCambio.update({ where: { id }, data });
      await logHistorial(tx, id, tenantId, 'PROYECTO_ACTUALIZADO', 'Proyecto vinculado actualizado', req.db.userId, req.db.userName);
    });
    return reply.send({ ok: true });
  });

  // FASE 5: Evidencias
  app.put('/:id/evidencias', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const evidenciasSchema = z.object({
      evidencias: z.array(z.object({
        titulo: z.string().min(1),
        descripcion: z.string().optional().nullable(),
        tipo: z.enum(['DOCUMENTO', 'FOTO', 'VIDEO', 'REGISTRO', 'OTRO']).default('OTRO'),
        fecha: z.string(),
        fileUrl: z.string().optional().nullable(),
        fileName: z.string().optional().nullable(),
        areaProceso: z.string().optional().nullable(),
      })),
    });
    const { evidencias } = evidenciasSchema.parse(body);

    await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
      if (!existing) throw new Error('Cambio no encontrado');
      await tx.gestionCambioEvidencia.deleteMany({ where: { cambioId: id } });
      for (const e of evidencias) {
        await tx.gestionCambioEvidencia.create({
          data: {
            cambioId: id,
            tenantId,
            titulo: e.titulo,
            descripcion: e.descripcion ?? null,
            tipo: e.tipo,
            fecha: new Date(e.fecha),
            fileUrl: e.fileUrl ?? null,
            fileName: e.fileName ?? null,
            areaProceso: e.areaProceso ?? null,
          },
        });
      }
      await logHistorial(tx, id, tenantId, 'EVIDENCIAS_ACTUALIZADAS', `${evidencias.length} evidencias registradas`, req.db.userId, req.db.userName);
    });
    return reply.send({ ok: true, count: evidencias.length });
  });

  // FASE 5: Verificación de eficacia
  app.put('/:id/verificacion', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const verifSchema = z.object({
      fechaPrevista: z.string().optional().nullable(),
      fechaReal: z.string().optional().nullable(),
      responsableId: z.string().uuid().optional().nullable(),
      metodo: z.string().optional().nullable(),
      criteriosEficacia: z.string().optional().nullable(),
      resultado: z.enum(['EFICAZ', 'PARCIALMENTE_EFICAZ', 'NO_EFICAZ']).optional().nullable(),
      observaciones: z.string().optional().nullable(),
    });
    const data = verifSchema.parse(body);
    if (data.fechaPrevista) (data as any).fechaPrevista = new Date(data.fechaPrevista);
    if (data.fechaReal) (data as any).fechaReal = new Date(data.fechaReal);

    await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
      if (!existing) throw new Error('Cambio no encontrado');
      // Upsert verificación
      const existingVerif = await tx.gestionCambioVerificacion.findFirst({ where: { cambioId: id } });
      if (existingVerif) {
        await tx.gestionCambioVerificacion.update({ where: { id: existingVerif.id }, data });
      } else {
        await tx.gestionCambioVerificacion.create({ data: { cambioId: id, tenantId, ...data } });
      }
      await logHistorial(tx, id, tenantId, 'VERIFICACION_ACTUALIZADA', 'Verificación de eficacia actualizada', req.db.userId, req.db.userName);
    });
    return reply.send({ ok: true });
  });

  // FASE 5: Cierre controlado
  app.put('/:id/cierre', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const cierreSchema = z.object({
      cierreComentario: z.string().optional(),
    });
    const { cierreComentario } = cierreSchema.parse(body);

    await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.gestionCambio.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
      if (!existing) throw new Error('Cambio no encontrado');
      await tx.gestionCambio.update({
        where: { id },
        data: {
          cierreComentario,
          cerradoPor: req.db.userId || null,
          status: 'CERRADO',
          fechaCierre: new Date(),
        },
      });
      await logHistorial(tx, id, tenantId, 'CERRADO', `Cambio cerrado${cierreComentario ? ': ' + cierreComentario : ''}`, req.db.userId, req.db.userName);
    });
    return reply.send({ ok: true });
  });
}
