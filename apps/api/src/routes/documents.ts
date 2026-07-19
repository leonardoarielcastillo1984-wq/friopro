import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import crypto from 'node:crypto';
import { extractTextFromPdf } from '../services/pdfParser.js';
import { generateDocumentSummary } from '../services/aiService.js';
import { notifyDocumentReview } from '../services/notifyService.js';
import { requiresTenantContext, getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { checkStorageQuota, incrementStorageUsed, decrementStorageUsed } from '../services/storage-usage.js';
import { createGroqOnlyLLMProvider } from '../services/llm/factory.js';

export const documentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');

    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

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
          normativeIds: true,
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

    // Vinculación real documento ↔ proceso (tabla ProcessDocument, misma que usa el Mapa de Procesos).
    const docIds = documents.map((d: any) => d.id);
    const processLinks = docIds.length
      ? await app.runWithDbContext(req, async (tx: any) => {
          return tx.processDocument.findMany({
            where: { documentId: { in: docIds } },
            select: { documentId: true, process: { select: { id: true, name: true } } },
          });
        })
      : [];
    const processesByDoc: Record<string, { id: string; name: string }[]> = {};
    for (const link of processLinks) {
      if (!link.process) continue;
      (processesByDoc[link.documentId] ??= []).push({ id: link.process.id, name: link.process.name });
    }

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
      return { ...d, autoStatus, processes: processesByDoc[d.id] ?? [] };
    });

    return reply.send({ documents: documentsWithAutoStatus });
  });

  // ── PUT /documents/:id/processes — Sincronizar vinculación documento ↔ procesos ──
  // Usa la misma tabla ProcessDocument que el Mapa de Procesos, por lo que la relación es bidireccional.
  app.put('/:id/processes', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { processIds } = z.object({ processIds: z.array(z.string().uuid()) }).parse(req.body);

    await app.runWithDbContext(req, async (tx: any) => {
      const doc = await tx.document.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!doc) return reply.code(404).send({ error: 'Documento no encontrado' });
      await tx.processDocument.deleteMany({ where: { documentId: id } });
      if (processIds.length) {
        await tx.processDocument.createMany({
          data: processIds.map((processId) => ({ processId, documentId: id })),
          skipDuplicates: true,
        });
      }
    });

    return reply.send({ ok: true, processIds });
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

    if (!doc) return reply.code(404).send({ error: 'Documento no encontrado.' });
    
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
        } else if (ext === '.doc') {
          const { extractTextFromDoc } = await import('../services/docxParser.js');
          extractedContent = await extractTextFromDoc(fileBuffer);
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

    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

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

      // No auto-link clauses — user links them manually via the UI
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
      normativeIds: z.union([z.array(z.string().uuid()), z.null()]).optional(),
      process: z.union([z.string(), z.null()]).optional(),
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

      // Validar ownerId - si no existe en PlatformUser, usar null
      let validOwnerId = body.ownerId !== undefined ? (body.ownerId || null) : existing.ownerId;
      if (validOwnerId) {
        const ownerExists = await tx.platformUser.findUnique({
          where: { id: validOwnerId },
          select: { id: true }
        });
        if (!ownerExists) {
          console.log('[DOCUMENTS_PATCH] ownerId no existe, usando null:', validOwnerId);
          validOwnerId = null;
        }
      }

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
            ? ((body.normativeIds ?? []).length > 0 ? (body.normativeIds ?? [])[0] : null)
            : (body.normativeId !== undefined ? body.normativeId : existing.normativeId),
          process: body.process !== undefined ? body.process : existing.process,
          ownerId: validOwnerId,
          reviewDate: body.reviewDate !== undefined ? (body.reviewDate ? new Date(body.reviewDate) : null) : existing.reviewDate,
          nextReviewDate: body.nextReviewDate !== undefined ? (body.nextReviewDate ? new Date(body.nextReviewDate) : null) : existing.nextReviewDate,
          reviewStatus: (body.reviewStatus as any) ?? existing.reviewStatus,
          documentQualityStatus: (body.documentQualityStatus as any) ?? existing.documentQualityStatus,
          updatedById: req.auth?.userId ?? null,
        },
      });

      // Las cláusulas se vinculan manualmente, no automáticamente
      return updated;
    });

    if (!updated) return reply.code(404).send({ error: 'Documento no encontrado.' });

    if (
      body.reviewStatus === 'REQUIRES_UPDATE' &&
      updated.ownerId &&
      updated.ownerId !== req.auth?.userId
    ) {
      notifyDocumentReview(app.prisma, {
        tenantId: req.db?.tenantId ?? req.auth?.tenantId ?? '',
        docId: updated.id,
        docTitle: updated.title,
        reviewerId: updated.ownerId,
      }).catch(() => {});
    }

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

    if (!deleted) return reply.code(404).send({ error: 'Documento no encontrado.' });

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
    try {
      app.requireFeature(req, 'documentos');

      console.log('[DOCUMENTS_UPLOAD] Request received:', {
        url: req.url,
        method: req.method,
        hasTenantId: !!req.db?.tenantId,
        tenantId: req.db?.tenantId,
        userId: req.auth?.userId,
        globalRole: req.auth?.globalRole
      });

      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      let data;
      try {
        data = await req.file();
      } catch (fileErr: any) {
        console.error('[DOCUMENTS_UPLOAD] Error getting file from request:', fileErr.message);
        return reply.code(400).send({ error: 'Error reading uploaded file: ' + fileErr.message });
      }
      
      if (!data) {
        console.log('[DOCUMENTS_UPLOAD] No file data received');
        return reply.code(400).send({ error: 'No file uploaded' });
      }
      
      console.log('[DOCUMENTS_UPLOAD] File received:', { filename: data.filename, mimetype: data.mimetype, size: '...' });

    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/vnd.ms-powerpoint', // .ppt
      'text/plain', // .txt
      'text/csv', // .csv
      'application/csv',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/octet-stream', // fallback para archivos que el SO no detecta el MIME correctamente
    ];
    if (!allowedMimes.includes(data.mimetype)) {
      return reply.code(400).send({ error: `Tipo de archivo no permitido: ${data.mimetype}. Se aceptan PDF, Word, Excel, PowerPoint, imágenes y archivos de texto.` });
    }

    // Read file buffer
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    // Verificar cuota de almacenamiento antes de guardar
    const quota = await checkStorageQuota((app as any).prisma, tenantId, fileBuffer.length);
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
    const uploadDir = path.resolve(storageBase, tenantId, 'documentos');
    await fs.mkdir(uploadDir, { recursive: true });

    const fileName = `${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, fileBuffer);
    await incrementStorageUsed((app as any).prisma, tenantId, fileBuffer.length);

    // Extract text from file
    let content = '';
    try {
      const ext = path.extname(data.filename).toLowerCase();
      if (ext === '.pdf') {
        content = await extractTextFromPdf(fileBuffer);
      } else if (ext === '.docx') {
        const { extractTextFromDocx } = await import('../services/docxParser.js');
        content = await extractTextFromDocx(fileBuffer);
      } else if (ext === '.doc') {
        const { extractTextFromDoc } = await import('../services/docxParser.js');
        content = await extractTextFromDoc(fileBuffer);
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
    // Support multi-normative: normativeIds is a JSON array of UUIDs
    const normativeIdsRaw = (data.fields?.normativeIds as any)?.value || null;
    let normativeIds: string[] = [];
    if (normativeIdsRaw) {
      try { normativeIds = JSON.parse(normativeIdsRaw); } catch { normativeIds = []; }
    }
    const singleNormativeId = (data.fields?.normativeId as any)?.value || null;
    // If normativeIds provided, use first as primary; otherwise fall back to single
    const normativeId = normativeIds.length > 0 ? normativeIds[0] : singleNormativeId;
    const docProcess = (data.fields?.process as any)?.value || null;
    let ownerId = (data.fields?.ownerId as any)?.value || null;
    const reviewDate = (data.fields?.reviewDate as any)?.value || null;
    const nextReviewDate = (data.fields?.nextReviewDate as any)?.value || null;
    const documentCode = (data.fields?.documentCode as any)?.value || null;
    const typeConfigId = (data.fields?.typeConfigId as any)?.value || null;

    // Validar ownerId - si no existe en PlatformUser, usar null
    if (ownerId) {
      const ownerExists = await (app.prisma as any).platformUser.findUnique({
        where: { id: ownerId },
        select: { id: true }
      });
      if (!ownerExists) {
        console.log('[DOCUMENTS_UPLOAD] ownerId no existe, usando null:', ownerId);
        ownerId = null;
      }
    }

    const created = await app.runWithDbContext(req, async (tx: any) => {
      const doc = await tx.document.create({
        data: {
          tenantId: tenantId,
          title,
          type: docType,
          content,
          filePath,
          departmentId,
          normativeId,
          normativeIds: normativeIds.length > 0 ? normativeIds : (normativeId ? [normativeId] : []),
          process: docProcess,
          ownerId,
          reviewDate: reviewDate ? new Date(reviewDate) : null,
          nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : null,
          documentCode: documentCode || null,
          typeConfigId: typeConfigId || null,
          reviewStatus: 'APPROVED',
          status: 'DRAFT',
          version: 1,
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
      });

      // No auto-link clauses — user links them manually via the UI
      return doc;
    });

    return reply.code(201).send({
      document: created,
      extractedChars: content.length,
    });
    } catch (error: any) {
      console.error('[DOCUMENTS_UPLOAD] Unexpected error:', error.message, error.stack);
      return reply.code(500).send({ error: 'Error processing upload: ' + error.message });
    }
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
      return reply.code(500).send({ error: 'Error al leer el archivo.' });
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
      const summary = await generateDocumentSummary(doc.content, doc.title, doc.type, req.tenant);
      return reply.send(summary);
    } catch (err: any) {
      app.log.error(err, 'Error generating summary');
      if (err.code === 'LLM_NOT_CONFIGURED' || err.message?.includes('GROQ_API_KEY')) {
        return reply.code(503).send({
          summary: 'Resumen con IA no disponible. El servicio de IA no está configurado en este entorno.',
          keyPoints: [],
          topics: [],
          _llmUnavailable: true,
        });
      }
      return reply.code(500).send({ error: 'Error al generar el resumen con IA. Intentá nuevamente.' });
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
      return reply.code(500).send({ error: 'Error al leer el archivo.' });
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

  // ── GET /documents/:id/content — Obtener contenido HTML editable ──
  app.get('/:id/content', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const doc = await app.runWithDbContext(req, async (tx: any) => {
      return tx.document.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, title: true, content: true, htmlContent: true, filePath: true, type: true, status: true },
      });
    });
    if (!doc) return reply.code(404).send({ error: 'Documento no encontrado' });

    const status = doc.status;
    const forceRefresh = (req.query as any)?.refresh === 'true';

    // Si ya tiene HTML editado y no forzamos refresh, devolvemos eso
    if (doc.htmlContent && !forceRefresh) {
      return reply.send({ htmlContent: doc.htmlContent, source: 'edited', status });
    }

    // Si forzamos refresh, limpiar el htmlContent cacheado para re-extraer del archivo
    if (forceRefresh && doc.htmlContent) {
      await app.runWithDbContext(req, async (tx: any) => {
        await tx.document.update({ where: { id }, data: { htmlContent: null } });
      });
    }

    // Si tiene contenido de texto y no forzamos refresh desde archivo, usamos ese texto
    if (doc.content && !forceRefresh) {
      const htmlContent = doc.content
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .map((line: string) => `<p>${line}</p>`)
        .join('\n');
      return reply.send({ htmlContent, source: 'text', status });
    }

    // Si tiene archivo físico, extraemos HTML con mammoth
    if (doc.filePath) {
      try {
        const mammoth = await import('mammoth');
        const ext = path.extname(doc.filePath).toLowerCase();
        let htmlContent = '';
        if (ext === '.doc') {
          // .doc binario: usar antiword (instalado en el contenedor) para extraer texto correcto
          try {
            const { execFile } = await import('node:child_process');
            const { promisify } = await import('node:util');
            const execFileAsync = promisify(execFile);
            const { stdout } = await execFileAsync('antiword', ['-w', '0', '-m', 'UTF-8', doc.filePath]);
            htmlContent = stdout
              .split('\n')
              .map((l: string) => l.trim())
              .reduce((acc: string[], line: string) => {
                if (line === '') {
                  acc.push(''); // separador de párrafo
                } else if (acc.length && acc[acc.length - 1] !== '') {
                  acc[acc.length - 1] += ' ' + line; // unir líneas del mismo párrafo
                } else {
                  acc.push(line);
                }
                return acc;
              }, [])
              .filter((l: string) => l !== '')
              .map((l: string) => `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
              .join('\n');
          } catch {
            // Si antiword falla, intentar con mammoth como fallback
            const fileBuffer = await fs.readFile(doc.filePath);
            const result = await mammoth.convertToHtml({ buffer: fileBuffer });
            htmlContent = result.value.replace(/[\uFFFD\u25C6♦]/g, '');
          }
        } else if (ext === '.docx') {
          // .docx moderno: mammoth funciona perfectamente
          const fileBuffer = await fs.readFile(doc.filePath);
          const result = await mammoth.convertToHtml({ buffer: fileBuffer }, {
            styleMap: [
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "p[style-name='Título 1'] => h1:fresh",
              "p[style-name='Título 2'] => h2:fresh",
              "p[style-name='Título 3'] => h3:fresh",
            ],
          });
          htmlContent = result.value
            .replace(/&#(\d+);/g, (_: string, num: string) => {
              const code = parseInt(num, 10);
              return code >= 32 && code <= 65535 ? String.fromCharCode(code) : '';
            })
            .replace(/&#x([0-9A-Fa-f]+);/g, (_: string, hex: string) => {
              const code = parseInt(hex, 16);
              return code >= 32 && code <= 65535 ? String.fromCharCode(code) : '';
            })
            .replace(/[\uFFFD\u25C6♦]/g, '');
        } else if (ext === '.pdf') {
          const textContent = await extractTextFromPdf(await fs.readFile(doc.filePath));
          htmlContent = textContent
            .split('\n')
            .filter((l: string) => l.trim())
            .map((l: string) => `<p>${l}</p>`)
            .join('\n');
        } else {
          htmlContent = `<p>Tipo de archivo no compatible para edición en línea (${ext}).</p>`;
        }
        return reply.send({ htmlContent, source: 'file', status });
      } catch (err) {
        app.log.error(err, 'Error extracting HTML from file');
        return reply.code(500).send({ error: 'Error al extraer contenido del archivo.' });
      }
    }

    return reply.send({ htmlContent: '<p></p>', source: 'empty', status });
  });

  // ── PUT /documents/:id/content — Guardar contenido HTML editado ──
  app.put('/:id/content', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { htmlContent, changeNote } = z.object({
      htmlContent: z.string(),
      changeNote: z.string().optional(),
    }).parse(req.body);

    const updated = await app.runWithDbContext(req, async (tx: any) => {
      const doc = await tx.document.findFirst({ where: { id, deletedAt: null } });
      if (!doc) return null;

      // Guardar snapshot en DocumentVersion antes de actualizar
      await tx.documentVersion.create({
        data: {
          documentId: id,
          version: doc.version,
          filePath: doc.filePath || '',
          originalName: changeNote || `Edición en línea v${doc.version}`,
          fileSize: (htmlContent.length),
          createdById: req.auth?.userId ?? null,
        },
      });

      // Extraer texto plano del HTML para el campo content (para búsqueda e IA)
      const textContent = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      return tx.document.update({
        where: { id },
        data: {
          htmlContent,
          content: textContent,
          version: doc.version + 1,
          updatedById: req.auth?.userId ?? null,
          updatedAt: new Date(),
        },
      });
    });

    if (!updated) return reply.code(404).send({ error: 'Documento no encontrado' });

    // Regenerar PDF cacheado en background (no bloquea la respuesta)
    setImmediate(async () => {
      try {
        const { execFile } = await import('node:child_process');
        const { promisify } = await import('node:util');
        const execFileAsync = promisify(execFile);
        const tmpDir = `/tmp/sgi-preview-${id}`;
        await fs.mkdir(tmpDir, { recursive: true });

        // Generar HTML completo con estilos para conversión a PDF
        const htmlForPdf = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #222; font-size: 11pt; line-height: 1.5; }
  h1 { font-size: 18pt; color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 6px; }
  h2 { font-size: 14pt; color: #1d4ed8; margin-top: 18px; }
  h3 { font-size: 12pt; color: #374151; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #d1d5db; padding: 6px 10px; }
  th { background: #eff6ff; font-weight: 600; }
  blockquote { border-left: 4px solid #3b82f6; margin: 0; padding: 6px 14px; background: #f0f9ff; }
  ul, ol { padding-left: 24px; }
</style></head><body>${htmlContent}</body></html>`;

        const htmlPath = path.join(tmpDir, 'edited.html');
        await fs.writeFile(htmlPath, htmlForPdf, 'utf-8');

        // Eliminar PDF anterior
        try { await fs.unlink(path.join(tmpDir, 'edited.pdf')); } catch { /* ok */ }

        await execFileAsync('libreoffice', [
          '--headless',
          `--env:UserInstallation=file:///tmp/lo-profile-${id}`,
          '--convert-to', 'pdf',
          '--outdir', tmpDir,
          htmlPath,
        ], { timeout: 60000, env: { ...process.env, HOME: '/tmp' } });

        // Renombrar para que el endpoint preview-pdf lo encuentre
        const originalExt = updated.filePath ? path.extname(updated.filePath) : '';
        const originalBase = updated.filePath ? path.basename(updated.filePath, originalExt) : 'document';
        const generatedPdf = path.join(tmpDir, 'edited.pdf');
        const targetPdf = path.join(tmpDir, originalBase + '.pdf');
        try { await fs.rename(generatedPdf, targetPdf); } catch { /* ok si ya tiene el nombre correcto */ }
      } catch (err) {
        app.log.warn(err, 'Error regenerando PDF preview tras guardar');
      }
    });

    return reply.send({ document: updated, message: 'Contenido guardado y nueva versión creada.' });
  });

  // ── POST /documents/:id/export-docx — Exportar HTML editado a DOCX ──
  app.post('/:id/export-docx', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const doc = await app.runWithDbContext(req, async (tx: any) => {
      return tx.document.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, title: true, htmlContent: true, content: true },
      });
    });
    if (!doc) return reply.code(404).send({ error: 'Documento no encontrado' });

    const textContent = doc.htmlContent
      ? doc.htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : (doc.content || '');

    try {
      const { Document, Paragraph, TextRun, HeadingLevel, Packer } = await import('docx');

      const paragraphs = textContent
        .split(/\n+/)
        .filter((p: string) => p.trim())
        .map((p: string) => new Paragraph({ children: [new TextRun(p.trim())] }));

      const wordDoc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: doc.title,
              heading: HeadingLevel.HEADING_1,
            }),
            ...paragraphs,
          ],
        }],
      });

      const buffer = await Packer.toBuffer(wordDoc);

      const sanitizedTitle = doc.title.replace(/[^a-zA-Z0-9._-]/g, '_');
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        .header('Content-Disposition', `attachment; filename="${sanitizedTitle}.docx"`)
        .send(buffer);
    } catch (err: any) {
      app.log.error(err, 'Error generating DOCX');
      return reply.code(500).send({ error: 'Error al generar el DOCX.' });
    }
  });

  // ── GET /documents/:id/preview-pdf — Convertir DOC/DOCX a PDF y servir ──
  app.get('/:id/preview-pdf', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const doc = await app.runWithDbContext(req, async (tx: any) => {
      return tx.document.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, filePath: true, title: true },
      });
    });
    if (!doc || !doc.filePath) return reply.code(404).send({ error: 'Archivo no encontrado' });
    if (!existsSync(doc.filePath)) return reply.code(404).send({ error: 'Archivo no encontrado en disco' });

    const ext = path.extname(doc.filePath).toLowerCase();
    if (!['.doc', '.docx', '.odt'].includes(ext)) {
      return reply.code(400).send({ error: 'Formato no soportado para preview' });
    }

    // Directorio temporal para la conversión
    const tmpDir = `/tmp/sgi-preview-${id}`;
    const editedPdfPath = path.join(tmpDir, 'edited.pdf');
    const originalPdfPath = path.join(tmpDir, path.basename(doc.filePath, ext) + '.pdf');

    try {
      await fs.mkdir(tmpDir, { recursive: true });

      // Priorizar el PDF generado desde el HTML editado (más reciente = versión editada)
      for (const pdfPath of [editedPdfPath, originalPdfPath]) {
        try {
          const stat = await fs.stat(pdfPath);
          if (Date.now() - stat.mtimeMs < 3600000) {
            const pdfBuffer = await fs.readFile(pdfPath);
            return reply
              .header('Content-Type', 'application/pdf')
              .header('Cache-Control', 'no-cache')
              .send(pdfBuffer);
          }
        } catch { /* no existe, continuar */ }
      }

      // Ningún PDF cacheado válido — generar desde archivo original

      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);

      await execFileAsync('libreoffice', [
        '--headless',
        `--env:UserInstallation=file:///tmp/lo-profile-${id}`,
        '--convert-to', 'pdf',
        '--outdir', tmpDir,
        doc.filePath,
      ], { timeout: 60000, env: { ...process.env, HOME: '/tmp' } });

      if (!existsSync(originalPdfPath)) return reply.code(500).send({ error: 'Error al convertir el documento' });

      const pdfBuffer = await fs.readFile(originalPdfPath);
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Cache-Control', 'no-cache')
        .send(pdfBuffer);
    } catch (err: any) {
      app.log.error(err, 'Error converting to PDF with LibreOffice');
      return reply.code(500).send({ error: 'Error al generar preview PDF: ' + err.message });
    }
  });

  // ── GET /documents/:id/file — Servir archivo para OnlyOffice (sin auth) ──
  app.get('/:id/file', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const prisma = (app as any).prisma;
    const doc = await prisma.document.findFirst({ where: { id, deletedAt: null }, select: { filePath: true, title: true } });
    if (!doc?.filePath || !existsSync(doc.filePath)) return reply.code(404).send({ error: 'Archivo no encontrado' });
    const ext = path.extname(doc.filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.pdf': 'application/pdf',
    };
    const buffer = await fs.readFile(doc.filePath);
    return reply
      .header('Content-Type', mimeTypes[ext] || 'application/octet-stream')
      .header('Content-Disposition', `inline; filename="${path.basename(doc.filePath)}"`)
      .header('Access-Control-Allow-Origin', '*')
      .send(buffer);
  });

  // ── GET /documents/:id/onlyoffice-key — Devuelve key estable por versión (sin auth) ──
  app.get('/:id/onlyoffice-key', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const base = id.replace(/-/g, '');
    try {
      const prisma = (app as any).prisma;
      const doc = await prisma.document.findFirst({ where: { id, deletedAt: null }, select: { version: true, updatedAt: true } });
      reply.header('Access-Control-Allow-Origin', '*');
      return reply.send({ key: `${base}_v${doc ? doc.version : 0}` });
    } catch {
      reply.header('Access-Control-Allow-Origin', '*');
      return reply.send({ key: `${base}_v0` });
    }
  });

  // ── POST /documents/:id/onlyoffice-callback — Callback de OnlyOffice para guardar ──
  app.post('/:id/onlyoffice-callback', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = req.body as any;

    app.log.info(`[OnlyOffice Callback] Doc: ${id}, Status: ${body.status}, URL: ${body.url ? 'present' : 'missing'}`);

    // Status 0 = no changes, 1 = document being edited, 2 = ready to save, 3 = saving error, 4 = document closed without changes, 6 = force saving error, 7 = error force saving
    if (body.status === 2 || body.status === 6) {
      try {
        if (!body.url) {
          app.log.error(`[OnlyOffice Callback] Missing URL for doc ${id}`);
          return reply.send({ error: 1, message: 'Missing URL' });
        }

        // Descargar el archivo editado desde OnlyOffice
        const fetch = (await import('node-fetch')).default;
        app.log.info(`[OnlyOffice Callback] Downloading from ${body.url}`);
        const response = await fetch(body.url, { timeout: 30000 });
        
        if (!response.ok) {
          app.log.error(`[OnlyOffice Callback] Download failed: ${response.status} ${response.statusText}`);
          throw new Error(`No se pudo descargar el archivo editado: ${response.status}`);
        }
        
        const buffer = Buffer.from(await response.arrayBuffer());
        app.log.info(`[OnlyOffice Callback] Downloaded ${buffer.length} bytes for doc ${id}`);

        // Usar prisma directo (sin runWithDbContext) porque OnlyOffice llama sin token
        const prisma = (app as any).prisma;
        const doc = await prisma.document.findFirst({ where: { id, deletedAt: null }, select: { filePath: true, version: true } });

        if (doc?.filePath) {
          app.log.info(`[OnlyOffice Callback] Saving version ${doc.version} for doc ${id} to ${doc.filePath}`);
          
          // Guardar snapshot de versión anterior
          await prisma.documentVersion.create({
            data: {
              documentId: id,
              version: doc.version,
              filePath: doc.filePath,
              originalName: `Versión ${doc.version} (OnlyOffice)`,
              fileSize: buffer.length,
              createdById: null,
            },
          });

          // Sobreescribir el archivo físico con la versión editada
          await fs.writeFile(doc.filePath, buffer);
          app.log.info(`[OnlyOffice Callback] Saved doc ${id} successfully`);

          // Actualizar versión en BD
          await prisma.document.update({
            where: { id },
            data: { version: doc.version + 1, updatedAt: new Date() },
          });

          // Limpiar caché PDF
          try { await fs.rm(`/tmp/sgi-preview-${id}`, { recursive: true, force: true }); } catch { /* ok */ }
        } else {
          app.log.warn(`[OnlyOffice Callback] Doc ${id} not found or no filePath`);
        }
      } catch (err: any) {
        app.log.error(err, `[OnlyOffice Callback] Error saving doc ${id}`);
        return reply.send({ error: 1, message: err.message });
      }
    } else {
      app.log.info(`[OnlyOffice Callback] Doc ${id} - no action needed for status ${body.status}`);
    }
    
    return reply.send({ error: 0 });
  });

  // ── POST /documents/:id/ai-action — Acciones IA copilot ──
  app.post('/:id/ai-action', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { prompt, actionId } = z.object({ prompt: z.string(), actionId: z.string().optional() }).parse(req.body);

    const doc = await app.runWithDbContext(req, async (tx: any) => {
      return tx.document.findFirst({ where: { id, deletedAt: null }, select: { id: true, title: true, content: true, htmlContent: true } });
    });
    if (!doc) return reply.code(404).send({ error: 'Documento no encontrado' });

    try {
      const tenantId = req.db?.tenantId ?? (req as any).auth?.tenantId ?? null;
      const llm = createGroqOnlyLLMProvider(req.tenant, app.prisma, tenantId, (req as any).auth?.userId ?? null, 'document-ai-action');
      const response = await llm.chat([{ role: 'user', content: prompt }], 1500);
      return reply.send({ text: response.text });
    } catch (err: any) {
      return reply.code(503).send({ error: err?.message || 'IA no disponible' });
    }
  });

  // ── POST /documents/:id/versions/:versionId/restore — Restaurar versión ──
  app.post('/:id/versions/:versionId/restore', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const { id, versionId } = z.object({ id: z.string().uuid(), versionId: z.string().uuid() }).parse(req.params);

    const result = await app.runWithDbContext(req, async (tx: any) => {
      const doc = await tx.document.findFirst({ where: { id, deletedAt: null } });
      if (!doc) return null;

      const version = await tx.documentVersion.findFirst({ where: { id: versionId, documentId: id } });
      if (!version) return null;

      // Guardar estado actual como nueva versión antes de restaurar
      await tx.documentVersion.create({
        data: {
          documentId: id,
          version: doc.version,
          filePath: doc.filePath || '',
          originalName: `Punto de restauración v${doc.version}`,
          fileSize: doc.htmlContent ? doc.htmlContent.length : 0,
          createdById: req.auth?.userId ?? null,
        },
      });

      // Si la versión tiene un filePath (archivo físico), extraer HTML
      let htmlContent = doc.htmlContent || '';
      if (version.filePath && existsSync(version.filePath)) {
        try {
          const ext = path.extname(version.filePath).toLowerCase();
          if (ext === '.docx' || ext === '.doc') {
            const mammoth = await import('mammoth');
            const result = await mammoth.convertToHtml({ path: version.filePath });
            htmlContent = result.value;
          }
        } catch { /* usar el HTML actual si falla */ }
      }

      // Actualizar documento restaurando versión
      await tx.document.update({
        where: { id },
        data: {
          htmlContent,
          version: doc.version + 1,
          updatedById: req.auth?.userId ?? null,
          updatedAt: new Date(),
        },
      });

      return { htmlContent, version: version.version };
    });

    if (!result) return reply.code(404).send({ error: 'Documento o versión no encontrada' });
    return reply.send(result);
  });

  // ── POST /documents/:id/export-pdf — Exportar HTML a PDF ──
  app.post('/:id/export-pdf', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const doc = await app.runWithDbContext(req, async (tx: any) => {
      return tx.document.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, title: true, htmlContent: true, content: true },
      });
    });
    if (!doc) return reply.code(404).send({ error: 'Documento no encontrado' });

    const htmlBody = doc.htmlContent || (doc.content
      ? doc.content.split('\n').filter((l: string) => l.trim()).map((l: string) => `<p>${l}</p>`).join('')
      : '<p>Sin contenido</p>');

    // Generamos un PDF simple usando HTML embebido en un buffer básico
    // Usamos una plantilla HTML que el browser puede imprimir como PDF
    const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${doc.title}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #222; font-size: 12pt; line-height: 1.6; }
  h1 { font-size: 20pt; border-bottom: 2px solid #2563eb; padding-bottom: 8px; color: #1e3a8a; }
  h2 { font-size: 16pt; color: #1d4ed8; margin-top: 20px; }
  h3 { font-size: 13pt; color: #374151; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
  th { background: #eff6ff; font-weight: 600; }
  blockquote { border-left: 4px solid #3b82f6; margin: 0; padding: 8px 16px; background: #f0f9ff; color: #374151; }
  .header { margin-bottom: 32px; }
  .meta { font-size: 10pt; color: #6b7280; margin-top: 4px; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
  <div class="header">
    <h1>${doc.title}</h1>
    <div class="meta">SGI360 · Documento generado el ${new Date().toLocaleDateString('es-AR')}</div>
  </div>
  ${htmlBody}
</body>
</html>`;

    const sanitizedTitle = doc.title.replace(/[^a-zA-Z0-9._-]/g, '_');
    return reply
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${sanitizedTitle}.html"`)
      .send(fullHtml);
  });

  // ── POST /documents/:id/cross-validate — Validación cruzada Fase 4 ──
  app.post('/:id/cross-validate', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const tenantId = req.db?.tenantId ?? (req as any).auth?.tenantId;

    const [doc, ncCount, auditCount, capaCount, trainingCount] = await Promise.all([
      app.runWithDbContext(req, async (tx: any) =>
        tx.document.findFirst({ where: { id, deletedAt: null }, select: { id: true, title: true, content: true, htmlContent: true, type: true } })
      ),
      (app as any).prisma.nonConformity?.count({ where: { tenantId } }).catch(() => 0),
      (app as any).prisma.audit?.count({ where: { tenantId } }).catch(() => 0),
      (app as any).prisma.cAPA?.count({ where: { tenantId } }).catch(() => 0),
      (app as any).prisma.training?.count({ where: { tenantId } }).catch(() => 0),
    ]);

    if (!doc) return reply.code(404).send({ error: 'Documento no encontrado' });

    const textContent = (doc.htmlContent || doc.content || '').replace(/<[^>]+>/g, ' ').slice(0, 2000);

    const systemContext = `El sistema SGI360 tiene actualmente:
- ${ncCount ?? 0} no conformidades registradas
- ${auditCount ?? 0} auditorías en el sistema
- ${capaCount ?? 0} CAPAs (acciones correctivas) registradas
- ${trainingCount ?? 0} capacitaciones registradas`;

    try {
      const prompt = `Sos un auditor experto en ISO 9001. Analizá si el siguiente documento de gestión "${doc.title}" (tipo: ${doc.type}) es consistente con los datos reales del sistema de gestión.

${systemContext}

Contenido del documento (primeros 2000 caracteres):
${textContent}

Tu tarea:
1. Detectá posibles inconsistencias entre lo que dice el documento y los datos del sistema
2. Identificá si el documento menciona procesos, evaluaciones o controles que deberían tener registros en el sistema
3. Sugierí acciones concretas para cerrar las brechas detectadas

Respondé en formato JSON sin markdown:
{
  "inconsistencies": ["descripción de inconsistencia 1", ...],
  "missing_records": ["registro que debería existir pero no se evidencia", ...],
  "recommendations": ["acción correctiva sugerida", ...],
  "compliance_risk": "ALTO|MEDIO|BAJO",
  "summary": "Resumen ejecutivo de 2-3 oraciones"
}`;

      const llm = createGroqOnlyLLMProvider(req.tenant, app.prisma, tenantId, (req as any).auth?.userId ?? null, 'document-cross-validate');
      const response = await llm.chat([{ role: 'user', content: prompt }], 1500);

      let parsed;
      try {
        parsed = JSON.parse(response.text.trim().replace(/^```json\s*|\s*```$/g, ''));
      } catch {
        parsed = { inconsistencies: [], missing_records: [], recommendations: [response.text.slice(0, 500)], compliance_risk: 'MEDIO', summary: 'Análisis completado.' };
      }

      return reply.send({ ...parsed, systemContext: { ncCount, auditCount, capaCount, trainingCount } });
    } catch (err: any) {
      return reply.code(503).send({ error: err?.message || 'IA no disponible' });
    }
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

      const tenantId = req.db?.tenantId ?? (req as any).auth?.tenantId ?? null;
      const llm = createGroqOnlyLLMProvider(req.tenant, app.prisma, tenantId, (req as any).auth?.userId ?? null, 'document-quality-analysis');
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

  // ════════════════════════════════════════════════════════
  // MAESTRO DE DOCUMENTOS — Configuración de codificación
  // ════════════════════════════════════════════════════════

  // ── GET /documents/code-config ──
  app.get('/code-config', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

    const config = await (app.prisma as any).documentCodeConfig.findUnique({ where: { tenantId } });
    return reply.send(config || { prefix: 'SGI', digitCount: 3, separator: '-' });
  });

  // ── PUT /documents/code-config ──
  app.put('/code-config', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

    const schema = z.object({
      prefix: z.string().min(1).max(10).toUpperCase(),
      digitCount: z.number().int().min(2).max(6).default(3),
      separator: z.string().max(1).default('-'),
    });
    const data = schema.parse(req.body);

    const config = await (app.prisma as any).documentCodeConfig.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...data },
    });
    return reply.send(config);
  });

  // ── GET /documents/types ──
  app.get('/types', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

    const types = await (app.prisma as any).documentTypeConfig.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return reply.send({ types });
  });

  // ── POST /documents/types ──
  app.post('/types', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

    const schema = z.object({
      name: z.string().min(1).max(100),
      abbreviation: z.string().min(1).max(10).toUpperCase(),
      description: z.string().optional(),
      color: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const existing = await (app.prisma as any).documentTypeConfig.findFirst({
      where: { tenantId, abbreviation: data.abbreviation, deletedAt: null },
    });
    if (existing) return reply.code(409).send({ error: `La abreviatura "${data.abbreviation}" ya existe` });

    const type = await (app.prisma as any).documentTypeConfig.create({
      data: { tenantId, ...data },
    });
    return reply.code(201).send(type);
  });

  // ── PUT /documents/types/:typeId ──
  app.put('/types/:typeId', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

    const { typeId } = z.object({ typeId: z.string().uuid() }).parse(req.params);
    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      color: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const type = await (app.prisma as any).documentTypeConfig.update({
      where: { id: typeId },
      data,
    });
    return reply.send(type);
  });

  // ── DELETE /documents/types/:typeId ──
  app.delete('/types/:typeId', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const { typeId } = z.object({ typeId: z.string().uuid() }).parse(req.params);
    await (app.prisma as any).documentTypeConfig.update({
      where: { id: typeId },
      data: { deletedAt: new Date() },
    });
    return reply.send({ ok: true });
  });

  // ── POST /documents/next-code — Obtener (y reservar) el próximo código ──
  app.post('/next-code', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

    const schema = z.object({
      typeConfigId: z.string().uuid(),
      reserve: z.boolean().default(false),
    });
    const { typeConfigId, reserve } = schema.parse(req.body);

    const [typeConfig, codeConfig] = await Promise.all([
      (app.prisma as any).documentTypeConfig.findFirst({ where: { id: typeConfigId, tenantId, deletedAt: null } }),
      (app.prisma as any).documentCodeConfig.findUnique({ where: { tenantId } }),
    ]);
    if (!typeConfig) return reply.code(404).send({ error: 'Tipo de documento no encontrado' });

    const prefix = codeConfig?.prefix || 'SGI';
    const digits = codeConfig?.digitCount || 3;
    const sep = codeConfig?.separator || '-';
    const seq = typeConfig.nextSequence;
    const code = `${prefix}${sep}${typeConfig.abbreviation}${sep}${String(seq).padStart(digits, '0')}`;

    if (reserve) {
      await (app.prisma as any).documentTypeConfig.update({
        where: { id: typeConfigId },
        data: { nextSequence: { increment: 1 } },
      });
    }

    return reply.send({ code, nextSequence: seq, preview: !reserve });
  });

  // ── GET /documents/master — Vista maestro con todos los metadatos ──
  app.get('/master', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

    const { status, typeConfigId, departmentId, search } = (req.query as any) || {};

    const where: any = { tenantId, deletedAt: null };
    if (status) where.status = status;
    if (typeConfigId) where.typeConfigId = typeConfigId;
    if (departmentId) where.departmentId = departmentId;
    if (search) where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { documentCode: { contains: search, mode: 'insensitive' } },
    ];

    const docs = await app.prisma.document.findMany({
      where,
      orderBy: [{ documentCode: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        documentCode: true,
        title: true,
        type: true,
        status: true,
        version: true,
        process: true,
        createdAt: true,
        updatedAt: true,
        approvedAt: true,
        nextReviewDate: true,
        typeConfig: { select: { id: true, name: true, abbreviation: true, color: true } },
        department: { select: { id: true, name: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        relatedDocument: { select: { id: true, title: true, documentCode: true } },
        versions: { select: { id: true, version: true, createdAt: true }, orderBy: { version: 'desc' }, take: 5 },
        _count: { select: { versions: true } },
      },
    } as any);

    const [codeConfig, typeConfigs] = await Promise.all([
      (app.prisma as any).documentCodeConfig.findUnique({ where: { tenantId } }),
      (app.prisma as any).documentTypeConfig.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: 'asc' } }),
    ]);

    return reply.send({ documents: docs, codeConfig, typeConfigs });
  });

  // ── PUT /documents/:id/master — Actualizar metadatos del maestro ──
  app.put('/:id/master', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, 'documentos');
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const schema = z.object({
      documentCode: z.string().optional(),
      typeConfigId: z.string().uuid().optional().nullable(),
      approvedAt: z.string().datetime().optional().nullable(),
      approvedById: z.string().uuid().optional().nullable(),
      relatedDocumentId: z.string().uuid().optional().nullable(),
      nextReviewDate: z.string().datetime().optional().nullable(),
      process: z.string().optional(),
      status: z.enum(['DRAFT', 'REVIEW', 'EFFECTIVE', 'OBSOLETE']).optional(),
    });
    const data = schema.parse(req.body);

    const updated = await app.prisma.document.update({
      where: { id },
      data: {
        ...(data.documentCode !== undefined && { documentCode: data.documentCode }),
        ...(data.typeConfigId !== undefined && { typeConfigId: data.typeConfigId }),
        ...(data.approvedAt !== undefined && { approvedAt: data.approvedAt ? new Date(data.approvedAt) : null }),
        ...(data.approvedById !== undefined && { approvedById: data.approvedById }),
        ...(data.relatedDocumentId !== undefined && { relatedDocumentId: data.relatedDocumentId }),
        ...(data.nextReviewDate !== undefined && { nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null }),
        ...(data.process !== undefined && { process: data.process }),
        ...(data.status !== undefined && { status: data.status as any }),
      } as any,
    });
    return reply.send(updated);
  });
};
