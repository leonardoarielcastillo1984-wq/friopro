import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const storageDir = '/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/storage/documents';

async function restoreDocuments() {
  console.log('🔍 Buscando archivos en:', storageDir);
  
  const files = fs.readdirSync(storageDir).filter(f => f.endsWith('.docx'));
  console.log(`📁 Archivos encontrados: ${files.length}`);
  
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  const user = await prisma.platformUser.findUnique({ where: { email: 'admin@sgi360.com' } });
  
  if (!tenant) {
    console.error('❌ Tenant "demo" no encontrado');
    return;
  }
  if (!user) {
    console.error('❌ Usuario admin no encontrado');
    return;
  }
  
  console.log(`✓ Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`✓ Usuario: ${user.email} (${user.id})`);
  
  let added = 0;
  for (const file of files) {
    // Extraer nombre limpio
    const cleanName = file
      .replace(/^\d+-/, '')
      .replace(/\.docx$/, '')
      .replace(/_/g, ' ');
    
    const filePath = path.join(storageDir, file);
    
    // Verificar si ya existe
    const existing = await prisma.document.findFirst({
      where: { 
        tenantId: tenant.id, 
        title: cleanName 
      }
    });
    
    if (existing) {
      console.log(`⚠️  Ya existe: ${cleanName}`);
      continue;
    }
    
    // Crear documento
    try {
      const doc = await prisma.document.create({
        data: {
          tenantId: tenant.id,
          title: cleanName,
          type: 'procedure',
          filePath: filePath,
          status: 'EFFECTIVE',
          version: 1,
          createdById: user.id,
          updatedById: user.id,
        }
      });
      console.log(`✅ Agregado: ${cleanName} (ID: ${doc.id})`);
      added++;
    } catch (err) {
      console.error(`❌ Error agregando ${cleanName}:`, err.message);
    }
  }
  
  // Contar totales
  const total = await prisma.document.count({ 
    where: { tenantId: tenant.id } 
  });
  
  console.log(`\n📊 Resumen:`);
  console.log(`   Agregados: ${added}`);
  console.log(`   Total en BD: ${total}`);
}

restoreDocuments()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
