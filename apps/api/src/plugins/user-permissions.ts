import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

// Mapeo de rutas API a keys de módulos de permisos
const ROUTE_MODULE_MAP: Record<string, string> = {
  '/api/dashboard': 'dashboard',
  '/api/calendar': 'calendario',
  '/api/project360': 'project360',
  '/api/context': 'contexto-sgi',
  '/api/objectives': 'objetivos',
  '/api/hr': 'rrhh',
  '/api/trainings': 'capacitaciones',
  '/api/customers': 'clientes',
  '/api/suppliers': 'proveedores',
  '/api/normativos': 'cumplimiento',
  '/api/documents': 'documents',
  '/api/hazards': 'seguridad',
  '/api/aspects': 'seguridad',
  '/api/incidents': 'seguridad',
  '/api/indicators': 'indicadores',
  '/api/ncr': 'calidad',
  '/api/audit': 'auditoria',
  '/api/management-review': 'revision-direccion',
  '/api/equipment': 'infraestructura',
  '/api/reports': 'reportes',
  '/api/help': 'modo-de-uso',
  '/api/notifications': 'notificaciones',
  '/api/settings': 'configuracion',
};

export const userPermissionsPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const url = req.url;
    const userId = (req as any).auth?.userId;

    // Skip si no hay usuario autenticado (rutas públicas ya se manejan en auth)
    if (!userId) return;

    // Skip para SUPER_ADMIN
    const globalRole = (req as any).auth?.globalRole;
    if (globalRole === 'SUPER_ADMIN') return;

    // Encontrar el módulo correspondiente a la ruta
    let moduleKey: string | null = null;
    for (const [routePrefix, key] of Object.entries(ROUTE_MODULE_MAP)) {
      if (url.startsWith(routePrefix)) {
        moduleKey = key;
        break;
      }
    }

    // Si no es una ruta mapeada, permitir
    if (!moduleKey) return;

    try {
      // Obtener PlatformUser
      const platformUser = await app.prisma.platformUser.findUnique({
        where: { id: userId }
      });

      if (!platformUser) return;

      // Obtener User interno (linked to employee)
      const user = await app.prisma.user.findUnique({
        where: { email: platformUser.email }
      });

      if (!user) return; // No es un empleado, permitir (podría ser admin)

      // Verificar permisos
      const permissions = (user.permissions as Record<string, any>) || {};
      const permValue = permissions[moduleKey];
      
      let accessLevel: string;
      if (typeof permValue === 'string') {
        accessLevel = permValue;
      } else if (permValue?.access) {
        accessLevel = permValue.access;
      } else {
        accessLevel = 'none';
      }

      // Si es POST/PUT/PATCH/DELETE, requiere 'edit'
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        if (accessLevel !== 'edit') {
          return reply.code(403).send({
            error: 'PERMISSION_DENIED',
            message: 'No tenés permiso de edición para este módulo',
            module: moduleKey
          });
        }
      }

      // Si es GET, requiere 'view' o 'edit'
      if (req.method === 'GET') {
        if (accessLevel !== 'view' && accessLevel !== 'edit') {
          return reply.code(403).send({
            error: 'PERMISSION_DENIED',
            message: 'No tenés permiso de lectura para este módulo',
            module: moduleKey
          });
        }
      }
    } catch (error) {
      app.log.error('Permission check error:', error);
      // En caso de error, permitir (fail-open para no bloquear usuarios)
    }
  });
});
