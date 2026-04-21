// Servicio de control de acceso por plan y feature flags

import { FastifyInstance } from 'fastify';

export class FeatureAccessService {
  constructor(private app: FastifyInstance) {}

  // Validar si un tenant tiene acceso a una funcionalidad
  async hasFeatureAccess(tenantId: string, featureKey: string): Promise<boolean> {
    try {
      // Buscar suscripción del tenant
      const subscription = await this.app.prisma.tenantSubscription.findFirst({
        where: { tenantId },
        include: { plan: true }
      });

      if (!subscription) return false;

      // Verificar en el campo features JSON del plan
      const planFeatures = subscription.plan.features as Record<string, boolean> | null;
      if (planFeatures && planFeatures[featureKey] === true) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  // Obtener información del plan y límites
  async getPlanInfo(tenantId: string) {
    try {
      // Buscar suscripción del tenant
      const subscription = await this.app.prisma.tenantSubscription.findFirst({
        where: { tenantId },
        include: { 
          plan: true,
          tenant: {
            select: {
              id: true,
              name: true,
              storageUsed: true
            }
          }
        }
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Contar usuarios activos
      const currentUsers = await this.app.prisma.platformUser.count({
        where: {
          memberships: {
            some: {
              tenantId,
              status: 'ACTIVE'
            }
          }
        }
      });

      // Extraer features del campo JSON
      const planFeatures = subscription.plan.features as Record<string, boolean> | null;
      const features = planFeatures ? Object.entries(planFeatures)
        .filter(([, enabled]) => enabled === true)
        .map(([key]) => ({
          key,
          name: this.getFeatureName(key),
          description: this.getFeatureDescription(key),
          limit: null
        })) : [];

      // Extraer límites del campo JSON
      const planLimits = subscription.plan.limits as Record<string, number> | null;
      const userLimit = planLimits?.users || 5;
      const storageLimit = planLimits?.storage || 1000;

      return {
        plan: {
          name: subscription.plan.name,
          tier: subscription.plan.tier,
          userLimit,
          storageLimit
        },
        subscription: {
          status: subscription.status,
          startedAt: subscription.startedAt,
          endsAt: subscription.endsAt
        },
        features,
        usage: {
          currentUsers,
          maxUsers: userLimit,
          currentStorage: Number(subscription.tenant.storageUsed ?? 0),
          maxStorage: storageLimit
        },
        tenant: subscription.tenant
      };
    } catch (error) {
      console.error('Error getting plan info:', error);
      throw error;
    }
  }

  // Validar límites de uso
  async validateUsageLimits(tenantId: string, resource: string, amount: number = 1): Promise<boolean> {
    try {
      const subscription = await this.app.prisma.tenantSubscription.findFirst({
        where: { tenantId },
        include: { plan: true }
      });

      if (!subscription) return false;

      const planLimits = subscription.plan.limits as Record<string, number> | null;

      switch (resource) {
        case 'users': {
          const currentUsers = await this.app.prisma.platformUser.count({
            where: {
              memberships: {
                some: {
                  tenantId,
                  status: 'ACTIVE'
                }
              }
            }
          });
          const userLimit = planLimits?.users || 5;
          return userLimit === -1 || (currentUsers + amount) <= userLimit;
        }

        case 'storage': {
          return true;
        }

        default:
          return true;
      }
    } catch (error) {
      console.error('Error validating usage limits:', error);
      return false;
    }
  }

  // Actualizar uso de recursos
  async updateUsage(tenantId: string, resource: string, amount: number) {
    try {
      console.log(`Updating usage for tenant ${tenantId}: ${resource} = ${amount}`);
    } catch (error) {
      console.error('Error updating usage:', error);
    }
  }

  // Obtener módulos disponibles/bloqueados para UI
  async getModuleAccess(tenantId: string, isSuperAdmin: boolean = false) {
    try {
      // Si es SuperAdmin, dar acceso a todo
      if (isSuperAdmin) {
        const allModules = [
          {
            key: 'project360',
            name: 'PROJECT360',
            icon: 'Target',
            route: '/project360',
            featureRequired: 'project360',
            description: 'Planes de acción y mejora continua'
          },
          {
            key: 'mantenimiento',
            name: 'Mantenimiento',
            icon: 'Wrench',
            route: '/mantenimiento',
            featureRequired: 'mantenimiento',
            description: 'Gestión de mantenimiento industrial'
          },
          {
            key: 'simulacros',
            name: 'Simulacros',
            icon: 'Shield',
            route: '/simulacros',
            featureRequired: 'simulacros',
            description: 'Planes de contingencia y emergencias'
          },
          {
            key: 'documentos',
            name: 'Documentos',
            icon: 'FileText',
            route: '/documentos',
            featureRequired: 'documentos',
            description: 'Gestión documental'
          },
          {
            key: 'normativos',
            name: 'Normativos',
            icon: 'Shield',
            route: '/normativos',
            featureRequired: 'normativos',
            description: 'Cumplimiento normativo'
          },
          {
            key: 'ia_auditora',
            name: 'Auditoría IA',
            icon: 'Brain',
            route: '/ia-auditoria',
            featureRequired: 'audit_ia',
            description: 'Auditoría asistida por IA'
          },
          {
            key: 'auditorias',
            name: 'Auditorías ISO',
            icon: 'ClipboardList',
            route: '/auditorias',
            featureRequired: 'auditorias_iso',
            description: 'Gestión de auditorías internas y externas'
          },
          {
            key: 'no_conformidades',
            name: 'No Conformidades',
            icon: 'AlertTriangle',
            route: '/no-conformidades',
            featureRequired: 'no_conformidades',
            description: 'Gestión de no conformidades'
          },
          {
            key: 'riesgos',
            name: 'Riesgos',
            icon: 'AlertTriangle',
            route: '/riesgos',
            featureRequired: 'riesgos',
            description: 'Gestión de riesgos y mitigación'
          },
          {
            key: 'indicadores',
            name: 'Indicadores',
            icon: 'TrendingUp',
            route: '/indicadores',
            featureRequired: 'indicadores',
            description: 'KPIs y métricas avanzadas'
          },
          {
            key: 'capacitaciones',
            name: 'Capacitaciones',
            icon: 'BookOpen',
            route: '/capacitaciones',
            featureRequired: 'capacitaciones',
            description: 'Gestión de capacitaciones'
          },
          {
            key: 'rrhh',
            name: 'RRHH',
            icon: 'UserCircle',
            route: '/rrhh',
            featureRequired: 'rrhh',
            description: 'Gestión de recursos humanos'
          },
          {
            key: 'clientes',
            name: 'Clientes',
            icon: 'Users',
            route: '/clientes',
            featureRequired: 'clientes',
            description: 'Gestión de clientes y encuestas'
          },
          {
            key: 'reportes',
            name: 'Reportes',
            icon: 'FileBarChart',
            route: '/reportes',
            featureRequired: 'reportes',
            description: 'Reportes y analytics'
          },
          {
            key: 'encuestas',
            name: 'Encuestas',
            icon: 'MessageSquare',
            route: '/encuestas',
            featureRequired: 'encuestas',
            description: 'Encuestas de satisfacción'
          }
        ];

        return allModules.map(module => ({
          ...module,
          hasAccess: true,
          isBlocked: false,
          requiredPlan: 'SUPER_ADMIN',
          upgradeUrl: '#',
          tooltip: null
        }));
      }

      // Para usuarios normales, evaluar según plan
      const subscription = await this.app.prisma.tenantSubscription.findFirst({
        where: { tenantId },
        include: { plan: true }
      });

      const planFeatures = subscription?.plan?.features as Record<string, boolean> | null;

      // Definición de módulos con sus features requeridas
      const modules = [
        {
          key: 'project360',
          name: 'PROJECT360',
          icon: 'Target',
          route: '/project360',
          featureRequired: 'project360',
          description: 'Planes de acción y mejora continua'
        },
        {
          key: 'mantenimiento',
          name: 'Mantenimiento',
          icon: 'Wrench',
          route: '/mantenimiento',
          featureRequired: 'mantenimiento',
          description: 'Gestión de mantenimiento industrial'
        },
        {
          key: 'simulacros',
          name: 'Simulacros',
          icon: 'Shield',
          route: '/simulacros',
          featureRequired: 'simulacros',
          description: 'Planes de contingencia y emergencias'
        },
        {
          key: 'documentos',
          name: 'Documentos',
          icon: 'FileText',
          route: '/documentos',
          featureRequired: 'documentos',
          description: 'Gestión documental'
        },
        {
          key: 'normativos',
          name: 'Normativos',
          icon: 'Shield',
          route: '/normativos',
          featureRequired: 'normativos',
          description: 'Cumplimiento normativo'
        },
        {
          key: 'ia_auditora',
          name: 'Auditoría IA',
          icon: 'Brain',
          route: '/ia-auditoria',
          featureRequired: 'audit_ia',
          description: 'Auditoría asistida por IA'
        },
        {
          key: 'auditorias',
          name: 'Auditorías ISO',
          icon: 'ClipboardList',
          route: '/auditorias',
          featureRequired: 'auditorias_iso',
          description: 'Gestión de auditorías internas y externas'
        },
        {
          key: 'no_conformidades',
          name: 'No Conformidades',
          icon: 'AlertTriangle',
          route: '/no-conformidades',
          featureRequired: 'no_conformidades',
          description: 'Gestión de no conformidades'
        },
        {
          key: 'riesgos',
          name: 'Riesgos',
          icon: 'AlertTriangle',
          route: '/riesgos',
          featureRequired: 'riesgos',
          description: 'Gestión de riesgos y mitigación'
        },
        {
          key: 'indicadores',
          name: 'Indicadores',
          icon: 'TrendingUp',
          route: '/indicadores',
          featureRequired: 'indicadores',
          description: 'KPIs y métricas avanzadas'
        },
        {
          key: 'capacitaciones',
          name: 'Capacitaciones',
          icon: 'BookOpen',
          route: '/capacitaciones',
          featureRequired: 'capacitaciones',
          description: 'Gestión de capacitaciones'
        },
        {
          key: 'rrhh',
          name: 'RRHH',
          icon: 'UserCircle',
          route: '/rrhh',
          featureRequired: 'rrhh',
          description: 'Gestión de recursos humanos'
        },
        {
          key: 'clientes',
          name: 'Clientes',
          icon: 'Users',
          route: '/clientes',
          featureRequired: 'clientes',
          description: 'Gestión de clientes y encuestas'
        },
        {
          key: 'reportes',
          name: 'Reportes',
          icon: 'FileBarChart',
          route: '/reportes',
          featureRequired: 'reportes',
          description: 'Reportes y analytics'
        },
        {
          key: 'encuestas',
          name: 'Encuestas',
          icon: 'MessageSquare',
          route: '/encuestas',
          featureRequired: 'encuestas',
          description: 'Encuestas de satisfacción'
        }
      ];

      // Evaluar acceso para cada módulo
      return modules.map(module => {
        const hasAccess = module.featureRequired 
          ? planFeatures?.[module.featureRequired] === true
          : true;

        return {
          ...module,
          hasAccess,
          isBlocked: !hasAccess,
          requiredPlan: hasAccess ? 'current' : this.getRequiredPlan(module.featureRequired || ''),
          upgradeUrl: `/planes?upgrade=${module.featureRequired}`,
          tooltip: !hasAccess ? this.getBlockedMessage(module.featureRequired || '') : null
        };
      });
    } catch (error) {
      console.error('Error getting module access:', error);
      throw error;
    }
  }

  // Obtener plan requerido para una feature
  private getRequiredPlan(featureKey: string): string {
    const featurePlanMap: Record<string, string> = {
      'project360': 'PROFESSIONAL',
      'mantenimiento': 'PROFESSIONAL',
      'simulacros': 'PROFESSIONAL',
      'audit_ia': 'PROFESSIONAL',
      'auditorias_iso': 'BASIC',
      'documentos': 'BASIC',
      'normativos': 'BASIC',
      'no_conformidades': 'BASIC',
      'riesgos': 'PROFESSIONAL',
      'indicadores': 'PROFESSIONAL',
      'capacitaciones': 'PROFESSIONAL',
      'rrhh': 'PROFESSIONAL',
      'clientes': 'PREMIUM',
      'reportes': 'PREMIUM',
      'encuestas': 'PREMIUM'
    };

    return featurePlanMap[featureKey] || 'PROFESSIONAL';
  }

  // Mensaje para módulos bloqueados
  private getBlockedMessage(featureKey: string): string {
    const requiredPlan = this.getRequiredPlan(featureKey);
    return `Disponible en plan ${requiredPlan} - Actualiza para acceder`;
  }

  // Helper para obtener nombre de feature
  private getFeatureName(key: string): string {
    const names: Record<string, string> = {
      'project360': 'PROJECT360',
      'mantenimiento': 'Mantenimiento',
      'simulacros': 'Simulacros',
      'documentos': 'Documentos',
      'normativos': 'Normativos',
      'audit_ia': 'Auditoría IA',
      'auditorias_iso': 'Auditorías ISO',
      'no_conformidades': 'No Conformidades',
      'riesgos': 'Riesgos',
      'indicadores': 'Indicadores',
      'capacitaciones': 'Capacitaciones',
      'rrhh': 'RRHH',
      'clientes': 'Clientes',
      'reportes': 'Reportes',
      'encuestas': 'Encuestas'
    };
    return names[key] || key;
  }

  // Helper para obtener descripción de feature
  private getFeatureDescription(key: string): string {
    const descriptions: Record<string, string> = {
      'project360': 'Planes de acción y mejora continua',
      'mantenimiento': 'Gestión de mantenimiento industrial',
      'simulacros': 'Planes de contingencia y emergencias',
      'documentos': 'Gestión documental',
      'normativos': 'Cumplimiento normativo',
      'audit_ia': 'Auditoría asistida por IA',
      'auditorias_iso': 'Gestión de auditorías internas y externas',
      'no_conformidades': 'Gestión de no conformidades',
      'riesgos': 'Gestión de riesgos y mitigación',
      'indicadores': 'KPIs y métricas avanzadas',
      'capacitaciones': 'Gestión de capacitaciones',
      'rrhh': 'Gestión de recursos humanos',
      'clientes': 'Gestión de clientes y encuestas',
      'reportes': 'Reportes y analytics',
      'encuestas': 'Encuestas de satisfacción'
    };
    return descriptions[key] || key;
  }

  // Crear planes iniciales (placeholder - implementar si es necesario)
  async seedPlans() {
    console.log('📝 Plan seeding not implemented in this version');
  }
}
