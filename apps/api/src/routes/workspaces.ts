import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';

// ─────────────────────────────────────────────────────────────────────────────
// Workspaces multi-país: un grupo empresario = 1 tenant raíz + N tenants hijos
// (Tenant.parentTenantId → raíz). Cada workspace es un tenant aislado que
// comparte plan, licencia y miembros con la raíz.
// ─────────────────────────────────────────────────────────────────────────────

const COUNTRIES: Record<string, { name: string; flag: string }> = {
  AR: { name: 'Argentina', flag: '🇦🇷' },
  CL: { name: 'Chile', flag: '🇨🇱' },
  BR: { name: 'Brasil', flag: '🇧🇷' },
  UY: { name: 'Uruguay', flag: '🇺🇾' },
  PY: { name: 'Paraguay', flag: '🇵🇾' },
  BO: { name: 'Bolivia', flag: '🇧🇴' },
  PE: { name: 'Perú', flag: '🇵🇪' },
  EC: { name: 'Ecuador', flag: '🇪🇨' },
  CO: { name: 'Colombia', flag: '🇨🇴' },
  VE: { name: 'Venezuela', flag: '🇻🇪' },
  MX: { name: 'México', flag: '🇲🇽' },
  US: { name: 'Estados Unidos', flag: '🇺🇸' },
  ES: { name: 'España', flag: '🇪🇸' },
};

function isAdmin(req: FastifyRequest): boolean {
  return req.auth?.globalRole === 'SUPER_ADMIN' || req.auth?.tenantRole === 'TENANT_ADMIN';
}

// IDs de todos los workspaces del grupo (raíz + hijos)
async function groupTenantIds(db: any, tenantId: string): Promise<{ rootId: string; ids: string[] }> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, parentTenantId: true } });
  const rootId = tenant?.parentTenantId ?? tenantId;
  const children = await db.tenant.findMany({
    where: { parentTenantId: rootId, deletedAt: null },
    select: { id: true },
  });
  return { rootId, ids: [rootId, ...children.map((c: any) => c.id)] };
}

async function logoMap(db: any, tenantIds: string[]): Promise<Map<string, string | null>> {
  const rows = await db.companySettings.findMany({
    where: { tenantId: { in: tenantIds } },
    select: { tenantId: true, logoUrl: true },
  });
  return new Map(rows.map((r: any) => [r.tenantId, r.logoUrl]));
}

// Nombre base del grupo: quita el sufijo de país si la raíz ya lo tiene
// ("Dada Argentina" → "Dada") para que el hijo quede "Dada Chile".
function baseGroupName(rootName: string): string {
  for (const c of Object.values(COUNTRIES)) {
    const suffix = ` ${c.name}`;
    if (rootName.toLowerCase().endsWith(suffix.toLowerCase())) {
      return rootName.slice(0, rootName.length - suffix.length).trim();
    }
  }
  return rootName.trim();
}

export async function workspacesRoutes(app: FastifyInstance) {
  // ── GET /workspaces — workspaces del grupo del tenant actual ──
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth) return reply.code(401).send({ error: 'No autorizado' });
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

    const { rootId, ids } = await groupTenantIds(app.prisma, tenantId);
    const [tenants, logos, memberCounts, myMemberships] = await Promise.all([
      app.prisma.tenant.findMany({
        where: { id: { in: ids }, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
      logoMap(app.prisma, ids),
      app.prisma.tenantMembership.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: ids }, status: 'ACTIVE', deletedAt: null },
        _count: { _all: true },
      }),
      app.prisma.tenantMembership.findMany({
        where: { userId: req.auth.userId, tenantId: { in: ids }, status: 'ACTIVE', deletedAt: null },
        select: { tenantId: true, role: true },
      }),
    ]);

    const countByTenant = new Map(memberCounts.map((m: any) => [m.tenantId, m._count._all]));
    const myByTenant = new Map(myMemberships.map((m: any) => [m.tenantId, m.role]));

    return reply.send({
      groupRootId: rootId,
      currentTenantId: tenantId,
      countries: Object.entries(COUNTRIES).map(([code, c]) => ({ code, ...c })),
      workspaces: tenants.map((t: any) => ({
        tenantId: t.id,
        name: t.name,
        slug: t.slug,
        country: t.country ?? null,
        isRoot: t.id === rootId,
        logoUrl: logos.get(t.id) ?? null,
        memberCount: countByTenant.get(t.id) ?? 0,
        myRole: myByTenant.get(t.id) ?? null,
        isCurrent: t.id === tenantId,
      })),
    });
  });

  // ── POST /workspaces — crear workspace de país (Dada Chile, Dada Brasil…) ──
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth) return reply.code(401).send({ error: 'No autorizado' });
    if (!isAdmin(req)) return reply.code(403).send({ error: 'Solo administradores pueden crear workspaces' });
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

    const body = z.object({
      country: z.string().min(2).max(2).transform((s) => s.toUpperCase()),
      name: z.string().min(1).max(120).optional(),
      copyMembers: z.boolean().default(true),
    }).parse(req.body);

    if (!COUNTRIES[body.country]) {
      return reply.code(400).send({ error: 'País no soportado', countries: Object.keys(COUNTRIES) });
    }

    const { rootId, ids } = await groupTenantIds(app.prisma, tenantId);
    const root = await app.prisma.tenant.findUnique({ where: { id: rootId } });
    if (!root) return reply.code(404).send({ error: 'Workspace raíz no encontrado' });

    // No duplicar país dentro del grupo
    const siblings = await app.prisma.tenant.findMany({ where: { id: { in: ids }, deletedAt: null } });
    if (siblings.some((t: any) => t.country === body.country)) {
      return reply.code(409).send({ error: `Ya existe un workspace para ${COUNTRIES[body.country].name} en este grupo` });
    }

    const name = body.name?.trim() || `${baseGroupName(root.name)} ${COUNTRIES[body.country].name}`;
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    // Crear tenant hijo heredando licencia de la raíz
    const child = await app.prisma.tenant.create({
      data: {
        name,
        slug,
        country: body.country,
        parentTenantId: rootId,
        licensePlan: root.licensePlan,
        licenseStartAt: root.licenseStartAt,
        licenseEndAt: root.licenseEndAt,
        licenseStatus: root.licenseStatus,
        graceEndAt: root.graceEndAt,
        createdById: req.auth.userId,
      } as any,
    });

    // Copiar suscripción activa (mismo plan) — es lo que habilita los módulos
    const sub = await app.prisma.tenantSubscription.findFirst({
      where: { tenantId: rootId, deletedAt: null, status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] } },
      orderBy: { startedAt: 'desc' },
    });
    if (sub) {
      await app.prisma.tenantSubscription.create({
        data: {
          tenantId: child.id,
          planId: sub.planId,
          status: sub.status,
          startedAt: new Date(),
          endsAt: sub.endsAt,
          price: sub.price,
        } as any,
      });
    }

    // Overrides de features
    const features = await app.prisma.tenantFeature.findMany({
      where: { tenantId: rootId, deletedAt: null },
    });
    for (const f of features) {
      await app.prisma.tenantFeature.create({
        data: { tenantId: child.id, key: f.key, enabled: f.enabled, config: f.config as any },
      });
    }

    // Branding: clonar CompanySettings (logo incluido) ajustando el nombre
    const cs = await (app.prisma as any).companySettings.findUnique({ where: { tenantId: rootId } });
    if (cs) {
      const { id, tenantId: _t, createdAt: _c, updatedAt: _u, ...rest } = cs;
      await (app.prisma as any).companySettings.create({
        data: { ...rest, tenantId: child.id, companyName: name },
      });
    }

    // TenantSetup PAID para que no pida onboarding/checkout
    await (app.prisma as any).tenantSetup.upsert({
      where: { tenantId: child.id },
      update: {},
      create: { tenantId: child.id, amount: 0, currency: 'USD', status: 'PAID', requestedAt: new Date(), paidAt: new Date(), provider: 'workspace' },
    });

    // Membresías: mismo equipo de la raíz con los mismos roles
    if (body.copyMembers) {
      const members = await app.prisma.tenantMembership.findMany({
        where: { tenantId: rootId, status: 'ACTIVE', deletedAt: null },
      });
      for (const m of members) {
        await app.prisma.tenantMembership.create({
          data: { tenantId: child.id, userId: m.userId, role: m.role, status: 'ACTIVE', createdById: req.auth.userId },
        });
      }
    } else {
      // Al menos el creador
      await app.prisma.tenantMembership.upsert({
        where: { tenantId_userId: { tenantId: child.id, userId: req.auth.userId } },
        update: { status: 'ACTIVE', deletedAt: null, role: 'TENANT_ADMIN' },
        create: { tenantId: child.id, userId: req.auth.userId, role: 'TENANT_ADMIN', createdById: req.auth.userId },
      });
    }

    app.prisma.auditEvent.create({
      data: {
        action: 'WORKSPACE_CREATED',
        actorUserId: req.auth.userId,
        tenantId: rootId,
        entityType: 'Tenant',
        entityId: child.id,
        metadata: JSON.stringify({ name, country: body.country }),
      },
    }).catch(() => {});

    return reply.code(201).send({
      workspace: { tenantId: child.id, name: child.name, slug: child.slug, country: body.country, logoUrl: cs?.logoUrl ?? null },
    });
  });

  // ── PATCH /workspaces/:id — renombrar / cambiar país (raíz o hijo del grupo) ──
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth) return reply.code(401).send({ error: 'No autorizado' });
    if (!isAdmin(req)) return reply.code(403).send({ error: 'Solo administradores pueden editar workspaces' });
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      name: z.string().min(1).max(120).optional(),
      country: z.string().min(2).max(2).transform((s) => s.toUpperCase()).nullable().optional(),
    }).parse(req.body);
    if (body.country && !COUNTRIES[body.country]) {
      return reply.code(400).send({ error: 'País no soportado' });
    }

    const { ids } = await groupTenantIds(app.prisma, tenantId);
    if (!ids.includes(id)) return reply.code(404).send({ error: 'Workspace no pertenece a tu grupo' });

    const updated = await app.prisma.tenant.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.country !== undefined && { country: body.country }),
      } as any,
    });
    return reply.send({ workspace: { tenantId: updated.id, name: updated.name, country: (updated as any).country ?? null } });
  });

  // ── POST /workspaces/:id/clone-structure — copiar estructura base entre workspaces ──
  // Secciones: areas | documentTypes | processes | normatives
  app.post('/:id/clone-structure', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth) return reply.code(401).send({ error: 'No autorizado' });
    if (!isAdmin(req)) return reply.code(403).send({ error: 'Solo administradores pueden clonar estructura' });
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      sourceTenantId: z.string().uuid().optional(),
      sections: z.array(z.enum(['areas', 'documentTypes', 'processes', 'normatives'])).default(['areas', 'documentTypes', 'processes']),
    }).parse(req.body ?? {});

    const { rootId, ids } = await groupTenantIds(app.prisma, tenantId);
    if (!ids.includes(id)) return reply.code(404).send({ error: 'Workspace destino no pertenece a tu grupo' });
    const sourceId = body.sourceTenantId ?? (id === rootId ? tenantId : rootId);
    if (!ids.includes(sourceId)) return reply.code(400).send({ error: 'Workspace origen no pertenece a tu grupo' });
    if (sourceId === id) return reply.code(400).send({ error: 'Origen y destino son el mismo workspace' });

    const targetId = id;
    const result: Record<string, number> = { areas: 0, documentTypes: 0, processes: 0, normatives: 0 };

    // ── Áreas (Department) ──
    if (body.sections.includes('areas')) {
      const depts = await app.prisma.department.findMany({
        where: { tenantId: sourceId, deletedAt: null },
        select: { name: true, description: true, color: true },
      });
      if (depts.length) {
        const r = await (app.prisma as any).department.createMany({
          data: depts.map((d: any) => ({ ...d, tenantId: targetId })),
          skipDuplicates: true,
        });
        result.areas = r.count;
      }
    }

    // ── Tipos de documento + configuración de código ──
    if (body.sections.includes('documentTypes')) {
      const types = await (app.prisma as any).documentTypeConfig.findMany({
        where: { tenantId: sourceId, deletedAt: null },
      });
      if (types.length) {
        const r = await (app.prisma as any).documentTypeConfig.createMany({
          data: types.map((t: any) => ({
            tenantId: targetId,
            name: t.name,
            abbreviation: t.abbreviation,
            description: t.description,
            color: t.color,
            nextSequence: t.nextSequence,
          })),
          skipDuplicates: true,
        });
        result.documentTypes = r.count;
      }
      const codeCfg = await (app.prisma as any).documentCodeConfig.findUnique({ where: { tenantId: sourceId } });
      if (codeCfg) {
        await (app.prisma as any).documentCodeConfig.upsert({
          where: { tenantId: targetId },
          update: { prefix: codeCfg.prefix, digitCount: codeCfg.digitCount, separator: codeCfg.separator },
          create: { tenantId: targetId, prefix: codeCfg.prefix, digitCount: codeCfg.digitCount, separator: codeCfg.separator },
        });
      }
    }

    // ── Mapas y procesos ──
    if (body.sections.includes('processes')) {
      // Mapa de departmentId viejo → nuevo (por nombre)
      const [srcDepts, tgtDepts] = await Promise.all([
        app.prisma.department.findMany({ where: { tenantId: sourceId, deletedAt: null }, select: { id: true, name: true } }),
        app.prisma.department.findMany({ where: { tenantId: targetId, deletedAt: null }, select: { id: true, name: true } }),
      ]);
      const deptByName = new Map(tgtDepts.map((d: any) => [d.name, d.id]));
      const mapDept = (oldId: string | null) => {
        if (!oldId) return null;
        const src = srcDepts.find((d: any) => d.id === oldId);
        return src ? deptByName.get(src.name) ?? null : null;
      };

      const maps = await app.prisma.processMap.findMany({
        where: { tenantId: sourceId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });

      for (const map of maps) {
        let targetMap = await app.prisma.processMap.findFirst({
          where: { tenantId: targetId, name: map.name, deletedAt: null },
        });
        if (!targetMap) {
          targetMap = await app.prisma.processMap.create({
            data: {
              tenantId: targetId,
              name: map.name,
              description: map.description,
              scope: map.scope,
              inputLabel: map.inputLabel,
              outputLabel: map.outputLabel,
              createdById: req.auth.userId,
            },
          });
        }

        const srcProcs = await app.prisma.process.findMany({
          where: { tenantId: sourceId, processMapId: map.id, deletedAt: null },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        });
        const existingNames = new Set(
          (await app.prisma.process.findMany({
            where: { tenantId: targetId, processMapId: targetMap.id, deletedAt: null },
            select: { name: true },
          })).map((p: any) => p.name)
        );

        // 2 pasadas: primero padres (parentId null), luego hijos (remap parentId)
        const idMap = new Map<string, string>();
        for (const pass of [false, true]) {
          for (const p of srcProcs) {
            const isChild = Boolean(p.parentId);
            if (isChild !== pass) continue;
            if (existingNames.has(p.name)) {
              const found = await app.prisma.process.findFirst({
                where: { tenantId: targetId, processMapId: targetMap.id, name: p.name, deletedAt: null },
                select: { id: true },
              });
              if (found) idMap.set(p.id, found.id);
              continue;
            }
            const created = await app.prisma.process.create({
              data: {
                tenantId: targetId,
                processMapId: targetMap.id,
                parentId: p.parentId ? idMap.get(p.parentId) ?? null : null,
                layer: p.layer,
                name: p.name,
                code: p.code,
                status: p.status,
                description: p.description,
                owner: p.owner,
                inputs: p.inputs,
                outputs: p.outputs,
                sites: p.sites,
                departmentId: mapDept(p.departmentId),
                indicators: p.indicators,
                documents: p.documents,
                risks: p.risks,
                order: p.order,
                objective: p.objective,
                observations: p.observations,
                activities: p.activities as any,
              },
            });
            idMap.set(p.id, created.id);
            result.processes++;
          }
        }

        // Relaciones internas (clientes/proveedores/flujo) con IDs remapeados
        const remap = (arr: string[]) => (arr ?? []).map((x) => idMap.get(x)).filter(Boolean) as string[];
        for (const p of srcProcs) {
          const newId = idMap.get(p.id);
          if (!newId) continue;
          const patch: any = {};
          if (p.clientsInternal?.length) patch.clientsInternal = remap(p.clientsInternal);
          if (p.suppliersInternal?.length) patch.suppliersInternal = remap(p.suppliersInternal);
          if (p.receivesFrom?.length) patch.receivesFrom = remap(p.receivesFrom);
          if (p.deliversTo?.length) patch.deliversTo = remap(p.deliversTo);
          if (Object.keys(patch).length) {
            await app.prisma.process.update({ where: { id: newId }, data: patch });
          }
        }
      }
    }

    // ── Normativas (metadatos + cláusulas; el archivo se referencia, no se copia) ──
    if (body.sections.includes('normatives')) {
      const norms = await app.prisma.normativeStandard.findMany({
        where: { tenantId: sourceId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      for (const n of norms) {
        const exists = await app.prisma.normativeStandard.findFirst({
          where: { tenantId: targetId, code: n.code, deletedAt: null },
          select: { id: true },
        });
        if (exists) continue;
        const created = await app.prisma.normativeStandard.create({
          data: {
            tenantId: targetId,
            name: n.name,
            code: n.code,
            version: n.version,
            description: n.description,
            originalFileName: n.originalFileName,
            fileSize: n.fileSize,
            filePath: n.filePath,
            fileHash: n.fileHash,
            status: n.status,
            totalClauses: n.totalClauses,
            extractedAt: n.extractedAt,
            createdById: req.auth.userId,
          },
        });
        const clauses = await app.prisma.normativeClause.findMany({
          where: { normativeId: n.id },
          orderBy: { clauseNumber: 'asc' },
        });
        if (clauses.length) {
          await (app.prisma as any).normativeClause.createMany({
            data: clauses.map((c: any) => ({
              normativeId: created.id,
              clauseNumber: c.clauseNumber,
              title: c.title,
              content: c.content,
              parentClauseId: null,
              level: c.level,
              tags: c.tags,
              aiMetadata: c.aiMetadata,
            })),
          });
        }
        result.normatives++;
      }
    }

    app.prisma.auditEvent.create({
      data: {
        action: 'WORKSPACE_STRUCTURE_CLONED',
        actorUserId: req.auth.userId,
        tenantId: targetId,
        entityType: 'Tenant',
        entityId: targetId,
        metadata: JSON.stringify({ sourceTenantId: sourceId, sections: body.sections, result }),
      },
    }).catch(() => {});

    return reply.send({ ok: true, result });
  });
}

export default workspacesRoutes;
