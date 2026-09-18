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
  // SYNC AUTOMÁTICO REGLA→GRUPO: aplica cada regla activa a todos los
  // vehículos de su tipoActivoAplicable que aún no la tengan aplicada
  // (incluye vehículos dados de alta después). Crea el MaintenancePlan
  // real por vehículo, igual que POST /component-rules/:id/aplicar.
  // Segura ante llamadas concurrentes: la aplicación se crea primero y
  // tiene constraint único (ruleId, assetId) — un duplicado concurrente
  // falla antes de crear el plan.
  // ─────────────────────────────────────────────────────────────
  async function syncReglasConFlota(tenantId: string) {
    const [reglas, vehiculos, aplicaciones] = await Promise.all([
      prisma().maintenanceComponentRule.findMany({ where: { tenantId, isActive: true } }),
      prisma().vehiculo.findMany({ where: { tenantId, maintenanceAssetId: { not: null } }, select: { id: true, tipo: true, maintenanceAssetId: true } }),
      prisma().maintenanceComponentRuleAsset.findMany({ where: { rule: { tenantId } }, select: { ruleId: true, assetId: true } }),
    ]);
    if (reglas.length === 0 || vehiculos.length === 0) return;

    const aplicados = new Set(aplicaciones.map((a: any) => `${a.ruleId}:${a.assetId}`));
    const assetIds = [...new Set(vehiculos.map((v: any) => v.maintenanceAssetId))];
    const assets = await prisma().maintenanceAsset.findMany({ where: { id: { in: assetIds as string[] }, tenantId }, select: { id: true, code: true } });
    const assetCode = new Map<string, string>(assets.map((a: any) => [a.id, a.code]));

    for (const rule of reglas) {
      const targets = vehiculos.filter((v: any) =>
        (rule.tipoActivoAplicable === 'TODOS' || v.tipo === rule.tipoActivoAplicable) &&
        !aplicados.has(`${rule.id}:${v.maintenanceAssetId}`)
      );
      for (const v of targets) {
        try {
          const code = assetCode.get(v.maintenanceAssetId);
          if (!code) continue;
          // Primero la aplicación (constraint único ruleId+assetId frena duplicados concurrentes)
          const aplicacion = await prisma().maintenanceComponentRuleAsset.create({
            data: { ruleId: rule.id, assetId: v.maintenanceAssetId, isActive: true },
          });
          const plan = await prisma().maintenancePlan.create({
            data: {
              tenantId,
              code: `CR-${rule.id.slice(0, 6)}-${code}`.toUpperCase(),
              title: rule.nombre,
              description: `Generado automáticamente desde catálogo de componentes (Flota 360): ${rule.nombre}`,
              type: 'PREVENTIVE', status: 'ACTIVE', assetId: v.maintenanceAssetId,
              frequencyValue: rule.frecuenciaDias || 30,
              frequencyUnit: rule.frecuenciaKm ? 'KM' : 'DAYS',
              triggerKm: rule.frecuenciaKm || null,
            },
          });
          await prisma().maintenanceComponentRuleAsset.update({
            where: { id: aplicacion.id },
            data: { generatedPlanId: plan.id },
          });
          aplicados.add(`${rule.id}:${v.maintenanceAssetId}`);
        } catch {
          // Duplicado concurrente o dato inválido: se reintenta en la próxima carga
        }
      }
    }
  }

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

    const hace30dias = new Date(now); hace30dias.setDate(now.getDate() - 30);

    const [vehiculos, workOrders, completadasRecientes, vencimientos] = await Promise.all([
      prisma().vehiculo.findMany({ where: { tenantId }, select: { id: true, dominio: true, tipo: true, status: true, notas: true, maintenanceAssetId: true, updatedAt: true } }),
      prisma().workOrder.findMany({
        where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] } },
        include: { asset: { select: { id: true, code: true, name: true } }, technician: { select: { id: true, name: true } } },
        orderBy: { scheduledDate: 'asc' },
      }),
      prisma().workOrder.findMany({
        where: { tenantId, status: 'COMPLETED', completedAt: { gte: hace30dias } },
        include: { asset: { select: { id: true, code: true, name: true } }, technician: { select: { id: true, name: true } } },
        orderBy: { completedAt: 'desc' },
        take: 50,
      }),
      prisma().vencimientoDocumento.findMany({
        where: { tenantId, renovado: false, fechaVto: { lte: en7dias } },
        include: { vehiculo: { select: { id: true, dominio: true } } },
        orderBy: { fechaVto: 'asc' },
      }),
    ]);

    const vehMapByAsset = new Map<string, any>(vehiculos.filter((v: any) => v.maintenanceAssetId).map((v: any) => [v.maintenanceAssetId, v]));

    const mapOrden = (o: any) => {
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
    };

    const ordenes = workOrders.map(mapOrden);
    const completadas = completadasRecientes.map(mapOrden);

    const trabajoHoy = ordenes.filter((o: any) => o.esHoy);
    const vencidas = ordenes.filter((o: any) => o.vencida);
    const enProceso = ordenes.filter((o: any) => o.estado === 'IN_PROGRESS');
    const pendientes = ordenes.filter((o: any) => o.estado === 'PENDING');

    const inmovilizados = vehiculos
      .filter((v: any) => v.status === 'EN_TALLER')
      .map((v: any) => ({
        id: v.id, dominio: v.dominio, tipo: v.tipo, notas: v.notas,
        enTallerDesde: v.updatedAt,
        diasEnTaller: Math.max(0, Math.floor((now.getTime() - new Date(v.updatedAt).getTime()) / 86400000)),
      }));

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
      completadas,
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
        tractor: { include: { vencimientos: { where: { renovado: false } }, posicionesNeumatico: { where: { activo: true }, include: { neumatico: true } } } },
        semi: { include: { vencimientos: { where: { renovado: false } }, posicionesNeumatico: { where: { activo: true }, include: { neumatico: true } } } },
        eventos: { orderBy: { fecha: 'desc' } },
      },
    });
    if (!conjunto) return reply.code(404).send({ error: 'No encontrado' });

    // Resumen operativo por vehículo: OTs abiertas, próximo servicio, última inspección QR.
    const resumenVehiculo = async (v: any) => {
      const [otsAbiertas, planes, ultimaInspeccion] = await Promise.all([
        v.maintenanceAssetId
          ? prisma().workOrder.count({ where: { tenantId, assetId: v.maintenanceAssetId, status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] } } })
          : 0,
        v.maintenanceAssetId
          ? prisma().maintenancePlan.findMany({ where: { tenantId, assetId: v.maintenanceAssetId, status: 'ACTIVE' }, orderBy: { nextExecutionDate: 'asc' } })
          : [],
        prisma().inspeccion.findFirst({
          where: {
            tenantId,
            OR: [
              ...(v.maintenanceAssetId ? [{ qr: { maintenanceAssetId: v.maintenanceAssetId } }] : []),
              { dominioTractor: { equals: v.dominio, mode: 'insensitive' } },
              { dominioSemi: { equals: v.dominio, mode: 'insensitive' } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true, createdAt: true, estado: true, puntaje: true, hallazgosCount: true },
        }),
      ]);

      const now = new Date();
      let proximoServicio: any = null;
      for (const p of planes) {
        if (p.frequencyUnit === 'KM' && p.triggerKm && v.currentOdometer != null) {
          const base = p.lastOdometerExecution ?? v.currentOdometer;
          const proxKm = base + p.triggerKm;
          const kmRestantes = Math.round(proxKm - v.currentOdometer);
          if (!proximoServicio || kmRestantes < proximoServicio.kmRestantes) {
            proximoServicio = { plan: p.title, tipo: 'KM', proximoKm: proxKm, kmRestantes };
          }
        } else if (p.nextExecutionDate) {
          const dias = Math.ceil((new Date(p.nextExecutionDate).getTime() - now.getTime()) / 86400000);
          if (!proximoServicio || proximoServicio.tipo !== 'KM' || dias < (proximoServicio.diasRestantes ?? Infinity)) {
            if (!proximoServicio || (proximoServicio.tipo === 'FECHA' && dias < proximoServicio.diasRestantes) || proximoServicio.tipo === 'KM') {
              proximoServicio = { plan: p.title, tipo: 'FECHA', fecha: p.nextExecutionDate, diasRestantes: dias };
            }
          }
        }
      }

      return {
        otsAbiertas,
        proximoServicio,
        ultimaInspeccion: ultimaInspeccion || null,
        neumaticosMontados: (v.posicionesNeumatico || []).length,
        docsPendientes: (v.vencimientos || []).filter((d: any) => new Date(d.fechaVto) < now).length,
        docsPorVencer: (v.vencimientos || []).filter((d: any) => {
          const dias = Math.ceil((new Date(d.fechaVto).getTime() - now.getTime()) / 86400000);
          return dias >= 0 && dias <= 30;
        }).length,
      };
    };

    const [tractorResumen, semiResumen] = await Promise.all([
      resumenVehiculo(conjunto.tractor),
      resumenVehiculo(conjunto.semi),
    ]);

    return reply.send({ conjunto: { ...conjunto, tractorResumen, semiResumen } });
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
    const hace12meses = new Date(); hace12meses.setMonth(hace12meses.getMonth() - 12);

    const [otTractor, otSemi, combustible, neumDesmontados, otTractorPrev, otSemiPrev, combustiblePrev] = await Promise.all([
      conjunto.tractor.maintenanceAssetId
        ? prisma().workOrder.aggregate({ where: { tenantId, assetId: conjunto.tractor.maintenanceAssetId, completedAt: { gte: hace6meses } }, _sum: { totalCost: true } })
        : { _sum: { totalCost: 0 } },
      conjunto.semi.maintenanceAssetId
        ? prisma().workOrder.aggregate({ where: { tenantId, assetId: conjunto.semi.maintenanceAssetId, completedAt: { gte: hace6meses } }, _sum: { totalCost: true } })
        : { _sum: { totalCost: 0 } },
      prisma().registroCombustible.aggregate({ where: { tenantId, vehiculoId: conjunto.tractorId, fecha: { gte: hace6meses } }, _sum: { costoTotal: true } }),
      // Neumáticos desmontados del conjunto en el período, valuados a precio de compra real
      prisma().neumaticoPosicion.findMany({
        where: { tenantId, vehiculoId: { in: [conjunto.tractorId, conjunto.semiId] }, activo: false, desmontadoAt: { gte: hace6meses } },
        select: { neumatico: { select: { precioCompra: true } } },
      }),
      // Período anterior (6-12 meses atrás) para variación
      conjunto.tractor.maintenanceAssetId
        ? prisma().workOrder.aggregate({ where: { tenantId, assetId: conjunto.tractor.maintenanceAssetId, completedAt: { gte: hace12meses, lt: hace6meses } }, _sum: { totalCost: true } })
        : { _sum: { totalCost: 0 } },
      conjunto.semi.maintenanceAssetId
        ? prisma().workOrder.aggregate({ where: { tenantId, assetId: conjunto.semi.maintenanceAssetId, completedAt: { gte: hace12meses, lt: hace6meses } }, _sum: { totalCost: true } })
        : { _sum: { totalCost: 0 } },
      prisma().registroCombustible.aggregate({ where: { tenantId, vehiculoId: conjunto.tractorId, fecha: { gte: hace12meses, lt: hace6meses } }, _sum: { costoTotal: true } }),
    ]);

    const costoTractor = otTractor._sum.totalCost || 0;
    const costoSemi = otSemi._sum.totalCost || 0;
    const costoCombustible = combustible._sum.costoTotal || 0;
    const costoNeumaticos = neumDesmontados.reduce((acc: number, p: any) => acc + (p.neumatico?.precioCompra || 0), 0);
    const costoMantenimiento = costoTractor + costoSemi;
    const costoTotal = costoMantenimiento + costoCombustible + costoNeumaticos;
    const hayDatos = costoTotal > 0;

    const costoTotalPrev = (otTractorPrev._sum.totalCost || 0) + (otSemiPrev._sum.totalCost || 0) + (combustiblePrev._sum.costoTotal || 0);
    const variacion = hayDatos && costoTotalPrev > 0
      ? Math.round(((costoTotal - costoTotalPrev) / costoTotalPrev) * 10000) / 100
      : null;

    return reply.send({
      hayDatos,
      periodo: 'Últimos 6 meses',
      costoTractor,
      costoSemi,
      costoCombustible,
      costoNeumaticos,
      costoMantenimiento,
      costoTotal,
      variacionVsPeriodoAnterior: variacion,
      comparacionDisponible: costoTotalPrev > 0,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CATÁLOGO DE COMPONENTES Y REGLAS DE SERVICIO — sincroniza MaintenancePlan real
  // ─────────────────────────────────────────────────────────────
  app.get('/component-rules', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const [rules, reservas, vehiculos] = await Promise.all([
      prisma().maintenanceComponentRule.findMany({
        where: { tenantId },
        include: { repuestosRequeridos: true, aplicaciones: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma().workOrderSparePart.groupBy({
        by: ['sparePartId'],
        where: { tenantId, stockDeducted: false, workOrder: { status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] } } },
        _sum: { quantity: true },
      }),
      prisma().vehiculo.findMany({ where: { tenantId, maintenanceAssetId: { not: null } }, select: { id: true, dominio: true, tipo: true, maintenanceAssetId: true } }),
    ]);

    const reservaMap = new Map<string, number>(reservas.map((r: any) => [r.sparePartId, r._sum.quantity || 0]));
    const sparePartIds = Array.from(new Set(rules.flatMap((r: any) => r.repuestosRequeridos.map((rp: any) => rp.sparePartId))));
    const partes = sparePartIds.length
      ? await prisma().maintenanceSparePart.findMany({ where: { id: { in: sparePartIds } }, select: { id: true, code: true, name: true, currentStock: true, minStock: true } })
      : [];
    const parteMap = new Map<string, any>(partes.map((p: any) => [p.id, p]));
    const vehByAsset = new Map<string, any>(vehiculos.map((v: any) => [v.maintenanceAssetId, v]));

    const rulesEnriquecidas = rules.map((r: any) => ({
      ...r,
      repuestosRequeridos: r.repuestosRequeridos.map((rp: any) => {
        const parte = parteMap.get(rp.sparePartId);
        const reservado = reservaMap.get(rp.sparePartId) || 0;
        return {
          ...rp,
          nombre: parte?.name || 'Repuesto no encontrado',
          code: parte?.code || null,
          disponible: parte ? parte.currentStock - reservado : null,
          currentStock: parte?.currentStock ?? null,
        };
      }),
      aplicaciones: r.aplicaciones.map((a: any) => ({
        ...a,
        vehiculo: vehByAsset.get(a.assetId) ? { dominio: vehByAsset.get(a.assetId).dominio, tipo: vehByAsset.get(a.assetId).tipo } : null,
      })),
    }));

    return reply.send({ rules: rulesEnriquecidas });
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

  // Aplica una regla a uno o varios activos: crea/actualiza un MaintenancePlan real vinculado por activo.
  // No modifica ni borra ningún MaintenancePlan preexistente creado manualmente.
  app.post('/component-rules/:id/aplicar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      assetId: z.string().uuid().optional(),
      assetIds: z.array(z.string().uuid()).optional(),
      frecuenciaKmOverride: z.number().optional().nullable(),
      frecuenciaDiasOverride: z.number().int().optional().nullable(),
      tecnicoSugeridoId: z.string().uuid().optional().nullable(),
      accionVencimientoOverride: z.enum(['ALERTA', 'SUGERENCIA_OT', 'GENERAR_OT']).optional().nullable(),
      kmBase: z.number().optional().nullable(),
      proximaEjecucion: z.string().optional().nullable(),
    }).refine((d) => d.assetId || (d.assetIds && d.assetIds.length > 0), { message: 'Se requiere assetId o assetIds' });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const rule = await prisma().maintenanceComponentRule.findFirst({ where: { id, tenantId } });
    if (!rule) return reply.code(404).send({ error: 'Regla no encontrada' });

    const assetIds = body.data.assetIds && body.data.assetIds.length > 0 ? body.data.assetIds : [body.data.assetId!];
    const assets = await prisma().maintenanceAsset.findMany({ where: { id: { in: assetIds }, tenantId } });
    if (assets.length === 0) return reply.code(404).send({ error: 'Ningún activo encontrado' });

    const resultados = [];
    for (const asset of assets) {
      const existingApp = await prisma().maintenanceComponentRuleAsset.findFirst({ where: { ruleId: id, assetId: asset.id } });

      const frecKm = body.data.frecuenciaKmOverride ?? rule.frecuenciaKm;
      const frecDias = body.data.frecuenciaDiasOverride ?? rule.frecuenciaDias;
      const frequencyUnit = frecKm ? 'KM' : 'DAYS';
      const frequencyValue = frecDias || 30;
      const proximaEjecucion = body.data.proximaEjecucion ? new Date(body.data.proximaEjecucion) : undefined;
      const kmBase = body.data.kmBase ?? undefined;

      let plan;
      if (existingApp?.generatedPlanId) {
        plan = await prisma().maintenancePlan.update({
          where: { id: existingApp.generatedPlanId },
          data: {
            title: rule.nombre, type: 'PREVENTIVE', frequencyValue, frequencyUnit, triggerKm: frecKm || null,
            ...(proximaEjecucion ? { nextExecutionDate: proximaEjecucion } : {}),
            ...(kmBase != null ? { lastOdometerExecution: kmBase } : {}),
          },
        });
      } else {
        const code = `CR-${rule.id.slice(0, 6)}-${asset.code}`.toUpperCase();
        plan = await prisma().maintenancePlan.create({
          data: {
            tenantId, code, title: rule.nombre,
            description: `Generado desde catálogo de componentes (Flota 360): ${rule.nombre}`,
            type: 'PREVENTIVE', status: 'ACTIVE', assetId: asset.id,
            frequencyValue, frequencyUnit, triggerKm: frecKm || null,
            nextExecutionDate: proximaEjecucion ?? null,
            lastOdometerExecution: kmBase ?? null,
          },
        });
      }

      const aplicacion = await prisma().maintenanceComponentRuleAsset.upsert({
        where: { ruleId_assetId: { ruleId: id, assetId: asset.id } },
        update: {
          generatedPlanId: plan.id, isActive: true,
          frecuenciaKmOverride: body.data.frecuenciaKmOverride ?? null,
          frecuenciaDiasOverride: body.data.frecuenciaDiasOverride ?? null,
          tecnicoSugeridoId: body.data.tecnicoSugeridoId ?? null,
          accionVencimientoOverride: body.data.accionVencimientoOverride ?? null,
          kmBase: body.data.kmBase ?? null,
          proximaEjecucion: proximaEjecucion ?? null,
        },
        create: {
          ruleId: id, assetId: asset.id, generatedPlanId: plan.id, isActive: true,
          frecuenciaKmOverride: body.data.frecuenciaKmOverride ?? null,
          frecuenciaDiasOverride: body.data.frecuenciaDiasOverride ?? null,
          tecnicoSugeridoId: body.data.tecnicoSugeridoId ?? null,
          accionVencimientoOverride: body.data.accionVencimientoOverride ?? null,
          kmBase: body.data.kmBase ?? null,
          proximaEjecucion: proximaEjecucion ?? null,
        },
      });

      resultados.push({ assetId: asset.id, plan, aplicacion });
    }

    return reply.send({ ok: true, resultados });
  });

  // ─────────────────────────────────────────────────────────────
  // PLANES DE MANTENIMIENTO ACTIVOS — tabla operativa (solo lectura, agrega MaintenancePlan + vehículo + regla)
  // ─────────────────────────────────────────────────────────────
  app.get('/planes-activos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { tipo, estado, vehiculoId } = req.query as any;

    // Auto-aplicar reglas a los vehículos de su grupo (tipoActivoAplicable)
    try { await syncReglasConFlota(tenantId); } catch (e: any) { req.log?.warn({ err: e?.message }, '[fleet-ops] syncReglasConFlota falló'); }

    const [plans, vehiculos, ruleAssets, tecnicos] = await Promise.all([
      prisma().maintenancePlan.findMany({
        where: { tenantId, assetId: { not: null } },
        include: { asset: { select: { id: true, code: true, name: true } } },
        orderBy: { nextExecutionDate: 'asc' },
      }),
      prisma().vehiculo.findMany({
        where: { tenantId, ...(tipo ? { tipo } : {}), ...(estado ? { status: estado } : {}), ...(vehiculoId ? { id: vehiculoId } : {}) },
        select: { id: true, dominio: true, tipo: true, status: true, currentOdometer: true, maintenanceAssetId: true },
      }),
      prisma().maintenanceComponentRuleAsset.findMany({
        where: { rule: { tenantId }, isActive: true },
        include: { rule: { select: { id: true, nombre: true, criticidad: true, accionVencimiento: true } } },
      }),
      prisma().maintenanceTechnician.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    ]);

    const vehByAsset = new Map<string, any>(vehiculos.filter((v: any) => v.maintenanceAssetId).map((v: any) => [v.maintenanceAssetId, v]));
    const ruleByPlan = new Map<string, any>(ruleAssets.filter((ra: any) => ra.generatedPlanId).map((ra: any) => [ra.generatedPlanId, ra]));
    const tecMap = new Map<string, string>(tecnicos.map((t: any) => [t.id, t.name]));
    const now = new Date();

    const planes = plans
      .filter((p: any) => vehByAsset.has(p.assetId))
      .map((p: any) => {
        const veh = vehByAsset.get(p.assetId);
        const ra = ruleByPlan.get(p.id);
        const esKm = p.frequencyUnit === 'KM' && p.triggerKm;
        const kmActual = veh?.currentOdometer ?? null;
        let proximoKm: number | null = null;
        let kmRestantes: number | null = null;
        if (esKm) {
          const base = p.lastOdometerExecution ?? kmActual ?? 0;
          const prox = base + (p.triggerKm || 0);
          proximoKm = prox;
          kmRestantes = kmActual != null ? Math.round(prox - kmActual) : null;
        }
        let diasRestantes: number | null = null;
        if (p.nextExecutionDate) {
          diasRestantes = Math.ceil((new Date(p.nextExecutionDate).getTime() - now.getTime()) / 86400000);
        }
        let estadoPlan: 'VENCIDO' | 'URGENTE' | 'PROXIMO' | 'OK' = 'OK';
        if ((kmRestantes != null && kmRestantes <= 0) || (diasRestantes != null && diasRestantes <= 0)) estadoPlan = 'VENCIDO';
        else if ((kmRestantes != null && kmRestantes <= 1500) || (diasRestantes != null && diasRestantes <= 5)) estadoPlan = 'URGENTE';
        else if ((kmRestantes != null && kmRestantes <= 4000) || (diasRestantes != null && diasRestantes <= 15)) estadoPlan = 'PROXIMO';

        return {
          id: p.id,
          plan: p.title,
          codigo: p.code,
          activo: veh ? { id: veh.id, dominio: veh.dominio, tipo: veh.tipo, status: veh.status } : null,
          componente: ra?.rule?.nombre || null,
          frecuencia: esKm ? `Cada ${Math.round(p.triggerKm).toLocaleString('es-AR')} km` : `Cada ${p.frequencyValue} ${p.frequencyUnit === 'DAYS' ? 'días' : p.frequencyUnit === 'WEEKS' ? 'semanas' : p.frequencyUnit === 'MONTHS' ? 'meses' : 'años'}`,
          ultimaEjecucion: p.lastExecutionDate,
          proximaEjecucion: p.nextExecutionDate,
          proximoKm,
          kmRestantes,
          diasRestantes,
          estado: estadoPlan,
          estadoPlan: p.status,
          tecnicoSugerido: ra?.tecnicoSugeridoId ? tecMap.get(ra.tecnicoSugeridoId) || null : null,
          accionVencimiento: ra?.accionVencimientoOverride || ra?.rule?.accionVencimiento || null,
          origen: ra ? 'Catálogo de componentes' : 'Plan manual',
        };
      });

    return reply.send({ planes });
  });

  // ─────────────────────────────────────────────────────────────
  // PRÓXIMAS ALERTAS DE SERVICIO — agrega MaintenancePlan + odómetro del vehículo (solo lectura)
  // ─────────────────────────────────────────────────────────────
  app.get('/alertas-servicio', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { tipo, soloAlertas } = req.query as any;

    // Auto-aplicar reglas a los vehículos de su grupo antes de evaluar alertas
    try { await syncReglasConFlota(tenantId); } catch (e: any) { req.log?.warn({ err: e?.message }, '[fleet-ops] syncReglasConFlota falló'); }

    const [plans, vehiculos, ruleAssets] = await Promise.all([
      prisma().maintenancePlan.findMany({
        where: { tenantId, status: 'ACTIVE', assetId: { not: null } },
        include: { asset: { select: { id: true, code: true, name: true } } },
      }),
      prisma().vehiculo.findMany({ where: { tenantId, ...(tipo ? { tipo } : {}) }, select: { id: true, dominio: true, tipo: true, currentOdometer: true, maintenanceAssetId: true, status: true } }),
      prisma().maintenanceComponentRuleAsset.findMany({
        where: { rule: { tenantId } },
        include: { rule: { select: { nombre: true, criticidad: true, accionVencimiento: true, kmAnticipacion: true, diasAnticipacion: true, duracionEstimada: true } } },
      }),
    ]);

    const vehByAsset = new Map<string, any>(vehiculos.filter((v: any) => v.maintenanceAssetId).map((v: any) => [v.maintenanceAssetId, v]));
    const ruleAssetPorPlan = new Map<string, any>(ruleAssets.filter((ra: any) => ra.generatedPlanId).map((ra: any) => [ra.generatedPlanId, ra]));
    const now = new Date();

    const alertas = plans.filter((p: any) => vehByAsset.has(p.assetId)).map((p: any) => {
      const veh = p.assetId ? vehByAsset.get(p.assetId) : null;
      const esKm = p.frequencyUnit === 'KM' && p.triggerKm;
      let kmActual: number | null = veh?.currentOdometer ?? null;
      let proximoServicioKm: number | null = null;
      let kmRestantes: number | null = null;
      if (esKm) {
        const base = p.lastOdometerExecution ?? kmActual ?? 0;
        const proximo = base + p.triggerKm;
        proximoServicioKm = proximo;
        kmRestantes = kmActual != null ? Math.round(proximo - kmActual) : null;
      }
      let diasRestantes: number | null = null;
      if (p.nextExecutionDate) {
        diasRestantes = Math.ceil((new Date(p.nextExecutionDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Umbrales de anticipación por regla de componente (fallback a valores por defecto)
      const ra = ruleAssetPorPlan.get(p.id);
      const proximoKmLimite = ra?.rule?.kmAnticipacion ?? 4000;
      const proximoDiasLimite = ra?.rule?.diasAnticipacion ?? 15;
      const urgenteKmLimite = Math.min(1500, proximoKmLimite);
      const urgenteDiasLimite = Math.min(5, proximoDiasLimite);

      let estado: 'VENCIDO' | 'URGENTE' | 'PROXIMO' | 'OK' = 'OK';
      const vencidoKm = kmRestantes != null && kmRestantes <= 0;
      const vencidoDias = diasRestantes != null && diasRestantes <= 0;
      const urgenteKm = kmRestantes != null && kmRestantes > 0 && kmRestantes <= urgenteKmLimite;
      const urgenteDias = diasRestantes != null && diasRestantes > 0 && diasRestantes <= urgenteDiasLimite;
      const proximoKm = kmRestantes != null && kmRestantes > urgenteKmLimite && kmRestantes <= proximoKmLimite;
      const proximoDias = diasRestantes != null && diasRestantes > urgenteDiasLimite && diasRestantes <= proximoDiasLimite;

      if (vencidoKm || vencidoDias) estado = 'VENCIDO';
      else if (urgenteKm || urgenteDias) estado = 'URGENTE';
      else if (proximoKm || proximoDias) estado = 'PROXIMO';

      return {
        id: p.id,
        planId: p.id,
        assetId: p.assetId,
        activo: veh ? { id: veh.id, dominio: veh.dominio, tipo: veh.tipo, status: veh.status } : (p.asset ? { id: p.asset.id, dominio: p.asset.name, tipo: '—' } : null),
        componente: p.title,
        kmActual,
        proximoServicioKm,
        kmRestantes,
        diasRestantes,
        fechaEstimada: p.nextExecutionDate,
        criticidad: ra?.rule?.criticidad || 'MEDIA',
        accionVencimiento: ra?.accionVencimientoOverride || ra?.rule?.accionVencimiento || null,
        estado,
      };
    })
    .filter((a: any) => a.estado !== 'OK')
    .filter((a: any) => soloAlertas !== 'urgentes' || a.estado !== 'PROXIMO')
    .sort((a: any, b: any) => {
      const rank: Record<string, number> = { VENCIDO: 0, URGENTE: 1, PROXIMO: 2 };
      return rank[a.estado] - rank[b.estado];
    });

    // GENERAR_OT: al entrar en la ventana de anticipación, crear la OT preventiva
    // automáticamente. Idempotente: no duplica si ya hay una OT abierta para ese plan.
    try {
      const candidatas = alertas.filter((a: any) => a.accionVencimiento === 'GENERAR_OT');
      if (candidatas.length > 0) {
        const planIds = candidatas.map((a: any) => a.planId);
        const otsAbiertas = await prisma().workOrder.findMany({
          where: { tenantId, planId: { in: planIds }, status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] } },
          select: { planId: true },
        });
        const planesConOT = new Set(otsAbiertas.map((o: any) => o.planId));
        const prioridadPorCriticidad: Record<string, string> = { ALTA: 'HIGH', MEDIA: 'MEDIUM', BAJA: 'LOW' };
        let n = 0;
        for (const a of candidatas) {
          if (planesConOT.has(a.planId)) continue;
          const ra = ruleAssetPorPlan.get(a.planId);
          await prisma().workOrder.create({
            data: {
              code: `OT-AUTO-${Date.now().toString().slice(-6)}-${++n}`,
              title: a.componente,
              description: `OT generada automáticamente: "${a.componente}" entró en la ventana de anticipación (${a.estado}).`,
              type: 'PREVENTIVE',
              priority: prioridadPorCriticidad[a.criticidad] || 'MEDIUM',
              status: 'PENDING',
              assetId: a.assetId,
              planId: a.planId,
              technicianId: ra?.tecnicoSugeridoId || null,
              scheduledDate: a.fechaEstimada ? new Date(a.fechaEstimada) : new Date(),
              estimatedDuration: ra?.rule?.duracionEstimada != null ? Math.round(ra.rule.duracionEstimada) : null,
              origen: 'MANTENIMIENTO',
              tenantId,
            },
          });
          planesConOT.add(a.planId);
        }
      }
    } catch (e: any) {
      req.log?.warn({ err: e?.message }, '[fleet-ops] auto GENERAR_OT falló');
    }

    return reply.send({ alertas });
  });

  // ─────────────────────────────────────────────────────────────
  // PROGRAMA DE MANTENIMIENTOS — matriz real por activo (solo lectura, agrega OT + inspecciones QR existentes)
  // Incluye TODOS los vehículos (tengan o no plan asignado). Nunca queda vacía si hay flota cargada.
  // ─────────────────────────────────────────────────────────────
  app.get('/programa-mantenimiento', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { periodo = 'MES', desde: desdeQ, tipo, estado, soloAlertas, vehiculoId } = req.query as any;
    const now = new Date();
    const ancla = desdeQ ? new Date(desdeQ) : now;

    let periodoInicio: Date;
    let periodoFin: Date;
    let columnas: { index: number; label: string; desde: Date; hasta: Date }[] = [];

    if (periodo === 'SEMANA') {
      const diaSemana = ancla.getDay() === 0 ? 7 : ancla.getDay();
      periodoInicio = new Date(ancla); periodoInicio.setDate(ancla.getDate() - diaSemana + 1); periodoInicio.setHours(0, 0, 0, 0);
      periodoFin = new Date(periodoInicio); periodoFin.setDate(periodoInicio.getDate() + 7);
      columnas = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(periodoInicio); d.setDate(periodoInicio.getDate() + i);
        const h = new Date(d); h.setHours(23, 59, 59, 999);
        return { index: i, label: d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit' }), desde: d, hasta: h };
      });
    } else if (periodo === 'TRIMESTRE') {
      const q = Math.floor(ancla.getMonth() / 3);
      periodoInicio = new Date(ancla.getFullYear(), q * 3, 1);
      periodoFin = new Date(ancla.getFullYear(), q * 3 + 3, 1);
      columnas = Array.from({ length: 3 }, (_, i) => {
        const d = new Date(periodoInicio.getFullYear(), periodoInicio.getMonth() + i, 1);
        const h = new Date(periodoInicio.getFullYear(), periodoInicio.getMonth() + i + 1, 0, 23, 59, 59);
        return { index: i, label: d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }), desde: d, hasta: h };
      });
    } else {
      // MES (default)
      periodoInicio = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
      periodoFin = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 1);
      const inicioGrilla = new Date(periodoInicio);
      const diaSemInicio = inicioGrilla.getDay() === 0 ? 7 : inicioGrilla.getDay();
      inicioGrilla.setDate(inicioGrilla.getDate() - diaSemInicio + 1);
      const semanasNecesarias = Math.ceil((periodoFin.getTime() - inicioGrilla.getTime()) / (7 * 24 * 3600 * 1000));
      columnas = Array.from({ length: semanasNecesarias }, (_, i) => {
        const d = new Date(inicioGrilla); d.setDate(inicioGrilla.getDate() + i * 7);
        const h = new Date(d); h.setDate(d.getDate() + 6); h.setHours(23, 59, 59, 999);
        return { index: i, label: `${d.getDate()}/${d.getMonth() + 1}`, desde: d, hasta: h };
      });
    }

    const rangoConsultaDesde = columnas[0]?.desde || periodoInicio;
    const rangoConsultaHasta = columnas[columnas.length - 1]?.hasta || periodoFin;

    const vehiculoWhere: any = { tenantId };
    if (tipo) vehiculoWhere.tipo = tipo;
    if (estado) vehiculoWhere.status = estado;
    if (vehiculoId) vehiculoWhere.id = vehiculoId;

    const [vehiculos, workOrders, inspecciones, planesActivos] = await Promise.all([
      prisma().vehiculo.findMany({
        where: vehiculoWhere,
        select: { id: true, dominio: true, tipo: true, status: true, currentOdometer: true, maintenanceAssetId: true },
        orderBy: { dominio: 'asc' },
      }),
      prisma().workOrder.findMany({
        where: { tenantId, scheduledDate: { gte: rangoConsultaDesde, lte: rangoConsultaHasta } },
        select: { id: true, code: true, title: true, status: true, priority: true, scheduledDate: true, assetId: true, origen: true },
      }),
      prisma().inspeccion.findMany({
        where: { tenantId, createdAt: { gte: rangoConsultaDesde, lte: rangoConsultaHasta } },
        include: { qr: { select: { maintenanceAssetId: true } }, hallazgos: { select: { id: true, severidad: true, equipoDestino: true } } },
      }),
      prisma().maintenancePlan.findMany({
        where: { tenantId, status: 'ACTIVE', assetId: { not: null } },
        select: { id: true, assetId: true, title: true, frequencyUnit: true, frequencyValue: true, triggerKm: true, lastOdometerExecution: true, nextExecutionDate: true },
      }),
    ]);

    const planPorAsset = new Set(planesActivos.map((p: any) => p.assetId));
    const planesPorAsset = new Map<string, any[]>();
    for (const p of planesActivos) {
      if (!p.assetId) continue;
      if (!planesPorAsset.has(p.assetId)) planesPorAsset.set(p.assetId, []);
      planesPorAsset.get(p.assetId)!.push(p);
    }
    const otsPorAsset = new Map<string, any[]>();
    for (const o of workOrders) {
      if (!o.assetId) continue;
      if (!otsPorAsset.has(o.assetId)) otsPorAsset.set(o.assetId, []);
      otsPorAsset.get(o.assetId)!.push(o);
    }

    let filas = vehiculos.map((v: any) => {
      const ots = v.maintenanceAssetId ? (otsPorAsset.get(v.maintenanceAssetId) || []) : [];
      const esSemi = v.tipo === 'SEMI';
      const inspMatched = inspecciones.filter((insp: any) => {
        if (v.maintenanceAssetId && insp.qr?.maintenanceAssetId === v.maintenanceAssetId) return true;
        const dominioMatch = esSemi ? insp.dominioSemi : insp.dominioTractor;
        return dominioMatch && dominioMatch.toUpperCase() === v.dominio.toUpperCase();
      });

      const planesVeh = v.maintenanceAssetId ? (planesPorAsset.get(v.maintenanceAssetId) || []) : [];

      const celdas = columnas.map((col) => {
        const otsEnCol = ots.filter((o: any) => { const d = new Date(o.scheduledDate); return d >= col.desde && d <= col.hasta; });
        const inspEnCol = inspMatched.filter((i: any) => { const d = new Date(i.createdAt); return d >= col.desde && d <= col.hasta; });

        const eventos: any[] = [];
        for (const o of otsEnCol) {
          let estadoOT: 'PROGRAMADO' | 'EJECUTADO' | 'VENCIDO' = 'PROGRAMADO';
          if (o.status === 'COMPLETED') estadoOT = 'EJECUTADO';
          else if (o.status === 'PENDING' && new Date(o.scheduledDate) < now) estadoOT = 'VENCIDO';
          eventos.push({ tipo: 'OT', id: o.id, codigo: o.code, titulo: o.title, estado: estadoOT, prioridad: o.priority, origen: o.origen });
        }
        for (const i of inspEnCol) {
          const hallazgosRol = i.hallazgos.filter((h: any) => !h.equipoDestino || (esSemi ? h.equipoDestino === 'SEMI' : h.equipoDestino === 'TRACTOR'));
          eventos.push({ tipo: 'QR', id: i.id, estado: 'QR', hallazgos: hallazgosRol.length, criticos: hallazgosRol.filter((h: any) => h.severidad === 'CRITICO').length });
        }
        // Proyección de planes: marca ámbar cuando el próximo servicio cae dentro de la columna
        // (por fecha nextExecutionDate o por km estimado con promedio de uso).
        for (const p of planesVeh) {
          let fechaPlan: Date | null = null;
          if (p.nextExecutionDate) {
            fechaPlan = new Date(p.nextExecutionDate);
          } else if (p.frequencyUnit === 'KM' && p.triggerKm && v.currentOdometer != null) {
            const base = p.lastOdometerExecution ?? v.currentOdometer;
            const kmRestantes = base + p.triggerKm - v.currentOdometer;
            if (kmRestantes <= 0) {
              fechaPlan = now; // vencido por km → se muestra en la columna actual
            } else {
              // Estimación: 250 km/día de referencia si no hay historial de consumo
              const kmPorDia = 250;
              fechaPlan = new Date(now.getTime() + (kmRestantes / kmPorDia) * 86400000);
            }
          }
          if (fechaPlan && fechaPlan >= col.desde && fechaPlan <= col.hasta) {
            eventos.push({ tipo: 'PLAN', id: p.id, titulo: p.title, estado: 'PROXIMO' });
          }
        }
        return eventos.length > 0 ? { eventos } : null;
      });

      return {
        vehiculoId: v.id, dominio: v.dominio, tipo: v.tipo, status: v.status,
        odometro: v.currentOdometer, hasPlan: v.maintenanceAssetId ? planPorAsset.has(v.maintenanceAssetId) : false,
        celdas,
      };
    });

    if (soloAlertas === 'true') {
      filas = filas.filter((f: any) => f.celdas.some((c: any) => c?.eventos.some((e: any) => e.estado === 'VENCIDO')));
    }

    return reply.send({ periodo, periodoInicio, periodoFin, columnas, filas });
  });

  // Mueve una OT planificada (aún no iniciada) a otra fecha dentro del cronograma.
  // No modifica historial, costos ni ningún otro campo de la OT — solo su fecha programada.
  app.patch('/programa-mantenimiento/mover-ot', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({ workOrderId: z.string().uuid(), nuevaFecha: z.string() });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const ot = await prisma().workOrder.findFirst({ where: { id: body.data.workOrderId, tenantId } });
    if (!ot) return reply.code(404).send({ error: 'Orden de trabajo no encontrada' });
    if (ot.status !== 'PENDING') return reply.code(409).send({ error: 'Solo se pueden reprogramar órdenes pendientes' });

    const actualizada = await prisma().workOrder.update({
      where: { id: ot.id },
      data: { scheduledDate: new Date(body.data.nuevaFecha) },
    });
    return reply.send({ ok: true, workOrder: actualizada });
  });

  // ─────────────────────────────────────────────────────────────
  // INVENTARIO DE REPUESTOS CON RESERVA — agrega WorkOrderSparePart no descontado (solo lectura)
  // ─────────────────────────────────────────────────────────────
  app.get('/repuestos-inventario', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const [partes, reservasRaw, componentUsage] = await Promise.all([
      prisma().maintenanceSparePart.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
      prisma().workOrderSparePart.findMany({
        where: { tenantId, stockDeducted: false, workOrder: { status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] } } },
        select: { sparePartId: true, quantity: true, workOrder: { select: { code: true, title: true, scheduledDate: true } } },
      }),
      prisma().maintenanceComponentRuleSparePart.findMany({
        where: { rule: { tenantId } },
        select: { sparePartId: true, rule: { select: { nombre: true, aplicaciones: { select: { isActive: true } } } } },
      }),
    ]);

    const reservaMap = new Map<string, number>();
    const proximasOTMap = new Map<string, any[]>();
    for (const r of reservasRaw) {
      reservaMap.set(r.sparePartId, (reservaMap.get(r.sparePartId) || 0) + r.quantity);
      if (!proximasOTMap.has(r.sparePartId)) proximasOTMap.set(r.sparePartId, []);
      proximasOTMap.get(r.sparePartId)!.push({ code: r.workOrder.code, title: r.workOrder.title, scheduledDate: r.workOrder.scheduledDate });
    }
    const planesMap = new Map<string, Set<string>>();
    for (const c of componentUsage) {
      const activas = c.rule.aplicaciones.filter((a: any) => a.isActive).length;
      if (activas === 0) continue;
      if (!planesMap.has(c.sparePartId)) planesMap.set(c.sparePartId, new Set());
      planesMap.get(c.sparePartId)!.add(c.rule.nombre);
    }

    const repuestos = partes.map((p: any) => {
      const reservado = reservaMap.get(p.id) || 0;
      const disponible = p.currentStock - reservado;
      let estado: 'OK' | 'BAJO' | 'CRITICO' = 'OK';
      if (disponible <= 0) estado = 'CRITICO';
      else if (disponible <= p.minStock) estado = 'BAJO';
      return {
        id: p.id, code: p.code, name: p.name, category: p.category,
        currentStock: p.currentStock, minStock: p.minStock, reservado, disponible, estado,
        proximasOTs: (proximasOTMap.get(p.id) || []).slice(0, 5),
        planesQueLoRequieren: Array.from(planesMap.get(p.id) || []),
      };
    });

    return reply.send({ repuestos });
  });

  // Ajuste manual de stock con motivo obligatorio (no reemplaza el descuento automático por OT).
  app.post('/repuestos-inventario/:id/ajustar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({ delta: z.number().int().refine((v) => v !== 0, 'El ajuste no puede ser 0'), motivo: z.string().min(3, 'El motivo es obligatorio') });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const parte = await prisma().maintenanceSparePart.findFirst({ where: { id, tenantId } });
    if (!parte) return reply.code(404).send({ error: 'Repuesto no encontrado' });

    const [actualizado] = await prisma().$transaction([
      prisma().maintenanceSparePart.update({ where: { id }, data: { currentStock: { increment: body.data.delta } } }),
      prisma().maintenanceSparePartMovement.create({ data: { tenantId, sparePartId: id, delta: body.data.delta, motivo: body.data.motivo, userId: (req as any).db?.userId || null } }),
    ]);
    return reply.send({ ok: true, part: actualizado });
  });

  // Historial de movimientos de un repuesto: ajustes manuales + consumo por OT (unificado, solo lectura)
  app.get('/repuestos-inventario/:id/movimientos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;

    const [ajustes, consumos] = await Promise.all([
      prisma().maintenanceSparePartMovement.findMany({ where: { tenantId, sparePartId: id }, orderBy: { createdAt: 'desc' } }),
      prisma().workOrderSparePart.findMany({
        where: { tenantId, sparePartId: id, stockDeducted: true },
        include: { workOrder: { select: { code: true, title: true, completedAt: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const movimientos = [
      ...ajustes.map((a: any) => ({ tipo: 'AJUSTE_MANUAL', delta: a.delta, motivo: a.motivo, fecha: a.createdAt })),
      ...consumos.map((c: any) => ({ tipo: 'CONSUMO_OT', delta: -c.quantity, motivo: `OT ${c.workOrder.code} · ${c.workOrder.title}`, fecha: c.workOrder.completedAt || c.createdAt })),
    ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    return reply.send({ movimientos });
  });

  // ─────────────────────────────────────────────────────────────
  // CARGA DE TALLER — horas asignadas por técnico y día vs. capacidad diaria (solo lectura)
  // ─────────────────────────────────────────────────────────────
  app.get('/carga-taller', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { desde: desdeQ, dias } = req.query as any;
    const numDias = Math.min(Number(dias) || 7, 14);
    const desde = desdeQ ? new Date(desdeQ) : new Date();
    desde.setHours(0, 0, 0, 0);
    const hasta = new Date(desde); hasta.setDate(desde.getDate() + numDias);

    const [tecnicos, ordenes] = await Promise.all([
      prisma().maintenanceTechnician.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } }),
      prisma().workOrder.findMany({
        where: { tenantId, scheduledDate: { gte: desde, lt: hasta }, technicianId: { not: null } },
        select: { id: true, code: true, title: true, technicianId: true, scheduledDate: true, estimatedDuration: true, status: true },
      }),
    ]);

    const dias_ = Array.from({ length: numDias }, (_, i) => {
      const d = new Date(desde); d.setDate(desde.getDate() + i);
      return d;
    });

    const filas = tecnicos.map((t: any) => {
      const celdas = dias_.map((d) => {
        const finDia = new Date(d); finDia.setHours(23, 59, 59, 999);
        const otsDia = ordenes.filter((o: any) => o.technicianId === t.id && new Date(o.scheduledDate) >= d && new Date(o.scheduledDate) <= finDia);
        const horasAsignadas = otsDia.reduce((acc: number, o: any) => acc + (o.estimatedDuration || 0), 0);
        return {
          fecha: d, horasAsignadas, capacidad: t.dailyCapacityHours,
          sobreasignado: horasAsignadas > t.dailyCapacityHours,
          ots: otsDia.map((o: any) => ({ id: o.id, codigo: o.code, titulo: o.title })),
        };
      });
      return { tecnicoId: t.id, nombre: t.name, especializacion: t.specialization, celdas };
    });

    return reply.send({ dias: dias_, filas });
  });

  // ─────────────────────────────────────────────────────────────
  // FILTROS — metadata real para la cabecera de Planes y frecuencias (solo lectura)
  // ─────────────────────────────────────────────────────────────
  app.get('/filtros', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const [tipos, tecnicos] = await Promise.all([
      prisma().vehiculo.findMany({ where: { tenantId }, select: { tipo: true }, distinct: ['tipo'] }),
      prisma().maintenanceTechnician.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return reply.send({
      tipos: tipos.map((t: any) => t.tipo),
      estados: ['ACTIVO', 'EN_TALLER', 'INACTIVO', 'BAJA'],
      tecnicos,
    });
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

  // ─────────────────────────────────────────────────────────────
  // COSTOS Y TCO — vista ejecutiva: KPIs, evolución mensual, composición, desvíos por unidad
  // Solo lectura: agrega RegistroCombustible + WorkOrder + NeumaticoPosicion existentes.
  // ─────────────────────────────────────────────────────────────
  app.get('/costos-tco', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const finMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const hace6meses = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [vehiculos, combustible6m, ots6m, neumDesmontados6m] = await Promise.all([
      prisma().vehiculo.findMany({
        where: { tenantId },
        select: { id: true, dominio: true, tipo: true, status: true, currentOdometer: true, maintenanceAssetId: true },
      }),
      prisma().registroCombustible.findMany({
        where: { tenantId, fecha: { gte: hace6meses } },
        select: { vehiculoId: true, costoTotal: true, litros: true, fecha: true },
      }),
      prisma().workOrder.findMany({
        where: { tenantId, status: 'COMPLETED', completedAt: { gte: hace6meses } },
        select: { assetId: true, totalCost: true, laborCost: true, partsCost: true, completedAt: true },
      }),
      prisma().neumaticoPosicion.findMany({
        where: { tenantId, activo: false, desmontadoAt: { gte: hace6meses } },
        select: { vehiculoId: true, desmontadoAt: true, neumatico: { select: { precioCompra: true } } },
      }),
    ]);

    const vehByAsset = new Map<string, any>(vehiculos.filter((v: any) => v.maintenanceAssetId).map((v: any) => [v.maintenanceAssetId, v]));
    const mesKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mesLabel = (d: Date) => d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });

    // Serie mensual de los últimos 6 meses
    const meses: { key: string; label: string; combustible: number; mantenimiento: number; neumaticos: number; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      meses.push({ key: mesKey(d), label: mesLabel(d), combustible: 0, mantenimiento: 0, neumaticos: 0, total: 0 });
    }
    const mesMap = new Map(meses.map((m) => [m.key, m]));

    for (const c of combustible6m) {
      const m = mesMap.get(mesKey(new Date(c.fecha)));
      if (m) m.combustible += c.costoTotal || 0;
    }
    for (const o of ots6m) {
      if (!o.completedAt) continue;
      const m = mesMap.get(mesKey(new Date(o.completedAt)));
      if (m) m.mantenimiento += o.totalCost || 0;
    }
    for (const n of neumDesmontados6m) {
      if (!n.desmontadoAt) continue;
      const m = mesMap.get(mesKey(new Date(n.desmontadoAt)));
      if (m) m.neumaticos += n.neumatico?.precioCompra || 0;
    }
    meses.forEach((m) => { m.total = m.combustible + m.mantenimiento + m.neumaticos; });

    // Totales del mes actual y anterior
    const keyMes = mesKey(inicioMes);
    const keyMesAnt = mesKey(inicioMesAnterior);
    const mesActual = mesMap.get(keyMes) || { combustible: 0, mantenimiento: 0, neumaticos: 0, total: 0 };
    const mesAnterior = mesMap.get(keyMesAnt) || { combustible: 0, mantenimiento: 0, neumaticos: 0, total: 0 };

    // Costo por unidad en el mes actual (y anterior para variación)
    const costoPorUnidad = (desde: Date, hasta: Date) => {
      const mapa = new Map<string, { combustible: number; mantenimiento: number; neumaticos: number; km: number | null }>();
      for (const v of vehiculos) mapa.set(v.id, { combustible: 0, mantenimiento: 0, neumaticos: 0, km: v.currentOdometer });
      for (const c of combustible6m) {
        const f = new Date(c.fecha);
        if (f >= desde && f <= hasta) mapa.get(c.vehiculoId)!.combustible += c.costoTotal || 0;
      }
      for (const o of ots6m) {
        const f = o.completedAt ? new Date(o.completedAt) : null;
        const veh = o.assetId ? vehByAsset.get(o.assetId) : null;
        if (f && f >= desde && f <= hasta && veh) mapa.get(veh.id)!.mantenimiento += o.totalCost || 0;
      }
      for (const n of neumDesmontados6m) {
        const f = n.desmontadoAt ? new Date(n.desmontadoAt) : null;
        if (f && f >= desde && f <= hasta && mapa.has(n.vehiculoId)) mapa.get(n.vehiculoId)!.neumaticos += n.neumatico?.precioCompra || 0;
      }
      return mapa;
    };

    const unidadMes = costoPorUnidad(inicioMes, now);
    const unidadMesAnt = costoPorUnidad(inicioMesAnterior, finMesAnterior);

    const desvios = vehiculos.map((v: any) => {
      const actual = unidadMes.get(v.id)!;
      const anterior = unidadMesAnt.get(v.id)!;
      const totalActual = actual.combustible + actual.mantenimiento + actual.neumaticos;
      const totalAnterior = anterior.combustible + anterior.mantenimiento + anterior.neumaticos;
      const variacion = totalAnterior > 0 ? Math.round(((totalActual - totalAnterior) / totalAnterior) * 10000) / 100 : null;
      let causaPrincipal = 'Combustible';
      let mayor = actual.combustible;
      if (actual.mantenimiento > mayor) { mayor = actual.mantenimiento; causaPrincipal = 'Mantenimiento'; }
      if (actual.neumaticos > mayor) { mayor = actual.neumaticos; causaPrincipal = 'Neumáticos'; }
      return {
        vehiculoId: v.id, dominio: v.dominio, tipo: v.tipo,
        costoMes: Math.round(totalActual),
        costoMesAnterior: Math.round(totalAnterior),
        variacion,
        causaPrincipal: totalActual > 0 ? causaPrincipal : null,
        desglose: { combustible: Math.round(actual.combustible), mantenimiento: Math.round(actual.mantenimiento), neumaticos: Math.round(actual.neumaticos) },
      };
    }).filter((d: any) => d.costoMes > 0 || d.costoMesAnterior > 0)
      .sort((a: any, b: any) => (b.variacion ?? -Infinity) - (a.variacion ?? -Infinity));

    const kmTotales = vehiculos.reduce((acc: number, v: any) => acc + (v.currentOdometer || 0), 0);
    const costoPorKm = kmTotales > 0 ? Math.round((mesActual.total / kmTotales) * 100) / 100 : null;
    const variacionTotal = mesAnterior.total > 0
      ? Math.round(((mesActual.total - mesAnterior.total) / mesAnterior.total) * 10000) / 100
      : null;
    const unidadesConDesvio = desvios.filter((d: any) => d.variacion != null && d.variacion > 20).length;

    return reply.send({
      hayDatos: mesActual.total > 0 || meses.some((m) => m.total > 0),
      kpis: {
        costoTotalMes: Math.round(mesActual.total),
        costoPorKm,
        variacionVsMesAnterior: variacionTotal,
        unidadesConDesvio,
      },
      evolucion: meses.map((m) => ({ mes: m.label, combustible: Math.round(m.combustible), mantenimiento: Math.round(m.mantenimiento), neumaticos: Math.round(m.neumaticos), total: Math.round(m.total) })),
      composicion: {
        combustible: Math.round(mesActual.combustible),
        mantenimiento: Math.round(mesActual.mantenimiento),
        neumaticos: Math.round(mesActual.neumaticos),
      },
      desvios,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SEED DEMO — carga datos de demostración para todos los módulos de Flota 360.
  // Idempotente: si ya existen vehículos DEMO-* del tenant, no duplica.
  // Solo crea registros nuevos; no modifica ni borra datos existentes.
  // ─────────────────────────────────────────────────────────────
  app.post('/seed-demo', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const existente = await prisma().vehiculo.findFirst({ where: { tenantId, dominio: { startsWith: 'DEMO-' } }, select: { id: true } });
    if (existente) {
      return reply.send({ ok: true, yaExistia: true, mensaje: 'Los datos de demostración ya estaban cargados' });
    }

    const now = new Date();
    const diasAtras = (n: number) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };
    const diasAdelante = (n: number) => { const d = new Date(now); d.setDate(d.getDate() + n); return d; };
    const mesesAtras = (n: number, dia = 10) => { const d = new Date(now); d.setMonth(d.getMonth() - n); d.setDate(dia); return d; };

    // ── Técnicos ──
    const tecnicos = await Promise.all([
      prisma().maintenanceTechnician.create({ data: { tenantId, code: `TEC-DEMO-1-${tenantId.slice(0, 6)}`, name: 'Carlos Gómez', specialization: 'Mecánica pesada', dailyCapacityHours: 8 } }),
      prisma().maintenanceTechnician.create({ data: { tenantId, code: `TEC-DEMO-2-${tenantId.slice(0, 6)}`, name: 'María Fernández', specialization: 'Electricidad y electrónica', dailyCapacityHours: 8 } }),
      prisma().maintenanceTechnician.create({ data: { tenantId, code: `TEC-DEMO-3-${tenantId.slice(0, 6)}`, name: 'Jorge Ramírez', specialization: 'Neumáticos y frenos', dailyCapacityHours: 6 } }),
    ]);

    // ── Repuestos ──
    const repuestos = await Promise.all([
      prisma().maintenanceSparePart.create({ data: { tenantId, code: `REP-DEMO-ACEITE-${tenantId.slice(0, 6)}`, name: 'Aceite motor 15W-40 (bidón 20L)', category: 'Lubricación', currentStock: 8, minStock: 3, unitCost: 85000, supplier: 'YPF Boxes' } }),
      prisma().maintenanceSparePart.create({ data: { tenantId, code: `REP-DEMO-FILTRO-${tenantId.slice(0, 6)}`, name: 'Filtro de aceite', category: 'Filtros', currentStock: 12, minStock: 4, unitCost: 18500, supplier: 'Mann Filter' } }),
      prisma().maintenanceSparePart.create({ data: { tenantId, code: `REP-DEMO-FILTROA-${tenantId.slice(0, 6)}`, name: 'Filtro de aire primario', category: 'Filtros', currentStock: 5, minStock: 4, unitCost: 42000, supplier: 'Mann Filter' } }),
      prisma().maintenanceSparePart.create({ data: { tenantId, code: `REP-DEMO-PASTILLA-${tenantId.slice(0, 6)}`, name: 'Pastillas de freno (juego eje)', category: 'Frenos', currentStock: 2, minStock: 4, unitCost: 95000, supplier: 'Fric-Rot' } }),
      prisma().maintenanceSparePart.create({ data: { tenantId, code: `REP-DEMO-CORREA-${tenantId.slice(0, 6)}`, name: 'Correa poly-V', category: 'Motor', currentStock: 0, minStock: 2, unitCost: 38000, supplier: 'Continental' } }),
      prisma().maintenanceSparePart.create({ data: { tenantId, code: `REP-DEMO-UREA-${tenantId.slice(0, 6)}`, name: 'UREA / AdBlue (bidón 20L)', category: 'Fluidos', currentStock: 15, minStock: 5, unitCost: 22000, supplier: 'YPF Boxes' } }),
    ]);

    // ── Conductores ──
    const conductores = await Promise.all([
      prisma().conductor.create({ data: { tenantId, nombre: 'Héctor Sosa', dni: '25.431.876', telefono: '11-5555-0101', categoria: 'E', nroLicencia: 'E-2543187', licenciaVto: diasAdelante(210), psicofisicoVto: diasAdelante(45), status: 'ACTIVO' } }),
      prisma().conductor.create({ data: { tenantId, nombre: 'Adrián Vega', dni: '30.112.554', telefono: '11-5555-0102', categoria: 'E', nroLicencia: 'E-3011255', licenciaVto: diasAdelante(18), psicofisicoVto: diasAdelante(120), status: 'ACTIVO' } }),
      prisma().conductor.create({ data: { tenantId, nombre: 'Pablo Duarte', dni: '28.990.341', telefono: '11-5555-0103', categoria: 'D', nroLicencia: 'D-2899034', licenciaVto: diasAtras(12), psicofisicoVto: diasAdelante(300), status: 'ACTIVO' } }),
      prisma().conductor.create({ data: { tenantId, nombre: 'Lucía Pereyra', dni: '33.455.120', telefono: '11-5555-0104', categoria: 'B', nroLicencia: 'B-3345512', licenciaVto: diasAdelante(400), psicofisicoVto: diasAdelante(200), status: 'ACTIVO' } }),
    ]);

    // ── Vehículos + activos de mantenimiento vinculados ──
    const crearVehiculo = async (data: any, assetCode: string, assetName: string) => {
      const asset = await prisma().maintenanceAsset.create({
        data: { tenantId, code: assetCode, name: assetName, category: 'VEHICLE', status: 'ACTIVE', currentOdometer: data.currentOdometer ?? null },
      });
      return prisma().vehiculo.create({ data: { ...data, tenantId, maintenanceAssetId: asset.id } });
    };

    const tractor1 = await crearVehiculo(
      { dominio: 'DEMO-AC123BB', tipo: 'TRACTOR', cantEjes: 3, configEjes: '6x4', marca: 'Scania', modelo: 'R450', anio: 2021, color: 'Blanco', currentOdometer: 412350, status: 'ACTIVO', conductorId: conductores[0].id },
      `AST-DEMO-T1-${tenantId.slice(0, 6)}`, 'Tractor Scania R450 (DEMO-AC123BB)',
    );
    const tractor2 = await crearVehiculo(
      { dominio: 'DEMO-AF456KL', tipo: 'TRACTOR', cantEjes: 2, configEjes: '4x2', marca: 'Volvo', modelo: 'FH 460', anio: 2019, color: 'Azul', currentOdometer: 688900, status: 'EN_TALLER', notas: 'Ingreso por falla en sistema de frenos EBS', conductorId: conductores[1].id },
      `AST-DEMO-T2-${tenantId.slice(0, 6)}`, 'Tractor Volvo FH 460 (DEMO-AF456KL)',
    );
    const tractor3 = await crearVehiculo(
      { dominio: 'DEMO-AD789MN', tipo: 'TRACTOR', cantEjes: 3, configEjes: '6x2', marca: 'Mercedes-Benz', modelo: 'Actros 2646', anio: 2022, color: 'Gris', currentOdometer: 198400, status: 'ACTIVO', conductorId: conductores[2].id },
      `AST-DEMO-T3-${tenantId.slice(0, 6)}`, 'Tractor MB Actros 2646 (DEMO-AD789MN)',
    );
    const semi1 = await crearVehiculo(
      { dominio: 'DEMO-BBB111', tipo: 'SEMI', cantEjes: 3, configEjes: 'SEMI_3EJE', marca: 'Helvetica', modelo: 'Sider 30', anio: 2020, currentOdometer: 355000, status: 'ACTIVO' },
      `AST-DEMO-S1-${tenantId.slice(0, 6)}`, 'Semi Helvetica Sider (DEMO-BBB111)',
    );
    const semi2 = await crearVehiculo(
      { dominio: 'DEMO-BCC222', tipo: 'SEMI', cantEjes: 2, configEjes: 'SEMI_2EJE', marca: 'Randon', modelo: 'Batea cerealera', anio: 2018, currentOdometer: 502300, status: 'ACTIVO' },
      `AST-DEMO-S2-${tenantId.slice(0, 6)}`, 'Semi Randon Batea (DEMO-BCC222)',
    );
    const camion = await crearVehiculo(
      { dominio: 'DEMO-AE333PQ', tipo: 'CAMION', cantEjes: 2, configEjes: '4x2', marca: 'Iveco', modelo: 'Tector 170E', anio: 2020, color: 'Rojo', currentOdometer: 234100, status: 'ACTIVO', conductorId: conductores[3].id },
      `AST-DEMO-C1-${tenantId.slice(0, 6)}`, 'Camión Iveco Tector (DEMO-AE333PQ)',
    );
    const utilitario = await crearVehiculo(
      { dominio: 'DEMO-AG444RS', tipo: 'UTILITARIO', cantEjes: 2, marca: 'Mercedes-Benz', modelo: 'Sprinter 415', anio: 2023, color: 'Blanco', currentOdometer: 45200, status: 'ACTIVO' },
      `AST-DEMO-U1-${tenantId.slice(0, 6)}`, 'Utilitario Sprinter 415 (DEMO-AG444RS)',
    );

    const todosVeh = [tractor1, tractor2, tractor3, semi1, semi2, camion, utilitario];

    // ── Vencimientos de documentación ──
    const vencimientosData = [
      { vehiculoId: tractor1.id, tipo: 'VTV', descripcion: 'Verificación Técnica Vehicular', fechaVto: diasAdelante(25), alertaDias: 30 },
      { vehiculoId: tractor1.id, tipo: 'SEGURO', descripcion: 'Póliza todo riesgo — La Caja', fechaVto: diasAdelante(180), alertaDias: 30 },
      { vehiculoId: tractor1.id, tipo: 'RUTA', descripcion: 'Habilitación RUTA nacional', fechaVto: diasAdelante(90), alertaDias: 30 },
      { vehiculoId: tractor2.id, tipo: 'VTV', descripcion: 'Verificación Técnica Vehicular', fechaVto: diasAtras(8), alertaDias: 30 },
      { vehiculoId: tractor2.id, tipo: 'SEGURO', descripcion: 'Póliza todo riesgo — Federación', fechaVto: diasAdelante(5), alertaDias: 30 },
      { vehiculoId: tractor3.id, tipo: 'VTV', descripcion: 'Verificación Técnica Vehicular', fechaVto: diasAdelante(140), alertaDias: 30 },
      { vehiculoId: tractor3.id, tipo: 'HABILITACION', descripcion: 'Habilitación municipal carga general', fechaVto: diasAdelante(12), alertaDias: 30 },
      { vehiculoId: semi1.id, tipo: 'VTV', descripcion: 'VTV semirremolque', fechaVto: diasAdelante(60), alertaDias: 30 },
      { vehiculoId: semi2.id, tipo: 'VTV', descripcion: 'VTV semirremolque', fechaVto: diasAtras(3), alertaDias: 30 },
      { vehiculoId: camion.id, tipo: 'SEGURO', descripcion: 'Póliza — Sancor Seguros', fechaVto: diasAdelante(75), alertaDias: 30 },
      { vehiculoId: camion.id, tipo: 'VTV', descripcion: 'Verificación Técnica Vehicular', fechaVto: diasAdelante(200), alertaDias: 30 },
      { vehiculoId: utilitario.id, tipo: 'SEGURO', descripcion: 'Póliza — Mapfre', fechaVto: diasAdelante(320), alertaDias: 30 },
    ];
    await prisma().vencimientoDocumento.createMany({ data: vencimientosData.map((v) => ({ ...v, tenantId })) });

    // ── Combustible (6 meses de cargas para tractores y camión) ──
    const cargas: any[] = [];
    const vehsCombustible = [
      { v: tractor1, kmBase: 412350, litrosBase: 380 },
      { v: tractor2, kmBase: 688900, litrosBase: 400 },
      { v: tractor3, kmBase: 198400, litrosBase: 360 },
      { v: camion, kmBase: 234100, litrosBase: 180 },
    ];
    for (const { v, litrosBase } of vehsCombustible) {
      let km = (v.currentOdometer || 0) - 6 * 4200;
      for (let m = 6; m >= 0; m--) {
        const cargasMes = 3;
        for (let c = 0; c < cargasMes; c++) {
          km += 1400;
          const litros = Math.round((litrosBase + (Math.random() * 40 - 20)) * 10) / 10;
          const precio = 980 + m * -15;
          cargas.push({
            tenantId, vehiculoId: v.id, fecha: mesesAtras(m, 4 + c * 8),
            litros, precioPorLitro: precio, costoTotal: Math.round(litros * precio),
            odometro: Math.round(km), rendimiento: Math.round((1400 / litros) * 100) / 100,
            estacion: ['YPF Ruta 9 km 62', 'Shell Campana', 'Axion Zárate'][c % 3],
            tipoCombustible: 'DIESEL',
          });
        }
      }
    }
    await prisma().registroCombustible.createMany({ data: cargas });

    // ── Neumáticos + posiciones montadas ──
    const crearNeumatico = (codigo: string, opts: any = {}) =>
      prisma().neumatico.create({
        data: {
          tenantId, codigo, marca: opts.marca || 'Michelin', modelo: opts.modelo || 'X Multi Z',
          medida: opts.medida || '295/80R22.5', condicion: opts.condicion || 'NUEVA',
          funcion: opts.funcion || 'TRACCION', proveedor: 'Neumáticos del Sur',
          fechaCompra: opts.fechaCompra || mesesAtras(4), precioCompra: opts.precio ?? 320000,
          garantiaKm: 120000, status: opts.status || 'EN_USO',
          kmAcumulados: opts.km ?? 0, profBanda: opts.prof ?? 16, profBandaOriginal: 18,
          presionRecomendada: 110, recapsCount: opts.recaps ?? 0,
        },
      });

    const posicionesTractor = [
      { eje: 1, lado: 'IZQ' }, { eje: 1, lado: 'DER' },
      { eje: 2, lado: 'IZQ', posicion: 'EXT' }, { eje: 2, lado: 'IZQ', posicion: 'INT' },
      { eje: 2, lado: 'DER', posicion: 'INT' }, { eje: 2, lado: 'DER', posicion: 'EXT' },
    ];
    const posicionesSemi = [
      { eje: 1, lado: 'IZQ' }, { eje: 1, lado: 'DER' },
      { eje: 2, lado: 'IZQ' }, { eje: 2, lado: 'DER' },
      { eje: 3, lado: 'IZQ' }, { eje: 3, lado: 'DER' },
    ];

    let nroNeu = 1;
    const montar = async (veh: any, posiciones: any[], kmAlMontar: number, desgaste: number) => {
      for (const pos of posiciones) {
        const neu = await crearNeumatico(`NEU-DEMO-${String(nroNeu++).padStart(3, '0')}`, {
          km: desgaste, prof: Math.max(4, 18 - desgaste / 12000), condicion: desgaste > 80000 ? 'USADA' : 'NUEVA',
        });
        await prisma().neumaticoPosicion.create({
          data: {
            tenantId, vehiculoId: veh.id, neumaticoId: neu.id,
            eje: pos.eje, lado: pos.lado, posicion: pos.posicion || 'SIMPLE',
            kmAlMontar, profBandaInicio: 18, activo: true, montadoAt: mesesAtras(3),
          },
        });
      }
    };
    await montar(tractor1, posicionesTractor, 380000, 32350);
    await montar(tractor2, posicionesTractor, 640000, 48900);
    await montar(semi1, posicionesSemi, 320000, 35000);
    // Neumáticos en stock
    await crearNeumatico('NEU-DEMO-STK-1', { status: 'DISPONIBLE', km: 0, prof: 18 });
    await crearNeumatico('NEU-DEMO-STK-2', { status: 'DISPONIBLE', km: 0, prof: 18 });
    await crearNeumatico('NEU-DEMO-STK-3', { status: 'EN_REPARACION', km: 95000, prof: 6, condicion: 'RECAPADA', recaps: 1 });

    // ── Reglas de componentes + aplicaciones ──
    const reglaAceite = await prisma().maintenanceComponentRule.create({
      data: {
        tenantId, nombre: 'Cambio de aceite y filtro', categoria: 'LUBRICACION', tipoActivoAplicable: 'TRACTOR',
        frecuenciaKm: 30000, kmAnticipacion: 3000, criticidad: 'ALTA', duracionEstimada: 3, accionVencimiento: 'SUGERENCIA_OT',
        repuestosRequeridos: { create: [{ sparePartId: repuestos[0].id, cantidad: 1 }, { sparePartId: repuestos[1].id, cantidad: 1 }] },
      },
    });
    const reglaFrenos = await prisma().maintenanceComponentRule.create({
      data: {
        tenantId, nombre: 'Revisión sistema de frenos', categoria: 'FRENOS', tipoActivoAplicable: 'TODOS',
        frecuenciaKm: 60000, kmAnticipacion: 5000, criticidad: 'ALTA', duracionEstimada: 4, accionVencimiento: 'ALERTA',
        repuestosRequeridos: { create: [{ sparePartId: repuestos[3].id, cantidad: 2 }] },
      },
    });
    const reglaFiltroAire = await prisma().maintenanceComponentRule.create({
      data: {
        tenantId, nombre: 'Filtro de aire primario', categoria: 'MOTOR', tipoActivoAplicable: 'TRACTOR',
        frecuenciaKm: 45000, kmAnticipacion: 4000, criticidad: 'MEDIA', duracionEstimada: 1, accionVencimiento: 'ALERTA',
        repuestosRequeridos: { create: [{ sparePartId: repuestos[2].id, cantidad: 1 }] },
      },
    });
    const reglaSemi = await prisma().maintenanceComponentRule.create({
      data: {
        tenantId, nombre: 'Inspección suspensión neumática', categoria: 'SUSPENSION', tipoActivoAplicable: 'SEMI',
        frecuenciaDias: 180, diasAnticipacion: 15, criticidad: 'MEDIA', duracionEstimada: 2, accionVencimiento: 'ALERTA',
      },
    });

    // ── Planes de mantenimiento (sincronizados con las aplicaciones) ──
    const crearPlan = async (data: any) => prisma().maintenancePlan.create({ data: { ...data, tenantId } });

    const planAceiteT1 = await crearPlan({
      code: `PLAN-DEMO-ACEITE-T1-${tenantId.slice(0, 6)}`, title: 'Cambio de aceite y filtro — DEMO-AC123BB',
      type: 'PREVENTIVE', status: 'ACTIVE', assetId: tractor1.maintenanceAssetId,
      frequencyUnit: 'KM', frequencyValue: 30000, triggerKm: 30000, lastOdometerExecution: 382000,
      lastExecutionDate: mesesAtras(2), totalExecutions: 4,
    });
    const planAceiteT2 = await crearPlan({
      code: `PLAN-DEMO-ACEITE-T2-${tenantId.slice(0, 6)}`, title: 'Cambio de aceite y filtro — DEMO-AF456KL',
      type: 'PREVENTIVE', status: 'ACTIVE', assetId: tractor2.maintenanceAssetId,
      frequencyUnit: 'KM', frequencyValue: 30000, triggerKm: 30000, lastOdometerExecution: 660000,
      lastExecutionDate: mesesAtras(3), totalExecutions: 7,
    });
    const planFrenosT2 = await crearPlan({
      code: `PLAN-DEMO-FRENOS-T2-${tenantId.slice(0, 6)}`, title: 'Revisión sistema de frenos — DEMO-AF456KL',
      type: 'PREVENTIVE', status: 'ACTIVE', assetId: tractor2.maintenanceAssetId,
      frequencyUnit: 'KM', frequencyValue: 60000, triggerKm: 60000, lastOdometerExecution: 630000,
      lastExecutionDate: mesesAtras(5), totalExecutions: 3,
    });
    const planSuspSemi1 = await crearPlan({
      code: `PLAN-DEMO-SUSP-S1-${tenantId.slice(0, 6)}`, title: 'Inspección suspensión neumática — DEMO-BBB111',
      type: 'PREVENTIVE', status: 'ACTIVE', assetId: semi1.maintenanceAssetId,
      frequencyUnit: 'DAYS', frequencyValue: 180, nextExecutionDate: diasAdelante(9),
      lastExecutionDate: diasAtras(171), totalExecutions: 2,
    });
    const planGralCamion = await crearPlan({
      code: `PLAN-DEMO-GRAL-C1-${tenantId.slice(0, 6)}`, title: 'Service general 10.000 km — DEMO-AE333PQ',
      type: 'PREVENTIVE', status: 'ACTIVE', assetId: camion.maintenanceAssetId,
      frequencyUnit: 'KM', frequencyValue: 10000, triggerKm: 10000, lastOdometerExecution: 230000,
      lastExecutionDate: mesesAtras(1), totalExecutions: 12,
    });

    // Aplicaciones regla↔activo vinculadas a los planes
    await prisma().maintenanceComponentRuleAsset.createMany({
      data: [
        { ruleId: reglaAceite.id, assetId: tractor1.maintenanceAssetId!, generatedPlanId: planAceiteT1.id, kmBase: 382000, tecnicoSugeridoId: tecnicos[0].id },
        { ruleId: reglaAceite.id, assetId: tractor2.maintenanceAssetId!, generatedPlanId: planAceiteT2.id, kmBase: 660000, tecnicoSugeridoId: tecnicos[0].id },
        { ruleId: reglaAceite.id, assetId: tractor3.maintenanceAssetId!, kmBase: 170000 },
        { ruleId: reglaFrenos.id, assetId: tractor2.maintenanceAssetId!, generatedPlanId: planFrenosT2.id, kmBase: 630000, accionVencimientoOverride: 'GENERAR_OT' },
        { ruleId: reglaFiltroAire.id, assetId: tractor1.maintenanceAssetId!, kmBase: 382000 },
        { ruleId: reglaSemi.id, assetId: semi1.maintenanceAssetId!, generatedPlanId: planSuspSemi1.id, proximaEjecucion: diasAdelante(9) },
        { ruleId: reglaSemi.id, assetId: semi2.maintenanceAssetId!, proximaEjecucion: diasAtras(6) },
      ],
    });

    // ── Órdenes de trabajo ──
    const crearOT = (data: any) => prisma().workOrder.create({ data: { ...data, tenantId } });
    const suf = tenantId.slice(0, 6);

    // Completadas (distribuidas en los últimos 6 meses para TCO/evolución)
    const otsCompletadas = [
      { meses: 0, veh: tractor1, titulo: 'Cambio de aceite y filtro', tipo: 'PREVENTIVE', costo: 145000, plan: planAceiteT1 },
      { meses: 0, veh: camion, titulo: 'Service general 10.000 km', tipo: 'PREVENTIVE', costo: 98000, plan: planGralCamion },
      { meses: 1, veh: tractor3, titulo: 'Reemplazo pastillas de freno eje 2', tipo: 'CORRECTIVE', costo: 210000 },
      { meses: 1, veh: tractor1, titulo: 'Alineación y balanceo', tipo: 'PREVENTIVE', costo: 65000 },
      { meses: 2, veh: tractor2, titulo: 'Cambio de aceite y filtro', tipo: 'PREVENTIVE', costo: 138000, plan: planAceiteT2 },
      { meses: 2, veh: semi1, titulo: 'Reparación lona sider', tipo: 'CORRECTIVE', costo: 87000 },
      { meses: 3, veh: tractor1, titulo: 'Cambio correa poly-V y tensores', tipo: 'CORRECTIVE', costo: 76000 },
      { meses: 3, veh: camion, titulo: 'Service general 10.000 km', tipo: 'PREVENTIVE', costo: 94000, plan: planGralCamion },
      { meses: 4, veh: tractor3, titulo: 'Diagnóstico electrónico motor', tipo: 'PREDICTIVE', costo: 45000 },
      { meses: 4, veh: semi2, titulo: 'Cambio bujes suspensión', tipo: 'CORRECTIVE', costo: 132000 },
      { meses: 5, veh: tractor2, titulo: 'Revisión sistema de frenos', tipo: 'PREVENTIVE', costo: 188000, plan: planFrenosT2 },
      { meses: 5, veh: utilitario, titulo: 'Service 40.000 km', tipo: 'PREVENTIVE', costo: 72000 },
    ];
    let otNro = 1;
    for (const o of otsCompletadas) {
      const fecha = mesesAtras(o.meses, 12);
      await crearOT({
        code: `OT-DEMO-${suf}-${String(otNro++).padStart(3, '0')}`, title: o.titulo, type: o.tipo,
        priority: 'MEDIUM', status: 'COMPLETED', assetId: o.veh.maintenanceAssetId,
        planId: o.plan?.id, origen: o.plan ? 'MANTENIMIENTO' : undefined,
        technicianId: tecnicos[otNro % 3].id,
        scheduledDate: fecha, startedAt: fecha, completedAt: fecha,
        estimatedDuration: 4, actualDuration: 4,
        laborCost: Math.round(o.costo * 0.4), partsCost: Math.round(o.costo * 0.6), totalCost: o.costo,
      });
    }

    // Abiertas: pendientes, en proceso, vencida, origen inspección
    await crearOT({
      code: `OT-DEMO-${suf}-${String(otNro++).padStart(3, '0')}`, title: 'Reparación sistema de frenos EBS',
      type: 'CORRECTIVE', priority: 'CRITICAL', status: 'IN_PROGRESS', assetId: tractor2.maintenanceAssetId,
      technicianId: tecnicos[0].id, scheduledDate: diasAtras(2), startedAt: diasAtras(2),
      estimatedDuration: 8, laborCost: 60000, partsCost: 0, totalCost: 60000,
    });
    await crearOT({
      code: `OT-DEMO-${suf}-${String(otNro++).padStart(3, '0')}`, title: 'Cambio de aceite y filtro',
      type: 'PREVENTIVE', priority: 'HIGH', status: 'PENDING', assetId: tractor2.maintenanceAssetId,
      planId: planAceiteT2.id, origen: 'MANTENIMIENTO', technicianId: tecnicos[0].id,
      scheduledDate: diasAdelante(4), estimatedDuration: 3,
    });
    await crearOT({
      code: `OT-DEMO-${suf}-${String(otNro++).padStart(3, '0')}`, title: 'Inspección suspensión neumática',
      type: 'PREVENTIVE', priority: 'MEDIUM', status: 'PENDING', assetId: semi1.maintenanceAssetId,
      planId: planSuspSemi1.id, origen: 'MANTENIMIENTO', technicianId: tecnicos[2].id,
      scheduledDate: diasAdelante(9), estimatedDuration: 2,
    });
    await crearOT({
      code: `OT-DEMO-${suf}-${String(otNro++).padStart(3, '0')}`, title: 'Revisión luces y chapas (hallazgo QR)',
      type: 'CORRECTIVE', priority: 'MEDIUM', status: 'PENDING', assetId: semi2.maintenanceAssetId,
      origen: 'INSPECCION', technicianId: tecnicos[2].id, scheduledDate: diasAdelante(6), estimatedDuration: 2,
    });
    await crearOT({
      code: `OT-DEMO-${suf}-${String(otNro++).padStart(3, '0')}`, title: 'Cambio filtro de aire primario',
      type: 'PREVENTIVE', priority: 'LOW', status: 'PENDING', assetId: tractor1.maintenanceAssetId,
      origen: 'MANTENIMIENTO', scheduledDate: diasAtras(5), estimatedDuration: 1,
    });
    await crearOT({
      code: `OT-DEMO-${suf}-${String(otNro++).padStart(3, '0')}`, title: 'Verificación tercer eje semi',
      type: 'CORRECTIVE', priority: 'MEDIUM', status: 'ON_HOLD', assetId: semi2.maintenanceAssetId,
      technicianId: tecnicos[1].id, scheduledDate: diasAdelante(12), estimatedDuration: 3,
    });

    // ── Conjuntos operativos ──
    const conjunto1 = await prisma().conjuntoOperativo.create({
      data: { tenantId, tractorId: tractor1.id, semiId: semi1.id, estado: 'ACOPLADO', fechaAcople: diasAtras(14), ubicacion: 'Planta central — Dock 4', notas: 'Conjunto asignado a ruta Buenos Aires–Rosario' },
    });
    await prisma().conjuntoOperativoEvento.createMany({
      data: [
        { tenantId, conjuntoId: conjunto1.id, tipo: 'ACOPLE', fecha: diasAtras(14), ubicacion: 'Planta central — Dock 4' },
      ],
    });
    const conjunto2 = await prisma().conjuntoOperativo.create({
      data: { tenantId, tractorId: tractor3.id, semiId: semi2.id, estado: 'DESACOPLADO', fechaAcople: diasAtras(40), fechaDesacople: diasAtras(10), ubicacion: 'Depósito norte' },
    });
    await prisma().conjuntoOperativoEvento.createMany({
      data: [
        { tenantId, conjuntoId: conjunto2.id, tipo: 'ACOPLE', fecha: diasAtras(40), ubicacion: 'Depósito norte' },
        { tenantId, conjuntoId: conjunto2.id, tipo: 'DESACOPLE', fecha: diasAtras(10), ubicacion: 'Depósito norte', notas: 'Semi derivado a revisión de suspensión' },
      ],
    });

    // ── Inspecciones QR ──
    let plantilla = await prisma().inspeccionPlantilla.findFirst({ where: { tenantId, isActive: true } });
    if (!plantilla) {
      plantilla = await prisma().inspeccionPlantilla.create({
        data: {
          tenantId, nombre: 'Checklist diario vehículo pesado', categoria: 'CAMION', isBuiltIn: false,
          items: {
            create: [
              { label: 'Nivel de aceite y fluidos', tipo: 'SI_NO', orden: 1, seccion: 'Motor', triggerHallazgo: true },
              { label: 'Estado de luces y señalización', tipo: 'SI_NO', orden: 2, seccion: 'Exterior', triggerHallazgo: true },
              { label: 'Presión y estado de neumáticos', tipo: 'SI_NO', orden: 3, seccion: 'Exterior', triggerHallazgo: true },
              { label: 'Frenos de servicio y estacionamiento', tipo: 'SI_NO', orden: 4, seccion: 'Seguridad', triggerHallazgo: true },
              { label: 'Documentación del vehículo al día', tipo: 'SI_NO', orden: 5, seccion: 'Documentación' },
              { label: 'Observaciones generales', tipo: 'TEXTO', orden: 6, seccion: 'General', isRequerido: false },
            ],
          },
        },
        include: { items: true },
      });
    }
    const itemsPlantilla = await prisma().inspeccionItem.findMany({ where: { plantillaId: plantilla.id }, orderBy: { orden: 'asc' } });

    const crearInspeccion = async (veh: any, qr: any, fecha: Date, opts: { hallazgos?: { descripcion: string; severidad: string; itemLabel?: string }[]; inspector: string; km: number }) => {
      const totalItems = itemsPlantilla.length || 6;
      const hallazgosCount = opts.hallazgos?.length || 0;
      const insp = await prisma().inspeccion.create({
        data: {
          tenantId, qrId: qr?.id, inspectorNombre: opts.inspector,
          activoNombre: veh.dominio, activoCodigo: veh.dominio,
          estado: hallazgosCount > 0 ? (opts.hallazgos!.some((h) => h.severidad === 'CRITICO') ? 'CRITICA' : 'CON_HALLAZGOS') : 'COMPLETA',
          puntaje: Math.round(((totalItems - hallazgosCount) / totalItems) * 100),
          hallazgosCount, itemsTotal: totalItems, itemsOk: totalItems - hallazgosCount,
          dominioTractor: veh.tipo === 'TRACTOR' ? veh.dominio : undefined,
          dominioSemi: veh.tipo === 'SEMI' ? veh.dominio : undefined,
          kmReported: opts.km, createdAt: fecha,
        },
      });
      for (const h of opts.hallazgos || []) {
        await prisma().inspeccionHallazgo.create({
          data: {
            tenantId, inspeccionId: insp.id, descripcion: h.descripcion, severidad: h.severidad,
            tipo: 'OPERATIVO', estado: 'ABIERTO', itemLabel: h.itemLabel,
            equipoDestino: veh.tipo === 'SEMI' ? 'SEMI' : 'TRACTOR',
          },
        });
      }
      if (qr) {
        await prisma().inspeccionQR.update({ where: { id: qr.id }, data: { useCount: { increment: 1 }, lastUsedAt: fecha } });
      }
      return insp;
    };

    const qrT1 = await prisma().inspeccionQR.create({
      data: { tenantId, plantillaId: plantilla.id, token: `demo-qr-t1-${suf}`, activoNombre: 'DEMO-AC123BB', activoCodigo: 'DEMO-AC123BB', maintenanceAssetId: tractor1.maintenanceAssetId, titulo: 'Inspección diaria — Tractor Scania' },
    });
    const qrS2 = await prisma().inspeccionQR.create({
      data: { tenantId, plantillaId: plantilla.id, token: `demo-qr-s2-${suf}`, activoNombre: 'DEMO-BCC222', activoCodigo: 'DEMO-BCC222', maintenanceAssetId: semi2.maintenanceAssetId, titulo: 'Inspección diaria — Semi Randon' },
    });

    await crearInspeccion(tractor1, qrT1, diasAtras(1), { inspector: 'Héctor Sosa', km: 412350 });
    await crearInspeccion(tractor1, qrT1, diasAtras(8), { inspector: 'Héctor Sosa', km: 411200, hallazgos: [{ descripcion: 'Luz de giro trasera derecha sin funcionar', severidad: 'LEVE', itemLabel: 'Estado de luces y señalización' }] });
    await crearInspeccion(tractor1, qrT1, diasAtras(15), { inspector: 'Héctor Sosa', km: 409800 });
    await crearInspeccion(semi2, qrS2, diasAtras(3), {
      inspector: 'Adrián Vega', km: 502300,
      hallazgos: [
        { descripcion: 'Chapa patente trasera suelta', severidad: 'MODERADO', itemLabel: 'Estado de luces y señalización' },
        { descripcion: 'Neumático eje 3 izquierdo con desgaste irregular', severidad: 'CRITICO', itemLabel: 'Presión y estado de neumáticos' },
      ],
    });
    await crearInspeccion(tractor3, null, diasAtras(5), { inspector: 'Pablo Duarte', km: 198400 });
    await crearInspeccion(camion, null, diasAtras(11), { inspector: 'Lucía Pereyra', km: 234100, hallazgos: [{ descripcion: 'Nivel de líquido de frenos bajo', severidad: 'MODERADO', itemLabel: 'Nivel de aceite y fluidos' }] });

    // ── Movimientos de stock ──
    await prisma().maintenanceSparePartMovement.createMany({
      data: [
        { tenantId, sparePartId: repuestos[0].id, delta: 10, motivo: 'Compra mensual lubricantes', createdAt: diasAtras(20) },
        { tenantId, sparePartId: repuestos[0].id, delta: -2, motivo: 'Uso en service tractor Scania', createdAt: diasAtras(9) },
        { tenantId, sparePartId: repuestos[3].id, delta: -2, motivo: 'Uso en OT frenos Actros', createdAt: diasAtras(30) },
        { tenantId, sparePartId: repuestos[4].id, delta: -1, motivo: 'Rotura en montaje — descarte', createdAt: diasAtras(15) },
      ],
    });

    return reply.send({
      ok: true,
      yaExistia: false,
      resumen: {
        vehiculos: todosVeh.length,
        conductores: conductores.length,
        tecnicos: tecnicos.length,
        repuestos: repuestos.length,
        vencimientos: vencimientosData.length,
        cargasCombustible: cargas.length,
        reglas: 4,
        planes: 5,
        ordenes: otNro - 1,
        conjuntos: 2,
        inspecciones: 6,
      },
    });
  });

  // ─────────────────────────────────────────────────────────────
  // MANTENIMIENTO PREDICTIVO — solo lectura, agrega datos existentes.
  //  • Cubiertas: regresión lineal profBanda vs kmAlMedir → km restantes al límite.
  //  • Combustible: rendimiento reciente (últimas 3 cargas) vs histórico → desvío.
  //  • Huella de carbono: litros × factor de emisión por tipo de combustible.
  // ─────────────────────────────────────────────────────────────
  app.get('/predictivo', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const PROF_LIMITE_MM = 2;      // mínimo recomendado carga pesada (legal AR ~1.6)
    const UMBRAL_DESVIO_PCT = -15; // consume 15% más que su media → alerta

    const vehiculos = await prisma().vehiculo.findMany({
      where: { tenantId },
      select: { id: true, dominio: true, marca: true, modelo: true, currentOdometer: true },
    });
    const vehMap = new Map(vehiculos.map((v: any) => [v.id, v]));
    const vehLabel = (v: any) => (v ? `${v.dominio}${v.marca ? ' · ' + v.marca : ''}` : '—');

    // ── Cubiertas ──
    const neumaticos = await prisma().neumatico.findMany({
      where: { tenantId, status: 'EN_USO' },
      select: {
        id: true, codigo: true, marca: true, medida: true,
        mediciones: { orderBy: { fecha: 'asc' }, select: { profBanda: true, kmAlMedir: true, fecha: true, vehiculoId: true } },
        posiciones: { where: { activo: true }, select: { vehiculoId: true, eje: true, lado: true, posicion: true }, take: 1 },
      },
    });

    const cubiertas: any[] = [];
    for (const n of neumaticos) {
      const meds = n.mediciones.filter((m: any) => m.kmAlMedir != null && m.profBanda != null);
      if (meds.length < 2) continue;
      const xs = meds.map((m: any) => m.kmAlMedir);
      const ys = meds.map((m: any) => m.profBanda);
      const len = xs.length;
      const mx = xs.reduce((a: number, b: number) => a + b, 0) / len;
      const my = ys.reduce((a: number, b: number) => a + b, 0) / len;
      let sxy = 0, sxx = 0;
      for (let i = 0; i < len; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
      const slope = sxx > 0 ? sxy / sxx : 0; // mm por km (negativo = desgaste)
      if (slope >= 0) continue; // sin desgaste medible
      const ultima = meds[len - 1];
      const kmRestantes = (ultima.profBanda - PROF_LIMITE_MM) / -slope;
      const diasSpan = (new Date(ultima.fecha).getTime() - new Date(meds[0].fecha).getTime()) / 86400000;
      const kmPorDia = diasSpan > 0 ? (ultima.kmAlMedir - meds[0].kmAlMedir) / diasSpan : 0;
      const fechaEstimada = kmPorDia > 0 && kmRestantes > 0
        ? new Date(Date.now() + (kmRestantes / kmPorDia) * 86400000)
        : null;
      const pos = n.posiciones[0];
      const veh = vehMap.get(pos?.vehiculoId || ultima.vehiculoId);
      cubiertas.push({
        neumaticoId: n.id,
        codigo: n.codigo,
        marca: n.marca,
        medida: n.medida,
        vehiculo: vehLabel(veh),
        posicion: pos ? `Eje ${pos.eje} ${pos.lado}` : '—',
        profActual: +ultima.profBanda.toFixed(1),
        desgasteMmPor1000Km: +(-slope * 1000).toFixed(2),
        kmRestantes: Math.max(0, Math.round(kmRestantes)),
        fechaEstimada,
        estado: ultima.profBanda <= PROF_LIMITE_MM ? 'VENCIDA'
          : kmRestantes < 3000 ? 'CRITICO'
          : kmRestantes < 10000 ? 'PROXIMO' : 'OK',
      });
    }
    cubiertas.sort((a, b) => a.kmRestantes - b.kmRestantes);

    // ── Combustible: desvío de rendimiento ──
    const cargasRend = await prisma().registroCombustible.findMany({
      where: { tenantId, rendimiento: { not: null } },
      orderBy: { fecha: 'asc' },
      select: { vehiculoId: true, rendimiento: true },
    });
    const rendPorVeh = new Map<string, number[]>();
    for (const c of cargasRend) {
      if (!rendPorVeh.has(c.vehiculoId)) rendPorVeh.set(c.vehiculoId, []);
      rendPorVeh.get(c.vehiculoId)!.push(c.rendimiento);
    }
    const combustible: any[] = [];
    for (const [vehiculoId, lista] of rendPorVeh) {
      if (lista.length < 4) continue;
      const recientes = lista.slice(-3);
      const historicas = lista.slice(0, -3);
      const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      const rendHistorico = avg(historicas);
      const rendReciente = avg(recientes);
      const desvioPct = ((rendReciente - rendHistorico) / rendHistorico) * 100;
      combustible.push({
        vehiculoId,
        vehiculo: vehLabel(vehMap.get(vehiculoId)),
        rendHistorico: +rendHistorico.toFixed(2),
        rendReciente: +rendReciente.toFixed(2),
        desvioPct: +desvioPct.toFixed(1),
        alerta: desvioPct <= UMBRAL_DESVIO_PCT,
        cargasAnalizadas: lista.length,
      });
    }
    combustible.sort((a, b) => a.desvioPct - b.desvioPct);

    // ── Huella de carbono: litros × factor de emisión ──
    const FACTORES_CO2: Record<string, number> = { DIESEL: 2.68, NAFTA: 2.31, GNC: 1.90, ELECTRICO: 0 };
    const cargasLitros = await prisma().registroCombustible.findMany({
      where: { tenantId, litros: { not: null } },
      select: { vehiculoId: true, litros: true, tipoCombustible: true, fecha: true },
    });
    const hace12m = new Date(); hace12m.setMonth(hace12m.getMonth() - 12);
    let co2Total = 0, litrosTotal = 0;
    const porVeh = new Map<string, { litros: number; co2: number }>();
    for (const c of cargasLitros) {
      const factor = FACTORES_CO2[c.tipoCombustible] ?? FACTORES_CO2.DIESEL;
      const co2 = c.litros * factor;
      co2Total += co2; litrosTotal += c.litros;
      if (new Date(c.fecha) >= hace12m) {
        const cur = porVeh.get(c.vehiculoId) || { litros: 0, co2: 0 };
        cur.litros += c.litros; cur.co2 += co2;
        porVeh.set(c.vehiculoId, cur);
      }
    }
    const huellaCarbono = {
      litrosTotal: Math.round(litrosTotal),
      co2TotalKg: Math.round(co2Total),
      co2TotalTn: +(co2Total / 1000).toFixed(1),
      ultimos12Meses: [...porVeh.entries()]
        .map(([vehiculoId, d]) => ({
          vehiculoId,
          vehiculo: vehLabel(vehMap.get(vehiculoId)),
          litros: Math.round(d.litros),
          co2Kg: Math.round(d.co2),
        }))
        .sort((a, b) => b.co2Kg - a.co2Kg),
    };

    return reply.send({
      cubiertas,
      combustible,
      huellaCarbono,
      parametros: { profLimiteMm: PROF_LIMITE_MM, umbralDesvioPct: UMBRAL_DESVIO_PCT },
    });
  });

  // ─────────────────────────────────────────────────────────────
  // LIBRO DE JORNADA DIGITAL — export formal para inspección CNRT.
  // Empareja INICIO_SERVICIO→FIN_SERVICIO por chofer y devuelve la
  // jornada diaria: horas trabajadas, descanso previo, recorrido.
  //   ?conductorId=&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&formato=json|csv
  // ─────────────────────────────────────────────────────────────
  app.get('/libro-jornada', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { conductorId, desde, hasta, formato } = req.query as any;

    const where: any = { tenantId, tipo: { in: ['INICIO_SERVICIO', 'FIN_SERVICIO'] } };
    if (conductorId) where.conductorId = conductorId;
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(desde);
      if (hasta) { const h = new Date(hasta); h.setHours(23, 59, 59, 999); where.createdAt.lte = h; }
    }

    const [regs, conductores, vehiculos] = await Promise.all([
      prisma().servicioRegistro.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        select: {
          tipo: true, createdAt: true, horasTrabajadas: true, horasDescanso: true,
          descansoInsuficiente: true, jornadaExcesiva: true, origen: true, destino: true,
          conductorId: true, reportadoPorNombre: true, vehiculoId: true,
        },
      }),
      prisma().conductor.findMany({ where: { tenantId }, select: { id: true, nombre: true } }),
      prisma().vehiculo.findMany({ where: { tenantId }, select: { id: true, dominio: true } }),
    ]);
    const condMap = new Map(conductores.map((c: any) => [c.id, c.nombre]));
    const vehMap = new Map(vehiculos.map((v: any) => [v.id, v.dominio]));

    // Emparejar INICIO→FIN por chofer (clave: conductorId o nombre reportado)
    const filas: any[] = [];
    const abiertos = new Map<string, any>();
    const pushFila = (ini: any, fin: any | null) => filas.push({
      fecha: ini.createdAt,
      chofer: condMap.get(ini.conductorId) || ini.reportadoPorNombre,
      vehiculo: vehMap.get((fin || ini).vehiculoId) || '—',
      inicio: ini.createdAt,
      fin: fin ? fin.createdAt : null,
      horasJornada: fin ? fin.horasTrabajadas : null,
      descansoPrevio: ini.horasDescanso,
      origen: ini.origen,
      destino: ini.destino,
      descansoInsuficiente: ini.descansoInsuficiente,
      jornadaExcesiva: fin ? fin.jornadaExcesiva : false,
    });
    for (const r of regs) {
      const key = r.conductorId || r.reportadoPorNombre;
      if (r.tipo === 'INICIO_SERVICIO') { abiertos.set(key, r); continue; }
      const ini = abiertos.get(key);
      if (!ini) continue;
      abiertos.delete(key);
      pushFila(ini, r);
    }
    for (const ini of abiertos.values()) pushFila(ini, null); // servicios en curso
    filas.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    if (formato === 'csv') {
      const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = 'Fecha;Chofer;Vehiculo;Inicio;Fin;Horas jornada;Descanso previo (h);Origen;Destino;Descanso <12h;Jornada >12h';
      const lines = filas.map(f => [
        new Date(f.fecha).toLocaleDateString('es-AR'),
        f.chofer, f.vehiculo,
        new Date(f.inicio).toLocaleString('es-AR'),
        f.fin ? new Date(f.fin).toLocaleString('es-AR') : 'EN CURSO',
        f.horasJornada ?? '', f.descansoPrevio ?? '',
        f.origen || '', f.destino || '',
        f.descansoInsuficiente ? 'SI' : 'NO',
        f.jornadaExcesiva ? 'SI' : 'NO',
      ].map(esc).join(';'));
      const csv = '﻿' + [header, ...lines].join('\n');
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="libro-jornada.csv"')
        .send(csv);
    }

    return reply.send({ filas });
  });

  // ─────────────────────────────────────────────────────────────
  // KPIs DE FLOTA — indicadores derivados de datos existentes.
  //  • CPK (costo por km) por vehículo: combustible + mantenimiento
  //    + facturas + multas, sobre km recorridos (odómetro).
  //  • Preventivo vs correctivo (VehiculoHistorialMantenimiento.tipo).
  //  • Utilización: km/día, disponibilidad, edad/odómetro de flota.
  //  • Combustible: L/100km, costo/km, outliers puntuales (posible robo).
  //  • Cubiertas: costo por km (precioCompra + recaps / kmAcumulados).
  //  • Seguridad: incidentes/100k km, multas por chofer, controles no aptos.
  //  • Ambiental: g CO₂/km por vehículo.
  // ─────────────────────────────────────────────────────────────
  app.get('/kpis', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const [
      vehiculos, cargas, servicios, historial, facturas, multas,
      incidentes, controles, neumaticos, conductores,
    ] = await Promise.all([
      prisma().vehiculo.findMany({
        where: { tenantId },
        select: { id: true, dominio: true, tipo: true, marca: true, modelo: true, anio: true, currentOdometer: true, status: true },
      }),
      prisma().registroCombustible.findMany({
        where: { tenantId },
        orderBy: { fecha: 'asc' },
        select: { vehiculoId: true, litros: true, costoTotal: true, odometro: true, rendimiento: true, tipoCombustible: true, fecha: true },
      }),
      prisma().servicioRegistro.findMany({
        where: { tenantId, odometro: { not: null } },
        select: { vehiculoId: true, odometro: true, createdAt: true },
      }),
      prisma().vehiculoHistorialMantenimiento.findMany({
        where: { tenantId },
        select: { vehiculoId: true, tipo: true, costo: true, odometro: true, fecha: true },
      }),
      prisma().flotaFactura.findMany({
        where: { tenantId },
        select: { vehiculoId: true, total: true, categoria: true },
      }),
      prisma().flotaMulta.findMany({
        where: { tenantId, estado: { not: 'ANULADA' } },
        select: { vehiculoId: true, conductorId: true, monto: true, fecha: true },
      }),
      prisma().flotaIncidente.findMany({
        where: { tenantId },
        select: { vehiculoId: true, tipo: true, gravedad: true, createdAt: true },
      }),
      prisma().flotaControlPreServicio.findMany({
        where: { tenantId },
        select: { alcoholemia: true, nivelFatiga: true, apto: true },
      }),
      prisma().neumatico.findMany({
        where: { tenantId },
        select: { id: true, codigo: true, marca: true, precioCompra: true, kmAcumulados: true, status: true, recaps: { select: { costo: true } } },
      }),
      prisma().conductor.findMany({ where: { tenantId }, select: { id: true, nombre: true } }),
    ]);

    const vehMap = new Map(vehiculos.map((v: any) => [v.id, v]));
    const condMap = new Map(conductores.map((c: any) => [c.id, c.nombre]));
    const vehLabel = (v: any) => (v ? `${v.dominio}${v.marca ? ' · ' + v.marca : ''}` : '—');

    // ── Km recorridos por vehículo: rango de odómetro entre todas las fuentes ──
    const odoPorVeh = new Map<string, { min: number; max: number; minFecha: number; maxFecha: number }>();
    const addOdo = (vehiculoId: string, odo: number | null, fecha: Date | string) => {
      if (odo == null || odo <= 0) return;
      const t = new Date(fecha).getTime();
      const cur = odoPorVeh.get(vehiculoId) || { min: odo, max: odo, minFecha: t, maxFecha: t };
      if (odo < cur.min) { cur.min = odo; cur.minFecha = t; }
      if (odo > cur.max) { cur.max = odo; cur.maxFecha = t; }
      odoPorVeh.set(vehiculoId, cur);
    };
    for (const c of cargas) addOdo(c.vehiculoId, c.odometro, c.fecha);
    for (const s of servicios) addOdo(s.vehiculoId, s.odometro, s.createdAt);
    for (const h of historial) addOdo(h.vehiculoId, h.odometro, h.fecha);
    const kmDe = (vehiculoId: string) => {
      const o = odoPorVeh.get(vehiculoId);
      return o ? Math.max(0, o.max - o.min) : 0;
    };

    // ── Costos por vehículo → CPK ──
    const costosPorVeh = new Map<string, { combustible: number; mantenimiento: number; facturas: number; multas: number }>();
    const acc = (id: string, k: 'combustible' | 'mantenimiento' | 'facturas' | 'multas', v: number) => {
      const cur = costosPorVeh.get(id) || { combustible: 0, mantenimiento: 0, facturas: 0, multas: 0 };
      cur[k] += v; costosPorVeh.set(id, cur);
    };
    for (const c of cargas) if (c.costoTotal) acc(c.vehiculoId, 'combustible', c.costoTotal);
    for (const h of historial) acc(h.vehiculoId, 'mantenimiento', h.costo || 0);
    for (const f of facturas) if (f.vehiculoId) acc(f.vehiculoId, 'facturas', f.total || 0);
    for (const m of multas) acc(m.vehiculoId, 'multas', m.monto || 0);

    const costos = vehiculos
      .map((v: any) => {
        const c = costosPorVeh.get(v.id) || { combustible: 0, mantenimiento: 0, facturas: 0, multas: 0 };
        const km = kmDe(v.id);
        const costoTotal = c.combustible + c.mantenimiento + c.facturas + c.multas;
        return {
          vehiculoId: v.id, vehiculo: vehLabel(v), kmRecorridos: Math.round(km),
          costoCombustible: Math.round(c.combustible), costoMantenimiento: Math.round(c.mantenimiento),
          costoFacturas: Math.round(c.facturas), costoMultas: Math.round(c.multas),
          costoTotal: Math.round(costoTotal),
          cpk: km > 0 ? +(costoTotal / km).toFixed(2) : null,
        };
      })
      .filter((c: any) => c.kmRecorridos > 0 || c.costoTotal > 0)
      .sort((a: any, b: any) => (b.cpk ?? 0) - (a.cpk ?? 0));

    // ── Preventivo vs correctivo ──
    let costoPreventivo = 0, costoCorrectivo = 0;
    for (const h of historial) {
      if (h.tipo === 'PREVENTIVE' || h.tipo === 'PREDICTIVE') costoPreventivo += h.costo || 0;
      else costoCorrectivo += h.costo || 0;
    }
    const costoMantTotal = costoPreventivo + costoCorrectivo;
    const mantenimiento = {
      costoPreventivo: Math.round(costoPreventivo),
      costoCorrectivo: Math.round(costoCorrectivo),
      preventivoPct: costoMantTotal > 0 ? +((costoPreventivo / costoMantTotal) * 100).toFixed(1) : null,
      correctivoPct: costoMantTotal > 0 ? +((costoCorrectivo / costoMantTotal) * 100).toFixed(1) : null,
    };

    // ── Utilización: km/día + snapshot de flota ──
    const utilizacion = vehiculos.map((v: any) => {
      const o = odoPorVeh.get(v.id);
      const dias = o ? Math.max(1, (o.maxFecha - o.minFecha) / 86400000) : 0;
      return {
        vehiculoId: v.id, vehiculo: vehLabel(v), status: v.status,
        kmPorDia: o && dias > 0 ? +((o.max - o.min) / dias).toFixed(1) : null,
      };
    }).filter((u: any) => u.kmPorDia != null).sort((a: any, b: any) => a.kmPorDia - b.kmPorDia);

    const anioActual = new Date().getFullYear();
    const conAnio = vehiculos.filter((v: any) => v.anio);
    const flota = {
      totalVehiculos: vehiculos.length,
      activos: vehiculos.filter((v: any) => v.status === 'ACTIVO').length,
      enTaller: vehiculos.filter((v: any) => v.status === 'EN_TALLER').length,
      disponibilidadPct: vehiculos.length > 0
        ? +((vehiculos.filter((v: any) => v.status !== 'EN_TALLER').length / vehiculos.length) * 100).toFixed(1) : null,
      edadPromedioAnios: conAnio.length > 0
        ? +(conAnio.reduce((a: number, v: any) => a + (anioActual - v.anio), 0) / conAnio.length).toFixed(1) : null,
      odometroPromedio: vehiculos.length > 0
        ? Math.round(vehiculos.reduce((a: number, v: any) => a + (v.currentOdometer || 0), 0) / vehiculos.length) : null,
    };

    // ── Combustible: L/100km, costo/km, ranking por modelo, outliers ──
    const FACTORES_CO2: Record<string, number> = { DIESEL: 2.68, NAFTA: 2.31, GNC: 1.90, ELECTRICO: 0 };
    const cargasPorVeh = new Map<string, any[]>();
    for (const c of cargas) {
      if (!cargasPorVeh.has(c.vehiculoId)) cargasPorVeh.set(c.vehiculoId, []);
      cargasPorVeh.get(c.vehiculoId)!.push(c);
    }
    const combustible: any[] = [];
    const outliers: any[] = [];
    const co2PorKm: any[] = [];
    for (const [vehiculoId, lista] of cargasPorVeh) {
      const v: any = vehMap.get(vehiculoId);
      const conRend = lista.filter(c => c.rendimiento != null && c.rendimiento > 0);
      const litros = lista.reduce((a, c) => a + (c.litros || 0), 0);
      const gasto = lista.reduce((a, c) => a + (c.costoTotal || 0), 0);
      const km = kmDe(vehiculoId);
      const rendProm = conRend.length > 0 ? conRend.reduce((a, c) => a + c.rendimiento, 0) / conRend.length : null;
      if (rendProm) {
        combustible.push({
          vehiculoId, vehiculo: vehLabel(v),
          modelo: v ? `${v.marca || ''} ${v.modelo || ''}`.trim() : '—',
          l100km: +(100 / rendProm).toFixed(1),
          costoPorKm: km > 0 ? +(gasto / km).toFixed(2) : null,
          cargas: lista.length,
        });
        // Outlier puntual: una carga con rendimiento <70% de la media del vehículo
        for (const c of conRend) {
          if (c.rendimiento < rendProm * 0.7) {
            outliers.push({
              vehiculoId, vehiculo: vehLabel(v), fecha: c.fecha,
              rendimiento: +c.rendimiento.toFixed(2), mediaVehiculo: +rendProm.toFixed(2),
              desvioPct: +(((c.rendimiento - rendProm) / rendProm) * 100).toFixed(1),
            });
          }
        }
      }
      if (km > 0 && litros > 0) {
        const co2 = lista.reduce((a, c) => a + (c.litros || 0) * (FACTORES_CO2[c.tipoCombustible] ?? FACTORES_CO2.DIESEL), 0);
        co2PorKm.push({ vehiculoId, vehiculo: vehLabel(v), gCo2PorKm: Math.round((co2 * 1000) / km) });
      }
    }
    // Ranking dentro del mismo modelo (menor L/100km = mejor)
    const porModelo = new Map<string, any[]>();
    for (const c of combustible) {
      if (!porModelo.has(c.modelo)) porModelo.set(c.modelo, []);
      porModelo.get(c.modelo)!.push(c);
    }
    for (const grupo of porModelo.values()) {
      grupo.sort((a, b) => a.l100km - b.l100km);
      grupo.forEach((c, i) => { c.rankingModelo = i + 1; c.grupoModelo = grupo.length; });
    }
    combustible.sort((a, b) => b.l100km - a.l100km);
    outliers.sort((a, b) => a.desvioPct - b.desvioPct);
    co2PorKm.sort((a, b) => b.gCo2PorKm - a.gCo2PorKm);

    // ── Cubiertas: costo por km ──
    const cubiertas = neumaticos
      .map((n: any) => {
        const costoRecaps = n.recaps.reduce((a: number, r: any) => a + (r.costo || 0), 0);
        const costoTotal = (n.precioCompra || 0) + costoRecaps;
        return {
          neumaticoId: n.id, codigo: n.codigo, marca: n.marca, status: n.status,
          kmAcumulados: Math.round(n.kmAcumulados || 0), recaps: n.recaps.length,
          costoTotal: Math.round(costoTotal),
          costoPorKm: n.kmAcumulados > 0 && costoTotal > 0 ? +(costoTotal / n.kmAcumulados).toFixed(2) : null,
        };
      })
      .filter((c: any) => c.costoPorKm != null)
      .sort((a: any, b: any) => a.costoPorKm - b.costoPorKm);

    // ── Seguridad ──
    const incPorVeh = new Map<string, number>();
    for (const i of incidentes) incPorVeh.set(i.vehiculoId, (incPorVeh.get(i.vehiculoId) || 0) + 1);
    const incidentesPor100k = [...incPorVeh.entries()]
      .map(([vehiculoId, cant]) => {
        const km = kmDe(vehiculoId);
        return {
          vehiculoId, vehiculo: vehLabel(vehMap.get(vehiculoId)),
          incidentes: cant, kmRecorridos: Math.round(km),
          tasaPor100kKm: km > 0 ? +((cant / km) * 100000).toFixed(1) : null,
        };
      })
      .sort((a, b) => (b.tasaPor100kKm ?? 0) - (a.tasaPor100kKm ?? 0));

    const hace12m = new Date(); hace12m.setMonth(hace12m.getMonth() - 12);
    const multaPorChofer = new Map<string, { cant: number; monto: number }>();
    for (const m of multas) {
      if (!m.conductorId || new Date(m.fecha) < hace12m) continue;
      const cur = multaPorChofer.get(m.conductorId) || { cant: 0, monto: 0 };
      cur.cant += 1; cur.monto += m.monto || 0;
      multaPorChofer.set(m.conductorId, cur);
    }
    const multasPorChofer = [...multaPorChofer.entries()]
      .map(([conductorId, d]) => ({
        conductorId, chofer: condMap.get(conductorId) || '—',
        cantidad: d.cant, montoTotal: Math.round(d.monto),
      }))
      .sort((a, b) => b.cantidad - a.cantidad);

    const controlesResumen = {
      total: controles.length,
      noAptos: controles.filter((c: any) => !c.apto).length,
      pctNoApto: controles.length > 0 ? +((controles.filter((c: any) => !c.apto).length / controles.length) * 100).toFixed(1) : null,
      fatigaAlta: controles.filter((c: any) => c.nivelFatiga != null && c.nivelFatiga >= 7).length,
      alcoholemiaPositiva: controles.filter((c: any) => c.alcoholemia != null && c.alcoholemia > 0).length,
    };

    return reply.send({
      flota, costos, mantenimiento, utilizacion, combustible,
      outliersCombustible: outliers, cubiertas,
      seguridad: { incidentesPor100k, multasPorChofer, controles: controlesResumen },
      co2PorKm,
    });
  });
}
