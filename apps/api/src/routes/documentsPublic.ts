import type { FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const documentsPublicRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /documents/list — Listar documentos reales ──
  app.get('/documents/list', async (req, reply) => {
    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const documentsPath = path.join(__dirname, '..', '..', '..', 'storage', 'documents');

      if (!fs.existsSync(documentsPath)) {
        return reply.send({ documents: [], message: 'No documents folder found' });
      }

      const files = fs.readdirSync(documentsPath);
      const documents = files
        .filter(file => file.endsWith('.docx') || file.endsWith('.pdf') || file.endsWith('.doc'))
        .map(file => ({
          name: file,
          path: `/documents/download/${encodeURIComponent(file)}`,
          size: fs.statSync(path.join(documentsPath, file)).size,
          createdAt: fs.statSync(path.join(documentsPath, file)).birthtime,
        }));

      return reply.send({ documents, total: documents.length });
    } catch (error: any) {
      app.log.error('Error listing documents:', error);
      return reply.code(500).send({ error: 'Error listing documents' });
    }
  });

  // ── GET /documents/download/:filename — Descargar documento ──
  app.get('/documents/download/:filename', async (req, reply) => {
    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const { filename } = req.params as { filename: string };
      const decodedFilename = decodeURIComponent(filename);
      const documentsPath = path.join(__dirname, '..', '..', '..', 'storage', 'documents');
      const filePath = path.join(documentsPath, decodedFilename);

      // Validar que el archivo está dentro de la carpeta de documentos
      if (!filePath.startsWith(documentsPath)) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      if (!fs.existsSync(filePath)) {
        return reply.code(404).send({ error: 'Document not found' });
      }

      const fileStream = fs.createReadStream(filePath);
      reply.type('application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${decodedFilename}"`);
      return reply.send(fileStream);
    } catch (error: any) {
      app.log.error('Error downloading document:', error);
      return reply.code(500).send({ error: 'Error downloading document' });
    }
  });
};
