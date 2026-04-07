const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3001;

const uploadsDir = '/Users/leonardocastillo/Desktop/APP/SGI 360/apps/api/uploads';

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Listar documentos
app.get('/documents', (req, res) => {
  const documents = [];
  
  try {
    const tenants = fs.readdirSync(uploadsDir).filter(f => {
      const stat = fs.statSync(path.join(uploadsDir, f));
      return stat.isDirectory() && f.includes('-');
    });
    
    for (const tenantId of tenants) {
      const tenantDir = path.join(uploadsDir, tenantId);
      const docDirs = fs.readdirSync(tenantDir).filter(f => {
        const stat = fs.statSync(path.join(tenantDir, f));
        return stat.isDirectory();
      });
      
      for (const docId of docDirs) {
        const filePath = path.join(tenantDir, docId, 'original.pdf');
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          documents.push({
            id: docId,
            title: 'Documento ' + docId.substring(0, 8),
            type: 'PROCEDURE',
            status: 'EFFECTIVE',
            version: '1.0',
            createdAt: stats.mtime.toISOString(),
            updatedAt: stats.mtime.toISOString(),
          });
        }
      }
    }
  } catch (error) {
    console.error('Error scanning documents:', error);
  }
  
  res.json({ documents });
});

// Descargar documento
app.get('/documents/:id/download', (req, res) => {
  const { id } = req.params;
  
  // Buscar en todas las carpetas de tenant
  const tenants = fs.readdirSync(uploadsDir).filter(f => {
    const stat = fs.statSync(path.join(uploadsDir, f));
    return stat.isDirectory() && f.includes('-');
  });
  
  for (const tenantId of tenants) {
    const filePath = path.join(uploadsDir, tenantId, id, 'original.pdf');
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${id}.pdf"`);
      return res.sendFile(filePath);
    }
  }
  
  res.status(404).json({ error: 'Document not found' });
});

// Endpoint simple para archivos
app.get('/files/:tenantId/:docId', (req, res) => {
  const { tenantId, docId } = req.params;
  const filePath = path.join(uploadsDir, tenantId, docId, 'original.pdf');
  
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${docId}.pdf"`);
    return res.sendFile(filePath);
  }
  
  res.status(404).json({ error: 'File not found' });
});

app.listen(port, () => {
  console.log(`🚀 Document server running on http://localhost:${port}`);
  console.log(`📁 Serving files from: ${uploadsDir}`);
});
