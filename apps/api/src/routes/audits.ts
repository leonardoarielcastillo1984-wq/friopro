import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getStorage } from '../services/storage.js';
import { randomUUID } from 'node:crypto';

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
    if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      const validation = CreateProgramSchema.safeParse(req.body);
      if (!validation.success) {
        return reply.code(400).send({ error: 'Validation failed', details: validation.error.errors });
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
    if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      const validation = CreateAuditorSchema.safeParse(req.body);
      if (!validation.success) {
        return reply.code(400).send({ error: 'Validation failed', details: validation.error.errors });
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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
    if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
    if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      const validation = CreateAuditSchema.safeParse(req.body);
      if (!validation.success) {
        return reply.code(400).send({ error: 'Validation failed', details: validation.error.errors });
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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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

  // STATS
  app.get('/audit/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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
}
