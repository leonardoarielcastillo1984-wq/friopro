import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import crypto from 'node:crypto';
import { extractTextFromPdf } from '../services/pdfParser.js';
import { generateDocumentSummary } from '../services/aiService.js';
import { requiresTenantContext, getEffectiveTenantId } from '../utils/tenant-bypass.js';

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
        },
      });
    });

    return reply.send({ documents });
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
    
    // Return full document data including content and filePath
    return reply.send({ 
      document: {
        ...doc,
        content: extractedContent || doc.content,
        filePath: doc.filePath,
        fileUrl: doc.filePath ? `/documents/${doc.id}/download` : null,
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
    });

    const body = bodySchema.parse(req.body);

    const created = await app.runWithDbContext(req, async (tx: any) => {
      return tx.document.create({
        data: {
          tenantId: (req.db!.tenantId as string),
          title: body.title,
          type: body.type,
          standardTags: body.standardTags as any,
          departmentId: body.departmentId,
          normativeId: body.normativeId,
          status: 'DRAFT',
          version: 1,
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
      });
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
    });

    const body = bodySchema.parse(req.body);

    const updated = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.document.findFirst({ where: { id: params.id, deletedAt: null } });
      if (!existing) return null;

      return tx.document.update({
        where: { id: existing.id },
        data: {
          title: body.title ?? existing.title,
          type: body.type ?? existing.type,
          standardTags: body.standardTags === undefined ? existing.standardTags : (body.standardTags as any),
          status: (body.status as any) ?? existing.status,
          version: body.bumpVersion ? existing.version + 1 : existing.version,
          departmentId: body.departmentId !== undefined ? body.departmentId : existing.departmentId,
          normativeId: body.normativeId !== undefined ? body.normativeId : existing.normativeId,
          updatedById: req.auth?.userId ?? null,
        },
      });
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

      return tx.document.update({
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

    // Save file to disk (ruta definitiva en proyecto)
    const uploadDir = path.resolve('/app/apps/api/uploads/documents');
    await fs.mkdir(uploadDir, { recursive: true });

    const fileName = `${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, fileBuffer);

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

    const created = await app.runWithDbContext(req, async (tx: any) => {
      return tx.document.create({
        data: {
          tenantId: effectiveTenantId,
          title,
          type: docType,
          content,
          filePath,
          departmentId,
          normativeId,
          status: 'DRAFT',
          version: 1,
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
      });
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

    const uploadDir = path.resolve('/Users/leonardocastillo/Desktop/APP/SGI 360/storage/documents');
    await fs.mkdir(uploadDir, { recursive: true });

    // Obtener documento actual para incrementar versión
    const currentDoc = await app.runWithDbContext(req, async (tx: any) => {
      return tx.document.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true, version: true, filePath: true },
      });
    });

    if (!currentDoc) return reply.code(404).send({ error: 'Document not found' });

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
};
