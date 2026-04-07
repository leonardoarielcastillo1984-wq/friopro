import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function recreateDocuments() {
  const uploadsDir = '/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/apps/api/uploads';
  const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.docx') || f.endsWith('.txt'));
  
  console.log('📁 Archivos encontrados:', files.length);
  
  const tenant = await prisma.tenant.findFirst();
  const admin = await prisma.platformUser.findFirst();
  
  if (!tenant || !admin) {
    console.log('❌ No hay tenant o admin disponible');
    return;
  }
  
  console.log('🏢 Tenant:', tenant.name);
  console.log('👤 Admin:', admin.email);
  
  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    const stat = fs.statSync(filePath);
    const baseName = file.replace(/-\d+\.\w+$/, '').replace(/-/g, ' ');
    
    const doc = await prisma.document.create({
      data: {
        title: baseName,
        type: 'POLICY',
        filePath: file,
        status: 'EFFECTIVE',
        version: 1,
        tenantId: tenant.id,
        createdById: admin.id,
      }
    });
    console.log('✅ Creado:', doc.title);
  }
  
  console.log('\n🎉 Total documentos recuperados:', files.length);
}

recreateDocuments().catch(console.error).finally(() => process.exit(0));
