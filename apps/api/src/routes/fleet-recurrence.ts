import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import {
  evaluarRecurrencia,
  evaluarSeguimiento,
  horasParadaPorOT,
  instanciaVigente,
  intervencionesDelComponente,
} from '../services/fleetRecurrence.js';

// ═══════════════════════════════════════════════════════════════
// FLOTA 360 — ANÁLISIS DE REPARACIONES RECURRENTES (aditivo)
// Circuito: catálogo de componentes → instancias instaladas →
// vínculo OT↔componente (clasificación) → reglas → detección →
// caso → alternativas → decisión → ejecución → seguimiento.
// No genera compras ni reemplazos automáticos; todo pasa por
// decisión del responsable con fundamento y trazabilidad.
// ═══════════════════════════════════════════════════════════════

const ESTADOS_CASO = ['DETECTADO', 'EN_ANALISIS', 'ACCION_APROBADA', 'EN_EJECUCION', 'EN_SEGUIMIENTO', 'CERRADO'];
const TIPOS_ALTERNATIVA = ['REPARAR', 'REPARACION_INTEGRAL', 'REEMPLAZAR', 'RECLAMO_GARANTIA'];

function userCtx(req: FastifyRequest) {
  const auth = (req as any).auth;
  return { userId: auth?.userId ?? null, userName: auth?.name ?? auth?.email ?? null };
}

export default async function fleetRecurrenceRoutes(app: FastifyInstance) {
  const prisma = () => app.prisma as any;

  const tenantOr401 = async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) { reply.code(401).send({ error: 'Unauthorized' }); return null; }
    return tenantId;
  };

  // ─────────────────────────────────────────────────────────────
  // CATÁLOGO DE COMPONENTES PADRE
  // ─────────────────────────────────────────────────────────────

  app.get('/componentes', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const componentes = await prisma().fleetComponent.findMany({
      where: { tenantId, isActive: true },
      include: { reglas: { where: { isActive: true } }, _count: { select: { links: true, casos: true } } },
      orderBy: { nombre: 'asc' },
    });
    return reply.send({ componentes });
  });

  app.post('/componentes', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const body = z.object({
      nombre: z.string().min(1),
      categoria: z.string().optional(),
      sinonimos: z.array(z.string()).optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const componente = await prisma().fleetComponent.create({
      data: { tenantId, nombre: body.data.nombre, categoria: body.data.categoria || 'GENERAL', sinonimos: body.data.sinonimos || [] },
    });
    return reply.code(201).send({ componente });
  });

  app.patch('/componentes/:id', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { id } = req.params as any;
    const body = z.object({
      nombre: z.string().min(1).optional(),
      categoria: z.string().optional(),
      sinonimos: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });
    const r = await prisma().fleetComponent.updateMany({ where: { id, tenantId }, data: body.data });
    if (r.count === 0) return reply.code(404).send({ error: 'Componente no encontrado' });
    return reply.send({ ok: true });
  });

  // ─────────────────────────────────────────────────────────────
  // REGLAS DE RECURRENCIA (configurables por componente)
  // ─────────────────────────────────────────────────────────────

  app.post('/componentes/:id/reglas', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { id } = req.params as any;
    const comp = await prisma().fleetComponent.findFirst({ where: { id, tenantId } });
    if (!comp) return reply.code(404).send({ error: 'Componente no encontrado' });
    const body = z.object({
      maxIntervenciones: z.number().int().min(2).max(20).optional(),
      ventanaDias: z.number().int().min(7).max(3650).optional(),
      kmMaxEntre: z.number().positive().optional().nullable(),
      soloFallas: z.boolean().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const regla = await prisma().fleetRecurrenceRule.create({
      data: {
        tenantId, componentId: id,
        maxIntervenciones: body.data.maxIntervenciones ?? 3,
        ventanaDias: body.data.ventanaDias ?? 180,
        kmMaxEntre: body.data.kmMaxEntre ?? null,
        soloFallas: body.data.soloFallas ?? true,
      },
    });
    return reply.code(201).send({ regla });
  });

  app.patch('/reglas/:id', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { id } = req.params as any;
    const body = z.object({
      maxIntervenciones: z.number().int().min(2).max(20).optional(),
      ventanaDias: z.number().int().min(7).max(3650).optional(),
      kmMaxEntre: z.number().positive().optional().nullable(),
      soloFallas: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });
    const r = await prisma().fleetRecurrenceRule.updateMany({ where: { id, tenantId }, data: body.data });
    if (r.count === 0) return reply.code(404).send({ error: 'Regla no encontrada' });
    return reply.send({ ok: true });
  });

  // ─────────────────────────────────────────────────────────────
  // INSTANCIAS E INSTALACIONES DE COMPONENTES
  // ─────────────────────────────────────────────────────────────

  // Instalar una instancia (nueva o existente) en un vehículo
  app.post('/vehiculos/:vehiculoId/instancias', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { vehiculoId } = req.params as any;
    const body = z.object({
      componentId: z.string().uuid(),
      instanceId: z.string().uuid().optional(), // si se reinstala una existente (traslado)
      serialNumber: z.string().optional(),
      notas: z.string().optional(),
      installedAt: z.string().optional(),
      installedKm: z.number().optional(),
      motivo: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const vehiculo = await prisma().vehiculo.findFirst({ where: { id: vehiculoId, tenantId } });
    if (!vehiculo) return reply.code(404).send({ error: 'Vehículo no encontrado' });
    const comp = await prisma().fleetComponent.findFirst({ where: { id: body.data.componentId, tenantId } });
    if (!comp) return reply.code(404).send({ error: 'Componente no encontrado' });

    let instanceId = body.data.instanceId;
    if (instanceId) {
      const inst = await prisma().fleetComponentInstance.findFirst({ where: { id: instanceId, tenantId, componentId: comp.id } });
      if (!inst) return reply.code(404).send({ error: 'Instancia no encontrada para ese componente' });
      // Cerrar instalación vigente de esa instancia si la hay (traslado)
      await prisma().fleetComponentInstallation.updateMany({
        where: { tenantId, instanceId, removedAt: null },
        data: { removedAt: body.data.installedAt ? new Date(body.data.installedAt) : new Date(), removedKm: body.data.installedKm ?? null, motivo: 'TRASLADO' },
      });
    } else {
      const inst = await prisma().fleetComponentInstance.create({
        data: { tenantId, componentId: comp.id, serialNumber: body.data.serialNumber || null, notas: body.data.notas || null },
      });
      instanceId = inst.id;
    }

    // Cerrar cualquier instalación vigente de OTRA instancia del mismo componente en este vehículo (reemplazo)
    await prisma().fleetComponentInstallation.updateMany({
      where: { tenantId, vehiculoId, removedAt: null, instance: { componentId: comp.id }, instanceId: { not: instanceId } },
      data: { removedAt: body.data.installedAt ? new Date(body.data.installedAt) : new Date(), removedKm: body.data.installedKm ?? null, motivo: 'REEMPLAZO' },
    });

    const instalacion = await prisma().fleetComponentInstallation.create({
      data: {
        tenantId, instanceId, vehiculoId,
        installedAt: body.data.installedAt ? new Date(body.data.installedAt) : new Date(),
        installedKm: body.data.installedKm ?? vehiculo.currentOdometer ?? null,
        motivo: body.data.motivo || 'INSTALACION_INICIAL',
      },
      include: { instance: { include: { component: true } } },
    });
    return reply.code(201).send({ instalacion });
  });

  // Retirar la instancia vigente de un componente en un vehículo
  app.post('/vehiculos/:vehiculoId/instancias/:installationId/retirar', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { vehiculoId, installationId } = req.params as any;
    const body = z.object({ removedAt: z.string().optional(), removedKm: z.number().optional(), motivo: z.string().optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });
    const r = await prisma().fleetComponentInstallation.updateMany({
      where: { id: installationId, tenantId, vehiculoId, removedAt: null },
      data: {
        removedAt: body.data.removedAt ? new Date(body.data.removedAt) : new Date(),
        removedKm: body.data.removedKm ?? null,
        motivo: body.data.motivo || 'REEMPLAZO',
      },
    });
    if (r.count === 0) return reply.code(404).send({ error: 'Instalación vigente no encontrada' });
    return reply.send({ ok: true });
  });

  // Instancias de un vehículo (vigentes e históricas)
  app.get('/vehiculos/:vehiculoId/instancias', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { vehiculoId } = req.params as any;
    const instalaciones = await prisma().fleetComponentInstallation.findMany({
      where: { tenantId, vehiculoId },
      include: { instance: { include: { component: true } } },
      orderBy: { installedAt: 'desc' },
    });
    return reply.send({ instalaciones });
  });

  // ─────────────────────────────────────────────────────────────
  // VÍNCULO OT ↔ COMPONENTE (clasificación de intervenciones)
  // ─────────────────────────────────────────────────────────────

  // Vincular una OT a un componente (clasificación manual confirmada)
  app.post('/work-orders/:workOrderId/componente', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { workOrderId } = req.params as any;
    const body = z.object({
      componentId: z.string().uuid(),
      instanceId: z.string().uuid().optional().nullable(),
      subcomponente: z.string().optional(),
      sintoma: z.string().optional(),
      diagnostico: z.string().optional(),
      causa: z.string().optional(),
      trabajoRealizado: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const ot = await prisma().workOrder.findFirst({ where: { id: workOrderId, tenantId }, select: { id: true, assetId: true, status: true } });
    if (!ot) return reply.code(404).send({ error: 'Orden de trabajo no encontrada' });
    const comp = await prisma().fleetComponent.findFirst({ where: { id: body.data.componentId, tenantId } });
    if (!comp) return reply.code(404).send({ error: 'Componente no encontrado' });

    const { userId } = userCtx(req);
    const link = await prisma().fleetWorkOrderComponent.create({
      data: {
        tenantId, workOrderId, componentId: comp.id,
        instanceId: body.data.instanceId ?? null,
        subcomponente: body.data.subcomponente || null,
        sintoma: body.data.sintoma || null,
        diagnostico: body.data.diagnostico || null,
        causa: body.data.causa || null,
        trabajoRealizado: body.data.trabajoRealizado || null,
        clasificacion: 'CONFIRMADA',
        createdBy: userId,
      },
      include: { component: true, instance: true },
    });

    // Si la OT ya está completada, evaluar recurrencia del componente en el vehículo
    if (ot.status === 'COMPLETED' && ot.assetId) {
      const vehiculo = await prisma().vehiculo.findFirst({ where: { maintenanceAssetId: ot.assetId, tenantId }, select: { id: true } });
      if (vehiculo) await evaluarRecurrencia(prisma(), tenantId, vehiculo.id, comp.id, userCtx(req));
    }
    return reply.code(201).send({ link });
  });

  // Vínculos de una OT
  app.get('/work-orders/:workOrderId/componentes', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { workOrderId } = req.params as any;
    const links = await prisma().fleetWorkOrderComponent.findMany({
      where: { tenantId, workOrderId },
      include: { component: true, instance: true },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send({ links });
  });

  // Confirmar o descartar una clasificación SUGERIDA
  app.patch('/links/:id', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { id } = req.params as any;
    const body = z.object({
      clasificacion: z.enum(['CONFIRMADA', 'SUGERIDA']).optional(),
      componentId: z.string().uuid().optional(),
      instanceId: z.string().uuid().optional().nullable(),
      subcomponente: z.string().optional(),
      sintoma: z.string().optional(),
      diagnostico: z.string().optional(),
      causa: z.string().optional(),
      trabajoRealizado: z.string().optional(),
      eliminar: z.boolean().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });

    const link = await prisma().fleetWorkOrderComponent.findFirst({ where: { id, tenantId }, include: { workOrder: { select: { assetId: true, status: true } } } });
    if (!link) return reply.code(404).send({ error: 'Vínculo no encontrado' });

    if (body.data.eliminar) {
      await prisma().fleetWorkOrderComponent.deleteMany({ where: { id, tenantId } });
      return reply.send({ ok: true, eliminado: true });
    }

    const { eliminar, ...data } = body.data;
    await prisma().fleetWorkOrderComponent.updateMany({ where: { id, tenantId }, data });

    // Si se confirmó, evaluar recurrencia
    if (body.data.clasificacion === 'CONFIRMADA' && link.workOrder?.status === 'COMPLETED' && link.workOrder?.assetId) {
      const vehiculo = await prisma().vehiculo.findFirst({ where: { maintenanceAssetId: link.workOrder.assetId, tenantId }, select: { id: true } });
      if (vehiculo) await evaluarRecurrencia(prisma(), tenantId, vehiculo.id, link.componentId, userCtx(req));
    }
    return reply.send({ ok: true });
  });

  // Clasificación asistida: sugiere componentes para OTs del vehículo sin vínculo,
  // matcheando título/descripción contra el catálogo (nombre + sinónimos).
  // Crea vínculos SUGERIDA — nunca los confirma automáticamente.
  app.post('/vehiculos/:vehiculoId/clasificacion-asistida', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { vehiculoId } = req.params as any;
    const vehiculo = await prisma().vehiculo.findFirst({ where: { id: vehiculoId, tenantId }, select: { maintenanceAssetId: true } });
    if (!vehiculo?.maintenanceAssetId) return reply.code(404).send({ error: 'Vehículo sin activo de mantenimiento vinculado' });

    const componentes = await prisma().fleetComponent.findMany({ where: { tenantId, isActive: true } });
    if (componentes.length === 0) return reply.send({ sugerencias: [], mensaje: 'Sin componentes en el catálogo' });

    // OTs del activo sin vínculo confirmado ni sugerido
    const ots = await prisma().workOrder.findMany({
      where: { tenantId, assetId: vehiculo.maintenanceAssetId, status: { not: 'CANCELLED' } },
      select: { id: true, code: true, title: true, description: true, type: true, status: true, completedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const linksExistentes = await prisma().fleetWorkOrderComponent.findMany({
      where: { tenantId, workOrderId: { in: ots.map((o: any) => o.id) } },
      select: { workOrderId: true },
    });
    const yaVinculadas = new Set(linksExistentes.map((l: any) => l.workOrderId));

    const { userId } = userCtx(req);
    const sugerencias: any[] = [];
    for (const ot of ots) {
      if (yaVinculadas.has(ot.id)) continue;
      const texto = `${ot.title || ''} ${ot.description || ''}`.toLowerCase();
      const match = componentes.find((c: any) => {
        const terminos = [c.nombre, ...(c.sinonimos || [])].map((t: string) => t.toLowerCase());
        return terminos.some((t: string) => t.length > 2 && texto.includes(t));
      });
      if (match) {
        const link = await prisma().fleetWorkOrderComponent.create({
          data: { tenantId, workOrderId: ot.id, componentId: match.id, clasificacion: 'SUGERIDA', createdBy: userId },
          include: { component: true },
        });
        sugerencias.push({ link, workOrder: ot });
      }
    }
    return reply.send({ sugerencias, pendientesConfirmacion: sugerencias.length });
  });

  // ─────────────────────────────────────────────────────────────
  // DETECCIÓN MANUAL + RESUMEN PARA LA FICHA DEL VEHÍCULO
  // ─────────────────────────────────────────────────────────────

  // Ejecutar detección para todos los componentes con regla en un vehículo
  app.post('/vehiculos/:vehiculoId/evaluar', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { vehiculoId } = req.params as any;
    const vehiculo = await prisma().vehiculo.findFirst({ where: { id: vehiculoId, tenantId } });
    if (!vehiculo) return reply.code(404).send({ error: 'Vehículo no encontrado' });

    const reglas = await prisma().fleetRecurrenceRule.findMany({ where: { tenantId, isActive: true }, select: { componentId: true } });
    const resultados: any[] = [];
    for (const r of [...new Set<string>(reglas.map((x: any) => x.componentId))]) {
      resultados.push(await evaluarRecurrencia(prisma(), tenantId, vehiculoId, r, userCtx(req)));
    }
    return reply.send({ resultados });
  });

  // Resumen para la línea "Análisis de reparaciones recurrentes" en la ficha
  app.get('/vehiculos/:vehiculoId/recurrencias', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { vehiculoId } = req.params as any;
    const vehiculo = await prisma().vehiculo.findFirst({
      where: { id: vehiculoId, tenantId },
      select: { id: true, dominio: true, maintenanceAssetId: true, currentOdometer: true },
    });
    if (!vehiculo) return reply.code(404).send({ error: 'Vehículo no encontrado' });
    if (!vehiculo.maintenanceAssetId) {
      return reply.send({ vehiculo: { id: vehiculo.id, dominio: vehiculo.dominio }, casos: [], componentesConDatos: [], sugerenciasPendientes: 0, sinActivo: true });
    }

    // Casos del vehículo (abiertos y cerrados recientes)
    const casos = await prisma().fleetRecurrenceCase.findMany({
      where: { tenantId, vehiculoId },
      include: {
        component: { select: { id: true, nombre: true, categoria: true } },
        rule: true,
        instance: { select: { id: true, serialNumber: true } },
        alternativas: true,
        eventos: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
      orderBy: { openedAt: 'desc' },
    });

    // Sugerencias de clasificación pendientes
    const sugerenciasPendientes = await prisma().fleetWorkOrderComponent.count({
      where: { tenantId, clasificacion: 'SUGERIDA', workOrder: { assetId: vehiculo.maintenanceAssetId } },
    });

    // Enriquecer cada caso con intervenciones, costos y horas de parada
    const casosOut: any[] = [];
    for (const caso of casos) {
      const ventana = caso.rule?.ventanaDias ?? 3650;
      const desde = new Date(Date.now() - ventana * 86400000);
      const intervenciones = await intervencionesDelComponente(prisma(), tenantId, vehiculoId, caso.componentId, {
        desde: caso.status === 'CERRADO' && caso.closedAt ? undefined : desde,
        soloFallas: caso.rule?.soloFallas ?? true,
        instanceId: caso.instanceId ?? undefined,
      });
      // Si el caso no tiene instancia, traer todas las confirmadas del componente
      const interv = caso.instanceId ? intervenciones : await intervencionesDelComponente(prisma(), tenantId, vehiculoId, caso.componentId, { desde, soloFallas: caso.rule?.soloFallas ?? true });

      const woIds = interv.map((l: any) => l.workOrderId);
      const horasMap = await horasParadaPorOT(prisma(), tenantId, vehiculoId, woIds);
      // Repartir la parada entre los componentes vinculados de cada OT
      const linksPorOT = await prisma().fleetWorkOrderComponent.groupBy({
        by: ['workOrderId'],
        where: { tenantId, workOrderId: { in: woIds } },
        _count: { componentId: true },
      });
      const compPorOT = new Map<string, number>(linksPorOT.map((g: any) => [g.workOrderId as string, Math.max(1, g._count.componentId as number)]));

      let costoTotal = 0, costoConocido = 0, horasParada = 0;
      const intervOut = interv.map((l: any) => {
        const wo = l.workOrder;
        const costo = wo?.totalCost ?? null;
        if (costo != null) { costoTotal += costo; costoConocido++; }
        const horasOT = (horasMap.get(wo.id) || 0) / compPorOT.get(wo.id)!;
        horasParada += horasOT;
        return {
          workOrderId: wo.id, code: wo.code, title: wo.title, type: wo.type,
          completedAt: wo.completedAt, totalCost: costo,
          subcomponente: l.subcomponente, sintoma: l.sintoma, causa: l.causa,
          horasParadaAtribuida: Math.round(horasOT * 10) / 10,
        };
      });

      // Seguimiento calculado al leer
      let seguimiento = null;
      if (caso.status === 'EN_SEGUIMIENTO') {
        seguimiento = await evaluarSeguimiento(prisma(), tenantId, caso);
      }

      casosOut.push({ ...caso, intervenciones: intervOut, costoTotalIntervenciones: costoConocido > 0 ? costoTotal : null, intervencionesConCosto: costoConocido, horasParadaTotal: Math.round(horasParada * 10) / 10, seguimiento });
    }

    // Componentes con vínculos confirmados en el vehículo (aunque sin caso)
    const linksVeh = await prisma().fleetWorkOrderComponent.findMany({
      where: { tenantId, clasificacion: 'CONFIRMADA', workOrder: { assetId: vehiculo.maintenanceAssetId, status: 'COMPLETED' } },
      include: { component: { select: { id: true, nombre: true } } },
    });
    const compMap = new Map<string, { nombre: string; count: number }>();
    for (const l of linksVeh) {
      const cur = compMap.get(l.componentId) || { nombre: l.component.nombre, count: 0 };
      cur.count++;
      compMap.set(l.componentId, cur);
    }

    return reply.send({
      vehiculo: { id: vehiculo.id, dominio: vehiculo.dominio, currentOdometer: vehiculo.currentOdometer },
      casos: casosOut,
      componentesConDatos: [...compMap.entries()].map(([id, v]) => ({ componentId: id, nombre: v.nombre, intervenciones: v.count })),
      sugerenciasPendientes,
      hayReglas: (await prisma().fleetRecurrenceRule.count({ where: { tenantId, isActive: true } })) > 0,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CASOS: detalle, estado, alternativas, decisión, ejecución, cierre
  // ─────────────────────────────────────────────────────────────

  app.get('/casos/:id', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { id } = req.params as any;
    const caso = await prisma().fleetRecurrenceCase.findFirst({
      where: { id, tenantId },
      include: {
        component: true, rule: true, instance: true,
        alternativas: { orderBy: { createdAt: 'asc' } },
        eventos: { orderBy: { createdAt: 'desc' } },
        vehiculo: { select: { id: true, dominio: true, currentOdometer: true } },
      },
    });
    if (!caso) return reply.code(404).send({ error: 'Caso no encontrado' });
    const seguimiento = caso.status === 'EN_SEGUIMIENTO' ? await evaluarSeguimiento(prisma(), tenantId, caso) : null;
    return reply.send({ caso, seguimiento });
  });

  // Cambio de estado manual (detectado → en_analisis, etc.) con trazabilidad
  app.post('/casos/:id/estado', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { id } = req.params as any;
    const body = z.object({ estado: z.enum(ESTADOS_CASO as [string, ...string[]]), notas: z.string().optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Estado inválido' });
    const caso = await prisma().fleetRecurrenceCase.findFirst({ where: { id, tenantId } });
    if (!caso) return reply.code(404).send({ error: 'Caso no encontrado' });

    const { userId, userName } = userCtx(req);
    await prisma().fleetRecurrenceCase.update({
      where: { id },
      data: { status: body.data.estado, ...(body.data.estado === 'CERRADO' ? { closedAt: new Date() } : {}) },
    });
    await prisma().fleetCaseEvent.create({
      data: { tenantId, caseId: id, tipo: 'CAMBIO_ESTADO', detalle: `${caso.status} → ${body.data.estado}${body.data.notas ? ` — ${body.data.notas}` : ''}`, userId, userName },
    });
    return reply.send({ ok: true });
  });

  // Cargar alternativa de decisión (reparar / integral / reemplazar / garantía)
  app.post('/casos/:id/alternativas', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { id } = req.params as any;
    const caso = await prisma().fleetRecurrenceCase.findFirst({ where: { id, tenantId } });
    if (!caso) return reply.code(404).send({ error: 'Caso no encontrado' });
    if (caso.status === 'CERRADO') return reply.code(400).send({ error: 'El caso está cerrado' });

    const body = z.object({
      tipo: z.enum(TIPOS_ALTERNATIVA as [string, ...string[]]),
      descripcion: z.string().optional(),
      costoInmediato: z.number().optional().nullable(),
      costoInstalacion: z.number().optional().nullable(),
      moneda: z.string().optional(),
      fechaCotizacion: z.string().optional(),
      proveedor: z.string().optional(),
      plazoInmovilizacionDias: z.number().optional().nullable(),
      garantiaMeses: z.number().int().optional().nullable(),
      garantiaKm: z.number().optional().nullable(),
      costosFuturosEstimados: z.number().optional().nullable(),
      baseEstimacion: z.string().optional(),
      valorParadaPorDia: z.number().optional().nullable(),
      baseValorParada: z.string().optional(),
      tipoCambio: z.number().positive().optional().nullable(),
      fechaTipoCambio: z.string().optional(),
      fuenteTipoCambio: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const d = body.data;
    // Moneda distinta sin conversión explícita → se guarda pero se marca
    const alternativa = await prisma().fleetCaseAlternative.create({
      data: {
        tenantId, caseId: id, tipo: d.tipo, descripcion: d.descripcion || null,
        costoInmediato: d.costoInmediato ?? null, costoInstalacion: d.costoInstalacion ?? null,
        moneda: d.moneda || 'ARS',
        fechaCotizacion: d.fechaCotizacion ? new Date(d.fechaCotizacion) : null,
        proveedor: d.proveedor || null,
        plazoInmovilizacionDias: d.plazoInmovilizacionDias ?? null,
        garantiaMeses: d.garantiaMeses ?? null, garantiaKm: d.garantiaKm ?? null,
        costosFuturosEstimados: d.costosFuturosEstimados ?? null, baseEstimacion: d.baseEstimacion || null,
        valorParadaPorDia: d.valorParadaPorDia ?? null, baseValorParada: d.baseValorParada || null,
        tipoCambio: d.tipoCambio ?? null,
        fechaTipoCambio: d.fechaTipoCambio ? new Date(d.fechaTipoCambio) : null,
        fuenteTipoCambio: d.fuenteTipoCambio || null,
      },
    });
    const { userId, userName } = userCtx(req);
    await prisma().fleetCaseEvent.create({
      data: { tenantId, caseId: id, tipo: 'NOTA', detalle: `Alternativa cargada: ${d.tipo}${d.costoInmediato != null ? ` — ${d.moneda || 'ARS'} ${d.costoInmediato}` : ''}`, userId, userName },
    });
    return reply.code(201).send({ alternativa });
  });

  // Comparación de alternativas: solo costos FUTUROS, con advertencias de datos
  app.get('/casos/:id/comparacion', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { id } = req.params as any;
    const caso = await prisma().fleetRecurrenceCase.findFirst({
      where: { id, tenantId },
      include: { alternativas: true, component: true, vehiculo: { select: { dominio: true } } },
    });
    if (!caso) return reply.code(404).send({ error: 'Caso no encontrado' });

    const monedas = [...new Set(caso.alternativas.map((a: any) => a.moneda))];
    const sinConversion = caso.alternativas.some((a: any) => a.moneda !== 'ARS' && a.tipoCambio == null);

    const alternativas = caso.alternativas.map((a: any) => {
      const costoFuturo = (a.costoInmediato ?? 0) + (a.costoInstalacion ?? 0) + (a.costosFuturosEstimados ?? 0);
      const costoParada = a.valorParadaPorDia != null && a.plazoInmovilizacionDias != null
        ? a.valorParadaPorDia * a.plazoInmovilizacionDias : null;
      return {
        ...a,
        costoFuturoEstimado: (a.costoInmediato != null || a.costoInstalacion != null || a.costosFuturosEstimados != null) ? costoFuturo : null,
        costoParadaEstimado: costoParada,
        advertencias: [
          ...(a.costoInmediato == null ? ['Sin costo inmediato informado'] : []),
          ...(a.costosFuturosEstimados != null && !a.baseEstimacion ? ['Estimación futura sin base documentada'] : []),
          ...(a.moneda !== 'ARS' && a.tipoCambio == null ? [`Moneda ${a.moneda} sin tipo de cambio — no comparable`] : []),
          ...(a.valorParadaPorDia != null && !a.baseValorParada ? ['Valor de parada sin base de cálculo declarada'] : []),
        ],
      };
    });

    return reply.send({
      alternativas,
      monedas,
      advertenciasGenerales: [
        ...(monedas.length > 1 && sinConversion ? ['Hay alternativas en monedas distintas sin tipo de cambio explícito: no son comparables entre sí'] : []),
        'Los gastos ya realizados son costos pasados comunes a todas las alternativas: no se suman a ninguna ni se recuperan al reemplazar',
        'El costo de parada es una estimación económica separada de los gastos efectivamente pagados',
      ],
    });
  });

  // Decisión del responsable: elegir alternativa con fundamento + OT opcional
  app.post('/casos/:id/decidir', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { id } = req.params as any;
    const body = z.object({
      alternativaId: z.string().uuid().optional(),
      tipo: z.enum(TIPOS_ALTERNATIVA as [string, ...string[]]).optional(),
      fundamento: z.string().min(3),
      workOrderAccionId: z.string().uuid().optional().nullable(),
      rechazadas: z.array(z.object({ alternativaId: z.string().uuid(), fundamento: z.string().optional() })).optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos — el fundamento es obligatorio', details: body.error.errors });

    const caso = await prisma().fleetRecurrenceCase.findFirst({ where: { id, tenantId }, include: { alternativas: true } });
    if (!caso) return reply.code(404).send({ error: 'Caso no encontrado' });
    if (caso.status === 'CERRADO') return reply.code(400).send({ error: 'El caso está cerrado' });

    let tipoElegido = body.data.tipo;
    if (body.data.alternativaId) {
      const alt = caso.alternativas.find((a: any) => a.id === body.data.alternativaId);
      if (!alt) return reply.code(404).send({ error: 'Alternativa no encontrada en el caso' });
      tipoElegido = alt.tipo;
      await prisma().fleetCaseAlternative.updateMany({ where: { id: alt.id, tenantId }, data: { seleccionada: true } });
    }
    if (!tipoElegido) return reply.code(400).send({ error: 'Indicá la alternativa elegida (id o tipo)' });

    // Marcar rechazadas con fundamento
    for (const r of body.data.rechazadas || []) {
      await prisma().fleetCaseAlternative.updateMany({
        where: { id: r.alternativaId, tenantId, caseId: id },
        data: { seleccionada: false, fundamentoRechazo: r.fundamento || 'Descartada por el responsable' },
      });
    }

    // Validar OT de acción si se vincula
    if (body.data.workOrderAccionId) {
      const ot = await prisma().workOrder.findFirst({ where: { id: body.data.workOrderAccionId, tenantId }, select: { id: true } });
      if (!ot) return reply.code(404).send({ error: 'La OT vinculada no existe' });
    }

    const { userId, userName } = userCtx(req);
    await prisma().fleetRecurrenceCase.update({
      where: { id },
      data: {
        alternativaElegida: tipoElegido,
        decisionFundamento: body.data.fundamento,
        decididoPor: userName,
        decididoAt: new Date(),
        workOrderAccionId: body.data.workOrderAccionId ?? null,
        status: body.data.workOrderAccionId ? 'EN_EJECUCION' : 'ACCION_APROBADA',
      },
    });
    await prisma().fleetCaseEvent.create({
      data: {
        tenantId, caseId: id, tipo: 'DECISION',
        detalle: `Decisión: ${tipoElegido} — ${body.data.fundamento}${body.data.workOrderAccionId ? ' (OT vinculada)' : ''}`,
        userId, userName,
      },
    });
    return reply.send({ ok: true, status: body.data.workOrderAccionId ? 'EN_EJECUCION' : 'ACCION_APROBADA' });
  });

  // Registrar ejecución de la acción: fecha, km, instancia nueva si reemplazó
  app.post('/casos/:id/ejecutar', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { id } = req.params as any;
    const body = z.object({
      fecha: z.string().optional(),
      km: z.number().optional(),
      revisionDias: z.number().int().optional().nullable(),
      revisionKm: z.number().optional().nullable(),
      instanciaNueva: z.object({ serialNumber: z.string().optional(), notas: z.string().optional() }).optional(),
      notas: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const caso = await prisma().fleetRecurrenceCase.findFirst({ where: { id, tenantId } });
    if (!caso) return reply.code(404).send({ error: 'Caso no encontrado' });
    if (!['ACCION_APROBADA', 'EN_EJECUCION', 'EN_SEGUIMIENTO'].includes(caso.status)) {
      return reply.code(400).send({ error: `No se puede ejecutar desde el estado ${caso.status}` });
    }

    const d = body.data;
    const fechaEjec = d.fecha ? new Date(d.fecha) : new Date();
    let instanciaNuevaId: string | null = null;

    // Si la decisión fue reemplazar, registrar la instancia nueva instalada
    if (d.instanciaNueva && caso.alternativaElegida === 'REEMPLAZAR') {
      const inst = await prisma().fleetComponentInstance.create({
        data: { tenantId, componentId: caso.componentId, serialNumber: d.instanciaNueva.serialNumber || null, notas: d.instanciaNueva.notas || null },
      });
      instanciaNuevaId = inst.id;
      // Cerrar instalación vigente del componente en el vehículo y montar la nueva
      await prisma().fleetComponentInstallation.updateMany({
        where: { tenantId, vehiculoId: caso.vehiculoId, removedAt: null, instance: { componentId: caso.componentId } },
        data: { removedAt: fechaEjec, removedKm: d.km ?? null, motivo: 'REEMPLAZO' },
      });
      await prisma().fleetComponentInstallation.create({
        data: { tenantId, instanceId: inst.id, vehiculoId: caso.vehiculoId, installedAt: fechaEjec, installedKm: d.km ?? null, motivo: 'REEMPLAZO' },
      });
    }

    const { userId, userName } = userCtx(req);
    await prisma().fleetRecurrenceCase.update({
      where: { id },
      data: {
        status: 'EN_SEGUIMIENTO',
        accionEjecutadaAt: fechaEjec,
        accionEjecutadaKm: d.km ?? null,
        instanciaNuevaId: instanciaNuevaId ?? caso.instanciaNuevaId,
        revisionDias: d.revisionDias ?? caso.revisionDias,
        revisionKm: d.revisionKm ?? caso.revisionKm,
        seguimientoResultado: 'PENDIENTE',
      },
    });
    await prisma().fleetCaseEvent.create({
      data: {
        tenantId, caseId: id, tipo: 'EJECUCION',
        detalle: `Acción ejecutada el ${fechaEjec.toLocaleDateString('es-AR')}${d.km != null ? ` a ${d.km.toLocaleString('es-AR')} km` : ''}${instanciaNuevaId ? ' — instancia nueva instalada' : ''}${d.notas ? ` — ${d.notas}` : ''}`,
        userId, userName,
      },
    });
    return reply.send({ ok: true, status: 'EN_SEGUIMIENTO', instanciaNuevaId });
  });

  // Cerrar el caso (con notas de resultado)
  app.post('/casos/:id/cerrar', async (req, reply) => {
    const tenantId = await tenantOr401(req, reply); if (!tenantId) return;
    const { id } = req.params as any;
    const body = z.object({ notas: z.string().optional(), resultado: z.enum(['SIN_RECURRENCIA', 'RECURRENCIA', 'PENDIENTE']).optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });
    const caso = await prisma().fleetRecurrenceCase.findFirst({ where: { id, tenantId } });
    if (!caso) return reply.code(404).send({ error: 'Caso no encontrado' });

    const { userId, userName } = userCtx(req);
    await prisma().fleetRecurrenceCase.update({
      where: { id },
      data: { status: 'CERRADO', closedAt: new Date(), seguimientoNotas: body.data.notas || caso.seguimientoNotas, seguimientoResultado: body.data.resultado || caso.seguimientoResultado },
    });
    await prisma().fleetCaseEvent.create({
      data: { tenantId, caseId: id, tipo: 'CAMBIO_ESTADO', detalle: `Caso cerrado${body.data.resultado ? ` — resultado: ${body.data.resultado}` : ''}${body.data.notas ? ` — ${body.data.notas}` : ''}`, userId, userName },
    });
    return reply.send({ ok: true });
  });
}
