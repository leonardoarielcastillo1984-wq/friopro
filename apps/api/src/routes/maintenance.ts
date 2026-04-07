import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

// Schemas de validación
const createWorkOrderSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'EMERGENCY']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD']).default('PENDING'),
  assetId: z.string(),
  technicianId: z.string().optional(),
  scheduledDate: z.string().datetime(),
  estimatedDuration: z.number().default(0),
  laborCost: z.number().default(0),
  partsCost: z.number().default(0)
});

const createTechnicianSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  specialization: z.string().optional(),
  certification: z.string().optional()
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
  frequencyUnit: z.enum(['DAYS', 'WEEKS', 'MONTHS', 'YEARS']).default('DAYS'),
  nextExecutionDate: z.string().optional(), // Accept YYYY-MM-DD format
  status: z.enum(['ACTIVE', 'PAUSED', 'INACTIVE']).default('ACTIVE')
});

export default async function maintenanceRoutes(app: FastifyInstance) {
  // Helper to get prisma client from request context
  const getPrisma = (request: FastifyRequest) => {
    return (request as any).db?.prisma || app.prisma;
  };

  // GET /maintenance/work-orders - Listar órdenes de trabajo
  app.get('/work-orders', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { status, type, priority, technician } = request.query as any;
    
    const where: any = { tenantId: request.db.tenantId };
    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (technician) where.technicianId = technician;

    const workOrders = await getPrisma(request).workOrder.findMany({
      where,
      include: { asset: true, technician: true },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ workOrders });
  });

  // POST /maintenance/work-orders - Crear orden de trabajo
  app.post('/work-orders', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    try {
      const validatedData = createWorkOrderSchema.parse(request.body);
      
      const code = `OT-${Date.now().toString().slice(-6)}`;
      
      const workOrder = await getPrisma(request).workOrder.create({
        data: {
          code,
          title: validatedData.title,
          description: validatedData.description,
          type: validatedData.type,
          priority: validatedData.priority,
          status: validatedData.status,
          assetId: validatedData.assetId,
          technicianId: validatedData.technicianId,
          scheduledDate: new Date(validatedData.scheduledDate),
          estimatedDuration: validatedData.estimatedDuration,
          laborCost: validatedData.laborCost,
          partsCost: validatedData.partsCost,
          totalCost: validatedData.laborCost + validatedData.partsCost,
          tenantId: request.db.tenantId
        },
        include: { asset: true, technician: true }
      });

      return reply.code(201).send({ workOrder });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error creating work order:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /maintenance/work-orders/:id - Actualizar orden
  app.put('/work-orders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    const updateData = request.body as any;

    try {
      const workOrder = await getPrisma(request).workOrder.update({
        where: { id, tenantId: request.db.tenantId },
        data: {
          ...updateData,
          scheduledDate: updateData.scheduledDate ? new Date(updateData.scheduledDate) : undefined,
          completedDate: updateData.completedDate ? new Date(updateData.completedDate) : undefined,
          totalCost: (updateData.laborCost || 0) + (updateData.partsCost || 0)
        },
        include: { asset: true, technician: true }
      });

      return reply.send({ workOrder });
    } catch (error) {
      console.error('Error updating work order:', error);
      return reply.code(500).send({ error: 'Failed to update work order' });
    }
  });

  // DELETE /maintenance/work-orders/:id
  app.delete('/work-orders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    
    try {
      await getPrisma(request).workOrder.delete({
        where: { id, tenantId: request.db.tenantId }
      });
      return reply.send({ message: 'Work order deleted' });
    } catch (error) {
      console.error('Error deleting work order:', error);
      return reply.code(500).send({ error: 'Failed to delete work order' });
    }
  });

  // GET /maintenance/technicians - Listar técnicos
  app.get('/technicians', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const technicians = await getPrisma(request).maintenanceTechnician.findMany({
      where: { tenantId: request.db.tenantId },
      orderBy: { name: 'asc' }
    });
    return reply.send({ technicians });
  });

  // POST /maintenance/technicians - Crear técnico
  app.post('/technicians', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
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
          tenantId: request.db.tenantId
        }
      });

      return reply.code(201).send({ technician });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error creating technician:', error?.message || error);
      return reply.code(500).send({ error: 'Internal server error', message: error?.message });
    }
  });

  // PUT /maintenance/technicians/:id - Actualizar técnico
  app.put('/technicians/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
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
      return reply.code(500).send({ error: 'Failed to update technician' });
    }
  });

  // DELETE /maintenance/technicians/:id
  app.delete('/technicians/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    
    try {
      await getPrisma(request).maintenanceTechnician.delete({
        where: { id, tenantId: request.db.tenantId }
      });
      return reply.send({ message: 'Technician deleted' });
    } catch (error) {
      console.error('Error deleting technician:', error);
      return reply.code(500).send({ error: 'Failed to delete technician' });
    }
  });

  // GET /maintenance/spare-parts - Listar repuestos
  app.get('/spare-parts', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
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
      return reply.code(400).send({ error: 'Tenant context required' });
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
        return reply.code(400).send({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error creating spare part:', error?.message || error);
      return reply.code(500).send({ error: 'Internal server error', message: error?.message });
    }
  });

  // PUT /maintenance/spare-parts/:id - Actualizar repuesto
  app.put('/spare-parts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
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
      return reply.code(500).send({ error: 'Failed to update spare part' });
    }
  });

  // DELETE /maintenance/spare-parts/:id
  app.delete('/spare-parts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    
    try {
      await getPrisma(request).maintenanceSparePart.delete({
        where: { id, tenantId: request.db.tenantId }
      });
      return reply.send({ message: 'Spare part deleted' });
    } catch (error) {
      console.error('Error deleting spare part:', error);
      return reply.code(500).send({ error: 'Failed to delete spare part' });
    }
  });

  // GET /maintenance/plans - Listar planes de mantenimiento
  app.get('/plans', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
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
      return reply.code(400).send({ error: 'Tenant context required' });
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
        return reply.code(400).send({ error: 'Validation failed', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error', message: error?.message || 'Unknown error' });
    }
  });

  // POST /maintenance/plans/:id/execute - Ejecutar plan
  app.post('/plans/:id/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };

    try {
      const plan = await getPrisma(request).maintenancePlan.findUnique({
        where: { id, tenantId: request.db.tenantId }
      });

      if (!plan) {
        return reply.code(404).send({ error: 'Plan not found' });
      }

      const now = new Date();
      
      // Calcular próxima ejecución
      let nextDate: Date | null = null;
      if (plan.nextExecutionDate) {
        nextDate = new Date(plan.nextExecutionDate);
        switch (plan.frequencyUnit) {
          case 'DAYS':
            nextDate.setDate(nextDate.getDate() + plan.frequencyValue);
            break;
          case 'WEEKS':
            nextDate.setDate(nextDate.getDate() + (plan.frequencyValue * 7));
            break;
          case 'MONTHS':
            nextDate.setMonth(nextDate.getMonth() + plan.frequencyValue);
            break;
          case 'YEARS':
            nextDate.setFullYear(nextDate.getFullYear() + plan.frequencyValue);
            break;
        }
      }

      const updatedPlan = await getPrisma(request).maintenancePlan.update({
        where: { id },
        data: {
          lastExecutionDate: now,
          totalExecutions: { increment: 1 },
          nextExecutionDate: nextDate
        },
        include: { asset: true }
      });

      return reply.send({ plan: updatedPlan });
    } catch (error) {
      console.error('Error executing plan:', error);
      return reply.code(500).send({ error: 'Failed to execute plan' });
    }
  });

  // PUT /maintenance/plans/:id - Actualizar plan
  app.put('/plans/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
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
      return reply.code(500).send({ error: 'Failed to update plan' });
    }
  });

  // DELETE /maintenance/plans/:id
  app.delete('/plans/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    
    try {
      await getPrisma(request).maintenancePlan.delete({
        where: { id, tenantId: request.db.tenantId }
      });
      return reply.send({ message: 'Plan deleted' });
    } catch (error) {
      console.error('Error deleting plan:', error);
      return reply.code(500).send({ error: 'Failed to delete plan' });
    }
  });

  // GET /maintenance/assets - Listar activos/equipos
  app.get('/assets', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { status, category } = request.query as any;
    
    const where: any = { tenantId: request.db.tenantId };
    if (status) where.status = status;
    if (category) where.category = category;

    console.log('🔧 GET /assets - where:', where);

    const assets = await getPrisma(request).maintenanceAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    console.log('🔧 GET /assets - found:', assets.length, 'assets');

    return reply.send({ assets });
  });

  // POST /maintenance/assets - Crear activo/equipo
  app.post('/assets', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
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
        return reply.code(400).send({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error creating asset:', error?.message || error);
      return reply.code(500).send({ error: 'Internal server error', message: error?.message });
    }
  });

  // PUT /maintenance/assets/:id - Actualizar activo
  app.put('/assets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
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
      return reply.code(500).send({ error: 'Failed to update asset' });
    }
  });

  // DELETE /maintenance/assets/:id
  app.delete('/assets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    
    try {
      await getPrisma(request).maintenanceAsset.delete({
        where: { id, tenantId: request.db.tenantId }
      });
      return reply.send({ message: 'Asset deleted' });
    } catch (error) {
      console.error('Error deleting asset:', error);
      return reply.code(500).send({ error: 'Failed to delete asset' });
    }
  });

  // POST /maintenance/assets/:id/maintenance-cost - Agregar costo de mantenimiento
  app.post('/assets/:id/maintenance-cost', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
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
      return reply.code(500).send({ error: 'Failed to add cost' });
    }
  });

  // GET /maintenance/assets/:id/maintenance-costs - Obtener historial de costos
  app.get('/assets/:id/maintenance-costs', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
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

  // GET /maintenance/stats - Estadísticas
  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const tenantId = request.db.tenantId;

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
      getPrisma(request).workOrder.count({ where: { tenantId } }),
      getPrisma(request).workOrder.count({ where: { tenantId, status: 'PENDING' } }),
      getPrisma(request).workOrder.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
      getPrisma(request).workOrder.count({ where: { tenantId, status: 'COMPLETED' } }),
      getPrisma(request).workOrder.count({ where: { tenantId, status: 'PENDING', scheduledDate: { lt: new Date() } } }),
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
}
