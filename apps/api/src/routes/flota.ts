import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';

export default async function flotaRoutes(app: FastifyInstance) {

  // ═══════════════════════════════════════════════════════════════
  // VEHÍCULOS
  // ═══════════════════════════════════════════════════════════════

  // POST /vehiculos/:id/eliminar - PRIMERO (antes de cualquier /vehiculos/:id)
  app.post('/vehiculos/:id/eliminar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;

    const vehiculo = await (app.prisma as any).vehiculo.findFirst({
      where: { id, tenantId },
      include: { posicionesNeumatico: true, registrosCombustible: { take: 1 }, vencimientos: { take: 1 } }
    });

    if (!vehiculo) return reply.code(404).send({ error: 'Vehículo no encontrado' });

    // Verificar si tiene neumáticos montados
    const tieneNeumaticosMontados = vehiculo.posicionesNeumatico?.some((p: any) => p.activo);
    if (tieneNeumaticosMontados) {
      return reply.code(400).send({ error: 'Tiene neumáticos montados. Desmontelos primero.' });
    }

    // Eliminar datos relacionados
    await (app.prisma as any).neumaticoPosicion.updateMany({ where: { vehiculoId: id, tenantId }, data: { vehiculoId: null } });
    await (app.prisma as any).vencimientoDocumento.deleteMany({ where: { vehiculoId: id, tenantId } });
    await (app.prisma as any).vehiculoHistorialMantenimiento.deleteMany({ where: { vehiculoId: id, tenantId } });
    await (app.prisma as any).garantiaVehiculo.deleteMany({ where: { vehiculoId: id, tenantId } });

    // Eliminar activo de mantenimiento si está vacío
    if (vehiculo.maintenanceAssetId) {
      const assetData = await (app.prisma as any).maintenanceAsset.findFirst({
        where: { id: vehiculo.maintenanceAssetId, tenantId },
        include: { workOrders: { take: 1 }, costs: { take: 1 } }
      });
      if (!assetData?.workOrders?.length && !assetData?.costs?.length) {
        await (app.prisma as any).assetDigitalTwin.deleteMany({ where: { assetId: vehiculo.maintenanceAssetId, tenantId } });
        await (app.prisma as any).maintenanceAsset.deleteMany({ where: { id: vehiculo.maintenanceAssetId, tenantId } });
      }
    }

    // Eliminar vehículo físicamente
    await (app.prisma as any).vehiculo.deleteMany({ where: { id, tenantId } });

    return reply.send({ ok: true, mensaje: 'Vehículo eliminado permanentemente' });
  });

  app.get('/vehiculos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const vehiculos = await (app.prisma as any).vehiculo.findMany({
      where: { tenantId },
      include: {
        conductor: { select: { id: true, nombre: true, categoria: true } },
        vencimientos: { orderBy: { fechaVto: 'asc' } },
        posicionesNeumatico: { where: { activo: true }, include: { neumatico: true }, orderBy: [{ eje: 'asc' }, { lado: 'asc' }] },
        _count: { select: { registrosCombustible: true } },
      },
      orderBy: { dominio: 'asc' },
    });
    return reply.send({ vehiculos });
  });

  // GET vehículo completo con datos unificados de mantenimiento
  app.get('/vehiculos/:id/completo', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;

    const vehiculo = await (app.prisma as any).vehiculo.findFirst({
      where: { id, tenantId },
      include: {
        conductor: true,
        vencimientos: { orderBy: { fechaVto: 'asc' } },
        posicionesNeumatico: { where: { activo: true }, include: { neumatico: true } },
        historialMantenimiento: { orderBy: { fecha: 'desc' }, take: 10 },
        garantias: { where: { status: 'ACTIVA' } },
        _count: { select: { registrosCombustible: true } },
      }
    });

    if (!vehiculo) return reply.code(404).send({ error: 'Vehículo no encontrado' });

    // Datos del activo de mantenimiento vinculado
    let maintenanceAsset = null;
    let digitalTwin = null;
    let workOrders = [];
    let maintenancePlans = [];
    let predictions = [];

    if (vehiculo.maintenanceAssetId) {
      maintenanceAsset = await (app.prisma as any).maintenanceAsset.findFirst({
        where: { id: vehiculo.maintenanceAssetId, tenantId },
        select: {
          id: true, code: true, name: true, status: true,
          totalMaintenanceCost: true, lastMaintenanceDate: true, nextMaintenanceDate: true,
          currentOdometer: true,
        }
      });

      if (maintenanceAsset) {
        digitalTwin = await (app.prisma as any).assetDigitalTwin.findUnique({
          where: { assetId_tenantId: { assetId: maintenanceAsset.id, tenantId } },
          include: {
            predictions: {
              where: { validadoAt: null, workOrderId: null },
              orderBy: { probabilidad: 'desc' },
              take: 5,
            }
          }
        });

        workOrders = await (app.prisma as any).workOrder.findMany({
          where: { assetId: maintenanceAsset.id, tenantId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true, code: true, title: true, status: true, priority: true,
            type: true, scheduledDate: true, completedDate: true, totalCost: true,
          }
        });

        maintenancePlans = await (app.prisma as any).maintenancePlan.findMany({
          where: { assetId: maintenanceAsset.id, tenantId, status: 'ACTIVE' },
          select: {
            id: true, title: true, frequencyUnit: true, frequencyValue: true,
            triggerKm: true, nextExecutionDate: true, lastExecutionDate: true,
          }
        });

        predictions = digitalTwin?.predictions || [];
      }
    }

    // KPIs calculados
    const otsPendientes = workOrders.filter((ot: any) => ['PENDING', 'IN_PROGRESS'].includes(ot.status)).length;
    const otsCompletadas = workOrders.filter((ot: any) => ot.status === 'COMPLETED').length;
    const costoTotalMantenimiento = workOrders.reduce((sum: number, ot: any) => sum + (ot.totalCost || 0), 0);
    const planesPorKm = maintenancePlans.filter((p: any) => p.frequencyUnit === 'KM');
    const planesPorTiempo = maintenancePlans.filter((p: any) => ['DAYS', 'WEEKS', 'MONTHS'].includes(p.frequencyUnit));

    return reply.send({
      vehiculo,
      mantenimiento: {
        asset: maintenanceAsset,
        digitalTwin,
        workOrders,
        maintenancePlans,
        predictions,
        kpis: {
          otsPendientes,
          otsCompletadas,
          otsTotal: workOrders.length,
          costoTotalMantenimiento,
          planesActivos: maintenancePlans.length,
          planesPorKm: planesPorKm.length,
          planesPorTiempo: planesPorTiempo.length,
          prediccionesActivas: predictions.length,
          ultimaFechaMantenimiento: maintenanceAsset?.lastMaintenanceDate,
          proximaFechaMantenimiento: maintenanceAsset?.nextMaintenanceDate,
        }
      },
      alertas: {
        vencimientosProximos: vehiculo.vencimientos?.filter((v: any) => {
          const dias = Math.ceil((new Date(v.fechaVto).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return dias <= 30 && dias >= 0;
        }).length || 0,
        prediccionesCriticas: predictions.filter((p: any) => p.severidad === 'CRITICA').length,
        prediccionesAltas: predictions.filter((p: any) => p.severidad === 'ALTA').length,
        otsVencidas: workOrders.filter((ot: any) => ot.status === 'PENDING' && ot.scheduledDate && new Date(ot.scheduledDate) < new Date()).length,
      }
    });
  });

  app.post('/vehiculos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      dominio: z.string().min(1).max(20).transform(v => v.toUpperCase()),
      tipo: z.string().default('CAMION'),
      marca: z.string().optional(),
      modelo: z.string().optional(),
      anio: z.number().int().optional(),
      color: z.string().optional(),
      chasis: z.string().optional(),
      motor: z.string().optional(),
      status: z.string().optional().default('ACTIVO'),
      currentOdometer: z.number().optional(),
      conductorId: z.string().uuid().optional().nullable(),
      maintenanceAssetId: z.string().uuid().optional().nullable(),
      notas: z.string().optional(),
      // Campos adicionales para crear el activo de mantenimiento automáticamente
      crearActivoMantenimiento: z.boolean().default(true),
      acquisitionCost: z.number().optional(),
      manufacturer: z.string().optional(),
      purchaseDate: z.string().datetime().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const { crearActivoMantenimiento, acquisitionCost, manufacturer, purchaseDate, ...vehiculoData } = body.data;

    // Crear vehículo inicialmente sin maintenanceAssetId
    let vehiculo = await (app.prisma as any).vehiculo.create({
      data: { ...vehiculoData, tenantId, maintenanceAssetId: null }
    });

    // ═══════════════════════════════════════════════════════════════
    // AUTO-CREAR ACTIVO DE MANTENIMIENTO VINCULADO
    // ═══════════════════════════════════════════════════════════════
    let maintenanceAsset = null;
    if (crearActivoMantenimiento && !vehiculoData.maintenanceAssetId) {
      const assetCode = `V-${vehiculo.dominio}`;
      const assetName = `${vehiculo.marca || ''} ${vehiculo.modelo || ''} ${vehiculo.dominio}`.trim();
      
      maintenanceAsset = await (app.prisma as any).maintenanceAsset.create({
        data: {
          tenantId,
          code: assetCode,
          name: assetName || vehiculo.dominio,
          description: `Vehículo de flota: ${vehiculo.dominio}. Tipo: ${vehiculo.tipo}. Creado automáticamente desde Flota 360.`,
          category: 'VEHICLE',
          status: 'ACTIVE',
          manufacturer: manufacturer || vehiculo.marca || 'Sin especificar',
          model: vehiculo.modelo || 'Sin especificar',
          serialNumber: vehiculo.chasis || vehiculo.motor || undefined,
          acquisitionCost: acquisitionCost || 0,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
          currentOdometer: vehiculo.currentOdometer,
          location: 'Flota',
        }
      });

      // Actualizar vehículo con el ID del activo creado
      vehiculo = await (app.prisma as any).vehiculo.update({
        where: { id: vehiculo.id, tenantId },
        data: { maintenanceAssetId: maintenanceAsset.id }
      });

      // Crear Digital Twin automáticamente para el activo
      await (app.prisma as any).assetDigitalTwin.create({
        data: {
          tenantId,
          assetId: maintenanceAsset.id,
          healthScore: 100,
          riskScore: 0,
          componentes: JSON.stringify({
            motor: { salud: 100, riesgo: 0, kmRestantes: 100000 },
            frenos: { salud: 100, riesgo: 0, kmRestantes: 50000 },
            caja: { salud: 100, riesgo: 0, kmRestantes: 80000 },
            diferencial: { salud: 100, riesgo: 0, kmRestantes: 70000 },
            neumaticos: { salud: 100, riesgo: 0, kmRestantes: 40000 },
          }),
          syncSource: 'AUTO',
        }
      });
    }

    return reply.code(201).send({
      vehiculo,
      maintenanceAsset,
      mensaje: maintenanceAsset
        ? 'Vehículo creado con activo de mantenimiento vinculado automáticamente'
        : 'Vehículo creado sin activo de mantenimiento'
    });
  });

  app.patch('/vehiculos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      dominio: z.string().optional().transform(v => v ? v.toUpperCase() : v),
      tipo: z.string().optional(),
      marca: z.string().optional(),
      modelo: z.string().optional(),
      anio: z.number().int().optional(),
      color: z.string().optional(),
      chasis: z.string().optional(),
      motor: z.string().optional(),
      status: z.string().optional(),
      conductorId: z.string().uuid().optional().nullable(),
      maintenanceAssetId: z.string().uuid().optional().nullable(),
      currentOdometer: z.number().optional(),
      notas: z.string().optional(),
    }).passthrough();
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    // ═══════════════════════════════════════════════════════════════
    // SINCRONIZAR ODÓMETRO CON ACTIVO DE MANTENIMIENTO
    // ═══════════════════════════════════════════════════════════════
    if (body.data.currentOdometer !== undefined) {
      const vehiculo = await (app.prisma as any).vehiculo.findFirst({
        where: { id, tenantId },
        select: { maintenanceAssetId: true }
      });
      if (vehiculo?.maintenanceAssetId) {
        await (app.prisma as any).maintenanceAsset.updateMany({
          where: { id: vehiculo.maintenanceAssetId, tenantId },
          data: { currentOdometer: body.data.currentOdometer }
        });
      }
    }

    await (app.prisma as any).vehiculo.updateMany({ where: { id, tenantId }, data: body.data });
    return reply.send({ ok: true });
  });

  // DELETE /vehiculos/:id - Marcar como BAJA (eliminación lógica)
  app.delete('/vehiculos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    
    await (app.prisma as any).vehiculo.updateMany({ 
      where: { id, tenantId }, 
      data: { status: 'BAJA' } 
    });
    
    return reply.send({ ok: true, mensaje: 'Vehículo marcado como BAJA' });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONDUCTORES
  // ═══════════════════════════════════════════════════════════════

  app.get('/conductores', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const conductores = await (app.prisma as any).conductor.findMany({
      where: { tenantId },
      include: { vehiculos: { select: { id: true, dominio: true, tipo: true, status: true } } },
      orderBy: { nombre: 'asc' },
    });
    return reply.send({ conductores });
  });

  app.post('/conductores', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      nombre: z.string().min(1),
      dni: z.string().optional(),
      telefono: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
      categoria: z.string().optional(),
      nroLicencia: z.string().optional(),
      licenciaVto: z.string().optional(),
      psicofisicoVto: z.string().optional(),
      notas: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const { licenciaVto, psicofisicoVto, ...rest } = body.data;
    const conductor = await (app.prisma as any).conductor.create({
      data: {
        ...rest,
        tenantId,
        licenciaVto: licenciaVto ? new Date(licenciaVto) : null,
        psicofisicoVto: psicofisicoVto ? new Date(psicofisicoVto) : null,
      },
    });
    return reply.code(201).send({ conductor });
  });

  app.patch('/conductores/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const data = req.body as any;
    if (data.licenciaVto) data.licenciaVto = new Date(data.licenciaVto);
    if (data.psicofisicoVto) data.psicofisicoVto = new Date(data.psicofisicoVto);
    await (app.prisma as any).conductor.updateMany({ where: { id, tenantId }, data });
    return reply.send({ ok: true });
  });

  app.delete('/conductores/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await (app.prisma as any).conductor.updateMany({ where: { id, tenantId }, data: { status: 'INACTIVO' } });
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // VENCIMIENTOS
  // ═══════════════════════════════════════════════════════════════

  app.get('/vencimientos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const vencimientos = await (app.prisma as any).vencimientoDocumento.findMany({
      where: { tenantId, renovado: false },
      include: { vehiculo: { select: { id: true, dominio: true, tipo: true, marca: true, modelo: true } } },
      orderBy: { fechaVto: 'asc' },
    });
    return reply.send({ vencimientos });
  });

  app.post('/vehiculos/:vehiculoId/vencimientos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { vehiculoId } = req.params as any;
    const schema = z.object({
      tipo: z.string().min(1),
      descripcion: z.string().optional(),
      fechaVto: z.string().min(1),
      alertaDias: z.number().int().default(30),
      notas: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const vencimiento = await (app.prisma as any).vencimientoDocumento.create({
      data: { ...body.data, vehiculoId, tenantId, fechaVto: new Date(body.data.fechaVto) },
    });
    return reply.code(201).send({ vencimiento });
  });

  app.patch('/vencimientos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const data = req.body as any;
    if (data.fechaVto) data.fechaVto = new Date(data.fechaVto);
    await (app.prisma as any).vencimientoDocumento.updateMany({ where: { id, tenantId }, data });
    return reply.send({ ok: true });
  });

  app.delete('/vencimientos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await (app.prisma as any).vencimientoDocumento.deleteMany({ where: { id, tenantId } });
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // NEUMÁTICOS
  // ═══════════════════════════════════════════════════════════════

  app.get('/neumaticos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const neumaticos = await (app.prisma as any).neumatico.findMany({
      where: { tenantId },
      include: {
        posiciones: {
          where: { activo: true },
          include: { vehiculo: { select: { id: true, dominio: true, tipo: true, currentOdometer: true } } },
        },
      },
      orderBy: { codigo: 'asc' },
    });
    // Enrich with sparePart name if linked
    const sparePartIds = neumaticos.filter((n: any) => n.sparePartId).map((n: any) => n.sparePartId);
    let spareParts: any[] = [];
    if (sparePartIds.length > 0) {
      spareParts = await (app.prisma as any).maintenanceSparePart.findMany({
        where: { id: { in: sparePartIds } },
        select: { id: true, code: true, name: true, currentStock: true, unitCost: true, medida: true },
      });
    }
    const spMap = Object.fromEntries(spareParts.map((s: any) => [s.id, s]));
    const enriched = neumaticos.map((n: any) => ({ ...n, sparePart: n.sparePartId ? spMap[n.sparePartId] || null : null }));
    return reply.send({ neumaticos: enriched });
  });

  // GET repuestos categoria neumatico para selector
  app.get('/neumaticos/repuestos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const parts = await (app.prisma as any).maintenanceSparePart.findMany({
      where: { tenantId },
      select: { id: true, code: true, name: true, currentStock: true, unitCost: true },
      orderBy: { name: 'asc' },
    });
    return reply.send({ parts });
  });

  app.post('/neumaticos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      codigo: z.string().min(1),
      marca: z.string().optional(),
      modelo: z.string().optional(),
      medida: z.string().optional(),
      dot: z.string().optional(),
      condicion: z.enum(['NUEVA', 'USADA', 'RECAPADA']).optional().default('NUEVA'),
      profBanda: z.number().optional(),
      sparePartId: z.string().uuid().optional().nullable(),
      notas: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const neumatico = await (app.prisma as any).neumatico.create({ data: { ...body.data, tenantId } });
    return reply.code(201).send({ neumatico });
  });

  app.patch('/neumaticos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await (app.prisma as any).neumatico.updateMany({ where: { id, tenantId }, data: req.body as any });
    return reply.send({ ok: true });
  });

  // Eliminar neumático (solo si está DISPONIBLE, no montado)
  app.delete('/neumaticos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const neum = await (app.prisma as any).neumatico.findFirst({ where: { id, tenantId } });
    if (!neum) return reply.code(404).send({ error: 'Neumático no encontrado' });
    if (neum.status !== 'DISPONIBLE') return reply.code(400).send({ error: 'No se puede eliminar: el neumático está EN_USO o DESCARTADO' });
    // Eliminar posiciones históricas primero
    await (app.prisma as any).neumaticoPosicion.deleteMany({ where: { neumaticoId: id, tenantId } });
    await (app.prisma as any).neumatico.deleteMany({ where: { id, tenantId } });
    return reply.send({ ok: true });
  });

  // Montar neumático en vehículo — descuenta stock del repuesto vinculado
  app.post('/neumaticos/:neumaticoId/montar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { neumaticoId } = req.params as any;
    const schema = z.object({
      vehiculoId: z.string().uuid(),
      eje: z.number().int().min(1),
      lado: z.enum(['IZQ', 'DER']),
      posicion: z.enum(['SIMPLE', 'EXT', 'INT']).default('SIMPLE'),
      kmAlMontar: z.number().optional(),
      profBandaInicio: z.number().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    // Desmontar posición previa si existía
    await (app.prisma as any).neumaticoPosicion.updateMany({
      where: { neumaticoId, activo: true, tenantId },
      data: { activo: false, desmontadoAt: new Date(), kmAlDesmontar: body.data.kmAlMontar },
    });

    // Si no se pasó kmAlMontar, tomarlo del odómetro actual del vehículo
    let kmAlMontar = body.data.kmAlMontar;
    if (kmAlMontar == null) {
      const veh = await (app.prisma as any).vehiculo.findFirst({ where: { id: body.data.vehiculoId, tenantId }, select: { currentOdometer: true } });
      if (veh?.currentOdometer) kmAlMontar = veh.currentOdometer;
    }

    const posicion = await (app.prisma as any).neumaticoPosicion.create({
      data: { ...body.data, kmAlMontar, neumaticoId, tenantId, activo: true },
    });

    // Actualizar estado del neumático
    await (app.prisma as any).neumatico.updateMany({ where: { id: neumaticoId }, data: { status: 'EN_USO' } });

    // Descontar 1 unidad del stock del repuesto vinculado
    const neum = await (app.prisma as any).neumatico.findFirst({ where: { id: neumaticoId }, select: { sparePartId: true } });
    if (neum?.sparePartId) {
      await (app.prisma as any).maintenanceSparePart.updateMany({
        where: { id: neum.sparePartId, tenantId, currentStock: { gt: 0 } },
        data: { currentStock: { decrement: 1 } },
      });
    }

    return reply.code(201).send({ posicion });
  });

  // Desmontar neumático — calcula km recorridos y actualiza acumulado
  app.post('/neumaticos/:neumaticoId/desmontar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { neumaticoId } = req.params as any;
    const { kmAlDesmontar, profBandaFin } = req.body as any;

    // Buscar posición activa para calcular km recorridos
    const posActiva = await (app.prisma as any).neumaticoPosicion.findFirst({
      where: { neumaticoId, activo: true, tenantId },
      select: { kmAlMontar: true },
    });

    await (app.prisma as any).neumaticoPosicion.updateMany({
      where: { neumaticoId, activo: true, tenantId },
      data: { activo: false, desmontadoAt: new Date(), kmAlDesmontar: kmAlDesmontar || null, profBandaFin: profBandaFin || null },
    });

    // Acumular km recorridos en el neumático
    const neum = await (app.prisma as any).neumatico.findFirst({ where: { id: neumaticoId }, select: { kmAcumulados: true } });
    const kmRecorridos = (posActiva?.kmAlMontar != null && kmAlDesmontar) ? (kmAlDesmontar - posActiva.kmAlMontar) : 0;
    const updateData: any = { status: 'DISPONIBLE' };
    if (profBandaFin != null) updateData.profBanda = profBandaFin;
    if (kmRecorridos > 0) updateData.kmAcumulados = (neum?.kmAcumulados || 0) + kmRecorridos;
    await (app.prisma as any).neumatico.updateMany({ where: { id: neumaticoId }, data: updateData });
    return reply.send({ ok: true, kmRecorridos: Math.max(0, kmRecorridos) });
  });

  // Historial de posiciones de un neumático
  app.get('/neumaticos/:id/historial', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const historial = await (app.prisma as any).neumaticoPosicion.findMany({
      where: { neumaticoId: id, tenantId },
      include: { vehiculo: { select: { id: true, dominio: true, tipo: true } } },
      orderBy: { montadoAt: 'desc' },
    });
    return reply.send({ historial });
  });

  // ═══════════════════════════════════════════════════════════════
  // COMBUSTIBLE
  // ═══════════════════════════════════════════════════════════════

  app.get('/vehiculos/:vehiculoId/combustible', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { vehiculoId } = req.params as any;
    const registros = await (app.prisma as any).registroCombustible.findMany({
      where: { vehiculoId, tenantId },
      orderBy: { fecha: 'desc' },
    });
    return reply.send({ registros });
  });

  app.post('/vehiculos/:vehiculoId/combustible', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { vehiculoId } = req.params as any;
    const schema = z.object({
      litros: z.number().positive(),
      precioPorLitro: z.number().optional(),
      odometro: z.number().optional(),
      estacion: z.string().optional(),
      tipoCombustible: z.string().default('DIESEL'),
      conductorId: z.string().uuid().optional().nullable(),
      fecha: z.string().optional(),
      notas: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    // Calcular rendimiento vs carga anterior
    let rendimiento: number | null = null;
    if (body.data.odometro) {
      const anterior = await (app.prisma as any).registroCombustible.findFirst({
        where: { vehiculoId, tenantId, odometro: { not: null } },
        orderBy: { fecha: 'desc' },
      });
      if (anterior?.odometro && body.data.odometro > anterior.odometro) {
        rendimiento = (body.data.odometro - anterior.odometro) / body.data.litros;
        rendimiento = Math.round(rendimiento * 100) / 100;
      }
      // Actualizar odómetro del vehículo
      await (app.prisma as any).vehiculo.updateMany({ where: { id: vehiculoId }, data: { currentOdometer: body.data.odometro } });
      
      // Verificar planes de mantenimiento por KM (ejecutar en background)
      verificarPlanesPorKm(app.prisma, tenantId, vehiculoId, body.data.odometro).catch(() => {});
    }

    const costoTotal = body.data.precioPorLitro ? body.data.litros * body.data.precioPorLitro : null;
    const registro = await (app.prisma as any).registroCombustible.create({
      data: {
        ...body.data,
        vehiculoId,
        tenantId,
        costoTotal,
        rendimiento,
        fecha: body.data.fecha ? new Date(body.data.fecha) : new Date(),
      },
    });
    return reply.code(201).send({ registro });
  });

  // ═══════════════════════════════════════════════════════════════
  // REPUESTOS EN OT
  // ═══════════════════════════════════════════════════════════════

  app.get('/ot-repuestos/:workOrderId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { workOrderId } = req.params as any;
    const repuestos = await (app.prisma as any).oTRepuesto.findMany({
      where: { workOrderId, tenantId },
    });
    return reply.send({ repuestos });
  });

  app.post('/ot-repuestos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      workOrderId: z.string().uuid(),
      sparePartId: z.string().uuid(),
      cantidad: z.number().positive(),
      precioUnit: z.number().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const subtotal = body.data.precioUnit ? body.data.cantidad * body.data.precioUnit : null;
    const otRepuesto = await (app.prisma as any).oTRepuesto.create({ data: { ...body.data, subtotal, tenantId } });
    // Descontar del stock
    await (app.prisma as any).maintenanceSparePart.updateMany({
      where: { id: body.data.sparePartId },
      data: { currentStock: { decrement: body.data.cantidad } },
    });
    return reply.code(201).send({ otRepuesto });
  });

  app.delete('/ot-repuestos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const otRep = await (app.prisma as any).oTRepuesto.findFirst({ where: { id, tenantId } });
    if (!otRep) return reply.code(404).send({ error: 'No encontrado' });
    // Reponer stock
    await (app.prisma as any).maintenanceSparePart.updateMany({
      where: { id: otRep.sparePartId },
      data: { currentStock: { increment: otRep.cantidad } },
    });
    await (app.prisma as any).oTRepuesto.deleteMany({ where: { id, tenantId } });
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD EJECUTIVO
  // ═══════════════════════════════════════════════════════════════

  app.get('/dashboard', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const hoy = new Date();
    const hace30 = new Date(hoy); hace30.setDate(hoy.getDate() - 30);
    const en30dias = new Date(hoy); en30dias.setDate(hoy.getDate() + 30);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);

    const [
      vehiculos,
      neumaticos,
      vencimientos,
      combustibleMes,
      combustibleMesAnt,
      otAbiertas,
      otCerradasMes,
      otUltimas30,
      conductores,
    ] = await Promise.all([
      (app.prisma as any).vehiculo.findMany({
        where: { tenantId },
        select: { id: true, dominio: true, tipo: true, status: true, currentOdometer: true },
      }),
      (app.prisma as any).neumatico.findMany({
        where: { tenantId },
        select: { id: true, status: true, kmAcumulados: true, profBanda: true },
      }),
      (app.prisma as any).vencimientoDocumento.findMany({
        where: { tenantId, renovado: false, fechaVto: { lte: en30dias } },
        include: { vehiculo: { select: { dominio: true } } },
        orderBy: { fechaVto: 'asc' },
      }),
      (app.prisma as any).registroCombustible.findMany({
        where: { tenantId, fecha: { gte: inicioMes } },
        select: { vehiculoId: true, litros: true, costoTotal: true, rendimiento: true },
      }),
      (app.prisma as any).registroCombustible.findMany({
        where: { tenantId, fecha: { gte: inicioMesAnterior, lte: finMesAnterior } },
        select: { litros: true, costoTotal: true },
      }),
      (app.prisma as any).workOrder.count({
        where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }),
      (app.prisma as any).workOrder.findMany({
        where: { tenantId, completedAt: { gte: inicioMes }, status: 'COMPLETED' },
        select: { id: true, startedAt: true, completedAt: true, totalCost: true, type: true },
      }),
      (app.prisma as any).workOrder.findMany({
        where: { tenantId, createdAt: { gte: hace30 } },
        select: { id: true, status: true, type: true, priority: true, totalCost: true, startedAt: true, completedAt: true, createdAt: true },
      }),
      (app.prisma as any).conductor.findMany({
        where: { tenantId, status: 'ACTIVO' },
        select: { id: true, nombre: true, licenciaVto: true, psicofisicoVto: true },
      }),
    ]);

    // ── KPIs Flota ────────────────────────────────────────────────
    const totalVeh = vehiculos.length;
    const activosCount = vehiculos.filter((v: any) => v.status === 'ACTIVO').length;
    const enTallerCount = vehiculos.filter((v: any) => v.status === 'EN_TALLER').length;
    const disponibilidadPct = totalVeh > 0 ? Math.round((activosCount / totalVeh) * 100) : 0;

    // Combustible
    const litrosMes = combustibleMes.reduce((s: number, r: any) => s + r.litros, 0);
    const costoCombuMes = combustibleMes.reduce((s: number, r: any) => s + (r.costoTotal || 0), 0);
    const litrosMesAnt = combustibleMesAnt.reduce((s: number, r: any) => s + r.litros, 0);
    const costoCombuMesAnt = combustibleMesAnt.reduce((s: number, r: any) => s + (r.costoTotal || 0), 0);
    const rendimientos = combustibleMes.filter((r: any) => r.rendimiento != null).map((r: any) => r.rendimiento);
    const promedioKmL = rendimientos.length > 0 ? Math.round((rendimientos.reduce((s: number, r: number) => s + r, 0) / rendimientos.length) * 100) / 100 : null;
    // L/100km: inverso de km/L * 100
    const l100km = promedioKmL && promedioKmL > 0 ? Math.round((100 / promedioKmL) * 100) / 100 : null;

    // Consumo por vehículo este mes
    const consumoPorVeh: Record<string, { litros: number; costo: number }> = {};
    for (const r of combustibleMes as any[]) {
      if (!consumoPorVeh[r.vehiculoId]) consumoPorVeh[r.vehiculoId] = { litros: 0, costo: 0 };
      consumoPorVeh[r.vehiculoId].litros += r.litros;
      consumoPorVeh[r.vehiculoId].costo += r.costoTotal || 0;
    }
    const topConsumidores = vehiculos
      .filter((v: any) => consumoPorVeh[v.id])
      .map((v: any) => ({ dominio: v.dominio, tipo: v.tipo, ...consumoPorVeh[v.id] }))
      .sort((a: any, b: any) => b.litros - a.litros)
      .slice(0, 5);

    // Neumáticos en alerta (banda < 3mm o km > 80k)
    const neumaticosAlerta = neumaticos.filter((n: any) =>
      (n.profBanda != null && n.profBanda < 3) || n.kmAcumulados > 80000
    ).length;
    const neumaticosDisponibles = neumaticos.filter((n: any) => n.status === 'DISPONIBLE').length;
    const neumaticosMontados = neumaticos.filter((n: any) => n.status === 'EN_USO').length;

    // Vencimientos críticos (vencidos = fecha < hoy)
    const vencimientosVencidos = vencimientos.filter((v: any) => new Date(v.fechaVto) < hoy);
    const vencimientosProximos = vencimientos.filter((v: any) => new Date(v.fechaVto) >= hoy);

    // Conductores con documentos por vencer
    const conductoresAlerta = conductores.filter((c: any) => {
      const licDias = c.licenciaVto ? Math.ceil((new Date(c.licenciaVto).getTime() - hoy.getTime()) / 86400000) : 999;
      const psicoDias = c.psicofisicoVto ? Math.ceil((new Date(c.psicofisicoVto).getTime() - hoy.getTime()) / 86400000) : 999;
      return licDias <= 30 || psicoDias <= 30;
    }).map((c: any) => {
      const licDias = c.licenciaVto ? Math.ceil((new Date(c.licenciaVto).getTime() - hoy.getTime()) / 86400000) : null;
      const psicoDias = c.psicofisicoVto ? Math.ceil((new Date(c.psicofisicoVto).getTime() - hoy.getTime()) / 86400000) : null;
      return { nombre: c.nombre, licDias, psicoDias };
    });

    // ── KPIs Mantenimiento ────────────────────────────────────────
    const otCerradas = otCerradasMes.length;
    // MTTR: tiempo medio de reparación en horas
    const otConDuracion = otCerradasMes.filter((o: any) => o.startedAt && o.completedAt);
    const mttr = otConDuracion.length > 0
      ? Math.round(otConDuracion.reduce((s: number, o: any) => {
          return s + (new Date(o.completedAt).getTime() - new Date(o.startedAt).getTime()) / 3600000;
        }, 0) / otConDuracion.length * 10) / 10
      : null;

    const costoOTMes = otCerradasMes.reduce((s: number, o: any) => s + (o.totalCost || 0), 0);

    // OTs por tipo (últimas 30 días)
    const otPorTipo: Record<string, number> = {};
    for (const o of otUltimas30 as any[]) {
      otPorTipo[o.type] = (otPorTipo[o.type] || 0) + 1;
    }
    const otPorPrioridad: Record<string, number> = {};
    for (const o of otUltimas30 as any[]) {
      otPorPrioridad[o.priority] = (otPorPrioridad[o.priority] || 0) + 1;
    }

    // Tendencia OTs: agrupar por semana
    const otPorSemana: Record<string, { abiertas: number; cerradas: number }> = {};
    for (const o of otUltimas30 as any[]) {
      const sem = `S${Math.ceil(new Date(o.createdAt).getDate() / 7)}`;
      if (!otPorSemana[sem]) otPorSemana[sem] = { abiertas: 0, cerradas: 0 };
      if (o.status === 'COMPLETED') otPorSemana[sem].cerradas++;
      else otPorSemana[sem].abiertas++;
    }

    return reply.send({
      flota: {
        totalVehiculos: totalVeh,
        activos: activosCount,
        enTaller: enTallerCount,
        inactivos: totalVeh - activosCount - enTallerCount,
        disponibilidadPct,
        combustible: {
          litrosMes: Math.round(litrosMes * 10) / 10,
          costoMes: Math.round(costoCombuMes),
          litrosMesAnt: Math.round(litrosMesAnt * 10) / 10,
          costoMesAnt: Math.round(costoCombuMesAnt),
          variacionLitros: litrosMesAnt > 0 ? Math.round(((litrosMes - litrosMesAnt) / litrosMesAnt) * 100) : null,
          promedioKmL,
          l100km,
        },
        topConsumidores,
        neumaticos: {
          total: neumaticos.length,
          disponibles: neumaticosDisponibles,
          montados:neumaticosMontados,
          enAlerta: neumaticosAlerta,
        },
        vencimientos: {
          vencidos: vencimientosVencidos.length,
          proximos: vencimientosProximos.length,
          lista: vencimientos.slice(0, 8).map((v: any) => ({
            tipo: v.tipo,
            dominio: v.vehiculo?.dominio,
            fechaVto: v.fechaVto,
            diasRestantes: Math.ceil((new Date(v.fechaVto).getTime() - hoy.getTime()) / 86400000),
          })),
        },
        conductores: {
          total: conductores.length,
          enAlerta: conductoresAlerta,
        },
      },
      mantenimiento: {
        otAbiertas,
        otCerradasMes: otCerradas,
        mttrHoras: mttr,
        costoOTMes: Math.round(costoOTMes),
        otPorTipo: Object.entries(otPorTipo).map(([tipo, count]) => ({ tipo, count })),
        otPorPrioridad: Object.entries(otPorPrioridad).map(([prioridad, count]) => ({ prioridad, count })),
        tendencia: Object.entries(otPorSemana).map(([semana, v]) => ({ semana, ...v })),
      },
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // STATS / DASHBOARD
  // ═══════════════════════════════════════════════════════════════

  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const hoy = new Date();
    const en30dias = new Date(hoy); en30dias.setDate(hoy.getDate() + 30);

    const [totalVehiculos, activos, enTaller, vencimientosProximos, conductores, neumaticos] = await Promise.all([
      (app.prisma as any).vehiculo.count({ where: { tenantId } }),
      (app.prisma as any).vehiculo.count({ where: { tenantId, status: 'ACTIVO' } }),
      (app.prisma as any).vehiculo.count({ where: { tenantId, status: 'EN_TALLER' } }),
      (app.prisma as any).vencimientoDocumento.count({ where: { tenantId, renovado: false, fechaVto: { lte: en30dias } } }),
      (app.prisma as any).conductor.count({ where: { tenantId, status: 'ACTIVO' } }),
      (app.prisma as any).neumatico.count({ where: { tenantId } }),
    ]);
    return reply.send({ stats: { totalVehiculos, activos, enTaller, vencimientosProximos, conductores, neumaticos } });
  });

  // ═══════════════════════════════════════════════════════════════
  // PLANES DE MANTENIMIENTO POR KM
  // ═══════════════════════════════════════════════════════════════

  // Obtener planes de mantenimiento por KM próximos a vencer para un vehículo
  app.get('/vehiculos/:vehiculoId/planes-km', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { vehiculoId } = req.params as any;
    
    const vehiculo = await (app.prisma as any).vehiculo.findFirst({
      where: { id: vehiculoId, tenantId },
      select: { id: true, dominio: true, currentOdometer: true },
    });
    if (!vehiculo) return reply.code(404).send({ error: 'Vehículo no encontrado' });
    
    const planes = await (app.prisma as any).maintenancePlan.findMany({
      where: { tenantId, status: 'ACTIVE', frequencyUnit: 'KM', assetId: vehiculoId },
      select: { id: true, code: true, title: true, triggerKm: true, lastOdometerExecution: true },
    });
    
    const planesConAlerta = planes.map((p: any) => {
      const kmDesdeUltima = vehiculo.currentOdometer && p.lastOdometerExecution 
        ? vehiculo.currentOdometer - p.lastOdometerExecution 
        : 0;
      const kmRestantes = (p.triggerKm || 0) - kmDesdeUltima;
      const porcentaje = p.triggerKm > 0 ? Math.round((kmDesdeUltima / p.triggerKm) * 100) : 0;
      return {
        ...p,
        kmDesdeUltima: Math.round(kmDesdeUltima),
        kmRestantes: Math.round(kmRestantes),
        porcentajeUso: porcentaje,
        alerta: porcentaje >= 90 ? 'CRITICAL' : porcentaje >= 80 ? 'WARNING' : null,
      };
    }).sort((a: any, b: any) => b.porcentajeUso - a.porcentajeUso);
    
    return reply.send({ vehiculo, planes: planesConAlerta });
  });

  // Verificar planes por KM para toda la flota (dashboard)
  app.get('/planes-km/pendientes', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    
    const [vehiculos, planes] = await Promise.all([
      (app.prisma as any).vehiculo.findMany({
        where: { tenantId, status: 'ACTIVO' },
        select: { id: true, dominio: true, currentOdometer: true, tipo: true },
      }),
      (app.prisma as any).maintenancePlan.findMany({
        where: { tenantId, status: 'ACTIVE', frequencyUnit: 'KM' },
        select: { id: true, code: true, title: true, triggerKm: true, lastOdometerExecution: true, assetId: true },
      }),
    ]);
    
    const vehMap = new Map((vehiculos as any[]).map((v: any) => [v.id, v]));
    
    const pendientes = (planes as any[])
      .map((p: any) => {
        const veh = vehMap.get(p.assetId) as any;
        if (!veh || !veh.currentOdometer) return null;
        const kmDesdeUltima = p.lastOdometerExecution 
          ? veh.currentOdometer - p.lastOdometerExecution 
          : veh.currentOdometer;
        const kmRestantes = (p.triggerKm || 0) - kmDesdeUltima;
        const porcentaje = p.triggerKm > 0 ? (kmDesdeUltima / p.triggerKm) * 100 : 0;
        if (porcentaje < 70) return null; // Solo mostrar los que están al 70% o más
        return {
          planId: p.id,
          planCode: p.code,
          planTitle: p.title,
          triggerKm: p.triggerKm,
          vehiculoId: veh.id,
          dominio: veh.dominio,
          tipo: veh.tipo,
          kmDesdeUltima: Math.round(kmDesdeUltima),
          kmRestantes: Math.round(kmRestantes),
          porcentajeUso: Math.round(porcentaje),
          alerta: porcentaje >= 90 ? 'CRITICAL' : porcentaje >= 80 ? 'WARNING' : 'INFO',
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.porcentajeUso - a.porcentajeUso);
    
    return reply.send({ pendientes, total: pendientes.length, critical: pendientes.filter((p: any) => p.alerta === 'CRITICAL').length });
  });

  // ═══════════════════════════════════════════════════════════════
  // ANÁLISIS TCO (Total Cost of Ownership) — Costo por KM
  // ═══════════════════════════════════════════════════════════════

  app.get('/tco/analisis', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const { desde, hasta } = req.query as any;
    const fechaDesde = desde ? new Date(desde) : new Date(new Date().getFullYear(), 0, 1);
    const fechaHasta = hasta ? new Date(hasta) : new Date();

    // Obtener todos los vehículos activos
    const vehiculos = await (app.prisma as any).vehiculo.findMany({
      where: { tenantId, status: 'ACTIVO' },
      select: { id: true, dominio: true, tipo: true, currentOdometer: true, marca: true, modelo: true },
    });

    const resultados = await Promise.all((vehiculos as any[]).map(async (v: any) => {
      // 1. Costo de combustible
      const combustibleAgg = await (app.prisma as any).registroCombustible.aggregate({
        where: { vehiculoId: v.id, tenantId, fecha: { gte: fechaDesde, lte: fechaHasta } },
        _sum: { costoTotal: true, litros: true },
      });

      // 2. Costo de mantenimiento (OTs)
      const mantenimientoAgg = await (app.prisma as any).workOrder.aggregate({
        where: {
          tenantId,
          assetId: v.id,
          status: 'COMPLETED',
          completedDate: { gte: fechaDesde, lte: fechaHasta },
        },
        _sum: { totalCost: true, laborCost: true, partsCost: true },
        _count: true,
      });

      // 3. Costo de neumáticos (desmontajes en el período)
      const neumaticosAgg = await (app.prisma as any).neumaticoPosicion.aggregate({
        where: {
          vehiculoId: v.id,
          tenantId,
          desmontadoAt: { gte: fechaDesde, lte: fechaHasta },
          activo: false,
        },
        _count: true,
      });

      // Calcular totales
      const costoCombustible = combustibleAgg._sum?.costoTotal || 0;
      const costoMantenimiento = mantenimientoAgg._sum?.totalCost || 0;
      const costoNeumaticos = (neumaticosAgg._count || 0) * 50000; // Estimado $50.000 por neumático desmontado

      const costoTotal = costoCombustible + costoMantenimiento + costoNeumaticos;
      const kmRecorridos = v.currentOdometer || 0;
      const costoPorKm = kmRecorridos > 0 ? costoTotal / kmRecorridos : 0;

      return {
        vehiculoId: v.id,
        dominio: v.dominio,
        tipo: v.tipo,
        marca: v.marca,
        modelo: v.modelo,
        kmRecorridos: Math.round(kmRecorridos),
        costoTotal: Math.round(costoTotal),
        costoPorKm: Math.round(costoPorKm * 100) / 100,
        desglose: {
          combustible: Math.round(costoCombustible),
          mantenimiento: Math.round(costoMantenimiento),
          neumaticos: Math.round(costoNeumaticos),
        },
        eficiencia: {
          litrosTotales: Math.round((combustibleAgg._sum?.litros || 0) * 100) / 100,
          rendimientoPromedio: combustibleAgg._sum?.litros > 0 
            ? Math.round((kmRecorridos / combustibleAgg._sum.litros) * 100) / 100 
            : 0,
          otsCompletadas: mantenimientoAgg._count || 0,
        },
        alerta: costoPorKm > 150 ? 'HIGH_COST' : costoPorKm > 100 ? 'MEDIUM_COST' : 'NORMAL',
      };
    }));

    // Ordenar por costo por km (mayor a menor)
    resultados.sort((a: any, b: any) => b.costoPorKm - a.costoPorKm);

    return reply.send({
      periodo: { desde: fechaDesde, hasta: fechaHasta },
      totalVehiculos: resultados.length,
      promedioCostoPorKm: Math.round((resultados.reduce((s: number, r: any) => s + r.costoPorKm, 0) / (resultados.length || 1)) * 100) / 100,
      vehiculos: resultados,
    });
  });

  // TCO por vehículo individual
  app.get('/vehiculos/:vehiculoId/tco', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { vehiculoId } = req.params as any;

    const vehiculo = await (app.prisma as any).vehiculo.findFirst({
      where: { id: vehiculoId, tenantId },
      select: { id: true, dominio: true, tipo: true, currentOdometer: true, marca: true, modelo: true, anio: true },
    });
    if (!vehiculo) return reply.code(404).send({ error: 'Vehículo no encontrado' });

    // Historial mensual de costos
    const historial = await (app.prisma as any).$queryRaw`
      SELECT 
        DATE_TRUNC('month', fecha) as mes,
        SUM(costo_total) as combustible,
        COUNT(*) as cargas
      FROM flota_registros_combustible
      WHERE vehiculo_id = ${vehiculoId} AND tenant_id = ${tenantId}
      GROUP BY DATE_TRUNC('month', fecha)
      ORDER BY mes DESC
      LIMIT 12
    `.catch(() => []);

    // Mantenimiento por tipo
    const mantenimientoPorTipo = await (app.prisma as any).$queryRaw`
      SELECT 
        type,
        COUNT(*) as cantidad,
        SUM(total_cost) as costo
      FROM work_orders
      WHERE asset_id = ${vehiculoId} AND tenant_id = ${tenantId} AND status = 'COMPLETED'
      GROUP BY type
    `.catch(() => []);

    return reply.send({ vehiculo, historial, mantenimientoPorTipo });
  });

  console.log('[FLOTA ROUTES] Routes registered including POST /vehiculos/:id/eliminar');
}

// Función auxiliar para verificar planes por KM (ejecutada en background)
async function verificarPlanesPorKm(prisma: any, tenantId: string, vehiculoId: string, odometer: number) {
  const planes = await prisma.maintenancePlan.findMany({
    where: { tenantId, status: 'ACTIVE', frequencyUnit: 'KM', assetId: vehiculoId },
    select: { id: true, triggerKm: true, lastOdometerExecution: true },
  });
  
  for (const plan of planes) {
    const kmDesdeUltima = plan.lastOdometerExecution 
      ? odometer - plan.lastOdometerExecution 
      : odometer;
    const triggerKm = plan.triggerKm || 0;
    
    // Si alcanzó o superó el umbral, actualizar nextExecutionDate para marcar como vencido
    if (kmDesdeUltima >= triggerKm) {
      await prisma.maintenancePlan.updateMany({
        where: { id: plan.id, tenantId },
        data: { nextExecutionDate: new Date() },
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// GARANTÍAS DE VEHÍCULOS
// ═══════════════════════════════════════════════════════════════
