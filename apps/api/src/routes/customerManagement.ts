import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { CUSTOMER_KPIS } from '../data/customerKPIs';

export async function registerCustomerManagementRoutes(app: FastifyInstance) {
  // Crear KPIs de clientes para un tenant
  app.post('/api/customer-management/setup-kpis', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Create default customer KPIs for tenant',
      tags: ['Customer Management'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            created: { type: 'number' }
          }
        }
      }
    }
  }, async (req, res) => {
    return await runWithDbContext(app, req, async (tx) => {
      const tenantId = app.tenant_id!;
      
      let created = 0;
      
      for (const kpi of CUSTOMER_KPIS) {
        // Check if KPI already exists
        const existing = await tx.indicator.findFirst({
          where: {
            tenantId,
            code: kpi.code
          }
        });
        
        if (!existing) {
          await tx.indicator.create({
            data: {
              ...kpi,
              tenantId,
              createdById: app.user_id
            }
          });
          created++;
        }
      }
      
      return {
        success: true,
        message: `Created ${created} customer KPIs`,
        created
      };
    });
  });

  // Obtener estadísticas de gestión de clientes
  app.get('/api/customer-management/stats', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Get customer management statistics',
      tags: ['Customer Management'],
      response: {
        200: {
          type: 'object',
          properties: {
            totalComplaints: { type: 'number' },
            openComplaints: { type: 'number' },
            resolvedComplaints: { type: 'number' },
            avgResolutionTime: { type: 'number' },
            satisfactionScore: { type: 'number' },
            customerKPIs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  code: { type: 'string' },
                  name: { type: 'string' },
                  currentValue: { type: 'number' },
                  targetValue: { type: 'number' },
                  status: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (req, res) => {
    return await runWithDbContext(app, req, async (tx) => {
      const tenantId = app.tenant_id!;
      
      // Get customer complaints NCRs
      const complaints = await tx.nonConformity.findMany({
        where: {
          tenantId,
          source: 'CUSTOMER_COMPLAINT',
          deletedAt: null
        },
        include: {
          actions: true
        }
      });
      
      const totalComplaints = complaints.length;
      const openComplaints = complaints.filter(nc => nc.status === 'OPEN').length;
      const resolvedComplaints = complaints.filter(nc => nc.status === 'CLOSED').length;
      
      // Calculate average resolution time (in hours)
      const resolvedWithTime = complaints.filter(nc => 
        nc.status === 'CLOSED' && nc.createdAt && nc.closedAt
      );
      const avgResolutionTime = resolvedWithTime.length > 0 
        ? resolvedWithTime.reduce((sum, nc) => {
            const hours = (new Date(nc.closedAt!).getTime() - new Date(nc.createdAt).getTime()) / (1000 * 60 * 60);
            return sum + hours;
          }, 0) / resolvedWithTime.length
        : 0;
      
      // Get customer KPIs
      const customerKPIs = await tx.indicator.findMany({
        where: {
          tenantId,
          category: 'CUSTOMER',
          isActive: true
        },
        select: {
          id: true,
          code: true,
          name: true,
          currentValue: true,
          targetValue: true,
          status: true
        }
      });
      
      // Get satisfaction score from measurements
      const satisfactionKPI = customerKPIs.find(kpi => kpi.code === 'CUST-SAT-001');
      const satisfactionScore = satisfactionKPI?.currentValue || 0;
      
      return {
        totalComplaints,
        openComplaints,
        resolvedComplaints,
        avgResolutionTime: Math.round(avgResolutionTime * 100) / 100,
        satisfactionScore,
        customerKPIs
      };
    });
  });

  // Obtener reclamos de clientes
  app.get('/api/customer-management/complaints', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Get customer complaints',
      tags: ['Customer Management'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['OPEN', 'CLOSED'] },
          severity: { type: 'string', enum: ['CRITICAL', 'MAJOR', 'MINOR', 'TRIVIAL'] },
          limit: { type: 'number', default: 50 },
          offset: { type: 'number', default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            complaints: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  code: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  severity: { type: 'string' },
                  status: { type: 'string' },
                  detectedAt: { type: 'string' },
                  assignedTo: { type: 'object' },
                  actions: { type: 'array' }
                }
              }
            },
            total: { type: 'number' }
          }
        }
      }
    }
  }, async (req, res) => {
    return await runWithDbContext(app, req, async (tx) => {
      const tenantId = app.tenant_id!;
      const { status, severity, limit = 50, offset = 0 } = req.query as any;
      
      const where: any = {
        tenantId,
        source: 'CUSTOMER_COMPLAINT',
        deletedAt: null
      };
      
      if (status) where.status = status;
      if (severity) where.severity = severity;
      
      const complaints = await tx.nonConformity.findMany({
        where,
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          actions: {
            where: {
              deletedAt: null
            },
            include: {
              assignedTo: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        },
        orderBy: {
          detectedAt: 'desc'
        },
        take: limit,
        skip: offset
      });
      
      const total = await tx.nonConformity.count({ where });
      
      return {
        complaints,
        total
      };
    });
  });
}
