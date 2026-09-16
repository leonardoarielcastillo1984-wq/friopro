import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';

// ═══════════════════════════════════════════════════════════════
// FLOTA 360 — Rutas NUEVAS y ADITIVAS.
// No reemplaza ni modifica /flota, /maintenance, /inspecciones ni
// /maintenance-interventions. Solo agrega:
//   1) Agregaciones de solo lectura (Centro de Trabajo, Costos Ejecutivos)
//      que leen de las tablas existentes sin escribir en ellas.
//   2) CRUD de Conjuntos Operativos (tabla nueva).
//   3) CRUD + sincronización de Catálogo de Componentes / Reglas de Servicio
//      (tabla nueva que, al aplicarse, crea/actualiza un MaintenancePlan real).
// ═══════════════════════════════════════════════════════════════

export default async function fleetOpsRoutes(app: FastifyInstance) {
  const prisma = () => app.prisma as any;

  // ─────────────────────────────────────────────────────────────
  // CENTRO DE TRABAJO — vista operacional del día (solo lectura, agrega datos existentes)
  // ─────────────────────────────────────────────────────────────
  app.get('/centro-de-trabajo', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const now = new Date();
    const inicioHoy = new Date(now); inicioHoy.setHours(0, 0, 0, 0);
    const finHoy = new Date(now); finHoy.setHours(23, 59, 59, 999);
    const en7dias = new Date(now); en7dias.setDate(now.getDate() + 7);

    const [vehiculos, workOrders, vencimientos] = await Promise.all([
      prisma().vehiculo.findMany({ where: { tenantId }, select: { id: true, dominio: true, tipo: true, status: true, notas: true, maintenanceAssetId: true } }),
      prisma().workOrder.findMany({
        where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] } },
        include: { asset: { select: { id: true, code: true, name: true } }, technician: { select: { id: true, name: true } } },
        orderBy: { scheduledDate: 'asc' },
      }),
      prisma().vencimientoDocumento.findMany({
        where: { tenantId, renovado: false, fechaVto: { lte: en7dias } },
        include: { vehiculo: { select: { id: true, dominio: true } } },
        orderBy: { fechaVto: 'asc' },
      }),
    ]);

    const vehMapByAsset = new Map<string, any>(vehiculos.filter((v: any) => v.maintenanceAssetId).map((v: any) => [v.maintenanceAssetId, v]));

    const ordenes = workOrders.map((o: any) => {
      const veh = o.assetId ? vehMapByAsset.get(o.assetId) : null;
      const vencida = o.scheduledDate && new Date(o.scheduledDate) < inicioHoy;
      const esHoy = o.scheduledDate && new Date(o.scheduledDate) >= inicioHoy && new Date(o.scheduledDate) <= finHoy;
      let origen = 'Preventivo';
      if (o.origen === 'INSPECCION') origen = 'Inspección QR';
      else if (o.planId) origen = 'Plan de mantenimiento';
      else if (o.type === 'CORRECTIVE') origen = 'Correctivo';
      return {
        id: o.id,
        codigo: o.code,
        titulo: o.title,
        tipo: o.type,
        prioridad: o.priority,
        estado: o.status,
        vehiculo: veh ? { id: veh.id, dominio: veh.dominio, tipo: veh.tipo } : null,
        activoNombre: o.asset?.name || o.activoNombreLibre || null,
        responsable: o.technician?.name || null,
        vence: o.scheduledDate,
        vencida,
        esHoy,
        origen,
      };
    });

    const trabajoHoy = ordenes.filter((o: any) => o.esHoy);
    const vencidas = ordenes.filter((o: any) => o.vencida);
    const enProceso = ordenes.filter((o: any) => o.estado === 'IN_PROGRESS');
    const pendientes = ordenes.filter((o: any) => o.estado === 'PENDING');

    const inmovilizados = vehiculos
      .filter((v: any) => v.status === 'EN_TALLER')
      .map((v: any) => ({ id: v.id, dominio: v.dominio, tipo: v.tipo, notas: v.notas }));

    const proximosVencimientos = vencimientos.map((v: any) => ({
      id: v.id,
      tipo: v.tipo,
      vehiculo: v.vehiculo?.dominio || null,
      fechaVto: v.fechaVto,
    }));

    return reply.send({
      resumen: {
        vencidas: vencidas.length,
        hoy: trabajoHoy.length,
        enProceso: enProceso.length,
        pendientes: pendientes.length,
      },
      trabajoHoy,
      vencidas,
      enProceso,
      pendientes,
      inmovilizados,
      proximosVencimientos,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CONJUNTOS OPERATIVOS (tractor + semi) — tabla nueva, no toca Vehiculo
  // ─────────────────────────────────────────────────────────────
  app.get('/conjuntos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { estado } = req.query as any;
    const conjuntos = await prisma().conjuntoOperativo.findMany({
      where: { tenantId, ...(estado ? { estado } : {}) },
      include: {
        tractor: { select: { id: true, dominio: true, tipo: true, status: true, currentOdometer: true } },
        semi: { select: { id: true, dominio: true, tipo: true, status: true, currentOdometer: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ conjuntos });
  });

  app.get('/conjuntos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const conjunto = await prisma().conjuntoOperativo.findFirst({
      where: { id, tenantId },
      include: {
        tractor: true,
        semi: true,
        eventos: { orderBy: { fecha: 'desc' } },
      },
    });
    if (!conjunto) return reply.code(404).send({ error: 'No encontrado' });
    return reply.send({ conjunto });
  });

  app.post('/conjuntos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      tractorId: z.string().uuid(),
      semiId: z.string().uuid(),
      ubicacion: z.string().optional(),
      viajeId: z.string().optional(),
      notas: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const [tractor, semi] = await Promise.all([
      prisma().vehiculo.findFirst({ where: { id: body.data.tractorId, tenantId } }),
      prisma().vehiculo.findFirst({ where: { id: body.data.semiId, tenantId } }),
    ]);
    if (!tractor) return reply.code(404).send({ error: 'Tractor no encontrado' });
    if (!semi) return reply.code(404).send({ error: 'Semi no encontrado' });

    // Evitar acoplar un tractor o semi que ya está ACOPLADO en otro conjunto activo
    const yaAcoplado = await prisma().conjuntoOperativo.findFirst({
      where: { tenantId, estado: 'ACOPLADO', OR: [{ tractorId: body.data.tractorId }, { semiId: body.data.semiId }] },
    });
    if (yaAcoplado) {
      return reply.code(409).send({ error: 'El tractor o el semi ya forman parte de un conjunto operativo acoplado. Desacoplá primero.' });
    }

    const conjunto = await prisma().conjuntoOperativo.create({
      data: {
        tenantId,
        tractorId: body.data.tractorId,
        semiId: body.data.semiId,
        estado: 'ACOPLADO',
        ubicacion: body.data.ubicacion,
        viajeId: body.data.viajeId,
        notas: body.data.notas,
        eventos: {
          create: {
            tenantId,
            tipo: 'ACOPLE',
            ubicacion: body.data.ubicacion,
            viajeId: body.data.viajeId,
            notas: body.data.notas,
          },
        },
      },
      include: { tractor: true, semi: true },
    });
    return reply.code(201).send({ conjunto });
  });

  app.post('/conjuntos/:id/desacoplar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({ ubicacion: z.string().optional(), notas: z.string().optional() });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const conjunto = await prisma().conjuntoOperativo.findFirst({ where: { id, tenantId } });
    if (!conjunto) return reply.code(404).send({ error: 'No encontrado' });
    if (conjunto.estado === 'DESACOPLADO') return reply.code(409).send({ error: 'Ya está desacoplado' });

    await prisma().conjuntoOperativo.update({
      where: { id },
      data: {
        estado: 'DESACOPLADO',
        fechaDesacople: new Date(),
        eventos: {
          create: { tenantId, tipo: 'DESACOPLE', ubicacion: body.data.ubicacion, notas: body.data.notas },
        },
      },
    });
    return reply.send({ ok: true });
  });

  // Costo consolidado de un conjunto: suma costos de OT (WorkOrder.totalCost) de ambos MaintenanceAsset
  // + combustible del tractor (el semi no consume combustible propio).
  app.get('/conjuntos/:id/costos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const conjunto = await prisma().conjuntoOperativo.findFirst({ where: { id, tenantId }, include: { tractor: true, semi: true } });
    if (!conjunto) return reply.code(404).send({ error: 'No encontrado' });

    const hace6meses = new Date(); hace6meses.setMonth(hace6meses.getMonth() - 6);

    const [otTractor, otSemi, combustible] = await Promise.all([
      conjunto.tractor.maintenanceAssetId
        ? prisma().workOrder.aggregate({ where: { tenantId, assetId: conjunto.tractor.maintenanceAssetId, completedAt: { gte: hace6meses } }, _sum: { totalCost: true } })
        : { _sum: { totalCost: 0 } },
      conjunto.semi.maintenanceAssetId
        ? prisma().workOrder.aggregate({ where: { tenantId, assetId: conjunto.semi.maintenanceAssetId, completedAt: { gte: hace6meses } }, _sum: { totalCost: true } })
        : { _sum: { totalCost: 0 } },
      prisma().registroCombustible.aggregate({ where: { tenantId, vehiculoId: conjunto.tractorId, fecha: { gte: hace6meses } }, _sum: { costoTotal: true } }),
    ]);

    const costoTractor = otTractor._sum.totalCost || 0;
    const costoSemi = otSemi._sum.totalCost || 0;
    const costoCombustible = combustible._sum.costoTotal || 0;
    const hayDatos = costoTractor > 0 || costoSemi > 0 || costoCombustible > 0;

    return reply.send({
      hayDatos,
      periodo: 'Últimos 6 meses',
      costoTractor,
      costoSemi,
      costoCombustible,
      costoTotal: costoTractor + costoSemi + costoCombustible,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CATÁLOGO DE COMPONENTES Y REGLAS DE SERVICIO — sincroniza MaintenancePlan real
  // ─────────────────────────────────────────────────────────────
  app.get('/component-rules', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const rules = await prisma().maintenanceComponentRule.findMany({
      where: { tenantId },
      include: { repuestosRequeridos: true, aplicaciones: true },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ rules });
  });

  const ruleSchema = z.object({
    nombre: z.string().min(1),
    categoria: z.string().default('GENERAL'),
    tipoActivoAplicable: z.string().default('TODOS'),
    frecuenciaKm: z.number().optional().nullable(),
    frecuenciaDias: z.number().int().optional().nullable(),
    horasMotor: z.number().optional().nullable(),
    ciclos: z.number().int().optional().nullable(),
    condicionObservada: z.boolean().optional().default(false),
    kmAnticipacion: z.number().optional().nullable(),
    diasAnticipacion: z.number().int().optional().nullable(),
    criticidad: z.enum(['BAJA', 'MEDIA', 'ALTA']).default('MEDIA'),
    duracionEstimada: z.number().optional().nullable(),
    accionVencimiento: z.enum(['ALERTA', 'SUGERENCIA_OT', 'GENERAR_OT']).default('ALERTA'),
    checklistPlantillaId: z.string().uuid().optional().nullable(),
    repuestos: z.array(z.object({ sparePartId: z.string().uuid(), cantidad: z.number().int().positive().default(1) })).optional().default([]),
  });

  app.post('/component-rules', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = ruleSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const { repuestos, ...data } = body.data;
    const rule = await prisma().maintenanceComponentRule.create({
      data: {
        tenantId,
        ...data,
        repuestosRequeridos: { create: repuestos.map(r => ({ sparePartId: r.sparePartId, cantidad: r.cantidad })) },
      },
      include: { repuestosRequeridos: true },
    });
    return reply.code(201).send({ rule });
  });

  app.put('/component-rules/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const body = ruleSchema.partial().safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const { repuestos, ...data } = body.data;
    const existing = await prisma().maintenanceComponentRule.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: 'No encontrado' });
    await prisma().maintenanceComponentRule.update({ where: { id }, data });
    if (repuestos) {
      await prisma().maintenanceComponentRuleSparePart.deleteMany({ where: { ruleId: id } });
      if (repuestos.length) {
        await prisma().maintenanceComponentRuleSparePart.createMany({ data: repuestos.map(r => ({ ruleId: id, sparePartId: r.sparePartId, cantidad: r.cantidad })) });
      }
    }
    return reply.send({ ok: true });
  });

  app.delete('/component-rules/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await prisma().maintenanceComponentRule.deleteMany({ where: { id, tenantId } });
    return reply.send({ ok: true });
  });

  // Aplica una regla a un activo: crea/actualiza un MaintenancePlan real vinculado.
  // No modifica ni borra ningún MaintenancePlan preexistente creado manualmente.
  app.post('/component-rules/:id/aplicar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({ assetId: z.string().uuid() });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const rule = await prisma().maintenanceComponentRule.findFirst({ where: { id, tenantId } });
    if (!rule) return reply.code(404).send({ error: 'Regla no encontrada' });

    const asset = await prisma().maintenanceAsset.findFirst({ where: { id: body.data.assetId, tenantId } });
    if (!asset) return reply.code(404).send({ error: 'Activo no encontrado' });

    const existingApp = await prisma().maintenanceComponentRuleAsset.findFirst({ where: { ruleId: id, assetId: body.data.assetId } });

    const frequencyUnit = rule.frecuenciaKm ? 'KM' : 'DAYS';
    const frequencyValue = rule.frecuenciaDias || 30;

    let plan;
    if (existingApp?.generatedPlanId) {
      plan = await prisma().maintenancePlan.update({
        where: { id: existingApp.generatedPlanId },
        data: {
          title: rule.nombre,
          type: 'PREVENTIVE',
          frequencyValue,
          frequencyUnit,
          triggerKm: rule.frecuenciaKm || null,
        },
      });
    } else {
      const code = `CR-${rule.id.slice(0, 6)}-${asset.code}`.toUpperCase();
      plan = await prisma().maintenancePlan.create({
        data: {
          tenantId,
          code,
          title: rule.nombre,
          description: `Generado desde catálogo de componentes (Flota 360): ${rule.nombre}`,
          type: 'PREVENTIVE',
          status: 'ACTIVE',
          assetId: asset.id,
          frequencyValue,
          frequencyUnit,
          triggerKm: rule.frecuenciaKm || null,
        },
      });
    }

    const aplicacion = await prisma().maintenanceComponentRuleAsset.upsert({
      where: { ruleId_assetId: { ruleId: id, assetId: body.data.assetId } },
      update: { generatedPlanId: plan.id, isActive: true },
      create: { ruleId: id, assetId: body.data.assetId, generatedPlanId: plan.id, isActive: true },
    });

    return reply.send({ ok: true, plan, aplicacion });
  });

  // ─────────────────────────────────────────────────────────────
  // COSTOS EJECUTIVOS DE FLOTA — agrega datos existentes, sin escribir nada
  // ─────────────────────────────────────────────────────────────
  app.get('/costos-ejecutivos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const finMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [combustibleMes, combustibleMesAnterior, otMes, otMesAnterior, vehiculos] = await Promise.all([
      prisma().registroCombustible.aggregate({ where: { tenantId, fecha: { gte: inicioMes } }, _sum: { costoTotal: true } }),
      prisma().registroCombustible.aggregate({ where: { tenantId, fecha: { gte: inicioMesAnterior, lte: finMesAnterior } }, _sum: { costoTotal: true } }),
      prisma().workOrder.aggregate({ where: { tenantId, completedAt: { gte: inicioMes } }, _sum: { totalCost: true } }),
      prisma().workOrder.aggregate({ where: { tenantId, completedAt: { gte: inicioMesAnterior, lte: finMesAnterior } }, _sum: { totalCost: true } }),
      prisma().vehiculo.findMany({ where: { tenantId }, select: { currentOdometer: true } }),
    ]);

    const costoCombustible = combustibleMes._sum.costoTotal || 0;
    const costoCombustibleAnterior = combustibleMesAnterior._sum.costoTotal || 0;
    const costoMantenimiento = otMes._sum.totalCost || 0;
    const costoMantenimientoAnterior = otMesAnterior._sum.totalCost || 0;

    const costoTotalMes = costoCombustible + costoMantenimiento;
    const costoTotalMesAnterior = costoCombustibleAnterior + costoMantenimientoAnterior;
    const hayDatos = costoTotalMes > 0;
    const hayDatosAnterior = costoTotalMesAnterior > 0;

    const variacion = hayDatos && hayDatosAnterior
      ? Math.round(((costoTotalMes - costoTotalMesAnterior) / costoTotalMesAnterior) * 10000) / 100
      : null;

    return reply.send({
      hayDatos,
      costoTotalMes,
      costoCombustible,
      costoMantenimiento,
      variacionVsMesAnterior: variacion,
      comparacionDisponible: hayDatosAnterior,
    });
  });
}
