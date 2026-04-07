import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { runWithDbContext } from '../middleware/dbContext.js';

export const emergencyRoutes: FastifyPluginAsync = async (app) => {
  // GET /emergency/drills - Obtener todos los simulacros
  app.get('/drills', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (req as any).auth?.tenantId;
      if (!tenantId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const drills = await (app as any).prisma.drillScenario.findMany({
        where: {
          tenantId,
          deletedAt: null
        },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send(drills);
    } catch (error) {
      app.log.error('Error fetching drills:', error);
      return reply.code(500).send({ error: 'Failed to fetch drills' });
    }
  });

  // GET /emergency/drills/:id - Obtener un simulacro específico
  app.get('/drills/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };

      // Simulación simple - retornar mock basado en el ID
      const mockDrill = {
        id: id,
        name: 'Simulacro de ' + id,
        description: 'Descripción del simulacro ' + id,
        type: 'FIRE',
        severity: 'MEDIUM',
        category: 'NATURAL_DISASTER',
        status: 'PLANNED',
        objectives: [
          'Evaluar tiempos de respuesta',
          'Verificar rutas de evacuación',
          'Probar sistemas de comunicación'
        ],
        scope: {
          areas: ['Área Principal', 'Oficinas', 'Estacionamiento'],
          departments: ['Seguridad', 'RRHH', 'Operaciones'],
          participants: 25,
          external_agencies: ['Bomberos', 'Emergencias Médicas']
        },
        schedule: {
          plannedDate: new Date().toISOString(),
          duration: 2,
          start_time: '09:00',
          end_time: '11:00'
        },
        coordinator: {
          id: 'coord-1',
          name: 'Administrador',
          email: 'admin@sgi360.com',
          phone: '+123456789'
        },
        evaluators: [
          { id: 'eval-1', name: 'Juan Pérez', role: 'Supervisor' },
          { id: 'eval-2', name: 'María González', role: 'Seguridad' }
        ],
        resources: {
          equipment: [
            { name: 'Extintores', quantity: 10, status: 'AVAILABLE' },
            { name: 'Alarmas', quantity: 5, status: 'AVAILABLE' },
            { name: 'Radios', quantity: 8, status: 'AVAILABLE' }
          ],
          personnel: [
            { role: 'Brigadistas', required: 10, assigned: 8 },
            { role: 'Primeros Auxilios', required: 3, assigned: 3 },
            { role: 'Comunicación', required: 2, assigned: 2 }
          ],
          facilities: [
            { name: 'Punto de Reunión', location: 'Estacionamiento', capacity: 50 },
            { name: 'Enfermería', location: 'Pb', capacity: 10 }
          ]
        },
        procedures: [
          {
            id: 'proc-1',
            step: 1,
            action: 'Activar alarma de evacuación',
            responsible: 'Coordinador',
            estimated_time: 1,
            dependencies: []
          },
          {
            id: 'proc-2',
            step: 2,
            action: 'Desalojar personal por rutas designadas',
            responsible: 'Brigadistas',
            estimated_time: 5,
            dependencies: ['proc-1']
          },
          {
            id: 'proc-3',
            step: 3,
            action: 'Verificar que todos estén en punto de reunión',
            responsible: 'Supervisores',
            estimated_time: 3,
            dependencies: ['proc-2']
          }
        ],
        evaluation_criteria: [
          {
            criteria: 'Tiempo de evacuación',
            weight: 0.4,
            measurement_method: 'Cronómetro',
            target_value: 5
          },
          {
            criteria: 'Participación del personal',
            weight: 0.3,
            measurement_method: 'Lista de asistencia',
            target_value: 100
          },
          {
            criteria: 'Uso correcto de equipos',
            weight: 0.3,
            measurement_method: 'Observación',
            target_value: 95
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId: 'test-tenant',
        createdById: 'test-user'
      };

      return reply.send(mockDrill);
    } catch (error) {
      app.log.error('Error fetching drill:', error);
      return reply.code(500).send({ error: 'Failed to fetch drill' });
    }
  });

  // GET /emergency/contingency-plans - Obtener planes de contingencia
  app.get('/contingency-plans', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (req as any).auth?.tenantId;
      if (!tenantId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const plans = await (app as any).prisma.contingencyPlan.findMany({
        where: {
          tenantId,
          deletedAt: null
        },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send(plans);
    } catch (error) {
      app.log.error('Error fetching contingency plans:', error);
      return reply.code(500).send({ error: 'Failed to fetch contingency plans' });
    }
  });

  // GET /emergency/contingency-plans/:id - Obtener plan específico
  app.get('/contingency-plans/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      
      // Buscar en memoria o retornar mock
      const plan = {
        id: id,
        name: 'Plan de Contingencia',
        description: 'Descripción del plan',
        type: 'EMERGENCY_RESPONSE',
        category: 'OPERATIONAL',
        status: 'DRAFT',
        coverage: {
          areas: ['Área Principal'],
          departments: ['Seguridad'],
          criticalProcesses: ['Operaciones críticas']
        },
        scenarios: [],
        procedures: [],
        resources: {
          personnel: [],
          equipment: [],
          facilities: [],
          externalResources: []
        },
        communication: {
          internalContacts: [],
          externalContacts: [],
          communicationChannels: []
        },
        activation: {
          triggerConditions: [],
          activationLevels: [],
          decisionMaker: 'Coordinador de Seguridad'
        },
        recovery: {
          rto: '4 horas',
          rpo: '1 hora',
          prioritySystems: [],
          recoverySteps: []
        },
        testing: {
          lastTestDate: null,
          testFrequency: 'Anual',
          testResults: null,
          nextTestDate: null
        },
        version: '1.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return reply.send({ plan });
    } catch (error) {
      app.log.error('Error fetching contingency plan:', error);
      return reply.code(500).send({ error: 'Failed to fetch contingency plan' });
    }
  });

  // GET /emergency/resources - Obtener recursos de emergencia
  app.get('/resources', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (req as any).auth?.tenantId;
      if (!tenantId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const resources = await (app as any).prisma.emergencyResource.findMany({
        where: {
          tenantId,
          deletedAt: null
        },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send(resources);
    } catch (error) {
      app.log.error('Error fetching resources:', error);
      return reply.code(500).send({ error: 'Failed to fetch resources' });
    }
  });

  // GET /emergency/stats - Obtener estadísticas
  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (req as any).auth?.tenantId;
      if (!tenantId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const tenantFilter = { tenantId, deletedAt: null };

      const [totalDrills, completedDrills, plannedDrills, contingencyPlans, availableResources] = await Promise.all([
        (app as any).prisma.drillScenario.count({ where: tenantFilter }),
        (app as any).prisma.drillScenario.count({ where: { ...tenantFilter, status: 'COMPLETED' } }),
        (app as any).prisma.drillScenario.count({ where: { ...tenantFilter, status: 'PLANNED' } }),
        (app as any).prisma.contingencyPlan.count({ where: tenantFilter }),
        (app as any).prisma.emergencyResource.count({ where: { ...tenantFilter, status: 'AVAILABLE' } })
      ]);

      return reply.send({
        total_drills: totalDrills,
        completed_drills: completedDrills,
        planned_drills: plannedDrills,
        contingency_plans: contingencyPlans,
        active_plans: contingencyPlans,
        resources_available: availableResources,
        participation_rate: 0,
        average_score: 0,
        critical_issues: 0
      });
    } catch (error) {
      app.log.error('Error fetching stats:', error);
      return reply.code(500).send({ error: 'Failed to fetch stats' });
    }
  });

  // POST /emergency/drills - Crear nuevo simulacro
  app.post('/drills', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = req.body as any;

      // Validar datos requeridos
      if (!body.name || !body.type || !body.severity) {
        return reply.code(400).send({ error: 'Missing required fields' });
      }

      // Simulación simple - retornar objeto mock con todos los campos necesarios
      const newDrill = {
        id: 'drill-' + Date.now(),
        name: body.name,
        description: body.description || '',
        type: body.type,
        severity: body.severity,
        category: 'NATURAL_DISASTER',
        status: 'PLANNED',
        objectives: [],
        scope: {
          areas: ['Área Principal'],
          departments: ['Seguridad'],
          participants: 10,
          external_agencies: []
        },
        schedule: {
          plannedDate: new Date().toISOString(),
          duration: 2,
          start_time: '09:00',
          end_time: '11:00'
        },
        coordinator: {
          id: 'coord-1',
          name: 'Administrador',
          email: 'admin@sgi360.com',
          phone: '+123456789'
        },
        evaluators: [],
        resources: {
          equipment: [],
          personnel: [],
          facilities: []
        },
        procedures: [],
        evaluation_criteria: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId: 'test-tenant',
        createdById: 'test-user'
      };

      return reply.code(201).send(newDrill);
    } catch (error) {
      app.log.error('Error creating drill:', error);
      return reply.code(500).send({ error: 'Failed to create drill' });
    }
  });

  // PUT /emergency/drills/:id - Actualizar simulacro
  app.put('/drills/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (req as any).auth?.tenantId;
      const { id } = req.params as { id: string };
      const body = req.body as any;

      if (!tenantId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Verificar que el simulacro pertenece al tenant
      const drill = await (app as any).prisma.drillScenario.findUnique({
        where: { id }
      });

      if (!drill) {
        return reply.code(404).send({ error: 'Drill not found' });
      }

      if (drill.tenantId !== tenantId) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const updatedDrill = await (app as any).prisma.drillScenario.update({
        where: { id },
        data: {
          name: body.name || drill.name,
          description: body.description !== undefined ? body.description : drill.description,
          type: body.type || drill.type,
          severity: body.severity || drill.severity,
          status: body.status || drill.status,
          objectives: body.objectives !== undefined ? body.objectives : drill.objectives,
          scope: body.scope !== undefined ? body.scope : drill.scope,
          schedule: body.schedule !== undefined ? body.schedule : drill.schedule,
          coordinator: body.coordinator !== undefined ? body.coordinator : drill.coordinator,
          evaluators: body.evaluators !== undefined ? body.evaluators : drill.evaluators,
          resources: body.resources !== undefined ? body.resources : drill.resources,
          procedures: body.procedures !== undefined ? body.procedures : drill.procedures,
          evaluationCriteria: body.evaluation_criteria !== undefined ? body.evaluation_criteria : drill.evaluationCriteria,
          results: body.results !== undefined ? body.results : drill.results
        }
      });

      return reply.send(updatedDrill);
    } catch (error) {
      app.log.error('Error updating drill:', error);
      return reply.code(500).send({ error: 'Failed to update drill' });
    }
  });

  // DELETE /emergency/drills/:id - Eliminar simulacro
  app.delete('/drills/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (req as any).auth?.tenantId;
      const { id } = req.params as { id: string };

      app.log.info(`DELETE /drills/${id} - tenantId: ${tenantId}`);

      if (!tenantId) {
        return reply.code(401).send({ error: 'Unauthorized - no tenantId' });
      }

      // Si es un ID de mock (drill-xxx), simular eliminación exitosa
      if (id.startsWith('drill-')) {
        app.log.info(`Mock drill ${id} - simulating delete`);
        return reply.code(204).send();
      }

      const drill = await (app as any).prisma.drillScenario.findUnique({
        where: { id }
      });

      app.log.info(`Found drill: ${JSON.stringify(drill)}`);

      if (!drill) {
        return reply.code(404).send({ error: 'Drill not found' });
      }

      if (drill.tenantId !== tenantId) {
        return reply.code(403).send({ error: 'Forbidden - tenant mismatch' });
      }

      await (app as any).prisma.drillScenario.update({
        where: { id },
        data: { deletedAt: new Date() }
      });

      app.log.info(`Drill ${id} soft deleted successfully`);
      return reply.code(204).send();
    } catch (error: any) {
      app.log.error('Error deleting drill:', error);
      return reply.code(500).send({ error: 'Failed to delete drill', details: error?.message });
    }
  });

  // POST /emergency/drills/:id/start - Iniciar simulacro
  app.post('/drills/:id/start', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (req as any).auth?.tenantId;
      const { id } = req.params as { id: string };

      if (!tenantId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const drill = await (app as any).prisma.drillScenario.findUnique({
        where: { id }
      });

      if (!drill) {
        return reply.code(404).send({ error: 'Drill not found' });
      }

      if (drill.tenantId !== tenantId) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const updatedDrill = await (app as any).prisma.drillScenario.update({
        where: { id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() }
      });

      return reply.send(updatedDrill);
    } catch (error) {
      app.log.error('Error starting drill:', error);
      return reply.code(500).send({ error: 'Failed to start drill' });
    }
  });

  // POST /emergency/contingency-plans - Crear plan de contingencia
  app.post('/contingency-plans', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = req.body as any;

      if (!body.name || !body.type) {
        return reply.code(400).send({ error: 'Missing required fields' });
      }

      // Crear plan en memoria (sin Prisma)
      const newPlan = {
        id: 'plan-' + Date.now(),
        name: body.name,
        description: body.description || '',
        type: body.type,
        category: body.category || 'OPERATIONAL',
        status: 'DRAFT',
        coverage: {
          areas: ['Área Principal'],
          departments: ['Seguridad'],
          criticalProcesses: ['Operaciones críticas']
        },
        scenarios: [],
        procedures: [],
        resources: {
          personnel: [],
          equipment: [],
          facilities: [],
          externalResources: []
        },
        communication: {
          internalContacts: [],
          externalContacts: [],
          communicationChannels: []
        },
        activation: {
          triggerConditions: [],
          activationLevels: [],
          decisionMaker: 'Coordinador de Seguridad'
        },
        recovery: {
          rto: '4 horas',
          rpo: '1 hora',
          prioritySystems: [],
          recoverySteps: []
        },
        testing: {
          lastTestDate: null,
          testFrequency: 'Anual',
          testResults: null,
          nextTestDate: null
        },
        version: '1.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return reply.code(201).send({
        success: true,
        message: 'Plan de contingencia creado exitosamente',
        plan: newPlan
      });
    } catch (error) {
      app.log.error('Error creating contingency plan:', error);
      return reply.code(500).send({ error: 'Failed to create contingency plan' });
    }
  });

  // PUT /emergency/contingency-plans/:id - Actualizar plan de contingencia
  app.put('/contingency-plans/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as any;

      // Simular actualización - retornar plan actualizado
      const updatedPlan = {
        id: id,
        name: body.name || 'Plan actualizado',
        description: body.description || '',
        type: body.type || 'EMERGENCY_RESPONSE',
        category: body.category || 'OPERATIONAL',
        status: body.status || 'DRAFT',
        coverage: body.coverage || {
          areas: ['Área Principal'],
          departments: ['Seguridad'],
          criticalProcesses: ['Operaciones críticas']
        },
        scenarios: body.scenarios || [],
        procedures: body.procedures || [],
        resources: body.resources || {
          personnel: [],
          equipment: [],
          facilities: [],
          externalResources: []
        },
        communication: body.communication || {
          internalContacts: [],
          externalContacts: [],
          communicationChannels: []
        },
        activation: body.activation || {
          triggerConditions: [],
          activationLevels: [],
          decisionMaker: 'Coordinador de Seguridad'
        },
        recovery: body.recovery || {
          rto: '4 horas',
          rpo: '1 hora',
          prioritySystems: [],
          recoverySteps: []
        },
        testing: body.testing || {
          lastTestDate: null,
          testFrequency: 'Anual',
          testResults: null,
          nextTestDate: null
        },
        version: '1.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return reply.send({
        success: true,
        message: 'Plan de contingencia actualizado exitosamente',
        plan: updatedPlan
      });
    } catch (error) {
      app.log.error('Error updating contingency plan:', error);
      return reply.code(500).send({ error: 'Failed to update contingency plan' });
    }
  });

  // POST /emergency/resources - Crear recurso de emergencia
  app.post('/resources', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (req as any).auth?.tenantId;
      const userId = (req as any).auth?.userId;

      if (!tenantId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const body = req.body as any;

      if (!body.name || !body.type) {
        return reply.code(400).send({ error: 'Missing required fields' });
      }

      const resource = await (app as any).prisma.emergencyResource.create({
        data: {
          tenantId,
          name: body.name,
          description: body.description || null,
          type: body.type,
          category: body.category || null,
          quantity: body.quantity || 1,
          location: body.location || null,
          status: 'AVAILABLE',
          contactInfo: body.contactInfo || null,
          specifications: body.specifications || null,
          maintenanceSchedule: body.maintenanceSchedule || null,
          createdById: userId || null
        }
      });

      return reply.code(201).send(resource);
    } catch (error: any) {
      app.log.error('Error creating emergency resource:', error);
      return reply.code(500).send({ error: 'Failed to create emergency resource', details: error?.message });
    }
  });

  // DELETE /emergency/contingency-plans/:id - Eliminar plan de contingencia
  app.delete('/contingency-plans/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (req as any).auth?.tenantId;
      const { id } = req.params as { id: string };

      app.log.info(`DELETE /contingency-plans/${id} - tenantId: ${tenantId}`);

      if (!tenantId) {
        return reply.code(401).send({ error: 'Unauthorized - no tenantId' });
      }

      // Si es un ID de mock (plan-xxx), simular eliminación exitosa
      if (id.startsWith('plan-')) {
        app.log.info(`Mock plan ${id} - simulating delete`);
        return reply.code(204).send();
      }

      const plan = await (app as any).prisma.contingencyPlan.findUnique({
        where: { id }
      });

      if (!plan) {
        return reply.code(404).send({ error: 'Plan not found' });
      }

      if (plan.tenantId !== tenantId) {
        return reply.code(403).send({ error: 'Forbidden - tenant mismatch' });
      }

      await (app as any).prisma.contingencyPlan.update({
        where: { id },
        data: { deletedAt: new Date() }
      });

      app.log.info(`Plan ${id} soft deleted successfully`);
      return reply.code(204).send();
    } catch (error: any) {
      app.log.error('Error deleting contingency plan:', error);
      return reply.code(500).send({ error: 'Failed to delete contingency plan', details: error?.message });
    }
  });

  // DELETE /emergency/resources/:id - Eliminar recurso de emergencia
  app.delete('/resources/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (req as any).auth?.tenantId;
      const { id } = req.params as { id: string };

      app.log.info(`DELETE /resources/${id} - tenantId: ${tenantId}`);

      if (!tenantId) {
        return reply.code(401).send({ error: 'Unauthorized - no tenantId' });
      }

      const resource = await (app as any).prisma.emergencyResource.findUnique({
        where: { id }
      });

      if (!resource) {
        return reply.code(404).send({ error: 'Resource not found' });
      }

      if (resource.tenantId !== tenantId) {
        return reply.code(403).send({ error: 'Forbidden - tenant mismatch' });
      }

      await (app as any).prisma.emergencyResource.update({
        where: { id },
        data: { deletedAt: new Date() }
      });

      app.log.info(`Resource ${id} soft deleted successfully`);
      return reply.code(204).send();
    } catch (error: any) {
      app.log.error('Error deleting emergency resource:', error);
      return reply.code(500).send({ error: 'Failed to delete emergency resource', details: error?.message });
    }
  });
};
