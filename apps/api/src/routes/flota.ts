import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';

export default async function flotaRoutes(app: FastifyInstance) {

  // ═══════════════════════════════════════════════════════════════
  // VEHÍCULOS
  // ═══════════════════════════════════════════════════════════════

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
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const vehiculo = await (app.prisma as any).vehiculo.create({ data: { ...body.data, tenantId } });
    return reply.code(201).send({ vehiculo });
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
    await (app.prisma as any).vehiculo.updateMany({ where: { id, tenantId }, data: body.data });
    return reply.send({ ok: true });
  });

  app.delete('/vehiculos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await (app.prisma as any).vehiculo.updateMany({ where: { id, tenantId }, data: { status: 'BAJA' } });
    return reply.send({ ok: true });
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
}
