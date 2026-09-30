import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { notifyWorkOrderAssigned } from '../services/notifyService.js';
import { evaluarRecurrenciasDeOT } from '../services/fleetRecurrence.js';
import { syncOdometroYDesgaste } from '../services/fleetTires.js';
import { registrarCambioVehiculo } from '../services/vehiculoAudit.js';
import { registrarEjecucionPlan, aplicarEjecucionesOT, pataKmDelPlan, pataDiasDelPlan, evaluarVencimientoPlan } from '../services/fleetExecution.js';
import { restriccionesActivasDe, marcarReparacionInformadaPorOT } from '../services/defectService.js';
import { abrirIndisponibilidad, evaluarYCerrarIndisponibilidad } from '../services/unidadEstadoService.js';

// Schemas de validación
const createWorkOrderSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'EMERGENCY']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD']).default('PENDING'),
  assetId: z.string(),
  planId: z.string().optional().nullable(),
  // Tareas preventivas explícitas: una OT puede cubrir varios planes.
  planIds: z.array(z.string()).optional(),
  technicianId: z.string().optional(),
  // Ejecución externa: ejecutor taller (sin mecánico ficticio) + seguimiento interno
  ejecutorTipo: z.enum(['INTERNO', 'EXTERNO']).default('INTERNO'),
  tallerId: z.string().uuid().optional().nullable(),
  responsableSeguimientoId: z.string().uuid().optional().nullable(),
  responsableSeguimientoNombre: z.string().max(160).optional().nullable(),
  trabajoSolicitado: z.string().max(2000).optional().nullable(),
  fechaEntregaEstimada: z.string().datetime().optional().nullable(),
  referenciaExterna: z.string().max(120).optional().nullable(),
  // Si la OT retira la unidad del servicio (default: sí). Una OT programada
  // a futuro que aún no empezó NO retira nada; el flag cuenta desde que
  // la OT entra en proceso. Las no bloqueantes pueden crearse con false.
  retiraDeServicio: z.boolean().optional().default(true),
  scheduledDate: z.string().datetime(),
  // Fecha real de ejecución física (distinta de scheduledDate y de la fecha de carga).
  executedAt: z.string().datetime().optional(),
  // Clave de idempotencia del cliente (doble clic / retry del formulario).
  creationKey: z.string().optional(),
  estimatedDuration: z.number().default(0),
  laborCost: z.number().default(0),
  partsCost: z.number().default(0),
  finalOdometer: z.number().optional(),
  repuestos: z.array(z.object({
    sparePartId: z.string(),
    quantity: z.number().int().positive(),
    // TALLER = repuesto aportado por el taller externo: informativo, no descuenta stock propio
    origen: z.enum(['PROPIO', 'TALLER']).default('PROPIO'),
  })).optional(),
});

const createTechnicianSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  specialization: z.string().optional(),
  certification: z.string().optional(),
  scope: z.enum(['INFRA', 'FLEET']).optional(),
});

const createSparePartSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  currentStock: z.number().default(0),
  minStock: z.number().default(0),
  maxStock: z.number().optional(),
  unitCost: z.number().default(0),
  supplier: z.string().optional(),
  supplierCode: z.string().optional(),
  location: z.string().optional()
});

const createAssetSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().default('OTHER'),
  location: z.string().optional(),
  department: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().datetime().optional(),
  warrantyDate: z.string().datetime().optional(),
  acquisitionCost: z.number().default(0)
});

const createPlanSchema = z.object({
  code: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'EMERGENCY']).default('PREVENTIVE'),
  assetId: z.string().optional(),
  frequencyValue: z.number().default(30),
  frequencyUnit: z.enum(['DAYS', 'WEEKS', 'MONTHS', 'YEARS', 'KM']).default('DAYS'),
  triggerKm: z.number().optional(),
  // Intervalo dual: vence por km O por días, lo primero que ocurra
  frecuenciaDias: z.number().int().positive().optional().nullable(),
  componentKey: z.string().optional().nullable(),
  intervaloModo: z.enum(['DESDE_EJECUCION', 'CALENDARIO_FIJO']).optional(),
  nextExecutionDate: z.string().optional(), // Accept YYYY-MM-DD format
  status: z.enum(['ACTIVE', 'PAUSED', 'INACTIVE']).default('ACTIVE')
});

export default async function maintenanceRoutes(app: FastifyInstance) {
  // Helper to get prisma client from request context
  const getPrisma = (request: FastifyRequest) => {
    return (request as any).db?.prisma || app.prisma;
  };

  // ── Separación Flota360 vs Infraestructura ─────────────────────────────
  // Una OT es "de flota" cuando su assetId es el maintenanceAssetId de un
  // Vehiculo, o cuando el asset tiene category='VEHICLE'. El resto es infra.
  const getFleetAssetIds = async (request: FastifyRequest): Promise<string[]> => {
    const tenantId = request.db?.tenantId;
    if (!tenantId) return [];
    const rows = await getPrisma(request).vehiculo.findMany({
      where: { tenantId, maintenanceAssetId: { not: null } },
      select: { maintenanceAssetId: true },
    }).catch(() => []);
    return rows.map((r: any) => r.maintenanceAssetId).filter(Boolean);
  };

  // Filtro Prisma que matchea OTs de flota
  const fleetWhere = (vehAssetIds: string[]) => ({
    OR: [
      { assetId: { in: vehAssetIds } },
      { asset: { category: 'VEHICLE' } },
    ],
  });

  // GET /maintenance/work-orders - Listar órdenes de trabajo
  app.get('/work-orders', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { status, type, priority, technician, scope } = request.query as any;

    const where: any = { tenantId: request.db.tenantId };
    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (technician) where.technicianId = technician;

    // scope=fleet → solo OTs de vehículos; scope=infra → excluye OTs de vehículos
    if (scope === 'fleet' || scope === 'infra') {
      const vehAssetIds = await getFleetAssetIds(request);
      const fleet = fleetWhere(vehAssetIds);
      where.AND = [...(where.AND || []), scope === 'fleet' ? fleet : { NOT: fleet }];
    }

    const workOrders = await getPrisma(request).workOrder.findMany({
      where,
      include: {
        asset: true, technician: true,
        // Taller externo asignado (ejecución EXTERNA)
        taller: { select: { id: true, nombre: true, tipo: true, isActive: true } },
        plan: { select: { id: true, code: true, title: true } },
        // Tareas preventivas por estado: el detalle distingue ejecutadas,
        // pendientes y omitidas (una OT parcial no es cumplimiento total).
        tareas: {
          select: {
            id: true, planId: true, status: true, completedAt: true,
            plan: { select: { id: true, code: true, title: true, triggerKm: true, frecuenciaDias: true, componentKey: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ workOrders });
  });

  // POST /maintenance/work-orders - Crear orden de trabajo
  app.post('/work-orders', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    try {
      const validatedData = createWorkOrderSchema.parse(request.body);
      const prisma = getPrisma(request);
      const tenantId = request.db.tenantId;

      // Idempotencia de creación: retry/doble clic con la misma creationKey
      // devuelve la OT ya creada sin repetir efectos (stock, ejecuciones, historial).
      if (validatedData.creationKey) {
        const existente = await prisma.workOrder.findFirst({
          where: { tenantId, creationKey: validatedData.creationKey },
          include: { asset: true, technician: true },
        });
        if (existente) return reply.code(200).send({ workOrder: existente, duplicada: true });
      }

      const code = `OT-${Date.now().toString().slice(-6)}`;
      const esCompletadaAlCrear = validatedData.status === 'COMPLETED';
      const executedAt = validatedData.executedAt ? new Date(validatedData.executedAt) : null;

      // planIds: lista explícita de tareas preventivas realizadas/planificadas.
      // Compatibilidad: planId suelto se pliega a la lista.
      const planIds = [...new Set([...(validatedData.planIds ?? []), ...(validatedData.planId ? [validatedData.planId] : [])])];
      const primerPlanId = planIds[0] ?? null;

      // Ejecución externa: validar que el taller exista y acepte asignaciones.
      // El ejecutor es UNO solo — EXTERNO no admite technicianId (no se crean mecánicos ficticios).
      const esExterna = validatedData.ejecutorTipo === 'EXTERNO';
      let taller = null;
      if (esExterna) {
        if (!validatedData.tallerId) {
          return reply.code(400).send({ error: 'Ejecución externa requiere seleccionar un taller' });
        }
        taller = await (prisma as any).flotaTaller.findFirst({
          where: { id: validatedData.tallerId, tenantId, deletedAt: null },
        });
        if (!taller) return reply.code(404).send({ error: 'Taller no encontrado' });
        if (!taller.isActive) {
          return reply.code(409).send({ error: `El taller "${taller.nombre}" está inactivo y no acepta nuevas asignaciones`, code: 'TALLER_INACTIVO' });
        }
      }

      let workOrder = await prisma.workOrder.create({
        data: {
          code,
          title: validatedData.title,
          description: validatedData.description,
          type: validatedData.type,
          priority: validatedData.priority,
          status: validatedData.status,
          assetId: validatedData.assetId,
          planId: primerPlanId,
          technicianId: esExterna ? null : validatedData.technicianId,
          ejecutorTipo: validatedData.ejecutorTipo,
          tallerId: esExterna ? validatedData.tallerId : null,
          responsableSeguimientoId: validatedData.responsableSeguimientoId ?? null,
          responsableSeguimientoNombre: validatedData.responsableSeguimientoNombre ?? null,
          trabajoSolicitado: esExterna ? validatedData.trabajoSolicitado ?? null : null,
          fechaEntregaEstimada: esExterna && validatedData.fechaEntregaEstimada ? new Date(validatedData.fechaEntregaEstimada) : null,
          referenciaExterna: esExterna ? validatedData.referenciaExterna ?? null : null,
          scheduledDate: new Date(validatedData.scheduledDate),
          retiraDeServicio: validatedData.retiraDeServicio,
          completedAt: esCompletadaAlCrear ? new Date() : undefined,
          executedAt: esCompletadaAlCrear ? (executedAt ?? new Date(validatedData.scheduledDate)) : executedAt,
          creationKey: validatedData.creationKey ?? null,
          estimatedDuration: validatedData.estimatedDuration,
          laborCost: validatedData.laborCost,
          partsCost: validatedData.partsCost,
          totalCost: validatedData.laborCost + validatedData.partsCost,
          tenantId
        },
        include: { asset: true, technician: true, taller: { select: { id: true, nombre: true, tipo: true } } }
      });

      // Vincular explícitamente las tareas preventivas de esta OT
      for (const pid of planIds) {
        await prisma.workOrderTask.create({
          data: { tenantId, workOrderId: workOrder.id, planId: pid, status: 'PENDING' },
        }).catch((e: any) => { if (e?.code !== 'P2002') throw e; });
      }

      // Asignar repuestos seleccionados a la OT
      if (validatedData.repuestos && validatedData.repuestos.length > 0) {
        for (const r of validatedData.repuestos) {
          const parte = await getPrisma(request).maintenanceSparePart.findFirst({
            where: { id: r.sparePartId, tenantId: request.db.tenantId },
          });
          if (!parte) continue;
          await (getPrisma(request) as any).workOrderSparePart.create({
            data: {
              tenantId: request.db.tenantId,
              workOrderId: workOrder.id,
              sparePartId: parte.id,
              quantity: r.quantity,
              unitCost: parte.unitCost,
              origen: r.origen ?? 'PROPIO',
            },
          });
        }
      }

      // Actividad puntual creada directamente como completada: aplicar TODOS
      // los efectos del cierre en una transacción (stock, tareas realizadas,
      // planes, odómetro del vehículo, historial). Si algo falla, nada queda a medias.
      let resumenEjecucion: any = null;
      if (esCompletadaAlCrear) {
        const userId = (request as any).auth?.userId ?? null;
        const resultadoTx = await prisma.$transaction(async (tx: any) => {
          // Stock de repuestos (idempotente por stockDeducted).
          // Solo repuestos PROPIOS descuentan inventario: los aportados por el
          // taller externo (origen TALLER) son informativos y su costo llega por factura.
          const repuestosAsignados = await tx.workOrderSparePart.findMany({
            where: { workOrderId: workOrder.id, tenantId, stockDeducted: false, OR: [{ origen: 'PROPIO' }, { origen: null }] },
          });
          let partsCostTotal = 0;
          for (const r of repuestosAsignados) {
            await tx.maintenanceSparePart.update({
              where: { id: r.sparePartId },
              data: { currentStock: { decrement: r.quantity } },
            });
            await tx.workOrderSparePart.update({ where: { id: r.id }, data: { stockDeducted: true } });
            partsCostTotal += r.quantity * r.unitCost;
          }
          if (partsCostTotal > 0) {
            const nuevoPartsCost = (workOrder.partsCost || 0) + partsCostTotal;
            await tx.workOrder.update({
              where: { id: workOrder.id },
              data: { partsCost: nuevoPartsCost, totalCost: (workOrder.laborCost || 0) + nuevoPartsCost },
            });
          }

          const fechaEjecucion = workOrder.executedAt ?? workOrder.completedAt ?? new Date();
          const resumen = await aplicarEjecucionesOT(tx, {
            tenantId, workOrder, executedAt: fechaEjecucion,
            odometro: validatedData.finalOdometer ?? null, registradoPor: userId,
          });

          // Odómetro + historial del vehículo (si el asset es de flota)
          const vehiculo = workOrder.assetId
            ? await tx.vehiculo.findFirst({ where: { maintenanceAssetId: workOrder.assetId, tenantId } })
            : null;
          if (vehiculo) {
            if (validatedData.finalOdometer != null) {
              await syncOdometroYDesgaste(tx, tenantId, vehiculo.id, validatedData.finalOdometer);
            }
            // Un registro por OT (workOrderId único): reintentos no duplican.
            await tx.vehiculoHistorialMantenimiento.upsert({
              where: { workOrderId: workOrder.id },
              update: {
                fecha: fechaEjecucion, tipo: workOrder.type, descripcion: workOrder.title,
                costo: (workOrder.laborCost || 0) + (workOrder.partsCost || 0) + partsCostTotal,
                odometro: validatedData.finalOdometer ?? null,
                notas: workOrder.description || '',
              },
              create: {
                tenantId, vehiculoId: vehiculo.id, workOrderId: workOrder.id,
                fecha: fechaEjecucion, tipo: workOrder.type, descripcion: workOrder.title,
                costo: (workOrder.laborCost || 0) + (workOrder.partsCost || 0) + partsCostTotal,
                odometro: validatedData.finalOdometer ?? null,
                notas: workOrder.description || '',
              },
            });
          }
          return resumen;
        });
        resumenEjecucion = resultadoTx;

        // Recurrencias (fuera de la tx: consulta read-heavy, no afecta integridad)
        workOrder = await prisma.workOrder.findUnique({
          where: { id: workOrder.id }, include: { asset: true, technician: true, taller: { select: { id: true, nombre: true, tipo: true } } },
        }) ?? workOrder;
        if (workOrder.assetId) {
          evaluarRecurrenciasDeOT(prisma, tenantId, workOrder.id, workOrder.assetId)
            .catch((e: any) => console.error('[maintenance] evaluarRecurrenciasDeOT error:', e));
        }
      }

      if (workOrder.technician?.email) {
        notifyWorkOrderAssigned(prisma, {
          tenantId,
          technicianEmail: workOrder.technician.email,
          technicianName: workOrder.technician.name,
          otCode: workOrder.code,
          otTitle: workOrder.title,
          otId: workOrder.id,
          assetName: workOrder.asset?.name,
          priority: workOrder.priority,
          scheduledDate: workOrder.scheduledDate,
        }).catch((e: any) => console.error('[maintenance] notifyWorkOrderAssigned error:', e));
      }

      return reply.code(201).send({ workOrder, ejecucion: resumenEjecucion });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validación fallida', details: error.errors });
      }
      console.error('Error creating work order:', error);
      return reply.code(500).send({ error: 'Error interno del servidor' });
    }
  });

  // PUT /maintenance/work-orders/:id - Actualizar orden
  app.put('/work-orders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { id } = request.params as { id: string };
    const updateData = request.body as any;

    try {
      // _userId: clave interna para auditar quién registró la ejecución (no es campo del modelo)
      const result = await applyWorkOrderUpdate(getPrisma(request), request.db.tenantId, id, {
        ...updateData, _userId: (request as any).auth?.userId ?? null,
      });
      if ('error' in result) {
        return reply.code(result.status).send({ error: result.error });
      }
      return reply.send({ workOrder: result.workOrder, ejecucion: result.ejecucion ?? null });
    } catch (error) {
      console.error('Error updating work order:', error);
      return reply.code(500).send({ error: 'Error al actualizar la orden de trabajo.' });
    }
  });

  // GET /maintenance/work-orders/:id/parts - Repuestos asignados a la OT
  app.get('/work-orders/:id/parts', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }
    const { id } = request.params as { id: string };
    const parts = await (getPrisma(request) as any).workOrderSparePart.findMany({
      where: { workOrderId: id, tenantId: request.db.tenantId },
      include: { sparePart: { select: { id: true, code: true, name: true, currentStock: true, unitCost: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send({ parts });
  });

  // POST /maintenance/work-orders/:id/parts - Asignar repuesto a la OT
  app.post('/work-orders/:id/parts', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }
    const { id } = request.params as { id: string };
    const schema = z.object({
      sparePartId: z.string().uuid(),
      quantity: z.number().int().positive().default(1),
      // TALLER = el repuesto lo aporta el taller externo (informativo, no descuenta stock)
      origen: z.enum(['PROPIO', 'TALLER']).default('PROPIO'),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Datos inválidos' });

    const ot = await getPrisma(request).workOrder.findFirst({ where: { id, tenantId: request.db.tenantId } });
    if (!ot) return reply.code(404).send({ error: 'Orden de trabajo no encontrada' });
    if (ot.status === 'COMPLETED' || ot.status === 'CANCELLED') {
      return reply.code(400).send({ error: 'No se pueden asignar repuestos a una OT cerrada' });
    }

    const part = await getPrisma(request).maintenanceSparePart.findFirst({
      where: { id: parsed.data.sparePartId, tenantId: request.db.tenantId },
    });
    if (!part) return reply.code(404).send({ error: 'Repuesto no encontrado' });

    // Si ya está asignado, sumar cantidad
    const existing = await (getPrisma(request) as any).workOrderSparePart.findFirst({
      where: { workOrderId: id, sparePartId: part.id, tenantId: request.db.tenantId },
    });
    if (existing) {
      const updated = await (getPrisma(request) as any).workOrderSparePart.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + parsed.data.quantity },
      });
      return reply.send({ part: updated });
    }

    const entry = await (getPrisma(request) as any).workOrderSparePart.create({
      data: {
        tenantId: request.db.tenantId,
        workOrderId: id,
        sparePartId: part.id,
        quantity: parsed.data.quantity,
        unitCost: parsed.data.origen === 'TALLER' ? 0 : part.unitCost,
        origen: parsed.data.origen,
      },
    });
    return reply.code(201).send({ part: entry });
  });

  // DELETE /maintenance/work-orders/:id/parts/:entryId - Quitar repuesto de la OT
  app.delete('/work-orders/:id/parts/:entryId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }
    const { entryId } = request.params as { entryId: string };
    const entry = await (getPrisma(request) as any).workOrderSparePart.findFirst({
      where: { id: entryId, tenantId: request.db.tenantId },
    });
    if (!entry) return reply.code(404).send({ error: 'Repuesto no encontrado en la OT' });
    if (entry.stockDeducted) {
      return reply.code(400).send({ error: 'El stock ya fue descontado, no se puede quitar' });
    }
    await (getPrisma(request) as any).workOrderSparePart.delete({ where: { id: entryId } });
    return reply.send({ ok: true });
  });

  // DELETE /maintenance/work-orders/:id
  app.delete('/work-orders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { id } = request.params as { id: string };
    
    try {
      await getPrisma(request).workOrder.delete({
        where: { id, tenantId: request.db.tenantId }
      });
      return reply.send({ message: 'Work order deleted' });
    } catch (error) {
      console.error('Error deleting work order:', error);
      return reply.code(500).send({ error: 'Error al eliminar la orden de trabajo.' });
    }
  });

  // GET /maintenance/technicians - Listar técnicos
  // ?scope=infra (default) → técnicos de Infraestructura | ?scope=fleet → mecánicos de Flota 360
  // ?scope=all → todos
  app.get('/technicians', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { scope } = request.query as any;
    const where: any = { tenantId: request.db.tenantId };
    if (scope === 'fleet') where.scope = 'FLEET';
    else if (scope !== 'all') where.scope = 'INFRA';

    const technicians = await getPrisma(request).maintenanceTechnician.findMany({
      where,
      orderBy: { name: 'asc' }
    });
    return reply.send({ technicians });
  });

  // GET /maintenance/technicians/ranking?scope=fleet&days=30 - Ranking de desempeño
  // Métricas por técnico: cumplimiento, puntualidad vs fecha programada, tiempos y costos.
  app.get('/technicians/ranking', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { scope, days } = request.query as any;
    const dias = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    desde.setHours(0, 0, 0, 0);
    const ahora = new Date();

    const whereTec: any = { tenantId: request.db.tenantId, isActive: true };
    if (scope === 'fleet') whereTec.scope = 'FLEET';
    else if (scope !== 'all') whereTec.scope = 'INFRA';

    const tecnicos = await getPrisma(request).maintenanceTechnician.findMany({
      where: whereTec,
      select: { id: true, name: true, code: true, specialization: true },
    });
    if (tecnicos.length === 0) return reply.send({ dias, ranking: [] });

    // OTs relevantes: creadas o completadas en el período, o actualmente abiertas
    const ordenes = await getPrisma(request).workOrder.findMany({
      where: {
        tenantId: request.db.tenantId,
        technicianId: { in: tecnicos.map((t: any) => t.id) },
        status: { not: 'CANCELLED' },
        OR: [
          { createdAt: { gte: desde } },
          { completedAt: { gte: desde } },
          { status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] } },
        ],
      },
      select: {
        technicianId: true, status: true, createdAt: true, scheduledDate: true,
        startedAt: true, completedAt: true, estimatedDuration: true, actualDuration: true,
        totalCost: true, partsCost: true,
      },
    });

    const ranking = tecnicos.map((t: any) => {
      const ots = ordenes.filter((o: any) => o.technicianId === t.id);
      const completadas = ots.filter((o: any) => o.status === 'COMPLETED' && o.completedAt && new Date(o.completedAt) >= desde);
      const abiertas = ots.filter((o: any) => ['PENDING', 'IN_PROGRESS', 'ON_HOLD'].includes(o.status));
      const vencidas = abiertas.filter((o: any) => o.scheduledDate && new Date(o.scheduledDate) < ahora);

      // Puntualidad: completada antes del fin del día programado
      const conFecha = completadas.filter((o: any) => o.scheduledDate);
      const aTiempo = conFecha.filter((o: any) => {
        const limite = new Date(o.scheduledDate);
        limite.setHours(23, 59, 59, 999);
        return new Date(o.completedAt) <= limite;
      });

      // Tiempos (horas): resolución = creación→cierre | ejecución = inicio→cierre
      const resHs = completadas.map((o: any) => (new Date(o.completedAt).getTime() - new Date(o.createdAt).getTime()) / 3600000);
      const ejecHs = completadas
        .filter((o: any) => o.startedAt)
        .map((o: any) => (new Date(o.completedAt).getTime() - new Date(o.startedAt).getTime()) / 3600000);
      const prom = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);

      const totalCerrables = completadas.length + abiertas.length;
      const tasaCumplimiento = totalCerrables > 0 ? Math.round((completadas.length / totalCerrables) * 100) : 0;
      const tasaATiempo = conFecha.length > 0
        ? Math.round((aTiempo.length / conFecha.length) * 100)
        : (totalCerrables > 0 ? tasaCumplimiento : 0);
      const score = Math.round(tasaCumplimiento * 0.6 + tasaATiempo * 0.4);

      return {
        technicianId: t.id,
        nombre: t.name,
        code: t.code,
        specialization: t.specialization,
        completadas: completadas.length,
        enCurso: abiertas.filter((o: any) => o.status === 'IN_PROGRESS').length,
        pendientes: abiertas.filter((o: any) => o.status !== 'IN_PROGRESS').length,
        vencidas: vencidas.length,
        tasaCumplimiento,
        tasaATiempo,
        promedioResolucionHs: prom(resHs),
        promedioEjecucionHs: prom(ejecHs),
        costoTotal: Math.round(completadas.reduce((s: number, o: any) => s + (o.totalCost || 0), 0)),
        costoRepuestos: Math.round(completadas.reduce((s: number, o: any) => s + (o.partsCost || 0), 0)),
        score,
      };
    }).sort((a: any, b: any) => b.score - a.score || b.completadas - a.completadas);

    return reply.send({ dias, ranking: ranking.map((r: any, i: number) => ({ posicion: i + 1, ...r })) });
  });

  // POST /maintenance/technicians - Crear técnico
  app.post('/technicians', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    try {
      const body = request.body as any;
      
      const validatedData = createTechnicianSchema.parse(body);
      
      // Generate code if not provided
      const code = validatedData.code || `TEC-${Date.now().toString().slice(-6)}`;
      
      const technician = await getPrisma(request).maintenanceTechnician.create({
        data: {
          code,
          name: validatedData.name,
          email: validatedData.email || null,
          phone: validatedData.phone,
          specialization: validatedData.specialization,
          certification: validatedData.certification,
          scope: validatedData.scope || 'INFRA',
          tenantId: request.db.tenantId
        }
      });

      return reply.code(201).send({ technician });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validación fallida', details: error.errors });
      }
      console.error('Error creating technician:', error?.message || error);
      return reply.code(500).send({ error: 'Error interno del servidor', message: error?.message });
    }
  });

  // PUT /maintenance/technicians/:id - Actualizar técnico
  app.put('/technicians/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { id } = request.params as { id: string };
    const updateData = request.body as any;
    
    try {
      const technician = await getPrisma(request).maintenanceTechnician.update({
        where: { id, tenantId: request.db.tenantId },
        data: updateData
      });

      return reply.send({ technician });
    } catch (error) {
      console.error('Error updating technician:', error);
      return reply.code(500).send({ error: 'Error al actualizar el técnico.' });
    }
  });

  // DELETE /maintenance/technicians/:id
  app.delete('/technicians/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { id } = request.params as { id: string };
    
    try {
      await getPrisma(request).maintenanceTechnician.delete({
        where: { id, tenantId: request.db.tenantId }
      });
      return reply.send({ message: 'Technician deleted' });
    } catch (error) {
      console.error('Error deleting technician:', error);
      return reply.code(500).send({ error: 'Error al eliminar el técnico.' });
    }
  });

  // GET /maintenance/spare-parts - Listar repuestos
  app.get('/spare-parts', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { category, lowStock } = request.query as any;
    
    const where: any = { tenantId: request.db.tenantId };
    if (category) where.category = category;
    if (lowStock === 'true') {
      where.currentStock = { lte: getPrisma(request).maintenanceSparePart.fields.minStock };
    }

    const parts = await getPrisma(request).maintenanceSparePart.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    return reply.send({ parts });
  });

  // POST /maintenance/spare-parts - Crear repuesto
  app.post('/spare-parts', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    try {
      const body = request.body as any;
      
      const validatedData = createSparePartSchema.parse(body);
      
      // Generate code if not provided
      const code = validatedData.code || `REP-${Date.now().toString().slice(-6)}`;
      
      const part = await getPrisma(request).maintenanceSparePart.create({
        data: {
          code,
          name: validatedData.name,
          description: validatedData.description,
          category: validatedData.category,
          currentStock: validatedData.currentStock,
          minStock: validatedData.minStock,
          maxStock: validatedData.maxStock,
          unitCost: validatedData.unitCost,
          supplier: validatedData.supplier,
          supplierCode: validatedData.supplierCode,
          location: validatedData.location,
          tenantId: request.db.tenantId
        }
      });

      return reply.code(201).send({ part });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validación fallida', details: error.errors });
      }
      console.error('Error creating spare part:', error?.message || error);
      return reply.code(500).send({ error: 'Error interno del servidor', message: error?.message });
    }
  });

  // PUT /maintenance/spare-parts/:id - Actualizar repuesto
  app.put('/spare-parts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { id } = request.params as { id: string };
    const updateData = request.body as any;
    
    try {
      const part = await getPrisma(request).maintenanceSparePart.update({
        where: { id, tenantId: request.db.tenantId },
        data: updateData
      });

      return reply.send({ part });
    } catch (error) {
      console.error('Error updating spare part:', error);
      return reply.code(500).send({ error: 'Error al actualizar el repuesto.' });
    }
  });

  // DELETE /maintenance/spare-parts/:id
  app.delete('/spare-parts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { id } = request.params as { id: string };
    
    try {
      await getPrisma(request).maintenanceSparePart.delete({
        where: { id, tenantId: request.db.tenantId }
      });
      return reply.send({ message: 'Spare part deleted' });
    } catch (error) {
      console.error('Error deleting spare part:', error);
      return reply.code(500).send({ error: 'Error al eliminar el repuesto.' });
    }
  });

  // GET /maintenance/plans - Listar planes de mantenimiento
  app.get('/plans', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const plans = await getPrisma(request).maintenancePlan.findMany({
      where: { tenantId: request.db.tenantId },
      include: { asset: true },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ plans });
  });

  // POST /maintenance/plans - Crear plan de mantenimiento
  app.post('/plans', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    try {
      const body = request.body as any;
      console.log('🔧 Creating plan, body:', body);
      
      const validatedData = createPlanSchema.parse(body);
      console.log('✅ Plan validated:', validatedData);

      // Generate code if not provided
      const code = validatedData.code || `PLAN-${Date.now().toString().slice(-6)}`;

      const plan = await getPrisma(request).maintenancePlan.create({
        data: {
          code,
          title: validatedData.title,
          description: validatedData.description,
          type: validatedData.type,
          status: validatedData.status,
          assetId: validatedData.assetId,
          frequencyValue: validatedData.frequencyValue,
          frequencyUnit: validatedData.frequencyUnit,
          triggerKm: validatedData.triggerKm ?? null,
          frecuenciaDias: validatedData.frecuenciaDias ?? null,
          componentKey: validatedData.componentKey ?? null,
          ...(validatedData.intervaloModo ? { intervaloModo: validatedData.intervaloModo } : {}),
          nextExecutionDate: validatedData.nextExecutionDate ? new Date(validatedData.nextExecutionDate) : null,
          tenantId: request.db.tenantId
        },
        include: { asset: true }
      });

      console.log('✅ Plan created:', plan.id);
      return reply.code(201).send({ plan });
    } catch (error: any) {
      console.error('❌ Error creating plan:', error?.message || String(error));
      if (error instanceof z.ZodError) {
        console.error('Zod validation errors:', JSON.stringify(error.errors));
        return reply.code(400).send({ error: 'Validación fallida', details: error.errors });
      }
      return reply.code(500).send({ error: 'Error interno del servidor', message: error?.message || 'Unknown error' });
    }
  });

  // POST /maintenance/plans/:id/execute - Ejecutar plan
  app.post('/plans/:id/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { id } = request.params as { id: string };

    try {
      const plan = await getPrisma(request).maintenancePlan.findFirst({
        where: { id, tenantId: request.db.tenantId }
      });

      if (!plan) {
        return reply.code(404).send({ error: 'Plan no encontrado' });
      }

      const body = (request.body ?? {}) as any;
      const executedAt = body.executedAt ? new Date(body.executedAt) : new Date();
      if (Number.isNaN(executedAt.getTime())) {
        return reply.code(400).send({ error: 'executedAt inválida' });
      }
      const odometro = body.odometro != null ? Number(body.odometro) : null;

      // Idempotencia: la clave puede venir del cliente (executionKey) o se
      // genera por plan+fecha; un retry con la misma clave no duplica el avance.
      const sourceKey = body.executionKey ? `dir:${body.executionKey}` : `dir:${id}:${executedAt.toISOString().slice(0, 16)}`;

      const prisma = getPrisma(request);
      const tenantId = request.db.tenantId;
      const resultado = await prisma.$transaction(async (tx: any) =>
        registrarEjecucionPlan(tx, {
          tenantId, planId: id, executedAt, odometro,
          sourceKey, registradoPor: (request as any).auth?.userId ?? null,
          notes: body.notes ?? null,
        })
      );

      if (resultado.status === 'SIN_PLAN') {
        return reply.code(404).send({ error: resultado.motivo });
      }
      if (resultado.status === 'PENDIENTE_KM') {
        return reply.code(400).send({ error: resultado.motivo, requiereOdometro: true });
      }
      if (resultado.status === 'DUPLICADA') {
        return reply.send({ plan: resultado.plan, duplicada: true });
      }
      return reply.send({ plan: resultado.plan, referenciaAplicada: resultado.referenciaAplicada });
    } catch (error) {
      console.error('Error executing plan:', error);
      return reply.code(500).send({ error: 'Error al ejecutar el plan de mantenimiento.' });
    }
  });

  // POST /maintenance/plans/:id/create-work-order - Generar OT planificada desde un plan
  app.post('/plans/:id/create-work-order', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }
    const { id } = request.params as { id: string };

    try {
      const plan = await getPrisma(request).maintenancePlan.findFirst({
        where: { id, tenantId: request.db.tenantId },
        include: { asset: true },
      });
      if (!plan) return reply.code(404).send({ error: 'Plan no encontrado' });
      if (!plan.assetId) return reply.code(400).send({ error: 'El plan no tiene un activo asignado' });

      const code = `OT-${Date.now().toString().slice(-6)}`;
      const scheduledDate = plan.nextExecutionDate ? new Date(plan.nextExecutionDate) : new Date();

      const workOrder = await getPrisma(request).workOrder.create({
        data: {
          code,
          title: plan.title,
          description: plan.description || `Generada automáticamente desde el plan ${plan.code}`,
          type: plan.type || 'PREVENTIVE',
          priority: 'MEDIUM',
          status: 'PENDING',
          assetId: plan.assetId,
          planId: plan.id,
          scheduledDate,
          tenantId: request.db.tenantId,
        },
        include: { asset: true, technician: true },
      });

      // Materializar la tarea preventiva: el cierre avanza solo esta tarea.
      await getPrisma(request).workOrderTask.create({
        data: { tenantId: request.db.tenantId, workOrderId: workOrder.id, planId: plan.id, status: 'PENDING' },
      }).catch((e: any) => { if (e?.code !== 'P2002') throw e; });

      return reply.code(201).send({ workOrder });
    } catch (error: any) {
      console.error('Error creando OT desde plan:', error);
      return reply.code(500).send({ error: 'Error al generar la orden de trabajo desde el plan.' });
    }
  });

  // PUT /maintenance/plans/:id - Actualizar plan
  app.put('/plans/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { id } = request.params as { id: string };
    const updateData = request.body as any;
    
    try {
      const plan = await getPrisma(request).maintenancePlan.update({
        where: { id, tenantId: request.db.tenantId },
        data: {
          ...updateData,
          nextExecutionDate: updateData.nextExecutionDate ? new Date(updateData.nextExecutionDate) : undefined
        },
        include: { asset: true }
      });

      return reply.send({ plan });
    } catch (error) {
      console.error('Error updating plan:', error);
      return reply.code(500).send({ error: 'Error al actualizar el plan de mantenimiento.' });
    }
  });

  // DELETE /maintenance/plans/:id
  app.delete('/plans/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { id } = request.params as { id: string };
    
    try {
      await getPrisma(request).maintenancePlan.delete({
        where: { id, tenantId: request.db.tenantId }
      });
      return reply.send({ message: 'Plan deleted' });
    } catch (error) {
      console.error('Error deleting plan:', error);
      return reply.code(500).send({ error: 'Error al eliminar el plan de mantenimiento.' });
    }
  });

  // GET /maintenance/assets - Listar activos/equipos
  app.get('/assets', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { status, category } = request.query as any;
    
    const where: any = { tenantId: request.db.tenantId };
    if (status) where.status = status;
    if (category) where.category = category;

    console.log('🔧 GET /assets - where:', where);

    const assets = await getPrisma(request).maintenanceAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { inspeccionQRs: true, workOrders: true } },
        inspeccionQRs: { select: { lastUsedAt: true }, orderBy: { lastUsedAt: 'desc' }, take: 1 },
      },
    });

    console.log('🔧 GET /assets - found:', assets.length, 'assets');

    return reply.send({ assets });
  });

  // POST /maintenance/assets - Crear activo/equipo
  app.post('/assets', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    try {
      const body = request.body as any;
      
      const validatedData = createAssetSchema.parse(body);
      
      // Generate code if not provided
      const code = validatedData.code || `ACT-${Date.now().toString().slice(-6)}`;
      
      const asset = await getPrisma(request).maintenanceAsset.create({
        data: {
          code,
          name: validatedData.name,
          description: validatedData.description,
          category: validatedData.category,
          location: validatedData.location,
          department: validatedData.department,
          manufacturer: validatedData.manufacturer,
          model: validatedData.model,
          serialNumber: validatedData.serialNumber,
          purchaseDate: validatedData.purchaseDate ? new Date(validatedData.purchaseDate) : null,
          warrantyDate: validatedData.warrantyDate ? new Date(validatedData.warrantyDate) : null,
          acquisitionCost: validatedData.acquisitionCost,
          tenantId: request.db.tenantId
        }
      });

      return reply.code(201).send({ asset });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validación fallida', details: error.errors });
      }
      console.error('Error creating asset:', error?.message || error);
      return reply.code(500).send({ error: 'Error interno del servidor', message: error?.message });
    }
  });

  // PUT /maintenance/assets/:id - Actualizar activo
  app.put('/assets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { id } = request.params as { id: string };
    const updateData = request.body as any;
    
    try {
      const asset = await getPrisma(request).maintenanceAsset.update({
        where: { id, tenantId: request.db.tenantId },
        data: {
          ...updateData,
          purchaseDate: updateData.purchaseDate ? new Date(updateData.purchaseDate) : undefined,
          warrantyDate: updateData.warrantyDate ? new Date(updateData.warrantyDate) : undefined,
          lastMaintenanceDate: updateData.lastMaintenanceDate ? new Date(updateData.lastMaintenanceDate) : undefined,
          nextMaintenanceDate: updateData.nextMaintenanceDate ? new Date(updateData.nextMaintenanceDate) : undefined
        }
      });

      return reply.send({ asset });
    } catch (error) {
      console.error('Error updating asset:', error);
      return reply.code(500).send({ error: 'Error al actualizar el activo.' });
    }
  });

  // DELETE /maintenance/assets/:id
  app.delete('/assets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { id } = request.params as { id: string };
    
    try {
      await getPrisma(request).maintenanceAsset.delete({
        where: { id, tenantId: request.db.tenantId }
      });
      return reply.send({ message: 'Asset deleted' });
    } catch (error) {
      console.error('Error deleting asset:', error);
      return reply.code(500).send({ error: 'Error al eliminar el activo.' });
    }
  });

  // POST /maintenance/assets/:id/maintenance-cost - Agregar costo de mantenimiento
  app.post('/assets/:id/maintenance-cost', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { id } = request.params as { id: string };
    const { costType, amount, description, date, workOrderId } = request.body as any;

    try {
      const cost = await getPrisma(request).maintenanceCost.create({
        data: {
          costType,
          amount,
          description,
          date: date ? new Date(date) : new Date(),
          assetId: id,
          workOrderId,
          tenantId: request.db.tenantId
        }
      });

      // Update asset total maintenance cost
      await getPrisma(request).maintenanceAsset.update({
        where: { id },
        data: {
          totalMaintenanceCost: { increment: amount }
        }
      });

      return reply.code(201).send({ cost });
    } catch (error) {
      console.error('Error adding maintenance cost:', error);
      return reply.code(500).send({ error: 'Error al registrar el costo de mantenimiento.' });
    }
  });

  // GET /maintenance/assets/:id/maintenance-costs - Obtener historial de costos
  app.get('/assets/:id/maintenance-costs', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const { id } = request.params as { id: string };

    const costs = await getPrisma(request).maintenanceCost.findMany({
      where: { assetId: id, tenantId: request.db.tenantId },
      orderBy: { date: 'desc' }
    });

    // Get asset total cost
    const asset = await getPrisma(request).maintenanceAsset.findUnique({
      where: { id, tenantId: request.db.tenantId },
      select: { totalMaintenanceCost: true }
    });

    return reply.send({ 
      costs,
      totalMaintenanceCost: asset?.totalMaintenanceCost || 0
    });
  });

  // GET /maintenance/assets/:id/historial - Hoja de vida del activo (inspecciones + OTs)
  app.get('/assets/:id/historial', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = request.params as { id: string };
    const tenantId = request.db.tenantId;

    const [asset, workOrders, qrs] = await Promise.all([
      getPrisma(request).maintenanceAsset.findFirst({
        where: { id, tenantId },
        include: { plans: { orderBy: { createdAt: 'desc' }, take: 5 } },
      }),
      getPrisma(request).workOrder.findMany({
        where: { assetId: id, tenantId },
        orderBy: { createdAt: 'desc' },
        include: { technician: { select: { name: true } } },
      }),
      (getPrisma(request) as any).inspeccionQR.findMany({
        where: { maintenanceAssetId: id, tenantId },
        select: { id: true, activoNombre: true, activoCodigo: true, token: true,
          inspecciones: { orderBy: { createdAt: 'desc' }, take: 20,
            select: { id: true, estado: true, puntaje: true, inspectorNombre: true, hallazgosCount: true, createdAt: true, notas: true } } },
      }),
    ]);

    if (!asset) return reply.code(404).send({ error: 'Activo no encontrado' });

    const inspecciones = qrs.flatMap((q: any) => q.inspecciones.map((i: any) => ({ ...i, qrActivoNombre: q.activoNombre })));
    inspecciones.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return reply.send({ asset, workOrders, inspecciones, qrs });
  });

  // GET /maintenance/stats - Estadísticas
  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const tenantId = request.db.tenantId;

    // Las OTs de flota no cuentan en las stats de infraestructura
    const vehAssetIds = await getFleetAssetIds(request);
    const noFlota = { NOT: fleetWhere(vehAssetIds) };

    const [
      totalAssets,
      activeAssets,
      totalWorkOrders,
      pendingOrders,
      inProgressOrders,
      completedOrders,
      overdueOrders,
      totalTechnicians,
      activeTechnicians,
      totalParts,
      lowStockParts,
      totalPlans,
      activePlans
    ] = await Promise.all([
      getPrisma(request).maintenanceAsset.count({ where: { tenantId } }),
      getPrisma(request).maintenanceAsset.count({ where: { tenantId, status: 'ACTIVE' } }),
      getPrisma(request).workOrder.count({ where: { tenantId, ...noFlota } }),
      getPrisma(request).workOrder.count({ where: { tenantId, status: 'PENDING', ...noFlota } }),
      getPrisma(request).workOrder.count({ where: { tenantId, status: 'IN_PROGRESS', ...noFlota } }),
      getPrisma(request).workOrder.count({ where: { tenantId, status: 'COMPLETED', ...noFlota } }),
      getPrisma(request).workOrder.count({ where: { tenantId, status: 'PENDING', scheduledDate: { lt: new Date() }, ...noFlota } }),
      getPrisma(request).maintenanceTechnician.count({ where: { tenantId } }),
      getPrisma(request).maintenanceTechnician.count({ where: { tenantId, isActive: true } }),
      getPrisma(request).maintenanceSparePart.count({ where: { tenantId } }),
      getPrisma(request).maintenanceSparePart.count({ 
        where: { 
          tenantId, 
          AND: [
            { currentStock: { gt: 0 } },
            { currentStock: { lte: getPrisma(request).maintenanceSparePart.fields.minStock } }
          ]
        } 
      }),
      getPrisma(request).maintenancePlan.count({ where: { tenantId } }),
      getPrisma(request).maintenancePlan.count({ where: { tenantId, status: 'ACTIVE' } })
    ]);

    // Calculate total costs
    const costs = await getPrisma(request).maintenanceCost.aggregate({
      where: { tenantId },
      _sum: { amount: true }
    });

    return reply.send({
      stats: {
        totalAssets,
        activeAssets,
        totalWorkOrders,
        pendingOrders,
        inProgressOrders,
        completedOrders,
        overdueOrders,
        totalTechnicians,
        activeTechnicians,
        totalParts,
        lowStockParts,
        totalPlans,
        activePlans,
        totalMaintenanceCost: costs._sum.amount || 0
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CALENDARIO DE MANTENIMIENTO — Vista Gantt
  // ═══════════════════════════════════════════════════════════════
  app.get('/calendar', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }
    const tenantId = request.db.tenantId;
    const { desde, hasta, assetId } = request.query as any;

    const fechaDesde = desde ? new Date(desde) : new Date();
    fechaDesde.setDate(fechaDesde.getDate() - 7); // Una semana atrás por defecto
    const fechaHasta = hasta ? new Date(hasta) : new Date();
    fechaHasta.setDate(fechaHasta.getDate() + 30); // 30 días adelante por defecto

    const whereBase: any = { tenantId };
    if (assetId) whereBase.assetId = assetId;

    // El calendario de infraestructura no muestra OTs de flota
    const vehAssetIds = await getFleetAssetIds(request);
    const noFlota = { NOT: fleetWhere(vehAssetIds) };

    // Obtener órdenes de trabajo en el período
    const workOrders = await getPrisma(request).workOrder.findMany({
      where: {
        ...whereBase,
        ...noFlota,
        OR: [
          { scheduledDate: { gte: fechaDesde, lte: fechaHasta } },
          { completedDate: { gte: fechaDesde, lte: fechaHasta } },
          { status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] } },
        ],
      },
      include: { asset: { select: { name: true, code: true } }, technician: { select: { name: true } } },
      orderBy: { scheduledDate: 'asc' },
    });

    // Obtener planes de mantenimiento con próxima ejecución
    const planes = await getPrisma(request).maintenancePlan.findMany({
      where: {
        ...whereBase,
        status: 'ACTIVE',
        OR: [
          { nextExecutionDate: { gte: fechaDesde, lte: fechaHasta } },
          { nextExecutionDate: { lt: new Date() } }, // Vencidos
        ],
      },
      include: { asset: { select: { name: true, code: true } } },
    });

    // Formatear para vista Gantt
    const eventosOT = (workOrders as any[]).map(ot => ({
      id: ot.id,
      tipo: 'WORK_ORDER',
      titulo: ot.title,
      assetId: ot.assetId,
      assetNombre: ot.asset?.name || ot.activoNombreLibre || 'Sin activo',
      assetCode: ot.asset?.code || '',
      tecnico: ot.technician?.name || 'Sin asignar',
      inicio: ot.scheduledDate,
      fin: ot.completedDate || ot.scheduledDate,
      estado: ot.status,
      prioridad: ot.priority,
      tipoMantenimiento: ot.type,
      costo: ot.totalCost,
      color: ot.status === 'COMPLETED' ? '#22c55e' : ot.status === 'IN_PROGRESS' ? '#3b82f6' : ot.priority === 'CRITICAL' ? '#ef4444' : '#f59e0b',
    }));

    const eventosPlan = (planes as any[]).map(plan => ({
      id: plan.id,
      tipo: 'PLAN',
      titulo: plan.title,
      assetId: plan.assetId,
      assetNombre: plan.asset?.name || 'Sin activo',
      assetCode: plan.asset?.code || '',
      inicio: plan.nextExecutionDate || new Date(),
      fin: plan.nextExecutionDate ? new Date(new Date(plan.nextExecutionDate).getTime() + 24 * 60 * 60 * 1000) : new Date(),
      estado: plan.nextExecutionDate && new Date(plan.nextExecutionDate) < new Date() ? 'VENCIDO' : 'PENDIENTE',
      prioridad: 'MEDIUM',
      tipoMantenimiento: plan.type,
      frecuencia: `${plan.frequencyValue} ${plan.frequencyUnit}`,
      color: plan.nextExecutionDate && new Date(plan.nextExecutionDate) < new Date() ? '#ef4444' : '#8b5cf6',
    }));

    // Agrupar por activo para vista Gantt
    const activosMap = new Map();
    [...eventosOT, ...eventosPlan].forEach(evt => {
      if (!activosMap.has(evt.assetId)) {
        activosMap.set(evt.assetId, {
          assetId: evt.assetId,
          assetNombre: evt.assetNombre,
          assetCode: evt.assetCode,
          eventos: [],
        });
      }
      activosMap.get(evt.assetId).eventos.push(evt);
    });

    return reply.send({
      periodo: { desde: fechaDesde, hasta: fechaHasta },
      totalEventos: eventosOT.length + eventosPlan.length,
      eventos: [...eventosOT, ...eventosPlan].sort((a: any, b: any) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime()),
      porActivo: Array.from(activosMap.values()),
      resumen: {
        otsPendientes: eventosOT.filter((e: any) => e.estado === 'PENDING').length,
        otsEnProgreso: eventosOT.filter((e: any) => e.estado === 'IN_PROGRESS').length,
        otsCompletadas: eventosOT.filter((e: any) => e.estado === 'COMPLETED').length,
        planesVencidos: eventosPlan.filter((e: any) => e.estado === 'VENCIDO').length,
        planesPendientes: eventosPlan.filter((e: any) => e.estado === 'PENDIENTE').length,
      },
    });
  });
}

// Función auxiliar: aplica una actualización de OT (incluye el ciclo de completado: descuento de
// stock, avance de plan preventivo, actualización del vehículo y auto-estado). Usada tanto por el
// endpoint autenticado PUT /work-orders/:id como por el flujo público del QR del mecánico.
export async function applyWorkOrderUpdate(prisma: any, tenantId: string, id: string, updateData: any): Promise<{ workOrder: any; ejecucion?: any } | { error: string; status: number }> {
  // Obtener orden actual para verificar cambio de estado
  const ordenActual = await prisma.workOrder.findFirst({
    where: { id, tenantId },
    include: { asset: true }
  });

  if (!ordenActual) {
    return { error: 'Orden de trabajo no encontrada', status: 404 };
  }

  const seCompletaAhora = ordenActual.status !== 'COMPLETED' && updateData.status === 'COMPLETED';
  const laborCost = updateData.laborCost ?? ordenActual.laborCost ?? 0;
  const partsCost = updateData.partsCost ?? ordenActual.partsCost ?? 0;

  // Solo columnas reales de WorkOrder — claves auxiliares como finalOdometer/odometro/repuestos
  // se usan más abajo para los efectos colaterales (flota, planes) pero no son campos del modelo.
  const WORK_ORDER_FIELDS = [
    'title', 'description', 'type', 'priority', 'status', 'assetId', 'planId', 'technicianId',
    'scheduledDate', 'startedAt', 'executedAt', 'estimatedDuration', 'actualDuration', 'laborCost', 'partsCost',
    'activoNombreLibre', 'origen', 'origenId',
    // Ejecución externa (el flujo dedicado /flota/ots/:id/* valida taller activo y trazabilidad;
    // acá se admiten también por compatibilidad con ediciones genéricas de la OT)
    'ejecutorTipo', 'tallerId', 'responsableSeguimientoId', 'responsableSeguimientoNombre',
    'fechaEntregaEstimada', 'trabajoSolicitado', 'trabajoRealizado', 'referenciaExterna',
    'observacionesExternas', 'sinCargo',
    // La OT retira la unidad del servicio al iniciarse (o ya la retiró si
    // nació directamente en proceso). Programada ≠ retirada.
    'retiraDeServicio',
  ];
  const dataUpdate: any = {};
  for (const key of WORK_ORDER_FIELDS) {
    if (updateData[key] !== undefined) dataUpdate[key] = updateData[key];
  }

  // Al completar: si nunca se marcó inicio, usar la creación como referencia y
  // persistir la duración real (horas) para métricas de desempeño del técnico.
  if (seCompletaAhora) {
    const inicioEfectivo = dataUpdate.startedAt ?? ordenActual.startedAt ?? ordenActual.createdAt;
    if (dataUpdate.startedAt === undefined && !ordenActual.startedAt) {
      dataUpdate.startedAt = inicioEfectivo;
    }
    if (updateData.actualDuration === undefined && inicioEfectivo) {
      dataUpdate.actualDuration = Math.max(0, Math.round((Date.now() - new Date(inicioEfectivo).getTime()) / 3600000));
    }
  }

  const workOrder = await prisma.workOrder.update({
    where: { id, tenantId },
    data: {
      ...dataUpdate,
      scheduledDate: updateData.scheduledDate ? new Date(updateData.scheduledDate) : undefined,
      // executedAt: fecha real de ejecución; si no se informa, la fecha de cierre
      // (completedAt) la provee — distinta de la fecha de carga histórica.
      executedAt: updateData.executedAt ? new Date(updateData.executedAt)
        : (seCompletaAhora && !ordenActual.executedAt ? (updateData.completedDate ? new Date(updateData.completedDate) : new Date()) : undefined),
      completedAt: seCompletaAhora ? new Date() : (updateData.completedDate ? new Date(updateData.completedDate) : undefined),
      // totalCost = mano de obra + repuestos propios + costo externo (facturas del taller)
      totalCost: laborCost + partsCost + (ordenActual.costoExterno || 0)
    },
    include: { asset: true, technician: true, taller: { select: { id: true, nombre: true, tipo: true } } }
  });

  // Si se reasignó a un técnico distinto (o se asignó por primera vez), notificarle
  const seReasigno = updateData.technicianId && updateData.technicianId !== ordenActual.technicianId;
  if (seReasigno && workOrder.technician?.email) {
    notifyWorkOrderAssigned(prisma, {
      tenantId,
      technicianEmail: workOrder.technician.email,
      technicianName: workOrder.technician.name,
      otCode: workOrder.code,
      otTitle: workOrder.title,
      otId: workOrder.id,
      assetName: workOrder.asset?.name,
      priority: workOrder.priority,
      scheduledDate: workOrder.scheduledDate,
    }).catch((e: any) => console.error('[maintenance] notifyWorkOrderAssigned error:', e));
  }

  // ═══════════════════════════════════════════════════════════════
  // INTEGRACIÓN OT ↔ FLOTA — cierre unificado y transaccional
  // ═══════════════════════════════════════════════════════════════
  const seCompleto = ordenActual.status !== 'COMPLETED' && updateData.status === 'COMPLETED';
  let resumenEjecucion: any = null;

  if (seCompleto) {
    const odometroOt = updateData.finalOdometer ?? updateData.odometro ?? null;
    const fechaEjecucion = workOrder.executedAt ?? workOrder.completedAt ?? new Date();
    const userId = updateData._userId ?? null;

    await prisma.$transaction(async (tx: any) => {
      // Stock de repuestos (idempotente por renglón: stockDeducted).
      // Solo PROPIO descuenta inventario; origen TALLER es informativo (lo aporta el taller).
      const repuestos = await tx.workOrderSparePart.findMany({
        where: { workOrderId: id, tenantId, stockDeducted: false, OR: [{ origen: 'PROPIO' }, { origen: null }] },
      });
      let partsCostTotal = 0;
      for (const r of repuestos) {
        await tx.maintenanceSparePart.update({
          where: { id: r.sparePartId },
          data: { currentStock: { decrement: r.quantity } },
        });
        await tx.workOrderSparePart.update({ where: { id: r.id }, data: { stockDeducted: true } });
        partsCostTotal += r.quantity * r.unitCost;
      }
      if (partsCostTotal > 0) {
        const nuevoPartsCost = (workOrder.partsCost || 0) + partsCostTotal;
        await tx.workOrder.update({
          where: { id },
          data: { partsCost: nuevoPartsCost, totalCost: (workOrder.laborCost || 0) + nuevoPartsCost + (workOrder.costoExterno || 0) },
        });
      }

      // Tareas preventivas: solo las confirmadas como COMPLETED avanzan su
      // plan; SKIPPED y PENDING no reinician intervalos. Idempotente por
      // sourceKey ot:{workOrderId}|{planId}.
      resumenEjecucion = await aplicarEjecucionesOT(tx, {
        tenantId, workOrder, executedAt: fechaEjecucion,
        odometro: odometroOt, registradoPor: userId,
        tareas: Array.isArray(updateData.tareas) ? updateData.tareas : null,
      });

      // Vehículo: odómetro (nunca reduce lecturas anteriores) + historial único por OT
      if (workOrder.assetId) {
        const vehiculo = await tx.vehiculo.findFirst({
          where: { maintenanceAssetId: workOrder.assetId, tenantId },
        });
        if (vehiculo) {
          if (odometroOt != null) {
            await syncOdometroYDesgaste(tx, tenantId, vehiculo.id, odometroOt);
            await verificarPlanesKmDespuesDeOt(tx, tenantId, vehiculo.id, odometroOt);
          }
          await tx.vehiculoHistorialMantenimiento.upsert({
            where: { workOrderId: workOrder.id },
            update: {
              fecha: fechaEjecucion, tipo: workOrder.type, descripcion: workOrder.title,
              costo: workOrder.totalCost || 0, odometro: odometroOt ?? vehiculo.currentOdometer,
              notas: workOrder.description || '',
            },
            create: {
              tenantId, vehiculoId: vehiculo.id, workOrderId: workOrder.id,
              fecha: fechaEjecucion, tipo: workOrder.type, descripcion: workOrder.title,
              costo: workOrder.totalCost || 0, odometro: odometroOt ?? vehiculo.currentOdometer,
              notas: workOrder.description || '',
            },
          });
        }
      }
    });

    // Recurrencias por componente (fuera de la tx — solo lectura + caso nuevo)
    if (workOrder.assetId) {
      evaluarRecurrenciasDeOT(prisma, tenantId, workOrder.id, workOrder.assetId)
        .catch((e: any) => console.error('[maintenance] evaluarRecurrenciasDeOT error:', e));
    }

    // Casos de defecto: completar la OT marca la REPARACIÓN INFORMADA
    // (no la resolución). La verificación y habilitación son pasos
    // separados con registro propio — la unidad sigue restringida.
    if (updateData.status === 'COMPLETED') {
      marcarReparacionInformadaPorOT(prisma, tenantId, workOrder.id,
        updateData._userId ? `usuario ${updateData._userId.slice(0, 8)}` : null)
        .catch((e: any) => console.error('[maintenance] marcarReparacion error:', e));
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // EPISODIO DE INDISPONIBILIDAD SEGÚN CICLO DE LA OT
  // El episodio (unidadEstadoService) es la única fuente de verdad:
  // estadoOperativo y status quedan derivados. Una OT solo retira la
  // unidad si retiraDeServicio=true (las programadas/no bloqueantes no).
  // ═══════════════════════════════════════════════════════════════
  if (workOrder.assetId && updateData.status && updateData.status !== ordenActual.status) {
    try {
      const veh = await prisma.vehiculo.findFirst({
        where: { maintenanceAssetId: workOrder.assetId, tenantId },
        select: { id: true, status: true },
      });
      if (veh) {
        const otExterna = (workOrder as any).ejecutorTipo === 'EXTERNO';
        if (updateData.status === 'IN_PROGRESS' && workOrder.retiraDeServicio) {
          // Inicio de una OT que retira la unidad: abre/engrosa el episodio.
          // Externa sin ingreso confirmado → pendiente de ingreso; interna →
          // reparación en curso con ingreso implícito (taller propio).
          const etapa = otExterna && !(workOrder as any).fechaIngresoTaller
            ? 'PENDIENTE_INGRESO' : 'REPARACION_EN_CURSO';
          await prisma.$transaction(async (tx: any) => {
            await abrirIndisponibilidad(tx, {
              tenantId, vehiculoId: veh.id, origen: 'OT',
              motivo: `OT ${workOrder.code || workOrder.id} en proceso`,
              etapa, workOrderId: workOrder.id,
              tallerTipo: otExterna ? 'EXTERNO' : 'INTERNO',
              tallerNombre: null,
              fechaIngresoTaller: !otExterna || (workOrder as any).fechaIngresoTaller
                ? (workOrder as any).startedAt ?? new Date() : null,
              fechaDevolucionEstimada: (workOrder as any).fechaEntregaEstimada ?? null,
              responsableNombre: (workOrder as any).responsableSeguimientoNombre ?? null,
            });
            await registrarCambioVehiculo(tx, {
              tenantId, vehiculo: veh, accion: 'CAMBIO_ESTADO', origen: 'AUTOMATICO_OT',
              motivo: `La OT ${workOrder.code || workOrder.id} pasó a "En proceso" y retira la unidad del servicio`,
              cambios: [], actor: { usuarioId: null, usuarioNombre: null },
            });
          });
        } else if (updateData.status === 'COMPLETED' || updateData.status === 'CANCELLED') {
          const estadoOt = updateData.status === 'COMPLETED' ? 'completada' : 'cancelada';
          await prisma.$transaction(async (tx: any) => {
            const res = await evaluarYCerrarIndisponibilidad(tx, {
              tenantId, vehiculoId: veh.id,
              motivo: `La OT ${workOrder.code || workOrder.id} fue ${estadoOt}`,
            });
            await registrarCambioVehiculo(tx, {
              tenantId, vehiculo: veh, accion: 'CAMBIO_ESTADO', origen: 'AUTOMATICO_OT',
              motivo: res.cerrado
                ? `La OT ${workOrder.code || workOrder.id} fue ${estadoOt} — la unidad vuelve a estar disponible`
                : `La OT ${workOrder.code || workOrder.id} fue ${estadoOt} pero la unidad sigue no disponible (${res.motivos.join('; ') || 'otras causas'}): requiere verificación/habilitación`,
              cambios: [], actor: { usuarioId: null, usuarioNombre: null },
            });
          });
        }
      }
    } catch (e: any) { console.error('[maintenance] episodio indisponibilidad error:', e); }
  }

  return { workOrder, ejecucion: resumenEjecucion };
}

// Función auxiliar para verificar planes por KM después de completar una OT.
// Marca vencimiento por km SOLO en planes sin pata de días: nextExecutionDate
// ahí funciona como marcador "vencido hoy" (no es una fecha de intervalo real).
// Los planes con frecuenciaDias guardan una fecha real que no se sobreescribe.
async function verificarPlanesKmDespuesDeOt(prisma: any, tenantId: string, vehiculoId: string, odometer: number) {
  try {
    // plan.assetId referencia maintenanceAsset.id — resolver desde el vehículo
    const veh = await prisma.vehiculo.findFirst({ where: { id: vehiculoId, tenantId }, select: { maintenanceAssetId: true } });
    if (!veh?.maintenanceAssetId) return;
    const planes = await prisma.maintenancePlan.findMany({
      where: { tenantId, status: 'ACTIVE', frequencyUnit: 'KM', assetId: veh.maintenanceAssetId, frecuenciaDias: null },
      select: { id: true, triggerKm: true, lastOdometerExecution: true },
    });

    for (const plan of planes) {
      const kmDesdeUltima = plan.lastOdometerExecution
        ? odometer - plan.lastOdometerExecution
        : odometer;
      const triggerKm = plan.triggerKm || 0;

      // Si alcanzó o superó el umbral, actualizar nextExecutionDate (marcador de vencido)
      if (kmDesdeUltima >= triggerKm) {
        await prisma.maintenancePlan.updateMany({
          where: { id: plan.id, tenantId },
          data: { nextExecutionDate: new Date() },
        });
      }
    }
  } catch (e) {
    // Silenciar errores - no debe bloquear la operación principal
  }
}
