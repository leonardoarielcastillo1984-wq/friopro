// ============================================================
// Centro de Control Empresarial — capa de consolidación visual.
// Solo lectura de módulos existentes + configuración del campus
// por tenant (JSON en CompanySettings). Nunca inventa datos:
// cuando una fuente no responde, el depto queda en 'nodata'.
// ============================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';

type DeptLayer = 'STRATEGIC' | 'OPERATIONAL' | 'SUPPORT';
type DeptSalud = 'ok' | 'warn' | 'crit' | 'nodata';

interface EmpresaDept {
  key: string;
  name: string;
  sub?: string;
  responsable?: string;
  model: string;        // modelo GLB en /cc-assets/3d
  moduleKey?: string;   // fuente de datos para el agregador
  moduleHref?: string;  // link "abrir módulo"
  layer: DeptLayer;
  enabled: boolean;
  campusPos?: { x: number; z: number };
  procPos?: { x: number; z: number };
  processId?: string | null;                         // proceso real del mapa (opcional)
  umbrales?: { warn?: number | null; crit?: number | null } | null; // alertas → semáforo
}

interface EmpresaConn {
  from: string; // dept.key
  to: string;
  label?: string;
  tipo?: string; // ENTRADA | SALIDA | INFORMACION | RECURSO
}

interface EmpresaConfig {
  defaultTemplate: 'campus' | 'procesos';
  departments: EmpresaDept[];
  connections: EmpresaConn[];
}

// Modelos de edificio disponibles en la biblioteca (cc-assets/3d)
export const BUILDING_MODELS = [
  'office-building', 'site-office', 'factory', 'warehouse',
  'car-wash', 'gas-station', 'water-tower',
];

const DEFAULT_DEPARTMENTS: EmpresaDept[] = [
  { key: 'direccion', name: 'DIRECCIÓN', sub: 'Estrategia y gobierno', model: 'office-building', moduleKey: 'resultados', moduleHref: '/resultados', layer: 'STRATEGIC', enabled: true },
  { key: 'administracion', name: 'ADMINISTRACIÓN', sub: 'Gestión y finanzas', model: 'office-building', moduleKey: 'resultados', moduleHref: '/resultados', layer: 'SUPPORT', enabled: true },
  { key: 'calidad', name: 'CALIDAD', sub: 'NCs, CAPA y auditorías', model: 'office-building', moduleKey: 'calidad', moduleHref: '/calidad', layer: 'OPERATIONAL', enabled: true },
  { key: 'trafico', name: 'TRÁFICO', sub: 'Logística y transporte', model: 'gas-station', moduleKey: 'flota', moduleHref: '/flota-360', layer: 'OPERATIONAL', enabled: true },
  { key: 'mantenimiento', name: 'MANTENIMIENTO', sub: 'Taller y disponibilidad', model: 'warehouse', moduleKey: 'flota', moduleHref: '/flota-360/ordenes', layer: 'SUPPORT', enabled: true },
  { key: 'produccion', name: 'PRODUCCIÓN', sub: 'Planta y operación', model: 'factory', moduleKey: 'procesos', moduleHref: '/contexto-sgi', layer: 'OPERATIONAL', enabled: true },
  { key: 'rrhh', name: 'RECURSOS HUMANOS', sub: 'Personal y capacitación', model: 'office-building', moduleKey: 'rrhh', moduleHref: '/rrhh', layer: 'SUPPORT', enabled: true },
  { key: 'sistemas', name: 'SISTEMAS', sub: 'Tecnología e infraestructura', model: 'office-building', layer: 'SUPPORT', enabled: true },
  { key: 'comercial', name: 'COMERCIAL', sub: 'Ventas y clientes', model: 'office-building', moduleKey: 'clientes', moduleHref: '/clientes', layer: 'OPERATIONAL', enabled: true },
  { key: 'compras', name: 'COMPRAS', sub: 'Proveedores y abastecimiento', model: 'office-building', moduleKey: 'proveedores', moduleHref: '/proveedores', layer: 'SUPPORT', enabled: true },
  { key: 'documental', name: 'GESTIÓN DOCUMENTAL', sub: 'Documentos y registros', model: 'office-building', moduleKey: 'documents', moduleHref: '/documents', layer: 'SUPPORT', enabled: true },
  { key: 'deposito', name: 'DEPÓSITO', sub: 'Almacenamiento y despacho', model: 'warehouse', moduleKey: 'infraestructura', moduleHref: '/infraestructura', layer: 'OPERATIONAL', enabled: true },
];

const DEFAULT_CONNECTIONS: EmpresaConn[] = [
  { from: 'comercial', to: 'produccion', label: 'Pedidos', tipo: 'ENTRADA' },
  { from: 'produccion', to: 'trafico', label: 'Producto terminado', tipo: 'SALIDA' },
  { from: 'trafico', to: 'comercial', label: 'Entrega al cliente', tipo: 'SALIDA' },
  { from: 'compras', to: 'mantenimiento', label: 'Repuestos', tipo: 'RECURSO' },
  { from: 'compras', to: 'deposito', label: 'Insumos', tipo: 'RECURSO' },
  { from: 'mantenimiento', to: 'trafico', label: 'Unidades disponibles', tipo: 'RECURSO' },
  { from: 'rrhh', to: 'produccion', label: 'Personal capacitado', tipo: 'RECURSO' },
  { from: 'documental', to: 'calidad', label: 'Registros', tipo: 'INFORMACION' },
  { from: 'calidad', to: 'direccion', label: 'Desempeño SGI', tipo: 'INFORMACION' },
  { from: 'administracion', to: 'direccion', label: 'Resultado del negocio', tipo: 'INFORMACION' },
];

const DEFAULT_CONFIG: EmpresaConfig = {
  defaultTemplate: 'campus',
  departments: DEFAULT_DEPARTMENTS,
  connections: DEFAULT_CONNECTIONS,
};

const deptSchema = z.object({
  key: z.string().min(1).max(40),
  name: z.string().min(1).max(60),
  sub: z.string().max(120).optional(),
  responsable: z.string().max(120).optional(),
  model: z.string().min(1).max(60),
  moduleKey: z.string().max(60).optional().nullable(),
  moduleHref: z.string().max(200).optional().nullable(),
  layer: z.enum(['STRATEGIC', 'OPERATIONAL', 'SUPPORT']),
  enabled: z.boolean(),
  campusPos: z.object({ x: z.number(), z: z.number() }).optional().nullable(),
  procPos: z.object({ x: z.number(), z: z.number() }).optional().nullable(),
  processId: z.string().uuid().optional().nullable(),
  umbrales: z.object({
    warn: z.number().min(0).optional().nullable(),
    crit: z.number().min(0).optional().nullable(),
  }).optional().nullable(),
});

const configSchema = z.object({
  defaultTemplate: z.enum(['campus', 'procesos']),
  departments: z.array(deptSchema).max(40),
  connections: z.array(z.object({
    from: z.string(), to: z.string(),
    label: z.string().max(120).optional().nullable(),
    tipo: z.string().max(40).optional().nullable(),
  })).max(120),
});

// Salud por departamento según métricas agregadas.
// crit > warn > ok > nodata (nodata solo si ninguna fuente respondió).
function saludFor(crit: number, warn: number, sawData: boolean): DeptSalud {
  if (crit > 0) return 'crit';
  if (warn > 0) return 'warn';
  return sawData ? 'ok' : 'nodata';
}

export async function centroEmpresaRoutes(app: FastifyInstance) {
  const prisma = () => (app as any).prisma;

  // Consulta defensiva: devuelve null si el modelo/campo no existe o falla.
  // Tipado any a propósito: prisma() es any y un genérico aquí colapsa a {}.
  const safe = async (fn: () => Promise<any>): Promise<any> => {
    try { return await fn(); } catch { return null; }
  };

  // ── Configuración por tenant ─────────────────────────────
  app.get('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const s = await prisma().companySettings.findUnique({
      where: { tenantId }, select: { centroEmpresaConfig: true },
    }).catch(() => null);
    const saved = (s?.centroEmpresaConfig as EmpresaConfig | null) || null;
    // Merge: los deptos guardados pisan los defaults por key (compat hacia adelante)
    const config: EmpresaConfig = saved?.departments?.length
      ? { ...DEFAULT_CONFIG, ...saved }
      : DEFAULT_CONFIG;
    return reply.send({ config, models: BUILDING_MODELS });
  });

  app.put('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const parsed = configSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Config inválida', details: parsed.error.issues });
    }
    const userId = (req as any).auth?.userId;
    await prisma().companySettings.upsert({
      where: { tenantId },
      update: { centroEmpresaConfig: parsed.data as any, updatedById: userId },
      create: {
        tenantId,
        companyName: (req as any).tenant?.name || 'Empresa',
        centroEmpresaConfig: parsed.data as any,
        updatedById: userId,
      },
    });
    return reply.send({ ok: true, config: parsed.data });
  });

  // ── Procesos reales del tenant (para el configurador) ────
  app.get('/procesos-disponibles', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const items = await safe(() => prisma().process.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, code: true, layer: true, parentId: true },
      orderBy: [{ layer: 'asc' }, { name: 'asc' }],
    }));
    return reply.send({ procesos: items ?? [] });
  });

  // ── Preferencia de plantilla por usuario (User.preferences) ─
  const resolveUser = async (req: FastifyRequest) => {
    const userId = (req as any).auth?.userId;
    if (!userId) return null;
    const platformUser = await prisma().platformUser.findUnique({ where: { id: userId }, select: { email: true } });
    if (!platformUser) return null;
    return prisma().user.findUnique({ where: { email: platformUser.email } });
  };

  app.get('/preferencia', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const user = await resolveUser(req).catch(() => null);
    const pref = (user?.preferences as any)?.centroEmpresa?.template;
    return reply.send({ template: pref === 'campus' || pref === 'procesos' ? pref : null });
  });

  app.put('/preferencia', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { template } = z.object({ template: z.enum(['campus', 'procesos']) }).parse(req.body);
    const user = await resolveUser(req).catch(() => null);
    if (!user) return reply.send({ ok: false }); // no-employee: nada que persistir
    const prefs = { ...((user.preferences as any) || {}), centroEmpresa: { template } };
    await prisma().user.update({ where: { id: user.id }, data: { preferences: prefs } });
    return reply.send({ ok: true });
  });

  // ── Resumen agregado por departamento (solo lectura) ──────
  app.get('/resumen', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const now = new Date();

    // Métricas transversales — cada una defensiva; null = fuente no disponible.
    const [
      ncAbiertas, ncVencidas,
      objTotal, objActivos,
      indTotal, capProximas,
      auditTotal, auditCompletas,
      procesos, docVencidos, vehiculos,
      riesgosAltos, reclamos,
    ] = await Promise.all([
      safe(() => prisma().nonConformity.count({ where: { tenantId, status: { not: 'CLOSED' } } })),
      safe(() => prisma().nonConformity.count({ where: { tenantId, status: { not: 'CLOSED' }, dueDate: { lt: now } } })),
      safe(() => prisma().sgiObjective.count({ where: { tenantId, deletedAt: null } })),
      safe(() => prisma().sgiObjective.count({ where: { tenantId, deletedAt: null, status: { in: ['ACTIVE', 'IN_PROGRESS', 'EN_PROGRESO', 'ACTIVO'] } } })),
      safe(() => prisma().indicator.count({ where: { tenantId } })),
      safe(() => prisma().sgiTraining.count({ where: { tenantId, status: { in: ['PLANNED', 'SCHEDULED', 'PROGRAMADA'] } } })),
      safe(() => prisma().audit.count({ where: { tenantId } })),
      safe(() => prisma().audit.count({ where: { tenantId, status: 'COMPLETED' } })),
      safe(() => prisma().process.count({ where: { tenantId, deletedAt: null, parentId: null } })),
      safe(() => prisma().document.count({ where: { tenantId, deletedAt: null, status: 'OBSOLETE' } })),
      safe(() => prisma().vehiculo.count({ where: { tenantId, deletedAt: null } })),
      safe(() => prisma().risk.count({ where: { tenantId, level: 'HIGH' } })),
      safe(async () => (await prisma().customerComplaint?.count({ where: { tenantId, status: { not: 'CLOSED' } } })) ?? null),
    ]);

    const kpisFor = (moduleKey?: string | null): { kpis: { label: string; value: string | number }[]; alertas: { label: string; nivel: 'warn' | 'crit' }[]; salud: DeptSalud } => {
      const kpis: { label: string; value: string | number }[] = [];
      const alertas: { label: string; nivel: 'warn' | 'crit' }[] = [];
      let crit = 0, warn = 0, sawData = false;

      switch (moduleKey) {
        case 'calidad': {
          if (ncAbiertas !== null) { kpis.push({ label: 'NCs abiertas', value: ncAbiertas }); sawData = true; }
          if (ncVencidas !== null && ncVencidas > 0) {
            alertas.push({ label: `${ncVencidas} acciones vencidas`, nivel: 'crit' }); crit += ncVencidas;
          }
          if (auditTotal !== null) { kpis.push({ label: 'Auditorías', value: `${auditCompletas ?? '—'}/${auditTotal}` }); sawData = true; }
          if (reclamos !== null) { kpis.push({ label: 'Reclamos abiertos', value: reclamos }); if (reclamos > 0) warn += reclamos; }
          break;
        }
        case 'rrhh': {
          if (capProximas !== null) { kpis.push({ label: 'Capacitaciones programadas', value: capProximas }); sawData = true; }
          break;
        }
        case 'flota': {
          if (vehiculos !== null) { kpis.push({ label: 'Unidades en flota', value: vehiculos }); sawData = true; }
          break;
        }
        case 'resultados': {
          if (riesgosAltos !== null && riesgosAltos > 0) {
            alertas.push({ label: `${riesgosAltos} riesgos altos`, nivel: 'warn' }); warn += riesgosAltos;
          }
          sawData = riesgosAltos !== null;
          break;
        }
        case 'procesos': {
          if (procesos !== null) { kpis.push({ label: 'Procesos en el mapa', value: procesos }); sawData = true; }
          break;
        }
        case 'documents': {
          if (docVencidos !== null && docVencidos > 0) {
            alertas.push({ label: `${docVencidos} docs obsoletos`, nivel: 'warn' }); warn += docVencidos;
          }
          sawData = docVencidos !== null;
          break;
        }
        case 'clientes': {
          if (reclamos !== null) { kpis.push({ label: 'Reclamos abiertos', value: reclamos }); if (reclamos > 0) warn += reclamos; sawData = true; }
          break;
        }
        case 'objetivos': {
          if (objTotal !== null) { kpis.push({ label: 'Objetivos activos', value: `${objActivos ?? '—'}/${objTotal}` }); sawData = true; }
          break;
        }
        case 'indicadores': {
          if (indTotal !== null) { kpis.push({ label: 'Indicadores configurados', value: indTotal }); sawData = true; }
          break;
        }
        default: break;
      }
      return { kpis, alertas, salud: saludFor(crit, warn, sawData) };
    };

    const s = await prisma().companySettings.findUnique({
      where: { tenantId }, select: { centroEmpresaConfig: true },
    }).catch(() => null);
    const saved = (s?.centroEmpresaConfig as EmpresaConfig | null) || null;
    const config: EmpresaConfig = saved?.departments?.length ? { ...DEFAULT_CONFIG, ...saved } : DEFAULT_CONFIG;

    // Procesos reales vinculados por processId — KPIs del proceso (solo lectura)
    const processIds = config.departments.map((d) => d.processId).filter(Boolean) as string[];
    const procs = (processIds.length
      ? await safe(() => prisma().process.findMany({
          where: { tenantId, deletedAt: null, id: { in: processIds } },
          select: {
            id: true, name: true, code: true, owner: true,
            _count: { select: { processIndicators: true, processRisks: true, children: true, sgiObjectives: true } },
            children: { where: { deletedAt: null }, select: { id: true, name: true, code: true } },
          },
        }))
      : null) ?? [];
    const procById = new Map(procs.map((p: any) => [p.id, p]));

    const departments = config.departments.filter((d) => d.enabled).map((d) => {
      const agg = kpisFor(d.moduleKey);
      const kpis = [...agg.kpis];
      const alertas = [...agg.alertas];
      let { salud } = agg;
      const proc: any = d.processId ? procById.get(d.processId) : null;
      if (proc) {
        if (salud === 'nodata') salud = 'ok';
        kpis.push({ label: 'Indicadores del proceso', value: proc._count.processIndicators });
        kpis.push({ label: 'Riesgos', value: proc._count.processRisks });
        if (proc._count.children > 0) kpis.push({ label: 'Subprocesos', value: proc._count.children });
        if (proc._count.sgiObjectives > 0) kpis.push({ label: 'Objetivos vinculados', value: proc._count.sgiObjectives });
      }
      // Umbrales configurados: N alertas activas → warn/crit (solo escala, nunca baja)
      const u = d.umbrales;
      const nAlerts = alertas.length;
      if (u?.crit != null && nAlerts >= u.crit) salud = 'crit';
      else if (u?.warn != null && nAlerts >= u.warn && salud !== 'crit') salud = 'warn';

      return {
        key: d.key, name: d.name, sub: d.sub, responsable: d.responsable,
        moduleHref: d.moduleHref, layer: d.layer, kpis, alertas, salud,
        processId: d.processId ?? null,
        proceso: proc ? { id: proc.id, name: proc.name, code: proc.code, owner: proc.owner } : null,
        subprocesos: proc ? proc.children.map((c: any) => ({ id: c.id, name: c.name, code: c.code })) : [],
      };
    });

    // Consolidado ejecutivo
    const crits = departments.filter((d) => d.salud === 'crit').length;
    const warns = departments.filter((d) => d.salud === 'warn').length;
    const oks = departments.filter((d) => d.salud === 'ok').length;

    return reply.send({
      departments,
      connections: config.connections,
      resumen: {
        departamentos: departments.length,
        enObjetivo: oks,
        conDesvio: warns,
        criticos: crits,
        sinDatos: departments.filter((d) => d.salud === 'nodata').length,
        ncAbiertas: ncAbiertas ?? null,
        ncVencidas: ncVencidas ?? null,
        objetivos: objTotal !== null ? { activos: objActivos ?? null, total: objTotal } : null,
        indicadores: indTotal,
        procesosEnMapa: procesos,
      },
    });
  });
}
