import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getStorage, computeFileHash, buildStorageKey } from '../services/storage.js';
import { getNormativeQueue } from '../jobs/queue.js';
import { requiresTenantContext, isSuperAdmin, getEffectiveTenantId } from '../utils/tenant-bypass.js';

const FEATURE_KEY = 'normativos_compliance';
const MAX_PDF_SIZE = parseInt(process.env.MAX_PDF_SIZE_MB || '50', 10) * 1024 * 1024;

// ──────────────────────────────────────────────────────────────
// Rutas de Normativos
// ──────────────────────────────────────────────────────────────

export const normativoRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /normativos — Listar normas del tenant ──
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    if (requiresTenantContext(req) && !req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const normativos = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.normativeStandard.findMany({
        where: { tenantId: req.db!.tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          code: true,
          version: true,
          description: true,
          status: true,
          totalClauses: true,
          originalFileName: true,
          fileSize: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return reply.send({ normativos });
  });

  // ── GET /normativos/compliance-summary — Resumen de cumplimiento ──
  app.get('/compliance-summary', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    const effectiveTenantId = headerTenantId || req.db?.tenantId || 'f20f0bfe-c1d8-40f6-8d36-97734881ffde';

    if (requiresTenantContext(req) && !effectiveTenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const prisma = app.prisma;

    try {
      // Get all normatives for tenant
      const normatives = await prisma.normativeStandard.findMany({
        where: { 
          tenantId: effectiveTenantId, 
          deletedAt: null,
          status: { not: 'ARCHIVED' }
        },
        select: { id: true, name: true, code: true, status: true }
      });

      // Calculate compliance for each normative
      const complianceSummary = await Promise.all(
        normatives.map(async (normative) => {
          const allClauses = await prisma.normativeClause.count({
            where: { 
              normativeId: normative.id, 
              deletedAt: null 
            }
          });

          const mappedClauses = await prisma.documentClauseMapping.count({
            where: { 
              deletedAt: null,
              clause: {
                normativeId: normative.id,
                deletedAt: null
              }
            }
          });

          const compliancePercentage = allClauses > 0 ? Math.round((mappedClauses / allClauses) * 100) : 0;

          let complianceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
          if (compliancePercentage >= 80) complianceLevel = 'HIGH';
          else if (compliancePercentage >= 50) complianceLevel = 'MEDIUM';
          else complianceLevel = 'LOW';

          return {
            normative,
            compliance: {
              totalClauses: allClauses,
              completedClauses: mappedClauses,
              pendingClauses: allClauses - mappedClauses,
              compliancePercentage,
              complianceLevel
            }
          };
        })
      );

      // Calculate overall compliance
      const totalAllClauses = complianceSummary.reduce((sum, item) => sum + item.compliance.totalClauses, 0);
      const totalCompletedClauses = complianceSummary.reduce((sum, item) => sum + item.compliance.completedClauses, 0);
      const overallCompliance = totalAllClauses > 0 ? Math.round((totalCompletedClauses / totalAllClauses) * 100) : 0;

      return reply.send({
        overallCompliance,
        normatives: complianceSummary
      });
    } catch (error) {
      console.error('Error calculating compliance summary:', error);
      return reply.code(500).send({ error: 'Failed to calculate compliance summary' });
    }
  });

  // ── GET /normativos/:id — Detalle de una norma ──
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const normativo = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.normativeStandard.findFirst({
        where: { id: params.id, deletedAt: null },
        include: {
          _count: { select: { clauses: true } },
        },
      });
    });

    if (!normativo) return reply.code(404).send({ error: 'Not found' });
    return reply.send({ normativo });
  });

  // ── POST /normativos/upload — Subir PDF de norma ──
  app.post('/upload', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    console.log('[UPLOAD] Request received:', {
      url: req.url,
      method: req.method,
      hasTenantId: !!req.db?.tenantId,
      tenantId: req.db?.tenantId,
      isSuperAdmin: isSuperAdmin(req),
      userId: req.auth?.userId
    });

    if (!req.db?.tenantId && !isSuperAdmin(req)) {
      console.log('[UPLOAD] Tenant context required - no tenantId and not superadmin');
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    // Obtener tenantId efectivo para SUPER_ADMIN
    const effectiveTenantId = await getEffectiveTenantId(req, app.prisma);
    console.log('[UPLOAD] Effective tenantId:', effectiveTenantId);
    
    if (!effectiveTenantId) {
      console.log('[UPLOAD] No tenant available for operation');
      return reply.code(400).send({ error: 'No tenant available for operation' });
    }

    const parts = req.parts();
    let fileBuffer: Buffer | null = null;
    let originalFileName = '';
    const fields: Record<string, string> = {};

    try {
      for await (const part of parts) {
        console.log('[UPLOAD] Processing part:', {
          type: part.type,
          fieldname: part.fieldname,
          mimetype: part.mimetype
        });
        
        if (part.type === 'file') {
          const filePart = part as any;
          if (filePart.mimetype !== 'application/pdf') {
            console.log('[UPLOAD] Invalid file type:', filePart.mimetype);
            return reply.code(400).send({ error: 'Solo se aceptan archivos PDF' });
          }
          const chunks: Buffer[] = [];
          for await (const chunk of filePart.file) {
            chunks.push(chunk);
          }
          fileBuffer = Buffer.concat(chunks);
          originalFileName = filePart.filename;

          console.log('[UPLOAD] File received:', {
            filename: originalFileName,
            size: fileBuffer.length,
            maxSize: MAX_PDF_SIZE
          });

          if (fileBuffer.length > MAX_PDF_SIZE) {
          return reply.code(400).send({
            error: `El archivo excede el límite de ${process.env.MAX_PDF_SIZE_MB || 50}MB`,
          });
        }
      } else {
        fields[part.fieldname] = (part as any).value;
      }
    }
    } catch (error) {
      console.error('[UPLOAD] Error processing parts:', error);
      return reply.code(400).send({ error: 'Error processing file upload', details: String(error) });
    }

    if (!fileBuffer) {
      return reply.code(400).send({ error: 'No se proporcionó archivo PDF' });
    }

    // Validar campos de metadatos
    const metaSchema = z.object({
      name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
      code: z
        .string()
        .min(2)
        .regex(/^[A-Za-z0-9\-_]+$/, 'El código solo puede contener letras, números, guiones y guiones bajos'),
      version: z.string().min(1, 'La versión es requerida'),
      description: z.string().optional(),
    });

    const meta = metaSchema.parse(fields);

    // Verificar duplicado por code en este tenant (excluyendo eliminados)
    const existing = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.normativeStandard.findFirst({
        where: {
          tenantId: effectiveTenantId,
          code: meta.code,
          deletedAt: null,
        },
        select: { id: true },
      });
    });

    if (existing) {
      return reply.code(409).send({ error: `Ya existe una norma activa con el código "${meta.code}" en este tenant` });
    }

    // Eliminar permanentemente cualquier norma soft-deleted con el mismo código
    await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      const deletedNormative = await tx.normativeStandard.findFirst({
        where: {
          tenantId: effectiveTenantId,
          code: meta.code,
          deletedAt: { not: null },
        },
      });
      
      if (deletedNormative) {
        // Hard delete del registro eliminado
        await tx.normativeStandard.delete({
          where: { id: deletedNormative.id },
        });
        app.log.info(`Permanently deleted soft-deleted normative ${deletedNormative.id} with code ${meta.code}`);
      }
    });

    // Calcular hash y subir archivo
    const fileHash = computeFileHash(fileBuffer);
    const storage = getStorage();

    // Crear registro en BD
    const normativo = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.normativeStandard.create({
        data: {
          tenantId: effectiveTenantId,
          name: meta.name,
          code: meta.code,
          version: meta.version,
          description: meta.description || null,
          originalFileName,
          fileSize: fileBuffer!.length,
          filePath: '', // Se actualiza después
          fileHash,
          status: 'UPLOADING',
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
      });
    });

    // Subir archivo al storage
    const storageKey = buildStorageKey(effectiveTenantId, normativo.id, 'original.pdf');
    await storage.upload(storageKey, fileBuffer);

    // Actualizar filePath
    await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      await tx.normativeStandard.update({
        where: { id: normativo.id },
        data: { filePath: storageKey },
      });
    });

    // Encolar job de procesamiento
    const queue = getNormativeQueue();
    const job = await queue.add('process-normative', {
      normativeId: normativo.id,
      tenantId: effectiveTenantId,
      filePath: storageKey,
    });

    return reply.code(202).send({
      normativo: {
        id: normativo.id,
        code: normativo.code,
        name: normativo.name,
        status: 'UPLOADING',
      },
      jobId: job.id,
    });
  });

  // ── PATCH /normativos/:id — Actualizar metadatos ──
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const bodySchema = z.object({
      name: z.string().min(2).optional(),
      description: z.string().optional(),
    });
    const body = bodySchema.parse(req.body);

    const updated = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      const existing = await tx.normativeStandard.findFirst({
        where: { id: params.id, deletedAt: null },
      });
      if (!existing) return null;

      return tx.normativeStandard.update({
        where: { id: existing.id },
        data: {
          name: body.name ?? existing.name,
          description: body.description !== undefined ? body.description : existing.description,
          updatedById: req.auth?.userId ?? null,
        },
      });
    });

    if (!updated) return reply.code(404).send({ error: 'Not found' });
    return reply.send({ normativo: updated });
  });

  // ── DELETE /normativos/:id — Soft delete ──
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const deleted = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      const existing = await tx.normativeStandard.findFirst({
        where: { id: params.id, deletedAt: null },
      });
      if (!existing) return null;

      return tx.normativeStandard.update({
        where: { id: existing.id },
        data: {
          deletedAt: new Date(),
          updatedById: req.auth?.userId ?? null,
        },
      });
    });

    if (!deleted) return reply.code(404).send({ error: 'Not found' });
    return reply.send({ ok: true });
  });

  // ── POST /normativos/:id/revision — Nueva revisión de norma ──
  app.post('/:id/revision', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    if (!req.db?.tenantId && !isSuperAdmin(req)) return reply.code(400).send({ error: 'Tenant context required' });

    // Obtener tenantId efectivo para SUPER_ADMIN
    const effectiveTenantId = await getEffectiveTenantId(req, app.prisma);
    if (!effectiveTenantId) {
      return reply.code(400).send({ error: 'No tenant available for operation' });
    }

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const parts = req.parts();
    let fileBuffer: Buffer | null = null;
    let originalFileName = '';
    const fields: Record<string, string> = {};

    for await (const part of parts) {
      if (part.type === 'file') {
        if (part.mimetype !== 'application/pdf') {
          return reply.code(400).send({ error: 'Solo se aceptan archivos PDF' });
        }
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        fileBuffer = Buffer.concat(chunks);
        originalFileName = part.filename;

        if (fileBuffer.length > MAX_PDF_SIZE) {
          return reply.code(400).send({
            error: `El archivo excede el límite de ${process.env.MAX_PDF_SIZE_MB || 50}MB`,
          });
        }
      } else {
        fields[part.fieldname] = (part as any).value;
      }
    }

    if (!fileBuffer) {
      return reply.code(400).send({ error: 'No se proporcionó archivo PDF' });
    }

    // Validar campos
    const metaSchema = z.object({
      version: z.string().min(1, 'La versión es requerida'),
      description: z.string().optional(),
    });

    const meta = metaSchema.parse(fields);

    // Obtener norma existente
    const existing = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.normativeStandard.findFirst({
        where: { id: params.id, tenantId: effectiveTenantId, deletedAt: null },
      });
    });

    if (!existing) {
      return reply.code(404).send({ error: 'Norma no encontrada' });
    }

    // Archivar la versión anterior
    await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      await tx.normativeStandard.update({
        where: { id: existing.id },
        data: {
          status: 'ARCHIVED',
          updatedById: req.auth?.userId ?? null,
        },
      });
    });

    // Crear nueva revisión
    const fileHash = computeFileHash(fileBuffer);
    const storage = getStorage();

    const normativo = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.normativeStandard.create({
        data: {
          tenantId: effectiveTenantId,
          name: existing.name,
          code: existing.code,
          version: meta.version,
          description: meta.description || existing.description,
          originalFileName,
          fileSize: fileBuffer!.length,
          filePath: '', // Se actualiza después
          fileHash,
          status: 'UPLOADING',
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
      });
    });

    // Subir archivo al storage
    const storageKey = buildStorageKey(effectiveTenantId, normativo.id, 'original.pdf');
    await storage.upload(storageKey, fileBuffer);

    // Actualizar filePath
    await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      await tx.normativeStandard.update({
        where: { id: normativo.id },
        data: { filePath: storageKey },
      });
    });

    // Encolar job de procesamiento
    const queue = getNormativeQueue();
    const job = await queue.add('process-normative', {
      normativeId: normativo.id,
      tenantId: effectiveTenantId,
      filePath: storageKey,
    });

    return reply.code(202).send({
      normativo: {
        id: normativo.id,
        code: normativo.code,
        name: normativo.name,
        version: normativo.version,
        status: 'UPLOADING',
      },
      previousVersion: {
        id: existing.id,
        version: existing.version,
        status: 'ARCHIVED',
      },
      jobId: job.id,
    });
  });

  // ── GET /normativos/:id/status — Estado del procesamiento ──
  app.get('/:id/status', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const normativo = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.normativeStandard.findFirst({
        where: { id: params.id, deletedAt: null },
        select: {
          id: true,
          status: true,
          processingJobId: true,
          errorMessage: true,
          totalClauses: true,
          extractedAt: true,
        },
      });
    });

    if (!normativo) return reply.code(404).send({ error: 'Not found' });

    // Obtener progreso del job si está procesando
    let progress: number | null = null;
    if (normativo.processingJobId && normativo.status === 'PROCESSING') {
      try {
        const queue = getNormativeQueue();
        const job = await queue.getJob(normativo.processingJobId);
        if (job) {
          const p = job.progress;
          progress = typeof p === 'number' ? p : null;
        }
      } catch {
        // Si no se puede obtener el progreso, no es crítico
      }
    }

    return reply.send({
      id: normativo.id,
      status: normativo.status,
      errorMessage: normativo.errorMessage,
      totalClauses: normativo.totalClauses,
      extractedAt: normativo.extractedAt,
      progress,
    });
  });

  // ── GET /normativos/:id/clauses — Listar cláusulas ──
  app.get('/:id/clauses', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const querySchema = z.object({
      search: z.string().optional(),
      parentOnly: z.string().optional(), // "true" para solo raíz
    });
    const query = querySchema.parse(req.query);

    const clauses = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      // Verificar que la norma existe y pertenece al tenant
      const normativo = await tx.normativeStandard.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true },
      });
      if (!normativo) return null;

      const where: any = {
        normativeId: params.id,
        deletedAt: null,
      };

      // Filtrar solo raíz si se pide
      if (query.parentOnly === 'true') {
        where.parentClauseId = null;
      }

      // Búsqueda por texto
      if (query.search) {
        where.OR = [
          { clauseNumber: { contains: query.search, mode: 'insensitive' } },
          { title: { contains: query.search, mode: 'insensitive' } },
          { content: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      return tx.normativeClause.findMany({
        where,
        orderBy: { extractionOrder: 'asc' },
        select: {
          id: true,
          clauseNumber: true,
          title: true,
          level: true,
          parentClauseId: true,
          status: true,
          extractionOrder: true,
          pageNumber: true,
          keywords: true,
          _count: { select: { childClauses: true, documentMappings: true } },
        },
      });
    });

    if (clauses === null) return reply.code(404).send({ error: 'Normative not found' });
    return reply.send({ clauses });
  });

  // ── GET /normativos/:id/clauses/:clauseId — Detalle de cláusula ──
  app.get('/:id/clauses/:clauseId', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const paramsSchema = z.object({
      id: z.string().uuid(),
      clauseId: z.string().uuid(),
    });
    const params = paramsSchema.parse(req.params);

    const clause = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.normativeClause.findFirst({
        where: {
          id: params.clauseId,
          normativeId: params.id,
          deletedAt: null,
        },
        include: {
          childClauses: {
            where: { deletedAt: null },
            orderBy: { extractionOrder: 'asc' },
            select: {
              id: true,
              clauseNumber: true,
              title: true,
              level: true,
            },
          },
          documentMappings: {
            where: { deletedAt: null },
            include: {
              document: {
                select: { id: true, title: true, type: true, status: true },
              },
            },
          },
        },
      });
    });

    if (!clause) return reply.code(404).send({ error: 'Clause not found' });
    return reply.send({ clause });
  });
  // ── GET /normativos/:id/clause-suggestions — Sugerencias de IA ──
  app.get('/:id/clause-suggestions', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    const effectiveTenantId = headerTenantId || req.db?.tenantId || 'f20f0bfe-c1d8-40f6-8d36-97734881ffde';
    
    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);
    const prisma = app.prisma;

    try {
      const normative = await prisma.normativeStandard.findFirst({
        where: { id: params.id, tenantId: effectiveTenantId, deletedAt: null },
        select: { id: true, name: true, code: true, status: true }
      });

      if (!normative) {
        return reply.code(404).send({ error: 'Normative not found' });
      }

      const allClauses = await prisma.normativeClause.findMany({
        where: { normativeId: params.id, deletedAt: null },
        select: { id: true, clauseNumber: true, title: true, content: true },
        orderBy: { clauseNumber: 'asc' }
      });

      const mappedClauses = await prisma.documentClauseMapping.findMany({
        where: { 
          deletedAt: null,
          clause: { normativeId: params.id, deletedAt: null }
        },
        select: { clauseId: true }
      });

      const mappedClauseIds = new Set(mappedClauses.map((m: any) => m.clauseId));
      const pendingClauses = allClauses.filter(c => !mappedClauseIds.has(c.id));

      const suggestions = pendingClauses.map(clause => {
        const content = (clause.content || '').toLowerCase();
        const title = (clause.title || '').toLowerCase();
        const clauseNumber = clause.clauseNumber || '';

        let documentTypes: string[] = [];
        let examples: string[] = [];
        let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

        if (content.includes('política') || title.includes('política') || clauseNumber.startsWith('5')) {
          documentTypes = ['Política de calidad', 'Manual de gestión', 'Declaración de política'];
          examples = ['Política de calidad firmada', 'Manual de gestión de calidad', 'Declaración de misión y visión'];
          priority = 'HIGH';
        } else if (content.includes('procedimiento') || title.includes('procedimiento') || clauseNumber.startsWith('8')) {
          documentTypes = ['Procedimientos documentados', 'Instrucciones de trabajo', 'Guías operativas'];
          examples = ['Procedimiento de control de documentos', 'Instrucciones de trabajo', 'Guías de procesos'];
          priority = 'HIGH';
        } else if (content.includes('registro') || title.includes('registro') || content.includes('evidencia')) {
          documentTypes = ['Registros de calidad', 'Formularios', 'Informes de auditoría'];
          examples = ['Registros de capacitación', 'Informes de auditoría interna', 'Formularios de control'];
          priority = 'MEDIUM';
        } else if (content.includes('competencia') || title.includes('competencia') || content.includes('capacitación')) {
          documentTypes = ['Registros de capacitación', 'Matriz de competencias', 'Plan de formación'];
          examples = ['Registros de entrenamiento', 'Evaluación de competencias', 'Plan anual de capacitación'];
          priority = 'MEDIUM';
        } else if (content.includes('evaluación') || title.includes('evaluación') || content.includes('auditoría')) {
          documentTypes = ['Informes de auditoría', 'Evaluaciones de desempeño', 'Mediciones de procesos'];
          examples = ['Informes de auditoría interna', 'Evaluación de proveedores', 'Indicadores de proceso'];
          priority = 'HIGH';
        } else if (content.includes('recurso') || title.includes('recurso') || content.includes('infraestructura')) {
          documentTypes = ['Plan de recursos', 'Inventario de equipos', 'Mantenimiento preventivo'];
          examples = ['Plan de infraestructura', 'Registro de equipos', 'Programa de mantenimiento'];
          priority = 'MEDIUM';
        } else if (content.includes('comunicación') || title.includes('comunicación')) {
          documentTypes = ['Plan de comunicación', 'Actas de reunión', 'Comunicados internos'];
          examples = ['Plan de comunicación interna', 'Actas de reuniones de revisión', 'Boletines informativos'];
          priority = 'LOW';
        } else {
          documentTypes = ['Documentos del sistema', 'Evidencias de implementación', 'Registros'];
          examples = ['Documentación del sistema de gestión', 'Evidencias de cumplimiento', 'Registros de actividades'];
          priority = 'MEDIUM';
        }

        return {
          clauseId: clause.id,
          clauseNumber: clause.clauseNumber,
          clauseTitle: clause.title,
          suggestion: {
            documentTypes,
            examples,
            priority,
            suggestedFileName: `${normative.code}_${clauseNumber}_${title.split(' ')[0].toLowerCase()}`
          }
        };
      });

      return reply.send({
        normative,
        totalPendingClauses: pendingClauses.length,
        suggestions
      });
    } catch (error) {
      console.error('Error generating clause suggestions:', error);
      return reply.code(500).send({ error: 'Failed to generate suggestions' });
    }
  });

};

// ──────────────────────────────────────────────────────────────
// Rutas de Document Clause Mappings (para agregar en documents)
// ──────────────────────────────────────────────────────────────

export const clauseMappingRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /documents/:docId/clause-mappings — Vincular cláusula ──
  app.post('/:docId/clause-mappings', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const paramsSchema = z.object({ docId: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const bodySchema = z.object({
      clauseId: z.string().uuid(),
      complianceType: z.enum(['CUMPLE', 'REFERENCIA', 'IMPLEMENTA', 'NO_APLICA']),
      notes: z.union([z.string(), z.null()]).optional(),
    });
    const body = bodySchema.parse(req.body);

    const mapping = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      // Verificar que el documento existe
      const doc = await tx.document.findFirst({
        where: { id: params.docId, deletedAt: null },
        select: { id: true },
      });
      if (!doc) return null;

      // Verificar que la cláusula existe
      const clause = await tx.normativeClause.findFirst({
        where: { id: body.clauseId, deletedAt: null },
        select: { id: true },
      });
      if (!clause) return 'CLAUSE_NOT_FOUND';

      // Verificar duplicado
      const existing = await tx.documentClauseMapping.findFirst({
        where: {
          documentId: params.docId,
          clauseId: body.clauseId,
          deletedAt: null,
        },
      });
      if (existing) return 'DUPLICATE';

      return tx.documentClauseMapping.create({
        data: {
          documentId: params.docId,
          clauseId: body.clauseId,
          complianceType: body.complianceType,
          notes: body.notes || null,
          createdById: req.auth?.userId ?? null,
        },
      });
    });

    if (mapping === null) return reply.code(404).send({ error: 'Document not found' });
    if (mapping === 'CLAUSE_NOT_FOUND') return reply.code(404).send({ error: 'Clause not found' });
    if (mapping === 'DUPLICATE') return reply.code(409).send({ error: 'Mapping already exists' });

    return reply.code(201).send({ mapping });
  });

  // ── GET /documents/:docId/clause-mappings — Listar vínculos ──
  app.get('/:docId/clause-mappings', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const paramsSchema = z.object({ docId: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const mappings = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.documentClauseMapping.findMany({
        where: { documentId: params.docId, deletedAt: null },
        include: {
          clause: {
            select: {
              id: true,
              clauseNumber: true,
              title: true,
              normative: {
                select: { id: true, name: true, code: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    return reply.send({ mappings });
  });

  // ── DELETE /documents/:docId/clause-mappings/:mappingId — Eliminar vínculo ──
  app.delete('/:docId/clause-mappings/:mappingId', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const paramsSchema = z.object({
      docId: z.string().uuid(),
      mappingId: z.string().uuid(),
    });
    const params = paramsSchema.parse(req.params);

    const deleted = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      const existing = await tx.documentClauseMapping.findFirst({
        where: {
          id: params.mappingId,
          documentId: params.docId,
          deletedAt: null,
        },
      });
      if (!existing) return null;

      return tx.documentClauseMapping.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
    });

    if (!deleted) return reply.code(404).send({ error: 'Mapping not found' });
    return reply.send({ ok: true });
  });
};
