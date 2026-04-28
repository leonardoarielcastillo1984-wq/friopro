import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import crypto from 'node:crypto';
import { extractTextFromPdf } from '../services/pdfParser.js';
import { generateDocumentSummary } from '../services/aiService.js';
import { requiresTenantContext, getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { checkStorageQuota, incrementStorageUsed, decrementStorageUsed } from '../services/storage-usage.js';
import { createLLMProvider } from '../services/llm/factory.js';

export const documentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');

    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const documents = await app.runWithDbContext(req, async (tx: any) => {
      return tx.document.findMany({
        where: { tenantId: req.db!.tenantId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          version: true,
          normativeId: true,
          departmentId: true,
          createdAt: true,
          updatedAt: true,
          process: true,
          ownerId: true,
          owner: { select: { id: true, firstName: true, lastName: true, email: true } },
          reviewDate: true,
          nextReviewDate: true,
          reviewStatus: true,
          documentQualityStatus: true,
        },
      });
    });

    // Calcular estado automático de vigencia
    const today = new Date();
    const documentsWithAutoStatus = documents.map((d: any) => {
      let autoStatus: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'SIN_FECHA' = 'SIN_FECHA';
      if (d.nextReviewDate) {
        const next = new Date(d.nextReviewDate);
        const diffDays = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) autoStatus = 'VENCIDO';
        else if (diffDays <= 15) autoStatus = 'POR_VENCER';
        else autoStatus = 'VIGENTE';
      }
      return { ...d, autoStatus };
    });

    return reply.send({ documents: documentsWithAutoStatus });
  });

  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const doc = await app.runWithDbContext(req, async (tx: any) => {
      return tx.document.findFirst({
        where: { id: params.id, deletedAt: null },
        include: {
          department: { select: { id: true, name: true } },
          normative: { select: { id: true, name: true, code: true } },
          owner: { select: { id: true, firstName: true, lastName: true, email: true } },
          clauseMappings: {
            where: { deletedAt: null },
            include: {
              clause: {
                select: {
                  id: true,
                  clauseNumber: true,
                  title: true,
                  normative: { select: { id: true, name: true, code: true } },
                },
              },
            },
          },
          reviews: {
            orderBy: { reviewedAt: 'desc' },
            take: 10,
            include: { reviewedBy: { select: { id: true, email: true } } },
          },
          createdBy: { select: { id: true, email: true } },
          updatedBy: { select: { id: true, email: true } },
        },
      });
    });

    if (!doc) return reply.code(404).send({ error: 'Not found' });
    
    // If content is null but file exists, extract content now
    let extractedContent = doc.content;
    if (!extractedContent && doc.filePath) {
      try {
        const fileBuffer = await fs.readFile(doc.filePath);
        const ext = path.extname(doc.filePath).toLowerCase();
        if (ext === '.pdf') {
          extractedContent = await extractTextFromPdf(fileBuffer);
        } else if (ext === '.docx') {
          const { extractTextFromDocx } = await import('../services/docxParser.js');
          extractedContent = await extractTextFromDocx(fileBuffer);
        } else if (ext === '.xlsx' || ext === '.xls') {
          extractedContent = `Archivo Excel: ${path.basename(doc.filePath)}`;
        }
        
        // Save extracted content to database
        if (extractedContent && extractedContent.length > 0) {
          await app.runWithDbContext(req, async (tx: any) => {
            await tx.document.update({
              where: { id: doc.id },
              data: { content: extractedContent },
            });
          });
        }
      } catch (err) {
        app.log.error(err, 'Error extracting content from file');
      }
    }
    
    // Calcular estado automático de vigencia
    const today = new Date();
    let autoStatus: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'SIN_FECHA' = 'SIN_FECHA';
    let daysToExpiry: number | null = null;
    if (doc.nextReviewDate) {
      const next = new Date(doc.nextReviewDate);
      daysToExpiry = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysToExpiry < 0) autoStatus = 'VENCIDO';
      else if (daysToExpiry <= 15) autoStatus = 'POR_VENCER';
      else autoStatus = 'VIGENTE';
    }

    // Flags de alerta
    const alerts = [] as string[];
    if (autoStatus === 'VENCIDO') alerts.push('Documento vencido');
    if (autoStatus === 'POR_VENCER') alerts.push('Documento próximo a vencer');
    if (!doc.reviewDate) alerts.push('Sin revisión registrada');
    if (!doc.ownerId) alerts.push('Sin responsable asignado');

    // Return full document data including content and filePath
    return reply.send({
      document: {
        ...doc,
        content: extractedContent || doc.content,
        filePath: doc.filePath,
        fileUrl: doc.filePath ? `/documents/${doc.id}/download` : null,
        autoStatus,
        daysToExpiry,
        alerts,
      }
    });
  });

  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');

    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const bodySchema = z.object({
      title: z.string().min(2),
      type: z.string().min(2),
      standardTags: z.unknown().optional(),
      departmentId: z.string().uuid().optional(),
      normativeId: z.string().uuid().optional(),
      process: z.string().optional(),
      ownerId: z.string().uuid().optional(),
      reviewDate: z.string().datetime().optional(),
      nextReviewDate: z.string().datetime().optional(),
      reviewStatus: z.enum(['APPROVED', 'REQUIRES_UPDATE']).optional(),
    });

    const body = bodySchema.parse(req.body);

    const created = await app.runWithDbContext(req, async (tx: any) => {
      const doc = await tx.document.create({
        data: {
          tenantId: (req.db!.tenantId as string),
          title: body.title,
          type: body.type,
          standardTags: body.standardTags as any,
          departmentId: body.departmentId,
          normativeId: body.normativeId,
          process: body.process,
          ownerId: body.ownerId,
          reviewDate: body.reviewDate ? new Date(body.reviewDate) : null,
          nextReviewDate: body.nextReviewDate ? new Date(body.nextReviewDate) : null,
          reviewStatus: (body.reviewStatus as any) ?? 'APPROVED',
          status: 'DRAFT',
          version: 1,
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
      });

      // Auto-link a cumplimiento si tiene normativa
      if (body.normativeId) {
        const clauses = await tx.normativeClause.findMany({
          where: { normativeId: body.normativeId, deletedAt: null },
          select: { id: true },
        });
        for (const clause of clauses) {
          await tx.documentClauseMapping.upsert({
            where: { documentId_clauseId: { documentId: doc.id, clauseId: clause.id } },
            update: {},
            create: {
              documentId: doc.id,
              clauseId: clause.id,
              complianceType: 'REFERENCIA',
              tenantId: req.db!.tenantId as string,
              createdById: req.auth?.userId ?? null,
            },
          });
        }
      }

      return doc;
    });

    return reply.code(201).send({ document: created });
  });

  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const bodySchema = z.object({
      title: z.string().min(2).optional(),
      type: z.string().min(2).optional(),
      standardTags: z.unknown().optional(),
      status: z.enum(['DRAFT', 'EFFECTIVE', 'OBSOLETE']).optional(),
      bumpVersion: z.boolean().optional(),
      departmentId: z.union([z.string().uuid(), z.literal(''), z.null()]).optional(),
      normativeId: z.union([z.string().uuid(), z.literal(''), z.null()]).optional(),
      normativeIds: z.array(z.string().uuid()).optional(),
      process: z.string().optional(),
      ownerId: z.union([z.string().uuid(), z.literal(''), z.null()]).optional(),
      reviewDate: z.union([z.string().datetime(), z.literal(''), z.null()]).optional(),
      nextReviewDate: z.union([z.string().datetime(), z.literal(''), z.null()]).optional(),
      reviewStatus: z.enum(['APPROVED', 'REQUIRES_UPDATE']).optional(),
      documentQualityStatus: z.enum(['ADEQUATE', 'IMPROVABLE', 'NON_CONFORMING']).optional(),
    });

    const body = bodySchema.parse(req.body);

    const updated = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.document.findFirst({ where: { id: params.id, deletedAt: null } });
      if (!existing) return null;

      const updated = await tx.document.update({
        where: { id: existing.id },
        data: {
          title: body.title ?? existing.title,
          type: body.type ?? existing.type,
          standardTags: body.standardTags === undefined ? existing.standardTags : (body.standardTags as any),
          status: (body.status as any) ?? existing.status,
          version: body.bumpVersion ? existing.version + 1 : existing.version,
          departmentId: body.departmentId !== undefined ? body.departmentId : existing.departmentId,
          normativeId: body.normativeIds !== undefined 
            ? (body.normativeIds.length > 0 ? body.normativeIds[0] : null)
            : (body.normativeId !== undefined ? body.normativeId : existing.normativeId),
          process: body.process !== undefined ? body.process : existing.process,
          ownerId: body.ownerId !== undefined ? body.ownerId : existing.ownerId,
          reviewDate: body.reviewDate !== undefined ? (body.reviewDate ? new Date(body.reviewDate) : null) : existing.reviewDate,
          nextReviewDate: body.nextReviewDate !== undefined ? (body.nextReviewDate ? new Date(body.nextReviewDate) : null) : existing.nextReviewDate,
          reviewStatus: (body.reviewStatus as any) ?? existing.reviewStatus,
          documentQualityStatus: (body.documentQualityStatus as any) ?? existing.documentQualityStatus,
          updatedById: req.auth?.userId ?? null,
        },
      });

      // Auto-link a cumplimiento si cambió la normativa (soporta múltiples normativas)
      const effectiveNormativeIds = body.normativeIds !== undefined
        ? body.normativeIds
        : (body.normativeId !== undefined && body.normativeId ? [body.normativeId] : []);
      
      const existingNormativeId = existing.normativeId;
      const hasNormativeChanged = effectiveNormativeIds.length > 0 && 
        (existingNormativeId === null || !effectiveNormativeIds.includes(existingNormativeId));
      
      if (hasNormativeChanged) {
        // Obtener cláusulas de todas las normativas seleccionadas
        const clauses = await tx.normativeClause.findMany({
          where: { normativeId: { in: effectiveNormativeIds }, deletedAt: null },
          select: { id: true },
        });
        
        // Insertar mappings en batch para mejor performance
        if (clauses.length > 0) {
          const createdById = req.auth?.userId ?? null;
          
          for (const clause of clauses) {
            await tx.documentClauseMapping.upsert({
              where: { documentId_clauseId: { documentId: existing.id, clauseId: clause.id } },
              update: {},
              create: {
                documentId: existing.id,
                clauseId: clause.id,
                complianceType: 'REFERENCIA',
                createdById,
              },
            });
          }
        }
      }

      return updated;
    });

    if (!updated) return reply.code(404).send({ error: 'Not found' });
    return reply.send({ document: updated });
  });

  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const deleted = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.document.findFirst({ where: { id: params.id, deletedAt: null } });
      if (!existing) return null;

      await tx.document.delete({ where: { id: existing.id } });
      return existing;
    });

    if (!deleted) return reply.code(404).send({ error: 'Not found' });

    // Decrementar uso y borrar archivo físico del disco
    if (deleted.filePath) {
      try {
        const { size } = await fs.stat(deleted.filePath);
        const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
        if (tenantId) await decrementStorageUsed((app as any).prisma, tenantId, size);
      } catch { /* archivo ya no existe en disco */ }
      try {
        await fs.unlink(deleted.filePath);
      } catch { /* no bloquear si falla */ }
    }

    return reply.send({ ok: true });
  });

  // ── POST /documents/upload — Subir PDF y extraer contenido ──
  app.post('/upload', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');

    console.log('[DOCUMENTS_UPLOAD] Request received:', {
      url: req.url,
      method: req.method,
      hasTenantId: !!req.db?.tenantId,
      tenantId: req.db?.tenantId,
      userId: req.auth?.userId,
      globalRole: req.auth?.globalRole
    });

    if (requiresTenantContext(req) && !req.db?.tenantId) {
      console.log('[DOCUMENTS_UPLOAD] Tenant context required - no tenantId and not superadmin');
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const effectiveTenantId = await getEffectiveTenantId(req, app.prisma);
    console.log('[DOCUMENTS_UPLOAD] Effective tenantId:', effectiveTenantId);
    
    if (!effectiveTenantId) {
      console.log('[DOCUMENTS_UPLOAD] No tenant available for operation');
      return reply.code(400).send({ error: 'No tenant available for operation' });
    }

    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'No file uploaded' });

    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];
    if (!allowedMimes.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'Solo se aceptan archivos PDF, Word (.docx, .doc) o Excel (.xlsx, .xls)' });
    }

    // Read file buffer
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    // Verificar cuota de almacenamiento antes de guardar
    const quota = await checkStorageQuota((app as any).prisma, effectiveTenantId, fileBuffer.length);
    if (!quota.allowed) {
      const usedMB = (quota.used / 1024 / 1024).toFixed(1);
      const limitMB = (quota.limit / 1024 / 1024 / 1024).toFixed(0);
      return reply.code(413).send({
        error: `Límite de almacenamiento alcanzado. Usás ${usedMB} MB de ${limitMB} GB disponibles en tu plan. Contactá soporte para ampliar tu capacidad.`,
        usage: { used: quota.used, limit: quota.limit, percentage: quota.percentage },
      });
    }

    // Save file to disk — volumen externo con estructura por tenant
    const storageBase = process.env.STORAGE_LOCAL_PATH || '/app/uploads';
    const uploadDir = path.resolve(storageBase, effectiveTenantId, 'documentos');
    await fs.mkdir(uploadDir, { recursive: true });

    const fileName = `${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, fileBuffer);
    await incrementStorageUsed((app as any).prisma, effectiveTenantId, fileBuffer.length);

    // Extract text from file
    let content = '';
    try {
      const ext = path.extname(data.filename).toLowerCase();
      if (ext === '.pdf') {
        content = await extractTextFromPdf(fileBuffer);
      } else if (ext === '.docx') {
        const { extractTextFromDocx } = await import('../services/docxParser.js');
        content = await extractTextFromDocx(fileBuffer);
      } else if (ext === '.xlsx' || ext === '.xls') {
        // Excel files: for now, just extract filename as content
        content = `Archivo Excel: ${data.filename}`;
      }
    } catch (err) {
      app.log.error(err, 'Error extracting text from document');
    }

    // Get metadata from form fields
    const title = (data.fields?.title as any)?.value || data.filename.replace(/\.(pdf|docx?|xlsx?)$/i, '');
    const docType = (data.fields?.type as any)?.value || 'PROCEDURE';
    const departmentId = (data.fields?.departmentId as any)?.value || null;
    const normativeId = (data.fields?.normativeId as any)?.value || null;
    const docProcess = (data.fields?.process as any)?.value || null;
    const ownerId = (data.fields?.ownerId as any)?.value || null;
    const reviewDate = (data.fields?.reviewDate as any)?.value || null;
    const nextReviewDate = (data.fields?.nextReviewDate as any)?.value || null;

    const created = await app.runWithDbContext(req, async (tx: any) => {
      const doc = await tx.document.create({
        data: {
          tenantId: effectiveTenantId,
          title,
          type: docType,
          content,
          filePath,
          departmentId,
          normativeId,
          process: docProcess,
          ownerId,
          reviewDate: reviewDate ? new Date(reviewDate) : null,
          nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : null,
          reviewStatus: 'APPROVED',
          status: 'DRAFT',
          version: 1,
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
      });

      // Auto-link a cumplimiento si tiene normativa
      if (normativeId) {
        const clauses = await tx.normativeClause.findMany({
          where: { normativeId, deletedAt: null },
          select: { id: true },
        });
        for (const clause of clauses) {
          await tx.documentClauseMapping.upsert({
            where: { documentId_clauseId: { documentId: doc.id, clauseId: clause.id } },
            update: {},
            create: {
              documentId: doc.id,
              clauseId: clause.id,
              complianceType: 'REFERENCIA',
              tenantId: effectiveTenantId,
              createdById: req.auth?.userId ?? null,
            },
          });
        }
      }

      return doc;
    });

    return reply.code(201).send({
      document: created,
      extractedChars: content.length,
    });
  });

  // ── GET /documents/:id/download — Descargar archivo ──
  app.get('/:id/download', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const doc = await app.runWithDbContext(req, async (tx: any) => {
      return tx.document.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true, title: true, filePath: true, type: true },
      });
    });

    if (!doc || !doc.filePath) return reply.code(404).send({ error: 'File not found' });

    try {
      const fileBuffer = await fs.readFile(doc.filePath);
      const ext = path.extname(doc.filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      // Sanitize filename for download
      const sanitizedTitle = doc.title.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `${sanitizedTitle}${ext}`;

      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(fileBuffer);
    } catch (err) {
      app.log.error(err, 'Error reading file');
      return reply.code(500).send({ error: 'Failed to read file' });
    }
  });

  // ── GET /documents/:id/summary — Resumen IA del documento ──
  app.get('/:id/summary', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const doc = await app.runWithDbContext(req, async (tx: any) => {
      return tx.document.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true, title: true, content: true, type: true },
      });
    });

    if (!doc) return reply.code(404).send({ error: 'Document not found' });

    // Si no hay contenido extraído, no podemos generar resumen
    if (!doc.content || doc.content.length < 50) {
      return reply.send({
        summary: 'No hay contenido suficiente para generar un resumen. El documento puede ser un archivo escaneado o protegido.',
        keyPoints: [],
        topics: [],
      });
    }

    try {
      // Generar resumen con IA
      const summary = await generateDocumentSummary(doc.content, doc.title, doc.type);
      return reply.send(summary);
    } catch (err) {
      app.log.error(err, 'Error generating summary');
      return reply.code(500).send({ error: 'Failed to generate summary' });
    }
  });

  // ── GET /documents/:id/versions — Listar versiones ──
  app.get('/:id/versions', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const versions = await app.runWithDbContext(req, async (tx: any) => {
      return tx.documentVersion.findMany({
        where: { documentId: params.id },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, email: true } },
        },
      });
    });

    return reply.send({ versions });
  });

  // ── POST /documents/:id/versions — Subir nueva versión ──
  app.post('/:id/versions', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'No file uploaded' });

    // Obtener documento actual para incrementar versión
    const currentDoc = await app.runWithDbContext(req, async (tx: any) => {
      return tx.document.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true, version: true, filePath: true, tenantId: true },
      });
    });

    if (!currentDoc) return reply.code(404).send({ error: 'Document not found' });

    const storageBase = process.env.STORAGE_LOCAL_PATH || '/app/uploads';
    const uploadDir = path.resolve(storageBase, currentDoc.tenantId, 'documentos', 'versiones');
    await fs.mkdir(uploadDir, { recursive: true });

    // Guardar versión anterior si existe
    let oldVersionId: string | null = null;
    if (currentDoc.filePath && existsSync(currentDoc.filePath)) {
      const versionRecord = await app.runWithDbContext(req, async (tx: any) => {
        return tx.documentVersion.create({
          data: {
            documentId: params.id,
            version: currentDoc.version || 1,
            filePath: currentDoc.filePath,
            originalName: path.basename(currentDoc.filePath!),
            fileSize: (await fs.stat(currentDoc.filePath!)).size,
            createdById: req.auth?.userId ?? null,
          },
        });
      });
      oldVersionId = versionRecord.id;
    }

    // Guardar nuevo archivo
    const fileId = crypto.randomUUID();
    const originalName = data.filename;
    const ext = path.extname(originalName).toLowerCase();
    const uniqueName = `${fileId}${ext}`;
    const filePath = path.join(uploadDir, uniqueName);

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);
    await fs.writeFile(filePath, fileBuffer);

    // Incrementar versión (parse semver style) - version es number en DB
    const currentVersionStr = String(currentDoc.version);
    const versionParts = currentVersionStr.split('.');
    let newVersion = currentVersionStr;
    if (versionParts.length === 2) {
      const major = parseInt(versionParts[0], 10);
      const minor = parseInt(versionParts[1], 10);
      if (!isNaN(major) && !isNaN(minor)) {
        newVersion = `${major}.${minor + 1}`;
      }
    } else if (versionParts.length === 1) {
      const major = parseInt(versionParts[0], 10);
      if (!isNaN(major)) {
        newVersion = `${major + 1}.0`;
      }
    }

    // Actualizar documento
    const updatedDoc = await app.runWithDbContext(req, async (tx: any) => {
      return tx.document.update({
        where: { id: params.id },
        data: {
          filePath,
          version: parseFloat(newVersion),
          updatedAt: new Date(),
          updatedById: req.auth?.userId ?? null,
        },
      });
    });

    return reply.code(201).send({
      version: { id: oldVersionId, version: currentDoc.version },
      document: updatedDoc,
    });
  });

  // ── GET /documents/:id/versions/:versionId/download — Descargar versión ──
  app.get('/:id/versions/:versionId/download', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');

    const paramsSchema = z.object({ id: z.string().uuid(), versionId: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    const version = await app.runWithDbContext(req, async (tx: any) => {
      return tx.documentVersion.findFirst({
        where: { id: params.versionId, documentId: params.id },
      });
    });

    if (!version || !version.filePath) return reply.code(404).send({ error: 'Version not found' });

    try {
      const fileBuffer = await fs.readFile(version.filePath);
      const ext = path.extname(version.filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      const filename = version.originalName || `version-${version.version}${ext}`;

      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(fileBuffer);
    } catch (err) {
      app.log.error(err, 'Error reading version file');
      return reply.code(500).send({ error: 'Failed to read file' });
    }
  });

  // ── GET /documents/:id/reviews — Listar revisiones ──
  app.get('/:id/reviews', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const paramsSchema = z.object({ id: z.string().uuid() });
    const { id } = paramsSchema.parse(req.params);

    const reviews = await app.runWithDbContext(req, async (tx: any) => {
      return tx.documentReview.findMany({
        where: { documentId: id },
        orderBy: { reviewedAt: 'desc' },
        include: { reviewedBy: { select: { id: true, email: true } } },
      });
    });

    return reply.send({ reviews });
  });

  // ── POST /documents/:id/reviews — Registrar revisión ──
  app.post('/:id/reviews', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const paramsSchema = z.object({ id: z.string().uuid() });
    const { id } = paramsSchema.parse(req.params);

    const bodySchema = z.object({
      result: z.enum(['APPROVED', 'REQUIRES_UPDATE']),
      comments: z.string().optional(),
      nextReviewDate: z.string().datetime().optional(),
    });
    const body = bodySchema.parse(req.body);

    const result = await app.runWithDbContext(req, async (tx: any) => {
      const doc = await tx.document.findFirst({ where: { id, deletedAt: null } });
      if (!doc) throw new Error('Document not found');

      const review = await tx.documentReview.create({
        data: {
          documentId: id,
          result: body.result,
          comments: body.comments,
          reviewedById: req.auth?.userId ?? null,
        },
      });

      // Actualizar fechas de revisión en el documento
      const now = new Date();
      const nextDate = body.nextReviewDate ? new Date(body.nextReviewDate) : (doc.nextReviewDate ? new Date(doc.nextReviewDate) : null);
      await tx.document.update({
        where: { id },
        data: {
          reviewDate: now,
          nextReviewDate: nextDate,
          reviewStatus: body.result,
          updatedById: req.auth?.userId ?? null,
        },
      });

      return review;
    });

    return reply.code(201).send({ review: result });
  });

  // ── POST /documents/:id/ai-validation — Validación documental con IA ──
  app.post('/:id/ai-validation', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const paramsSchema = z.object({ id: z.string().uuid() });
    const { id } = paramsSchema.parse(req.params);

    const doc = await app.runWithDbContext(req, async (tx: any) => {
      return tx.document.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, title: true, content: true, type: true, status: true, reviewStatus: true },
      });
    });

    if (!doc) return reply.code(404).send({ error: 'Document not found' });
    if (!doc.content || doc.content.length < 50) {
      return reply.send({
        qualityStatus: 'IMPROVABLE',
        summary: 'No hay contenido suficiente para validar.',
        gaps: ['Contenido insuficiente o archivo no parseable'],
        recommendations: [{ priority: 'ALTA', action: 'Verificar que el archivo sea legible y contenga texto.', moduleOrDocument: 'general' }],
        complianceScore: 0,
      });
    }

    try {
      const prompt = `Sos un experto en control documental ISO 9001/14001/45001. Evaluá la calidad y conformidad del siguiente documento de gestión.

=== DOCUMENTO ===
Título: ${doc.title}
Tipo: ${doc.type}
Estado: ${doc.status}

Contenido (primeros 3000 caracteres):
${doc.content.slice(0, 3000)}

Tu tarea:
1. Evaluá la calidad del documento considerando:
   - Claridad y redacción
   - Estructura (título, alcance, responsabilidades, procedimiento, registros)
   - Completitud de secciones ISO requeridas
   - Definición de responsabilidades
2. Detectá faltantes o deficiencias.
3. Asigná un puntaje de conformidad del 0 al 100.
4. Clasificá la calidad como: ADEQUATE (>=70), IMPROVABLE (40-69), NON_CONFORMING (<40).

Respondé EXACTAMENTE en este formato JSON (sin markdown, sin bloques de código):
{
  "qualityStatus": "ADEQUATE|IMPROVABLE|NON_CONFORMING",
  "complianceScore": 0,
  "summary": "Evaluación breve en 2-3 oraciones.",
  "gaps": ["Faltante 1", "Faltante 2"],
  "recommendations": [
    {"priority": "ALTA|MEDIA|BAJA", "action": "Acción concreta", "moduleOrDocument": "qué sección o campo mejorar"}
  ],
  "structureAnalysis": "Análisis de la estructura del documento.",
  "responsibilityAnalysis": "Análisis de si las responsabilidades están claras."
}`;

      const llm = createLLMProvider();
      const response = await llm.chat([{ role: 'user', content: prompt }], 1500);

      let parsed;
      try {
        parsed = JSON.parse(response.text.trim().replace(/^```json\s*|\s*```$/g, ''));
      } catch {
        parsed = {
          qualityStatus: 'IMPROVABLE',
          complianceScore: 50,
          summary: response.text.slice(0, 500),
          gaps: ['No se pudo estructurar la validación.'],
          recommendations: [{ priority: 'MEDIA', action: 'Revisar manualmente el documento.', moduleOrDocument: 'general' }],
          structureAnalysis: '',
          responsibilityAnalysis: '',
        };
      }

      // Guardar qualityStatus en el documento
      await app.runWithDbContext(req, async (tx: any) => {
        await tx.document.update({
          where: { id },
          data: { documentQualityStatus: parsed.qualityStatus as any },
        });
      });

      return reply.send({ ...parsed, model: response.model });
    } catch (err: any) {
      app.log.error('AI validation error:', err);
      return reply.code(503).send({ error: err?.message || 'El servicio de IA no está disponible' });
    }
  });
};
