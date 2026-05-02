import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getStorage } from '../services/storage.js';
import { randomUUID } from 'node:crypto';
import { createLLMProvider } from '../services/llm/factory.js';

const storage = getStorage();

function buildDefaultChecklistItems(isoStandard: string[]) {
  const items: Array<{ clause: string; requirement: string; whatToCheck: string }> = [];

  const add = (clause: string, requirement: string, whatToCheck: string) => {
    items.push({ clause, requirement, whatToCheck });
  };

  const standards = isoStandard.length ? isoStandard : ['ISO_9001'];
  for (const std of standards) {
    switch (std) {
      case 'ISO_14001':
        add('6.1', 'Acciones para abordar riesgos y oportunidades', 'Identificar aspectos/impactos y acciones planificadas');
        add('8.1', 'Planificación y control operacional', 'Controles operacionales documentados y registros');
        break;
      case 'ISO_45001':
        add('6.1', 'Acciones para abordar riesgos y oportunidades', 'Evaluación de riesgos SST y controles');
        add('7.2', 'Competencia', 'Evidencia de competencia y formación');
        break;
      case 'ISO_27001':
        add('5.1', 'Liderazgo y compromiso', 'Política y responsabilidades de seguridad');
        add('8.2', 'Evaluación de riesgos', 'Metodología, registros y tratamiento');
        break;
      case 'ISO_39001':
        add('6.1', 'Acciones para abordar riesgos y oportunidades', 'Identificación de factores de desempeño de seguridad vial');
        add('8.1', 'Planificación y control operacional', 'Controles para riesgos viales clave');
        break;
      case 'IATF_16949':
        add('8.5.1', 'Control de producción y servicio', 'Plan de control, trazabilidad y registros');
        add('10.2.3', 'Solución de problemas', 'Metodología y evidencias de resolución');
        break;
      case 'ISO_50001':
        add('6.3', 'Revisión energética', 'Línea base, usos significativos y oportunidades');
        add('9.1', 'Seguimiento y medición', 'Indicadores energéticos y calibración');
        break;
      case 'CUSTOM':
        add('N/A', 'Requisito personalizado', 'Definir y verificar requisitos propios');
        break;
      case 'ISO_9001':
      default:
        add('4.4', 'Sistema de gestión de la calidad y sus procesos', 'Mapa de procesos, entradas/salidas, indicadores');
        add('8.5.1', 'Control de la producción y de la provisión del servicio', 'Procedimientos operativos y registros');
        add('9.1', 'Seguimiento, medición, análisis y evaluación', 'KPIs, análisis y acciones');
        break;
    }
  }

  return items;
}

function buildReportDraft(params: {
  audit: any;
  findings: any[];
  checklist: any[];
}) {
  const { audit, findings, checklist } = params;
  const totalItems = checklist.length;
  const compliantItems = checklist.filter((i) => i.response === 'COMPLIES').length;
  const nonCompliantItems = checklist.filter((i) => i.response === 'DOES_NOT_COMPLY').length;
  const notApplicableItems = checklist.filter((i) => i.response === 'NOT_APPLICABLE').length;
  const answered = checklist.filter((i) => i.response != null).length;

  const denominator = Math.max(1, answered - notApplicableItems);
  const score = answered === 0 ? null : Math.round((compliantItems / denominator) * 10000) / 100; // 2 decimals

  const totalFindings = findings.length;
  const openFindings = findings.filter((f) => f.status !== 'CLOSED').length;
  const closedFindings = findings.filter((f) => f.status === 'CLOSED').length;

  const intervieweesText = audit.interviewees ? ` Entrevistados: ${audit.interviewees}.` : '';

  const executiveSummary =
    `Se realizó la auditoría ${audit.code} (${audit.title}) para el área ${audit.area}. ` +
    `Normas aplicables: ${(audit.isoStandard ?? []).join(', ') || 'N/A'}.` +
    intervieweesText +
    `Se auditaron ${totalItems} ítems de checklist (${answered} respondidos). ` +
    `Conformidades: ${compliantItems}. No conformidades: ${nonCompliantItems}. No aplica: ${notApplicableItems}. ` +
    `Hallazgos registrados: ${totalFindings} (abiertos: ${openFindings}, cerrados: ${closedFindings}).`;

  const conclusion =
    score === null
      ? 'No hay suficiente información del checklist para concluir el nivel de cumplimiento. Completar el checklist para generar una conclusión.'
      : score >= 90
        ? 'El nivel de cumplimiento general es alto. Se recomienda cerrar los hallazgos pendientes y mantener el sistema.'
        : score >= 70
          ? 'El nivel de cumplimiento es aceptable con oportunidades de mejora. Se recomienda ejecutar acciones correctivas para los hallazgos detectados.'
          : 'El nivel de cumplimiento es bajo. Se requiere un plan de acciones correctivas y seguimiento cercano.';

  const processesAudited: string[] = [audit.process || audit.area].filter(Boolean);

  return {
    executiveSummary,
    objective: audit.objective || 'N/A',
    scope: audit.scope || 'N/A',
    processesAudited,
    overallScore: score,
    totalItems,
    compliantItems,
    nonCompliantItems,
    totalFindings,
    openFindings,
    closedFindings,
    conclusion,
  };
}

const CreateProgramSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  name: z.string().min(3),
  description: z.string().optional(),
});

const CreateAuditSchema = z.object({
  programId: z.string().uuid(),
  code: z.string().min(3),
  title: z.string().min(3),
  description: z.string().optional(),
  type: z.enum(['INTERNAL', 'EXTERNAL', 'SUPPLIER', 'CUSTOMER', 'CERTIFICATION', 'RECERTIFICATION', 'SURVEILLANCE']),
  plannedStartDate: z.string().datetime().optional(),
  plannedEndDate: z.string().datetime().optional(),
  duration: z.number().int().positive().optional(),
  leadAuditorId: z.string().uuid(),
  area: z.string().min(1),
  process: z.string().optional(),
  isoStandard: z.array(
    z.enum(['ISO_9001', 'ISO_14001', 'ISO_45001', 'ISO_39001', 'IATF_16949', 'ISO_27001', 'ISO_50001', 'CUSTOM'])
  ),
  scope: z.string().optional(),
  objective: z.string().optional(),
});

const CreateAuditorSchema = z.object({
  type: z.enum(['INTERNAL', 'EXTERNAL']),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  normativeCompetencies: z
    .array(z.enum(['ISO_9001', 'ISO_14001', 'ISO_45001', 'ISO_39001', 'IATF_16949', 'ISO_27001', 'ISO_50001', 'CUSTOM']))
    .optional(),
});

// Routes for ISO Audits module
export async function registerAuditRoutes(app: FastifyInstance) {
  // PROGRAMS
  app.get('/audit/programs', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const programs = await app.runWithDbContext(req, async (tx) => {
      return tx.auditProgram.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { year: 'desc' },
      });
    });

    return reply.send({ programs });
  });

  app.post(
    '/audit/programs',
    async (req: FastifyRequest<{ Body: z.infer<typeof CreateProgramSchema> }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const validation = CreateProgramSchema.safeParse(req.body);
      if (!validation.success) {
        return reply.code(400).send({ error: 'Validación fallida', details: validation.error.errors });
      }

      const { year, name, description } = validation.data;

      const program = await app.runWithDbContext(req, async (tx) => {
        return tx.auditProgram.create({
          data: {
            tenantId,
            year,
            name,
            description,
            createdById: req.auth!.userId,
          },
        });
      });

      return reply.code(201).send({ program });
    },
  );

  // AUDITORS
  app.get('/audit/auditors', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const auditors = await app.runWithDbContext(req, async (tx) => {
      return tx.auditor.findMany({
        where: { tenantId, deletedAt: null, isActive: true },
        orderBy: { name: 'asc' },
      });
    });

    return reply.send({ auditors });
  });

  app.post(
    '/audit/auditors',
    async (req: FastifyRequest<{ Body: z.infer<typeof CreateAuditorSchema> }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const validation = CreateAuditorSchema.safeParse(req.body);
      if (!validation.success) {
        return reply.code(400).send({ error: 'Validación fallida', details: validation.error.errors });
      }

      const auditor = await app.runWithDbContext(req, async (tx) => {
        return tx.auditor.create({
          data: {
            tenantId,
            ...validation.data,
            createdById: req.auth!.userId,
          },
        });
      });

      return reply.code(201).send({ auditor });
    },
  );

  // PATCH /audit/auditors/:id - Actualizar auditor
  app.patch(
    '/audit/auditors/:id',
    async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const body = (req.body ?? {}) as any;
      const data: any = {};

      const setIfDefined = (key: string) => {
        if (key in body) data[key] = body[key];
      };

      setIfDefined('name');
      setIfDefined('email');
      setIfDefined('phone');
      setIfDefined('company');
      setIfDefined('type');
      setIfDefined('isActive');
      setIfDefined('employeeId');
      if ('normativeCompetencies' in body) data.normativeCompetencies = body.normativeCompetencies;

      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: 'No updatable fields provided' });
      }

      const auditor = await app.runWithDbContext(req, async (tx) => {
        const existing = await tx.auditor.findFirst({
          where: { id: req.params.id, tenantId, deletedAt: null },
        });
        if (!existing) return null;

        return tx.auditor.update({
          where: { id: req.params.id },
          data,
        });
      });

      if (!auditor) return reply.code(404).send({ error: 'Auditor not found' });
      return reply.send({ auditor });
    },
  );

  // DELETE /audit/auditors/:id - Eliminar auditor (soft delete)
  app.delete(
    '/audit/auditors/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const auditor = await app.runWithDbContext(req, async (tx) => {
        const existing = await tx.auditor.findFirst({
          where: { id: req.params.id, tenantId, deletedAt: null },
        });
        if (!existing) return null;

        return tx.auditor.update({
          where: { id: req.params.id },
          data: { deletedAt: new Date(), isActive: false },
        });
      });

      if (!auditor) return reply.code(404).send({ error: 'Auditor not found' });
      return reply.send({ success: true, message: 'Auditor eliminado' });
    },
  );

  // ── AUDITOR DOCUMENTS (Certificates/Diplomas) ──
  
  // GET /audit/auditors/:id/documents - Listar documentos del auditor
  app.get(
    '/audit/auditors/:id/documents',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const documents = await app.runWithDbContext(req, async (tx) => {
        // Verificar que el auditor existe y pertenece al tenant
        const auditor = await tx.auditor.findFirst({
          where: { id: req.params.id, tenantId, deletedAt: null },
          select: { id: true },
        });
        if (!auditor) return null;

        return tx.auditorDocument.findMany({
          where: { auditorId: req.params.id, tenantId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        });
      });

      if (documents === null) return reply.code(404).send({ error: 'Auditor not found' });
      return reply.send({ documents });
    },
  );

  // POST /audit/auditors/:id/documents - Subir documento PDF
  app.post(
    '/audit/auditors/:id/documents',
    async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const body = (req.body ?? {}) as any;
      
      if (!body.title || typeof body.title !== 'string') {
        return reply.code(400).send({ error: 'title is required' });
      }
      if (!body.filePath || typeof body.filePath !== 'string') {
        return reply.code(400).send({ error: 'filePath is required' });
      }

      try {
        const document = await app.runWithDbContext(req, async (tx) => {
          // Verificar que el auditor existe y pertenece al tenant
          const auditor = await tx.auditor.findFirst({
            where: { id: req.params.id, tenantId, deletedAt: null },
            select: { id: true },
          });
          if (!auditor) return null;

          return tx.auditorDocument.create({
            data: {
              tenantId,
              auditorId: req.params.id,
              title: body.title,
              description: body.description || null,
              filePath: body.filePath,
              fileSize: body.fileSize || null,
              mimeType: body.mimeType || 'application/pdf',
              issueDate: body.issueDate ? new Date(body.issueDate) : null,
              expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
              issuer: body.issuer || null,
            },
          });
        });

        if (!document) return reply.code(404).send({ error: 'Auditor not found' });
        return reply.code(201).send({ document });
      } catch (err: any) {
        console.error('Error creating auditor document:', err);
        console.error('Error details:', err.message, err.stack);
        return reply.code(500).send({ error: 'Error creating document', details: err.message });
      }
    },
  );

  // DELETE /audit/auditors/documents/:docId - Eliminar documento
  app.delete(
    '/audit/auditors/documents/:docId',
    async (req: FastifyRequest<{ Params: { docId: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const result = await app.runWithDbContext(req, async (tx) => {
        const doc = await tx.auditorDocument.findFirst({
          where: { id: req.params.docId, tenantId, deletedAt: null },
          select: { id: true, filePath: true },
        });
        if (!doc) return { kind: 'not_found' as const };

        // Soft delete
        await tx.auditorDocument.update({
          where: { id: req.params.docId },
          data: { deletedAt: new Date() },
        });

        return { kind: 'ok' as const, filePath: doc.filePath };
      });

      if (result.kind === 'not_found') return reply.code(404).send({ error: 'Document not found' });
      return reply.send({ success: true, message: 'Documento eliminado' });
    },
  );

  // POST /audit/auditors/:id/upload - Subir archivo PDF de certificado
  app.post(
    '/audit/auditors/:id/upload',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      try {
        // Verificar que el auditor existe
        const auditor = await app.runWithDbContext(req, async (tx) => {
          return tx.auditor.findFirst({
            where: { id: req.params.id, tenantId, deletedAt: null },
            select: { id: true, name: true },
          });
        });

        if (!auditor) {
          return reply.code(404).send({ error: 'Auditor not found' });
        }

        // Obtener el archivo de la request
        const data = await req.file();
        if (!data) {
          return reply.code(400).send({ error: 'No file provided' });
        }

        // Validar que sea PDF
        if (data.mimetype !== 'application/pdf') {
          return reply.code(400).send({ error: 'Only PDF files are allowed' });
        }

        // Validar tamaño máximo (10MB)
        const chunks: Buffer[] = [];
        for await (const chunk of data.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        
        if (buffer.length > 10 * 1024 * 1024) {
          return reply.code(400).send({ error: 'File too large. Maximum 10MB allowed.' });
        }

        // Generar nombre único para el archivo
        const fileName = `${randomUUID()}.pdf`;
        const storageKey = `auditors/${tenantId}/${req.params.id}/${fileName}`;

        // Subir archivo al storage
        await storage.upload(storageKey, buffer, 'application/pdf');

        // Construir URL relativa
        const filePath = `/storage/${storageKey}`;

        return reply.send({ 
          success: true, 
          filePath,
          fileName: data.filename,
          fileSize: buffer.length,
        });
      } catch (err: any) {
        console.error('Error uploading file:', err);
        console.error('Error details:', err.message, err.stack);
        return reply.code(500).send({ error: 'Error uploading file', details: err.message });
      }
    },
  );

  // AUDITS
  app.get('/audit/audits', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const audits = await app.runWithDbContext(req, async (tx) => {
      return tx.audit.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { plannedStartDate: 'desc' },
      });
    });

    return reply.send({ audits });
  });

  app.get('/audit/audits/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const audit = await app.runWithDbContext(req, async (tx) => {
      return tx.audit.findUnique({
        where: { id: req.params.id, tenantId },
      });
    });

    if (!audit) return reply.code(404).send({ error: 'Audit not found' });
    return reply.send({ audit });
  });

  app.patch(
    '/audit/audits/:id',
    async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const body = (req.body ?? {}) as any;
      const data: any = {};

      const setIfDefined = (key: string) => {
        if (key in body) data[key] = body[key];
      };

      setIfDefined('code');
      setIfDefined('title');
      setIfDefined('description');
      setIfDefined('type');
      setIfDefined('status');
      setIfDefined('area');
      setIfDefined('process');
      setIfDefined('scope');
      setIfDefined('objective');
      setIfDefined('interviewees');
      if ('isoStandard' in body) data.isoStandard = Array.isArray(body.isoStandard) ? body.isoStandard : undefined;

      if ('plannedStartDate' in body) data.plannedStartDate = body.plannedStartDate ? new Date(body.plannedStartDate) : null;
      if ('plannedEndDate' in body) data.plannedEndDate = body.plannedEndDate ? new Date(body.plannedEndDate) : null;

      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: 'No updatable fields provided' });
      }

      const invalidDates = ['plannedStartDate', 'plannedEndDate'].filter((k) => {
        const v = data[k];
        return v instanceof Date && Number.isNaN(v.getTime());
      });
      if (invalidDates.length > 0) {
        return reply.code(400).send({ error: `${invalidDates.join(', ')} must be a valid date` });
      }

      const audit = await app.runWithDbContext(req, async (tx) => {
        const existing = await tx.audit.findUnique({ where: { id: req.params.id, tenantId } });
        if (!existing) return null;
        return tx.audit.update({
          where: { id: req.params.id, tenantId },
          data,
        });
      });

      if (!audit) return reply.code(404).send({ error: 'Audit not found' });
      return reply.send({ audit });
    },
  );

  app.post(
    '/audit/audits',
    async (req: FastifyRequest<{ Body: z.infer<typeof CreateAuditSchema> }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const validation = CreateAuditSchema.safeParse(req.body);
      if (!validation.success) {
        return reply.code(400).send({ error: 'Validación fallida', details: validation.error.errors });
      }

      const data = validation.data;

      const audit = await app.runWithDbContext(req, async (tx) => {
        return tx.audit.create({
          data: {
            tenantId,
            ...data,
            plannedStartDate: data.plannedStartDate ? new Date(data.plannedStartDate) : null,
            plannedEndDate: data.plannedEndDate ? new Date(data.plannedEndDate) : null,
            createdById: req.auth!.userId,
          },
        });
      });

      return reply.code(201).send({ audit });
    },
  );

  // FINDINGS (per ISO audit)
  app.get(
    '/audit/audits/:id/findings',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const findings = await app.runWithDbContext(req, async (tx) => {
        return tx.auditFinding.findMany({
          where: { auditId: req.params.id, tenantId, deletedAt: null },
          orderBy: { detectedAt: 'desc' },
        });
      });

      return reply.send({ findings });
    },
  );

  app.post(
    '/audit/audits/:id/findings',
    async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const body = (req.body ?? {}) as any;
      const finding = await app.runWithDbContext(req, async (tx) => {
        const audit = await tx.audit.findUnique({ where: { id: req.params.id, tenantId } });
        if (!audit) return null;

        return tx.auditFinding.create({
          data: {
            tenantId,
            auditId: req.params.id,
            code: body.code,
            type: body.type,
            severity: body.severity,
            status: body.status ?? 'OPEN',
            description: body.description,
            evidence: body.evidence || undefined,
            clause: body.clause,
            requirement: body.requirement || body.description || 'N/A',
            area: body.area || audit.area,
            process: body.process || audit.process || undefined,
            responsibleId: body.responsibleId || req.auth!.userId,
            detectedAt: body.detectedAt ? new Date(body.detectedAt) : undefined,
            createdById: req.auth!.userId,
          },
        });
      });

      if (!finding) return reply.code(404).send({ error: 'Audit not found' });
      return reply.code(201).send({ finding });
    },
  );

  // CHECKLIST
  app.get(
    '/audit/audits/:id/checklist',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const items = await app.runWithDbContext(req, async (tx) => {
        const existing = await tx.auditChecklistItem.findMany({
          where: { auditId: req.params.id },
          orderBy: { order: 'asc' },
        });

        if (existing.length > 0) return existing;

        const audit = await tx.audit.findUnique({ where: { id: req.params.id, tenantId } });
        if (!audit) return [];

        const defaults = buildDefaultChecklistItems(audit.isoStandard as string[]);
        if (defaults.length === 0) return [];

        await tx.auditChecklistItem.createMany({
          data: defaults.map((d, idx) => ({
            auditId: audit.id,
            clause: d.clause,
            requirement: d.requirement,
            whatToCheck: d.whatToCheck,
            weight: 1,
            order: idx,
          })),
        });

        return tx.auditChecklistItem.findMany({
          where: { auditId: req.params.id },
          orderBy: { order: 'asc' },
        });
      });

      return reply.send({ items });
    },
  );

  app.patch(
    '/audit/checklist/:id',
    async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const body = (req.body ?? {}) as any;

      const normalizeResponse = (value: any) => {
        if (value === 'COMPLIANT') return 'COMPLIES';
        if (value === 'NON_COMPLIANT') return 'DOES_NOT_COMPLY';
        return value;
      };

      if ('response' in body) {
        body.response = normalizeResponse(body.response);
      }

      const allowedResponse = new Set(['COMPLIES', 'DOES_NOT_COMPLY', 'NOT_APPLICABLE', null]);
      if ('response' in body && !allowedResponse.has(body.response ?? null)) {
        return reply.code(400).send({ error: 'Invalid response value' });
      }

      const data: any = {};
      if ('response' in body) data.response = body.response;
      if ('comment' in body) data.comment = body.comment;
      if ('evidence' in body) data.evidence = body.evidence;

      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: 'No updatable fields provided' });
      }

      const result = await app.runWithDbContext(req, async (tx) => {
        const existing = await tx.auditChecklistItem.findUnique({ where: { id: req.params.id } });
        if (!existing) return { kind: 'not_found' as const };

        const audit = await tx.audit.findUnique({ where: { id: existing.auditId, tenantId } });
        if (!audit) return { kind: 'not_found' as const };

        const updated = await tx.auditChecklistItem.update({
          where: { id: req.params.id },
          data,
        });

        if (data.response === 'DOES_NOT_COMPLY') {
          const code = `NC-${audit.code}-${existing.order + 1}`;
          const already = await tx.auditFinding.findFirst({
            where: {
              tenantId,
              auditId: audit.id,
              code,
              deletedAt: null,
            },
            select: { id: true },
          });

          if (!already) {
            await tx.auditFinding.create({
              data: {
                tenantId,
                auditId: audit.id,
                code,
                type: 'NON_CONFORMITY',
                severity: 'MINOR',
                status: 'OPEN',
                description: updated.comment || updated.requirement,
                evidence: updated.evidence || undefined,
                clause: updated.clause,
                requirement: updated.requirement,
                area: audit.area,
                process: audit.process || undefined,
                responsibleId: req.auth!.userId,
                createdById: req.auth!.userId,
              },
            });
          }
        }
        return { kind: 'ok' as const, item: updated };
      });

      if (result.kind === 'not_found') return reply.code(404).send({ error: 'Checklist item not found' });
      return reply.send({ item: result.item });
    },
  );

  // REPORT DRAFT
  app.post(
    '/audit/audits/:id/report/draft',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const draft = await app.runWithDbContext(req, async (tx) => {
        const audit = await tx.audit.findUnique({ where: { id: req.params.id, tenantId } });
        if (!audit) return null;

        const [findings, checklist] = await Promise.all([
          tx.auditFinding.findMany({ where: { auditId: audit.id, tenantId, deletedAt: null } }),
          tx.auditChecklistItem.findMany({ where: { auditId: audit.id }, orderBy: { order: 'asc' } }),
        ]);

        const draftData = buildReportDraft({ audit, findings, checklist });

        const report = await tx.auditReport.upsert({
          where: { auditId: audit.id },
          create: {
            auditId: audit.id,
            executiveSummary: draftData.executiveSummary,
            objective: draftData.objective,
            scope: draftData.scope,
            processesAudited: draftData.processesAudited,
            overallScore: draftData.overallScore,
            totalItems: draftData.totalItems,
            compliantItems: draftData.compliantItems,
            nonCompliantItems: draftData.nonCompliantItems,
            totalFindings: draftData.totalFindings,
            openFindings: draftData.openFindings,
            closedFindings: draftData.closedFindings,
            conclusion: draftData.conclusion,
            generatedById: req.auth!.userId,
          },
          update: {
            executiveSummary: draftData.executiveSummary,
            objective: draftData.objective,
            scope: draftData.scope,
            processesAudited: draftData.processesAudited,
            overallScore: draftData.overallScore,
            totalItems: draftData.totalItems,
            compliantItems: draftData.compliantItems,
            nonCompliantItems: draftData.nonCompliantItems,
            totalFindings: draftData.totalFindings,
            openFindings: draftData.openFindings,
            closedFindings: draftData.closedFindings,
            conclusion: draftData.conclusion,
            generatedById: req.auth!.userId,
          },
        });

        return { draft: draftData, report };
      });

      if (!draft) return reply.code(404).send({ error: 'Audit not found' });
      return reply.send(draft);
    },
  );

  // ACTIONS (namespaced to avoid colliding with AI audit routes)
  app.get(
    '/audit/iso-findings/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const finding = await app.runWithDbContext(req, async (tx) => {
        return tx.auditFinding.findFirst({
          where: { id: req.params.id, tenantId, deletedAt: null },
        });
      });

      if (!finding) return reply.code(404).send({ error: 'Finding not found' });
      return reply.send({ finding });
    },
  );

  app.get(
    '/audit/iso-findings/:id/actions',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const actions = await app.runWithDbContext(req, async (tx) => {
        const finding = await tx.auditFinding.findFirst({
          where: { id: req.params.id, tenantId, deletedAt: null },
          select: { id: true },
        });
        if (!finding) return null;

        return tx.auditFindingAction.findMany({
          where: { findingId: req.params.id },
          orderBy: { createdAt: 'desc' },
        });
      });

      if (!actions) return reply.code(404).send({ error: 'Finding not found' });
      return reply.send({ actions });
    },
  );

  app.post(
    '/audit/iso-findings/:id/actions',
    async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const body = (req.body ?? {}) as any;
      if (!body.description || typeof body.description !== 'string') {
        return reply.code(400).send({ error: 'description is required' });
      }
      if (!body.plannedDate || typeof body.plannedDate !== 'string') {
        return reply.code(400).send({ error: 'plannedDate is required' });
      }

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (body.responsibleId && (typeof body.responsibleId !== 'string' || !uuidRegex.test(body.responsibleId))) {
        return reply.code(400).send({ error: 'responsibleId must be a UUID' });
      }

      const plannedDate = new Date(body.plannedDate);
      if (Number.isNaN(plannedDate.getTime())) {
        return reply.code(400).send({ error: 'plannedDate must be a valid date' });
      }

      const action = await app.runWithDbContext(req, async (tx) => {
        const finding = await tx.auditFinding.findFirst({
          where: { id: req.params.id, tenantId, deletedAt: null },
          select: { id: true },
        });
        if (!finding) return null;

        const data: any = {
          findingId: req.params.id,
          description: body.description,
          rootCause: body.rootCause || undefined,
          type: body.type || 'CORRECTIVE',
          status: body.status || 'PENDING',
          responsibleId: body.responsibleId || req.auth!.userId,
          plannedDate,
          evidence: body.evidence || undefined,
        };

        return tx.auditFindingAction.create({
          data,
        });
      });

      if (!action) return reply.code(404).send({ error: 'Finding not found' });
      return reply.code(201).send({ action });
    },
  );

  app.patch(
    '/audit/iso-actions/:id',
    async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const body = (req.body ?? {}) as any;

      const action = await app.runWithDbContext(req, async (tx) => {
        const existing = await tx.auditFindingAction.findUnique({
          where: { id: req.params.id },
          select: { id: true, findingId: true },
        });
        if (!existing) return { kind: 'not_found' as const };

        const finding = await tx.auditFinding.findFirst({
          where: { id: existing.findingId, tenantId, deletedAt: null },
          select: { id: true },
        });
        if (!finding) return { kind: 'not_found' as const };

        const data: any = {};
        if ('status' in body) data.status = body.status;
        if ('isEffective' in body) data.isEffective = body.isEffective;
        if ('completedDate' in body) {
          data.completedDate = body.completedDate ? new Date(body.completedDate) : null;
        }

        if (Object.keys(data).length === 0) return { kind: 'bad_request' as const };

        const updated = await tx.auditFindingAction.update({
          where: { id: req.params.id },
          data,
        });

        return { kind: 'ok' as const, action: updated };
      });

      if (action.kind === 'not_found') return reply.code(404).send({ error: 'Action not found' });
      if (action.kind === 'bad_request') return reply.code(400).send({ error: 'No updatable fields provided' });
      return reply.send({ action: action.action });
    },
  );

  // ──────────────────────────────────────────────────────────────
  // AUDIT360 — EJECUCIÓN / EQUIPO / CRONOGRAMA
  // ──────────────────────────────────────────────────────────────

  // GET audit completo con relaciones (para pantalla ejecutar)
  app.get(
    '/audit/audits/:id/full',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

      const audit = await app.runWithDbContext(req, async (tx) => {
        return tx.audit.findUnique({
          where: { id: req.params.id, tenantId },
          include: {
            checklist: { orderBy: { order: 'asc' } },
            findings: { where: { deletedAt: null }, orderBy: { detectedAt: 'desc' } },
            team: true,
            schedule: { orderBy: { plannedDate: 'asc' } },
            report: true,
          },
        });
      });

      if (!audit) return reply.code(404).send({ error: 'Auditoría no encontrada' });
      return reply.send({ audit });
    },
  );

  // EXECUTE — Iniciar o avanzar auditoría
  app.post(
    '/audit/audits/:id/execute',
    async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

      const body = (req.body ?? {}) as any;

      const audit = await app.runWithDbContext(req, async (tx) => {
        const existing = await tx.audit.findUnique({
          where: { id: req.params.id, tenantId },
          include: { checklist: true },
        });
        if (!existing) return null;

        const data: any = {};

        // Cambio de estado según transición válida
        const targetStatus = body.status;
        const currentStatus = existing.status;
        const validTransitions: Record<string, string[]> = {
          DRAFT: ['PLANNED'],
          PLANNED: ['SCHEDULED', 'IN_PROGRESS'],
          SCHEDULED: ['IN_PROGRESS'],
          IN_PROGRESS: ['PENDING_REPORT', 'COMPLETED'],
          PENDING_REPORT: ['COMPLETED'],
          COMPLETED: ['CLOSED'],
        };
        if (targetStatus && targetStatus !== currentStatus) {
          const allowed = validTransitions[currentStatus] ?? [];
          if (!allowed.includes(targetStatus)) {
            return { kind: 'bad_transition' as const, currentStatus, targetStatus };
          }
          data.status = targetStatus;
        }

        // Guardar resultado si se envía
        if (body.result && ['CONFORME', 'PARCIAL', 'NO_CONFORME'].includes(body.result)) {
          data.result = body.result;
        }

        // Calcular score automático desde checklist
        if (existing.checklist && existing.checklist.length > 0) {
          const answered = existing.checklist.filter((i: any) => i.response != null);
          const compliant = answered.filter((i: any) => i.response === 'COMPLIES').length;
          const na = answered.filter((i: any) => i.response === 'NOT_APPLICABLE').length;
          const denom = Math.max(1, answered.length - na);
          data.complianceScore = Math.round((compliant / denom) * 10000) / 100;
        }

        if (Object.keys(data).length === 0) return { kind: 'no_changes' as const, audit: existing };

        const updated = await tx.audit.update({
          where: { id: req.params.id, tenantId },
          data,
        });
        return { kind: 'ok' as const, audit: updated };
      });

      if (!audit) return reply.code(404).send({ error: 'Auditoría no encontrada' });
      if (audit.kind === 'bad_transition') {
        return reply.code(400).send({
          error: `Transición inválida: ${audit.currentStatus} → ${audit.targetStatus}`,
        });
      }
      return reply.send({ audit: audit.audit });
    },
  );

  // TEAM — Gestión de equipo de auditoría
  app.get(
    '/audit/audits/:id/team',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

      const team = await app.runWithDbContext(req, async (tx) => {
        const audit = await tx.audit.findUnique({
          where: { id: req.params.id, tenantId },
          select: { id: true },
        });
        if (!audit) return null;
        return tx.auditTeam.findMany({
          where: { auditId: req.params.id, tenantId },
          include: { auditor: true },
          orderBy: { createdAt: 'asc' },
        });
      });

      if (team === null) return reply.code(404).send({ error: 'Auditoría no encontrada' });
      return reply.send({ team });
    },
  );

  app.post(
    '/audit/audits/:id/team',
    async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

      const body = (req.body ?? {}) as any;
      if (!body.userId || typeof body.userId !== 'string') {
        return reply.code(400).send({ error: 'userId es requerido' });
      }
      const role = body.role ?? 'AUDITOR';
      if (!['LEADER', 'AUDITOR', 'OBSERVER'].includes(role)) {
        return reply.code(400).send({ error: 'Rol inválido. Use LEADER, AUDITOR u OBSERVER' });
      }

      const result = await app.runWithDbContext(req, async (tx) => {
        const audit = await tx.audit.findUnique({
          where: { id: req.params.id, tenantId },
          select: { id: true },
        });
        if (!audit) return { kind: 'not_found' as const };

        // Verificar si ya existe
        const existing = await tx.auditTeam.findUnique({
          where: { auditId_userId: { auditId: req.params.id, userId: body.userId } },
        });
        if (existing) {
          const updated = await tx.auditTeam.update({
            where: { id: existing.id },
            data: { role, auditorId: body.auditorId || existing.auditorId },
          });
          return { kind: 'ok' as const, member: updated, action: 'updated' };
        }

        const member = await tx.auditTeam.create({
          data: {
            tenantId,
            auditId: req.params.id,
            userId: body.userId,
            auditorId: body.auditorId || null,
            role,
          },
        });
        return { kind: 'ok' as const, member, action: 'created' };
      });

      if (result.kind === 'not_found') return reply.code(404).send({ error: 'Auditoría no encontrada' });
      return reply.code(result.action === 'created' ? 201 : 200).send({ member: result.member, action: result.action });
    },
  );

  app.delete(
    '/audit/audits/:id/team/:userId',
    async (req: FastifyRequest<{ Params: { id: string; userId: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

      const result = await app.runWithDbContext(req, async (tx) => {
        const audit = await tx.audit.findUnique({
          where: { id: req.params.id, tenantId },
          select: { id: true },
        });
        if (!audit) return { kind: 'not_found' as const };

        const member = await tx.auditTeam.findUnique({
          where: { auditId_userId: { auditId: req.params.id, userId: req.params.userId } },
        });
        if (!member) return { kind: 'not_found_member' as const };

        await tx.auditTeam.delete({ where: { id: member.id } });
        return { kind: 'ok' as const };
      });

      if (result.kind === 'not_found') return reply.code(404).send({ error: 'Auditoría no encontrada' });
      if (result.kind === 'not_found_member') return reply.code(404).send({ error: 'Miembro no encontrado en el equipo' });
      return reply.send({ success: true, message: 'Miembro eliminado del equipo' });
    },
  );

  // SCHEDULE — Cronograma de fases de auditoría
  app.get(
    '/audit/audits/:id/schedule',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

      const schedule = await app.runWithDbContext(req, async (tx) => {
        const audit = await tx.audit.findUnique({
          where: { id: req.params.id, tenantId },
          select: { id: true },
        });
        if (!audit) return null;
        return tx.auditSchedule.findMany({
          where: { auditId: req.params.id, tenantId },
          orderBy: { plannedDate: 'asc' },
        });
      });

      if (schedule === null) return reply.code(404).send({ error: 'Auditoría no encontrada' });
      return reply.send({ schedule });
    },
  );

  app.post(
    '/audit/audits/:id/schedule',
    async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

      const body = (req.body ?? {}) as any;
      if (!body.phase || typeof body.phase !== 'string') {
        return reply.code(400).send({ error: 'phase es requerida' });
      }

      const result = await app.runWithDbContext(req, async (tx) => {
        const audit = await tx.audit.findUnique({
          where: { id: req.params.id, tenantId },
          select: { id: true },
        });
        if (!audit) return { kind: 'not_found' as const };

        const data: any = {
          tenantId,
          auditId: req.params.id,
          phase: body.phase,
          plannedDate: body.plannedDate ? new Date(body.plannedDate) : null,
          actualDate: body.actualDate ? new Date(body.actualDate) : null,
          duration: body.duration ?? null,
          location: body.location || null,
          notes: body.notes || null,
        };

        if (body.id) {
          const updated = await tx.auditSchedule.update({
            where: { id: body.id },
            data,
          });
          return { kind: 'ok' as const, item: updated, action: 'updated' };
        }

        const item = await tx.auditSchedule.create({ data });
        return { kind: 'ok' as const, item, action: 'created' };
      });

      if (result.kind === 'not_found') return reply.code(404).send({ error: 'Auditoría no encontrada' });
      return reply.code(result.action === 'created' ? 201 : 200).send({ item: result.item, action: result.action });
    },
  );

  app.delete(
    '/audit/audits/:id/schedule/:scheduleId',
    async (req: FastifyRequest<{ Params: { id: string; scheduleId: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

      const result = await app.runWithDbContext(req, async (tx) => {
        const audit = await tx.audit.findUnique({
          where: { id: req.params.id, tenantId },
          select: { id: true },
        });
        if (!audit) return { kind: 'not_found' as const };

        const item = await tx.auditSchedule.findFirst({
          where: { id: req.params.scheduleId, auditId: req.params.id, tenantId },
        });
        if (!item) return { kind: 'not_found_item' as const };

        await tx.auditSchedule.delete({ where: { id: item.id } });
        return { kind: 'ok' as const };
      });

      if (result.kind === 'not_found') return reply.code(404).send({ error: 'Auditoría no encontrada' });
      if (result.kind === 'not_found_item') return reply.code(404).send({ error: 'Fase no encontrada' });
      return reply.send({ success: true, message: 'Fase eliminada del cronograma' });
    },
  );

  // INTEGRACIÓN NCR — Crear NC desde hallazgo
  app.post(
    '/audit/iso-findings/:id/create-ncr',
    async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

      const body = (req.body ?? {}) as any;

      const result = await app.runWithDbContext(req, async (tx) => {
        const finding = await tx.auditFinding.findFirst({
          where: { id: req.params.id, tenantId, deletedAt: null },
          include: { audit: true },
        });
        if (!finding) return { kind: 'not_found' as const };
        if (finding.ncrId) return { kind: 'already_linked' as const, ncrId: finding.ncrId };

        const severityMap: Record<string, string> = {
          MAJOR: 'MAJOR',
          MINOR: 'MINOR',
          CRITICAL: 'CRITICAL',
          OBSERVATION: 'MINOR',
          OPPORTUNITY: 'MINOR',
        };

        const ncr = await tx.nonConformity.create({
          data: {
            tenantId,
            code: body.code || `NC-AUDIT-${finding.code}`,
            title: body.title || `Hallazgo auditoría ${finding.audit.code}: ${finding.clause || 'N/A'}`,
            description: finding.description,
            severity: (severityMap[finding.severity] || 'MINOR') as any,
            source: 'AUDIT' as any,
            status: 'OPEN' as any,
            standard: finding.audit.isoStandard?.[0] || null,
            clause: finding.clause || null,
            assignedToId: finding.responsibleId || req.auth!.userId,
            createdById: req.auth!.userId,
          },
        });

        await tx.auditFinding.update({
          where: { id: finding.id },
          data: { ncrId: ncr.id },
        });

        return { kind: 'ok' as const, ncr };
      });

      if (result.kind === 'not_found') return reply.code(404).send({ error: 'Hallazgo no encontrado' });
      if (result.kind === 'already_linked') {
        return reply.code(409).send({ error: 'Hallazgo ya vinculado a una NC', ncrId: result.ncrId });
      }
      return reply.code(201).send({ ncr: result.ncr });
    },
  );

  // STATS
  app.get('/audit/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

    const stats = await app.runWithDbContext(req, async (tx) => {
      const [
        totalPrograms,
        totalAudits,
        auditsByStatus,
        totalFindings,
        findingsBySeverity,
      ] = await Promise.all([
        tx.auditProgram.count({ where: { tenantId, deletedAt: null } }),
        tx.audit.count({ where: { tenantId, deletedAt: null } }),
        tx.audit.groupBy({ by: ['status'], where: { tenantId, deletedAt: null }, _count: { status: true } }),
        tx.auditFinding.count({ where: { tenantId, deletedAt: null } }),
        tx.auditFinding.groupBy({ by: ['severity'], where: { tenantId, deletedAt: null }, _count: { severity: true } }),
      ]);

      return {
        totalPrograms,
        totalAudits,
        auditsByStatus: Object.fromEntries(auditsByStatus.map((s) => [s.status, s._count.status])),
        totalFindings,
        findingsBySeverity: Object.fromEntries(findingsBySeverity.map((f) => [f.severity, f._count.severity])),
      };
    });

    return reply.send({ stats });
  });

  // ═════════════════════════════════════════════════════════════
  // FASE 4 — AI / INTEGRACIÓN INTELIGENTE AUDIT360
  // ═════════════════════════════════════════════════════════════

  // POST /audit/audits/:id/generate-checklist — Generar checklist con IA
  app.post(
    '/audit/audits/:id/generate-checklist',
    async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

      try {
        const llm = createLLMProvider(req.tenant);
        const audit = await app.runWithDbContext(req, async (tx) => {
          return tx.audit.findUnique({ where: { id: req.params.id, tenantId } });
        });
        if (!audit) return reply.code(404).send({ error: 'Auditoría no encontrada' });

        const isoStandards = (audit.isoStandard as string[]) || ['ISO_9001'];
        const prompt = `Eres un auditor experto ISO. Genera una lista de verificación (checklist) detallada para una auditoría interna ${isoStandards.join(', ')}.
Auditoría: ${audit.title || ''}
Área/Proceso: ${audit.area || ''} / ${audit.process || ''}
Alcance: ${audit.scope || 'N/A'}
Objetivo: ${audit.objective || 'Verificar conformidad y efectividad del sistema de gestión'}

Responde EXACTAMENTE en formato JSON (sin markdown, sin bloques de código):
{
  "items": [
    {
      "clause": "4.1",
      "requirement": "Entender la organización y su contexto",
      "whatToCheck": "Verificar análisis de contexto externo e interno documentado"
    }
  ],
  "summary": "Breve resumen de la cobertura de la checklist generada"
}`;

        const response = await llm.chat([{ role: 'user', content: prompt }]);
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return reply.code(500).send({ error: 'La IA no devolvió un formato JSON válido' });

        const parsed = JSON.parse(jsonMatch[0]);
        const items = (parsed.items || []).filter((i: any) => i && typeof i === 'object');

        if (items.length === 0) return reply.code(500).send({ error: 'La IA no generó ítems de checklist' });

        const created = await app.runWithDbContext(req, async (tx) => {
          const existingCount = await tx.auditChecklistItem.count({ where: { auditId: audit.id } });
          const data = items.map((i: any, idx: number) => ({
            auditId: audit.id,
            clause: String(i.clause || '').slice(0, 50),
            requirement: String(i.requirement || '').slice(0, 500),
            whatToCheck: String(i.whatToCheck || '').slice(0, 500) || null,
            weight: 1,
            order: existingCount + idx,
          }));
          await tx.auditChecklistItem.createMany({ data });
          return tx.auditChecklistItem.findMany({ where: { auditId: audit.id }, orderBy: { order: 'asc' } });
        });

        return reply.send({ items: created, aiSummary: String(parsed.summary || 'Checklist generada por IA') });
      } catch (err: any) {
        console.error('Error generando checklist con IA:', err.message);
        return reply.code(500).send({ error: 'Error al generar checklist con IA', details: err.message });
      }
    },
  );

  // POST /audit/iso-findings/:id/classify — Clasificar hallazgo con IA
  app.post(
    '/audit/iso-findings/:id/classify',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

      try {
        const llm = createLLMProvider(req.tenant);
        const finding = await app.runWithDbContext(req, async (tx) => {
          return tx.auditFinding.findFirst({
            where: { id: req.params.id, tenantId, deletedAt: null },
            include: { audit: true },
          });
        });
        if (!finding) return reply.code(404).send({ error: 'Hallazgo no encontrado' });

        const prompt = `Eres un auditor experto ISO. Clasifica el siguiente hallazgo de auditoría y sugiere acciones correctivas.

Hallazgo: ${finding.code}
Descripción: ${finding.description}
Cláusula: ${finding.clause || 'N/A'}
Norma: ${(finding.audit.isoStandard as string[] || []).join(', ') || 'ISO 9001'}

Responde EXACTAMENTE en formato JSON (sin markdown, sin bloques de código):
{
  "type": "NON_CONFORMITY",
  "severity": "MINOR",
  "classificationRationale": "Justificación de la clasificación",
  "suggestedActions": ["Acción 1", "Acción 2"],
  "riskIfNotAddressed": "Descripción del riesgo",
  "recommendedDeadlineDays": 30
}`;

        const response = await llm.chat([{ role: 'user', content: prompt }]);
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return reply.code(500).send({ error: 'La IA no devolvió un formato JSON válido' });

        const parsed = JSON.parse(jsonMatch[0]);
        const type = ['NON_CONFORMITY', 'OBSERVATION', 'OPPORTUNITY', 'POSITIVE_PRACTICE'].includes(parsed.type) ? parsed.type : finding.type;
        const severity = ['MAJOR', 'MINOR', 'CRITICAL', 'OBSERVATION', 'OPPORTUNITY'].includes(parsed.severity) ? parsed.severity : finding.severity;

        return reply.send({
          classification: {
            type,
            severity,
            rationale: String(parsed.classificationRationale || ''),
            suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions.map(String) : [],
            riskIfNotAddressed: String(parsed.riskIfNotAddressed || ''),
            recommendedDeadlineDays: Number(parsed.recommendedDeadlineDays) || 30,
          },
          finding: {
            id: finding.id,
            currentType: finding.type,
            currentSeverity: finding.severity,
          },
        });
      } catch (err: any) {
        console.error('Error clasificando hallazgo con IA:', err.message);
        return reply.code(500).send({ error: 'Error al clasificar con IA', details: err.message });
      }
    },
  );

  // POST /audit/audits/:id/report/ai-draft — Borrador de informe con IA
  app.post(
    '/audit/audits/:id/report/ai-draft',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

      try {
        const llm = createLLMProvider(req.tenant);
        const auditData = await app.runWithDbContext(req, async (tx) => {
          const audit = await tx.audit.findUnique({
            where: { id: req.params.id, tenantId },
            include: {
              checklist: { orderBy: { order: 'asc' } },
              findings: { where: { deletedAt: null }, orderBy: { detectedAt: 'desc' } },
              team: { include: { auditor: { select: { name: true } } } },
            },
          });
          return audit;
        });
        if (!auditData) return reply.code(404).send({ error: 'Auditoría no encontrada' });

        const checklistSummary = auditData.checklist.map((c: any, i: number) =>
          `${i + 1}. ${c.clause}: ${c.requirement} → ${c.response || 'Sin respuesta'}${c.comment ? ` (${c.comment})` : ''}`
        ).join('\n');

        const findingsSummary = auditData.findings.map((f: any) =>
          `- ${f.code} (${f.severity}): ${f.description}`
        ).join('\n');

        const teamNames = auditData.team.map((t: any) => t.auditor?.name || 'Auditor').join(', ');

        const prompt = `Eres un auditor líder experto ISO. Redacta un borrador profesional de Informe de Auditoría en español.

DATOS DE LA AUDITORÍA:
Código: ${auditData.code}
Título: ${auditData.title || ''}
Tipo: ${auditData.type}
Área/Proceso: ${auditData.area} / ${auditData.process || 'N/A'}
Normas: ${(auditData.isoStandard as string[] || []).join(', ')}
Alcance: ${auditData.scope || 'N/A'}
Objetivo: ${auditData.objective || 'Verificar conformidad'}
Equipo: ${teamNames || 'No asignado'}

CHECKLIST (${auditData.checklist.length} ítems):
${checklistSummary}

HALLAZGOS (${auditData.findings.length} hallazgos):
${findingsSummary || 'Sin hallazgos registrados'}

Responde EXACTAMENTE en formato JSON (sin markdown, sin bloques de código):
{
  "executiveSummary": "Resumen ejecutivo en 2-3 párrafos",
  "conclusion": "Conclusión y juicio global de conformidad",
  "strengths": ["Fortaleza 1", "Fortaleza 2"],
  "weaknesses": ["Debilidad 1", "Debilidad 2"],
  "recommendations": ["Recomendación 1", "Recomendación 2"],
  "overallScore": 85,
  "complianceLevel": "PARCIAL"
}`;

        const response = await llm.chat([{ role: 'user', content: prompt }]);
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return reply.code(500).send({ error: 'La IA no devolvió un formato JSON válido' });

        const parsed = JSON.parse(jsonMatch[0]);

        const draft = {
          executiveSummary: String(parsed.executiveSummary || ''),
          conclusion: String(parsed.conclusion || ''),
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
          weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
          overallScore: Number(parsed.overallScore) || null,
          complianceLevel: ['CONFORME', 'PARCIAL', 'NO_CONFORME'].includes(parsed.complianceLevel) ? parsed.complianceLevel : null,
          generatedAt: new Date().toISOString(),
        };

        return reply.send({ draft });
      } catch (err: any) {
        console.error('Error generando borrador de informe con IA:', err.message);
        return reply.code(500).send({ error: 'Error al generar informe con IA', details: err.message });
      }
    },
  );

  // POST /audit/audits/:id/chat — Chat de análisis normativo durante ejecución
  app.post(
    '/audit/audits/:id/chat',
    async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

      const body = (req.body ?? {}) as any;
      if (!body.message || typeof body.message !== 'string') {
        return reply.code(400).send({ error: 'message es requerido' });
      }

      try {
        const llm = createLLMProvider(req.tenant);
        const auditData = await app.runWithDbContext(req, async (tx) => {
          return tx.audit.findUnique({
            where: { id: req.params.id, tenantId },
            include: {
              checklist: { orderBy: { order: 'asc' } },
              findings: { where: { deletedAt: null }, orderBy: { detectedAt: 'desc' } },
            },
          });
        });
        if (!auditData) return reply.code(404).send({ error: 'Auditoría no encontrada' });

        const context = `CONTEXTO DE AUDITORÍA ISO:
Código: ${auditData.code}
Título: ${auditData.title || ''}
Tipo: ${auditData.type}
Normas: ${(auditData.isoStandard as string[] || []).join(', ')}
Área: ${auditData.area} / ${auditData.process || ''}
Checklist: ${auditData.checklist.length} ítems (${auditData.checklist.filter((c: any) => c.response === 'COMPLIES').length} conformes, ${auditData.checklist.filter((c: any) => c.response === 'DOES_NOT_COMPLY').length} no conformes)
Hallazgos: ${auditData.findings.length} hallazgos registrados.

El usuario es un auditor ejecutando la auditoría y necesita asesoramiento normativo.`;

        const messages = [
          { role: 'user' as const, content: context },
          ...(Array.isArray(body.history) ? body.history.map((h: any) => ({ role: h.role as 'user' | 'assistant', content: String(h.content || '') })) : []),
          { role: 'user' as const, content: body.message },
        ];

        const response = await llm.chat(messages);
        return reply.send({ reply: response.text, tokensUsed: response.tokensUsed, model: response.model });
      } catch (err: any) {
        console.error('Error en chat de auditoría:', err.message);
        return reply.code(500).send({ error: 'Error en chat de auditoría', details: err.message });
      }
    },
  );
}
