import { FastifyInstance, FastifyRequest } from 'fastify';

// Plugin para manejar contexto multi-tenant
export async function tenantContext(app: FastifyInstance) {
  
  // Decorator para validar tenant
  app.decorateRequest('tenant', null);
  app.decorateRequest('subscription', null);
  app.decorateRequest('permissions', null);
  
  // Hook global para validar tenant en todas las rutas
  app.addHook('preHandler', async (request, reply) => {
    // Skip para rutas públicas
    const publicRoutes = [
      '/auth/login',
      '/auth/register',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/plans',
      '/webhooks/mercadopago',
      '/health'
    ];
    
    if (publicRoutes.some(route => request.url.startsWith(route))) {
      return;
    }
    
    try {
      // Obtener tenant desde token o headers
      const tenantId = request.headers['x-tenant-id'] as string;
      const userId = request.user?.id;
      
      if (!tenantId) {
        return reply.code(401).send({
          error: 'TENANT_REQUIRED',
          message: 'Tenant ID is required'
        });
      }
      
      // Validar que el tenant exista y esté activo
      const tenant = await app.prisma.tenant.findFirst({
        where: {
          id: tenantId,
          isActive: true,
          status: {
            in: ['TRIAL', 'ACTIVE']
          }
        },
        include: {
          subscription: {
            include: {
              plan: {
                include: {
                  planFeatures: true
                }
              },
              addons: {
                include: {
                  addon: true
                }
              }
            }
          }
        }
      });
      
      if (!tenant) {
        return reply.code(403).send({
          error: 'TENANT_NOT_FOUND',
          message: 'Tenant not found or inactive'
        });
      }
      
      // Validar si el usuario tiene acceso a este tenant
      if (userId) {
        const userAccess = await app.prisma.platformUser.findFirst({
          where: {
            id: userId,
            tenantId: tenantId,
            isActive: true
          }
        });
        
        if (!userAccess) {
          return reply.code(403).send({
            error: 'USER_NOT_AUTHORIZED',
            message: 'User not authorized for this tenant'
          });
        }
      }
      
      // Establecer contexto de tenant
      request.tenant = tenant;
      request.subscription = tenant.subscription;
      
      // Generar permissions basados en el plan
      const permissions = generatePermissions(tenant.subscription);
      request.permissions = permissions;
      
      // Validar acceso a la funcionalidad específica
      await validateFeatureAccess(request, reply, permissions);
      
    } catch (error) {
      app.log.error('Tenant validation error:', error);
      return reply.code(500).send({
        error: 'TENANT_VALIDATION_ERROR',
        message: 'Internal server error'
      });
    }
  });
  
  // Helper para generar permisos basados en plan
  function generatePermissions(subscription: any) {
    if (!subscription) {
      return {
        plan: 'FREE',
        features: [],
        limits: {
          users: 1,
          storage: 100
        }
      };
    }
    
    const features = subscription.plan.planFeatures
      .filter((pf: any) => pf.isEnabled)
      .map((pf: any) => ({
        key: pf.featureKey,
        name: pf.featureName,
        limit: pf.limit
      }));
    
    // Agregar features de addons
    const addonFeatures = subscription.addons
      .filter((sa: any) => sa.isActive)
      .flatMap((sa: any) => sa.addon.features);
    
    return {
      plan: subscription.plan.name,
      features: [...features, ...addonFeatures],
      limits: {
        users: subscription.userLimit,
        storage: subscription.storageLimit,
        currentUsers: subscription.currentUsers,
        currentStorage: subscription.currentStorage
      },
      status: subscription.status,
      billingCycle: subscription.billingCycle
    };
  }
  
  // Helper para validar acceso a funcionalidades
  async function validateFeatureAccess(request: FastifyRequest, reply: any, permissions: any) {
    const url = request.url;
    const method = request.method;
    
    // Mapeo de rutas a features requeridas
    const routeFeatureMap: Record<string, string> = {
      '/project360': 'PROJECT360',
      '/maintenance': 'MAINTENANCE',
      '/drills': 'DRILLS',
      '/risks': 'RISKS',
      '/indicators': 'INDICATORS_ADVANCED',
      '/business-intelligence': 'BUSINESS_INTELLIGENCE',
      '/reports': 'REPORTS_AUTO',
      '/ai': 'AI_FEATURES',
      '/audit360': 'AUDIT360',
      '/hse360': 'HSE360',
      '/users': 'USERS_MANAGEMENT'
    };
    
    // Determinar feature requerida
    const requiredFeature = Object.keys(routeFeatureMap).find(route => 
      url.startsWith(route)
    );
    
    if (requiredFeature) {
      const featureKey = routeFeatureMap[requiredFeature];
      const hasAccess = permissions.features.some((f: any) => f.key === featureKey);
      
      if (!hasAccess) {
        return reply.code(403).send({
          error: 'FEATURE_NOT_AVAILABLE',
          message: `Feature ${featureKey} not available in current plan`,
          requiredPlan: getRequiredPlan(featureKey),
          upgradeUrl: `/plans?upgrade=${featureKey}`
        });
      }
    }
    
    // Validar límites de usuarios
    if (url.startsWith('/users') && method === 'POST') {
      if (permissions.limits.currentUsers >= permissions.limits.users) {
        return reply.code(403).send({
          error: 'USER_LIMIT_EXCEEDED',
          message: `User limit (${permissions.limits.users}) exceeded`,
          upgradeUrl: '/plans?upgrade=USER_LIMIT'
        });
      }
    }
  }
  
  // Helper para obtener plan requerido
  function getRequiredPlan(featureKey: string): string {
    const featurePlanMap: Record<string, string> = {
      'PROJECT360': 'Professional',
      'MAINTENANCE': 'Professional',
      'DRILLS': 'Professional',
      'RISKS': 'Professional',
      'INDICATORS_ADVANCED': 'Professional',
      'BUSINESS_INTELLIGENCE': 'Enterprise',
      'REPORTS_AUTO': 'Enterprise',
      'AI_FEATURES': 'Enterprise',
      'AUDIT360': 'Addon',
      'HSE360': 'Addon',
      'USERS_MANAGEMENT': 'Starter'
    };
    
    return featurePlanMap[featureKey] || 'Professional';
  }
}

// Tipos para TypeScript
declare module 'fastify' {
  export interface FastifyRequest {
    tenant: any;
    subscription: any;
    permissions: any;
  }
}
