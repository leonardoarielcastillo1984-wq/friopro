import { isSuperAdmin, getEffectiveTenantId } from '../utils/tenant-bypass.js';
/**
 * Rutas dedicadas para IPERC (Peligros SST) con gestion completa ISO 45001.
 * Reemplaza el makeCrud generico de sgi-professional.
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import XLSX from 'xlsx';
import { createGroqOnlyLLMProvider } from '../services/llm/factory.js';

function parseBody(req: FastifyRequest): any {
  let body = req.body as any;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return null; }
  }
  return body;
}

function stripNulls(data: any) {
  Object.keys(data).forEach((k) => {
    if (data[k] === '' || data[k] === undefined) data[k] = null;
  });
}

function parseDates(data: any) {
  for (const k of Object.keys(data)) {
    if (/Date$|At$/.test(k) && typeof data[k] === 'string' && data[k]) {
      data[k] = new Date(data[k]);
    }
  }
}

// Calcular nivel de riesgo segun probabilidad * severidad * exposicion
function computeRiskLevel(probability: number, severity: number, exposure: number) {
  return probability * severity * exposure;
}

function getRiskCategory(level: number): string {
  if (level <= 4) return 'TOLERABLE';
  if (level <= 9) return 'MODERATE';
  if (level <= 15) return 'SUBSTANTIAL';
  return 'INTOLERABLE';
}

export const hazardsRoutes: FastifyPluginAsync = async (app) => {
  

  // --- LIST ---
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const query = req.query as Record<string, string>;
    const where: any = { tenantId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.riskCategory) where.riskCategory = query.riskCategory;

    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          actions: { orderBy: { createdAt: 'desc' } },
          reviews: { orderBy: { reviewDate: 'desc' }, take: 1 },
          _count: { select: { actions: true, reviews: true, nonConformities: true } },
        },
      });
    });
    return reply.send({ items });
  });

  // --- DETAIL ---
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.findUnique({
        where: { id, tenantId: tenantId, deletedAt: null },
        include: {
          actions: { orderBy: { createdAt: 'desc' } },
          reviews: { orderBy: { reviewDate: 'desc' } },
          nonConformities: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      });
    });
    if (!item) return reply.code(404).send({ error: 'Registro no encontrado.' });
    return reply.send({ item });
  });

  // --- CREATE ---
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'El cuerpo de la solicitud es inválido.' });
    delete body.id;

    stripNulls(body);
    parseDates(body);

    // Auto-compute riskLevel and riskCategory if not provided
    if (typeof body.probability === 'number' && typeof body.severity === 'number') {
      const exposure = body.exposure ?? 1;
      body.riskLevel = computeRiskLevel(body.probability, body.severity, exposure);
      body.riskCategory = getRiskCategory(body.riskLevel);
    }

    // Auto code IPERC
    if (!body.code) {
      const year = new Date().getFullYear();
      const count = await app.prisma.hazard.count({
        where: { tenantId: tenantId, code: { startsWith: `IPERC-${year}-` } },
      });
      body.code = `IPERC-${year}-${String(count + 1).padStart(3, '0')}`;
    }

    const data: any = { ...body, tenantId: tenantId };
    delete data.createdById;
    delete data.updatedById;

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.create({ data });
    });
    return reply.send({ item });
  });

  // --- UPDATE ---
  app.put('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'El cuerpo de la solicitud es inválido.' });
    delete body.id; delete body.tenantId; delete body.createdAt;
    stripNulls(body);
    parseDates(body);

    if (typeof body.probability === 'number' && typeof body.severity === 'number') {
      const exposure = body.exposure ?? 1;
      body.riskLevel = computeRiskLevel(body.probability, body.severity, exposure);
      body.riskCategory = getRiskCategory(body.riskLevel);
    }

    delete body.updatedById;
    delete body.createdById;

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.update({
        where: { id, tenantId: tenantId, deletedAt: null },
        data: body,
      });
    });
    return reply.send({ item });
  });

  // --- PATCH ---
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'El cuerpo de la solicitud es inválido.' });
    delete body.id; delete body.tenantId;
    stripNulls(body);
    parseDates(body);

    if (typeof body.probability === 'number' && typeof body.severity === 'number') {
      const exposure = body.exposure ?? 1;
      body.riskLevel = computeRiskLevel(body.probability, body.severity, exposure);
      body.riskCategory = getRiskCategory(body.riskLevel);
    }

    delete body.updatedById;
    delete body.createdById;

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.update({
        where: { id, tenantId: tenantId, deletedAt: null },
        data: body,
      });
    });
    return reply.send({ item });
  });

  // --- SOFT DELETE ---
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.update({
        where: { id, tenantId: tenantId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    });
    return reply.send({ item });
  });

  // --- IMPORT ---
  // POST /hazards/import — sube la matriz IPERC en Excel (la misma plantilla
  // que se descarga del sitio u otra con headers equivalentes) y crea un
  // Hazard por fila con sus acciones de tratamiento.
  app.post('/import', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const data = await (req as any).file();
    if (!data) return reply.code(400).send({ error: 'No se recibió archivo' });
    const mimeOk = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ].includes(data.mimetype);
    if (!mimeOk) return reply.code(400).send({ error: 'Solo se aceptan archivos Excel (.xlsx, .xls)' });

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const wb = XLSX.read(Buffer.concat(chunks), { type: 'buffer' });

    const norm = (h: string) => String(h || '').trim().toLowerCase()
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

    // La plantilla tiene título + datos de encabezado antes de la fila de
    // headers: se detecta la hoja y fila correctas exigiendo ≥2 celdas que
    // sean headers conocidos (una de peligro + una de proceso/tarea), así el
    // título "Identificación de Peligros" no se confunde con la fila real.
    const H_PELIGRO = ['peligro_identificado', 'peligro', 'hazard'];
    const H_PROCESO = ['proceso_tarea', 'proceso', 'tarea', 'actividad', 'actividad_tarea', 'puesto', 'area_puesto', 'area_actividad'];
    let wsSheet: XLSX.WorkSheet | null = null;
    let headerRowIdx = -1;
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const grid = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      const idx = grid.findIndex((row: any[]) => {
        const cells = row.map((c: any) => norm(String(c)));
        return cells.some(c => H_PELIGRO.includes(c)) && cells.some(c => H_PROCESO.includes(c));
      });
      if (idx >= 0) { wsSheet = ws; headerRowIdx = idx; break; }
    }
    if (!wsSheet || headerRowIdx < 0) {
      return reply.code(400).send({ error: 'No se encontró la fila de encabezados (columna "Peligro")' });
    }

    // Campo "Área / Proceso:" de la fila de encabezado de la plantilla (si vino completo).
    const gridTop = XLSX.utils.sheet_to_json<any[]>(wsSheet, { header: 1, defval: '', range: 0, blankrows: true });
    let areaGlobal = '';
    for (const row of gridTop.slice(0, headerRowIdx)) {
      for (let i = 0; i < row.length - 1; i++) {
        const cell = norm(String(row[i]));
        if (cell === 'area_proceso' || cell === 'area') {
          const v = String(row[i + 1] || '').trim();
          if (v) areaGlobal = v;
        }
      }
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wsSheet, { defval: '', range: headerRowIdx });
    if (!rows.length) return reply.code(400).send({ error: 'La hoja no contiene filas de datos' });

    const getVal = (row: Record<string, any>, keys: string[]) => {
      for (const k of keys) {
        for (const ok of Object.keys(row)) {
          if (norm(ok) === k) return row[ok];
        }
      }
      return undefined;
    };
    const toInt = (v: any, fb?: number) => {
      const s = String(v ?? '').trim();
      if (s === '') return fb; // Number('') es 0 en JS — la celda vacía no es cero, es "sin dato"
      const n = Number(s);
      return Number.isFinite(n) ? Math.trunc(n) : fb;
    };
    const toBool = (v: any) => {
      const s = String(v ?? '').trim().toLowerCase();
      if (['si', 'sí', 's', 'true', '1', 'yes', 'y'].includes(s)) return true;
      if (['no', 'n', 'false', '0'].includes(s)) return false;
      return undefined;
    };
    const toDate = (v: any) => {
      if (v == null || v === '') return undefined;
      if (v instanceof Date && !isNaN(+v)) return v;
      if (typeof v === 'number') { // serial Excel
        const d = XLSX.SSF.parse_date_code(v);
        if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
      }
      const d = new Date(String(v));
      return isNaN(+d) ? undefined : d;
    };

    // Responsables: match difuso por nombre completo contra empleados.
    const employees = await app.runWithDbContext(req, async (tx: any) =>
      tx.employee.findMany({ where: { tenantId, status: 'ACTIVE' }, select: { id: true, firstName: true, lastName: true } })
    );
    const normName = (s: string) => norm(s).replace(/_/g, ' ').trim();
    const matchEmployee = (nombre: string) => {
      const n = normName(nombre);
      if (!n) return null;
      return employees.find((e: any) => normName(`${e.firstName} ${e.lastName}`) === n)
          || employees.find((e: any) => n.includes(normName(e.lastName)) || normName(`${e.firstName} ${e.lastName}`).includes(n))
          || null;
    };

    const year = new Date().getFullYear();
    let codeSeq = await app.prisma.hazard.count({
      where: { tenantId, code: { startsWith: `IPERC-${year}-` } },
    });

    let created = 0, skipped = 0;
    const errors: { fila: number; error: string }[] = [];

    await app.runWithDbContext(req, async (tx: any) => {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const actividad = String(getVal(r, ['proceso_tarea', 'proceso', 'tarea', 'actividad', 'actividad_tarea', 'puesto', 'area_puesto', 'area_actividad']) ?? '').trim();
        const peligro = String(getVal(r, ['peligro_identificado', 'peligro', 'hazard']) ?? '').trim();
        if (!actividad && !peligro) { skipped++; continue; }

        const tipo = String(getVal(r, ['tipo_de_peligro', 'tipo_peligro', 'tipo', 'clasificacion']) ?? '').trim();
        const expuestos = String(getVal(r, ['personas_expuestas', 'expuestos', 'trabajadores_expuestos']) ?? '').trim();
        const prob = toInt(getVal(r, ['probabilidad_1_5', 'probabilidad', 'probability']), undefined);
        const sev = toInt(getVal(r, ['impacto_severidad_1_5', 'severidad_1_5', 'severidad', 'impacto', 'severity', 'impact']), undefined);
        if (prob == null || sev == null || prob < 1 || prob > 5 || sev < 1 || sev > 5) {
          errors.push({ fila: headerRowIdx + 2 + i, error: 'Probabilidad e Impacto/Severidad (1-5) son requeridos' });
          continue;
        }

        const controles = String(getVal(r, ['controles_existentes', 'controles', 'medidas_de_control', 'control_existente']) ?? '').trim();
        const suficiente = toBool(getVal(r, ['suficiente_s_n', 'suficiente', 'controles_suficientes']));
        const plan = String(getVal(r, ['plan_de_accion', 'plan_accion', 'acciones', 'medidas_correctivas']) ?? '').trim();
        const responsableTxt = String(getVal(r, ['responsable', 'responsable_del_control']) ?? '').trim();
        const fechaLimite = toDate(getVal(r, ['fecha_limite', 'fecha', 'vencimiento', 'plazo']));
        const probPost = toInt(getVal(r, ['prob_post', 'probabilidad_post', 'p_post']), undefined);
        const impPost = toInt(getVal(r, ['imp_post', 'impacto_post', 'i_post']), undefined);
        const exposure = toInt(getVal(r, ['exposicion', 'exposure']), 1) ?? 1;

        const level = prob * sev * exposure;
        const residual = (probPost != null && impPost != null) ? probPost * impPost : null;
        const emp = matchEmployee(responsableTxt);

        try {
          codeSeq += 1;
          const item = await tx.hazard.create({
            data: {
              tenantId,
              code: `IPERC-${year}-${String(codeSeq).padStart(3, '0')}`,
              area: areaGlobal || actividad || 'Sin área',
              activity: actividad || 'Sin actividad',
              hazard: peligro || actividad,
              risk: [tipo ? `Tipo: ${tipo}` : '', expuestos ? `Expuestos: ${expuestos}` : ''].filter(Boolean).join('. ') || 'Riesgo ocupacional',
              probability: prob, severity: sev, exposure,
              riskLevel: level, riskCategory: getRiskCategory(level),
              // El control existente del Excel es un bucket único: se registra
              // como administrativo (el tipo más frecuente) y la evaluación
              // ¿Suficiente? pasa a su flag de eficacia.
              administrative: controles || null,
              administrativeImplemented: controles ? true : false,
              administrativeEffective: suficiente ?? null,
              residualRiskLevel: residual,
              residualRiskCategory: residual != null ? getRiskCategory(residual) : null,
              responsibleId: emp?.id || null,
              status: plan ? 'IN_TREATMENT' : 'OPEN',
            },
          });
          if (plan) {
            await tx.riskAction.create({
              data: {
                tenantId, hazardId: item.id,
                description: plan + (responsableTxt && !emp ? ` (Responsable: ${responsableTxt})` : ''),
                responsibleId: emp?.id || null,
                dueDate: fechaLimite || null,
                status: 'PENDING', effectiveness: 'PENDING',
              },
            });
          }
          created++;
        } catch (e: any) {
          errors.push({ fila: headerRowIdx + 2 + i, error: e?.message || 'Error al crear' });
        }
      }
    });

    return reply.send({ result: { created, skipped, failed: errors.length, errors: errors.slice(0, 20) } });
  });

  // --- RISK ACTIONS ---
  // List actions for a hazard
  app.get('/:id/actions', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const actions = await app.runWithDbContext(req, async (tx: any) => {
      return tx.riskAction.findMany({
        where: { hazardId: id, tenantId: tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });
    return reply.send({ actions });
  });

  // Create action
  app.post('/:id/actions', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'El cuerpo de la solicitud es inválido.' });
    delete body.id; delete body.hazardId; delete body.tenantId; delete body.createdAt; delete body.updatedAt;
    stripNulls(body);
    parseDates(body);

    try {
      const action = await app.runWithDbContext(req, async (tx: any) => {
        return tx.riskAction.create({
          data: {
            ...body,
            tenantId: tenantId,
            hazardId: id,
          },
        });
      });
      return reply.send({ action });
    } catch (e: any) {
      app.log.error('Create action error:', e);
      return reply.code(400).send({ error: 'Datos de la acción inválidos.', detail: e?.message });
    }
  });

  // Update action
  app.put('/:id/actions/:actionId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id: hazardId, actionId } = z.object({ id: z.string().uuid(), actionId: z.string().uuid() }).parse(req.params);
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'El cuerpo de la solicitud es inválido.' });
    delete body.id; delete body.hazardId; delete body.tenantId;
    stripNulls(body);
    parseDates(body);

    try {
      const action = await app.runWithDbContext(req, async (tx: any) => {
        return tx.riskAction.update({
          where: { id: actionId, hazardId, tenantId: tenantId },
          data: body,
        });
      });
      return reply.send({ action });
    } catch (e: any) {
      app.log.error('Update action error:', e);
      return reply.code(400).send({ error: 'Datos de la acción inválidos.', detail: e?.message });
    }
  });

  // Delete action
  app.delete('/:id/actions/:actionId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id: hazardId, actionId } = z.object({ id: z.string().uuid(), actionId: z.string().uuid() }).parse(req.params);

    await app.runWithDbContext(req, async (tx: any) => {
      return tx.riskAction.delete({ where: { id: actionId, hazardId, tenantId: tenantId } });
    });
    return reply.send({ deleted: true });
  });

  // --- RISK REVIEWS ---
  app.get('/:id/reviews', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const reviews = await app.runWithDbContext(req, async (tx: any) => {
      return tx.riskReview.findMany({
        where: { hazardId: id, tenantId: tenantId },
        orderBy: { reviewDate: 'desc' },
      });
    });
    return reply.send({ reviews });
  });

  app.post('/:id/reviews', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'El cuerpo de la solicitud es inválido.' });
    delete body.id; delete body.hazardId; delete body.tenantId; delete body.createdAt; delete body.updatedAt;
    stripNulls(body);
    parseDates(body);

    try {
      const review = await app.runWithDbContext(req, async (tx: any) => {
        return tx.riskReview.create({
          data: {
            ...body,
            tenantId: tenantId,
            hazardId: id,
          },
        });
      });
      return reply.send({ review });
    } catch (e: any) {
      app.log.error('Create review error:', e);
      return reply.code(400).send({ error: 'Datos de la revisión inválidos.', detail: e?.message });
    }
  });

  // --- ALERTS SUMMARY ---
  app.get('/alerts/summary', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const now = new Date();
    const hazards = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.findMany({
        where: { tenantId: tenantId, deletedAt: null },
        include: {
          actions: true,
          reviews: { orderBy: { reviewDate: 'desc' }, take: 1 },
          nonConformities: { where: { deletedAt: null } },
        },
      });
    });

    const alerts = hazards.map((h: any) => {
      const flags: string[] = [];
      // Riesgo alto sin acciones
      if ((h.riskLevel >= 12 || h.riskCategory === 'INTOLERABLE' || h.riskCategory === 'SUBSTANTIAL') && (!h.actions || h.actions.length === 0)) {
        flags.push('high-no-actions');
      }
      // Accion vencida
      const overdueActions = h.actions?.filter((a: any) => a.dueDate && new Date(a.dueDate) < now && a.status !== 'COMPLETED');
      if (overdueActions && overdueActions.length > 0) flags.push('overdue-action');
      // Sin revision
      const lastReview = h.reviews?.[0];
      if (!lastReview) flags.push('no-review');
      // Control no implementado
      const controls = [
        h.eliminationImplemented, h.substitutionImplemented, h.engineeringImplemented,
        h.administrativeImplemented, h.ppeImplemented,
      ];
      if (controls.some((c: any) => c === false)) flags.push('control-not-implemented');
      // Control no eficaz
      const effs = [
        h.eliminationEffective, h.substitutionEffective, h.engineeringEffective,
        h.administrativeEffective, h.ppeEffective,
      ];
      if (effs.some((e: any) => e === false)) flags.push('control-not-effective');
      // Proxima revision vencida
      if (h.reviewDate && new Date(h.reviewDate) < now) flags.push('review-overdue');

      return { hazardId: h.id, code: h.code, area: h.area, flags, actionsCount: h.actions?.length ?? 0 };
    }).filter((a: any) => a.flags.length > 0);

    return reply.send({ alerts, count: alerts.length });
  });

  // --- AUTO CREATE NC (manual trigger) ---
  app.post('/:id/auto-nc', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const hazard = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.findUnique({
        where: { id, tenantId: tenantId, deletedAt: null },
        include: { nonConformities: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 } },
      });
    });
    if (!hazard) return reply.code(404).send({ error: 'Hazard not found' });

    // Condicion: nivel alto o control no eficaz
    const highRisk = hazard.riskLevel >= 12 || hazard.riskCategory === 'INTOLERABLE' || hazard.riskCategory === 'SUBSTANTIAL';
    const ineffectiveControl = [
      hazard.eliminationEffective, hazard.substitutionEffective, hazard.engineeringEffective,
      hazard.administrativeEffective, hazard.ppeEffective,
    ].some((e: any) => e === false);

    if (!highRisk && !ineffectiveControl) {
      return reply.send({ created: false, reason: 'Risk not high and controls effective' });
    }

    // Evitar duplicados recientes (30 dias)
    const recent = hazard.nonConformities?.[0];
    if (recent && recent.createdAt) {
      const days = (Date.now() - new Date(recent.createdAt).getTime()) / (24 * 3600 * 1000);
      if (days < 30) {
        return reply.send({ created: false, reason: 'Recent NC exists', existingNcrId: recent.id });
      }
    }

    const title = `Riesgo SST: ${hazard.code} - ${hazard.area}`;
    const description = `Riesgo identificado en IPERC con nivel ${hazard.riskLevel} (${hazard.riskCategory}). Peligro: ${hazard.hazard}. Riesgo: ${hazard.risk}.`;

    const ncr = await app.runWithDbContext(req, async (tx: any) => {
      const year = new Date().getFullYear();
      const count = await tx.nonConformity.count({
        where: { tenantId: tenantId, code: { startsWith: `NCR-${year}-` } },
      });
      const code = `NCR-${year}-${String(count + 1).padStart(3, '0')}`;

      return tx.nonConformity.create({
        data: {
          tenantId: tenantId,
          code,
          title,
          description,
          source: 'INTERNAL_AUDIT',
          severity: highRisk ? 'CRITICAL' : 'MAJOR',
          status: 'OPEN',
          dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
          hazardId: id,
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
      });
    });

    return reply.send({ created: true, ncr });
  });

  // --- AI ANALYSIS ---
  app.post('/:id/ai-analyze', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const hazard = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.findUnique({
        where: { id, tenantId: tenantId, deletedAt: null },
        include: { actions: true },
      });
    });
    if (!hazard) return reply.code(404).send({ error: 'Hazard not found' });

    const prompt = `Analiza el siguiente riesgo SST de un IPERC (ISO 45001):

Area/Puesto: ${hazard.area}
Actividad: ${hazard.activity}
Peligro: ${hazard.hazard}
Riesgo: ${hazard.risk}
Probabilidad: ${hazard.probability}, Severidad: ${hazard.severity}, Exposicion: ${hazard.exposure}
Nivel de riesgo: ${hazard.riskLevel} (${hazard.riskCategory})
Controles actuales:
- Eliminacion: ${hazard.elimination || 'Ninguno'}
- Sustitucion: ${hazard.substitution || 'Ninguno'}
- Ingenieria: ${hazard.engineering || 'Ninguno'}
- Administrativo: ${hazard.administrative || 'Ninguno'}
- EPP: ${hazard.ppe || 'Ninguno'}
Acciones abiertas: ${hazard.actions?.length || 0}

Tarea:
1. Evalua si la evaluacion del riesgo es coherente.
2. Sugiere controles adicionales si es necesario.
3. Recomienda acciones correctivas si el riesgo es alto o intolerable.
4. Indica si se requiere una revision urgente.

Responde en español, conciso y profesional.`;

    try {
      const tenantId = (req as any).db?.tenantId ?? (req as any).auth?.tenantId ?? null;
      const llm = createGroqOnlyLLMProvider(req.tenant, (app as any).prisma, tenantId, (req as any).auth?.userId ?? null, 'hazards-analysis');
      const aiRes = await llm.chat([{ role: 'user', content: prompt }], 1500);
      return reply.send({ analysis: aiRes?.text || 'Sin respuesta del modelo' });
    } catch (e: any) {
      return reply.code(500).send({ error: 'AI analysis failed', detail: e?.message });
    }
  });
};
