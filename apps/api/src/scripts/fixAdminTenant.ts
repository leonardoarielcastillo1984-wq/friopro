import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Asignando Tenant al usuario admin...\n');

  try {
    // 1. Obtener el usuario admin
    const admin = await prisma.platformUser.findUnique({
      where: { email: 'admin@sgi360.com' },
    });

    if (!admin) {
      console.log('❌ Usuario admin no encontrado. Ejecuta primero: npm run seed');
      return;
    }

    console.log(`✅ Usuario admin encontrado: ${admin.email}`);

    // 2. Obtener o crear tenant Demo
    const tenant = await prisma.tenant.findUnique({
      where: { slug: 'demo' },
    });

    if (!tenant) {
      console.log('❌ Tenant "demo" no encontrado. Ejecuta primero: npm run seed');
      return;
    }

    console.log(`✅ Tenant encontrado: ${tenant.name}`);

    // 3. Asignar admin al tenant
    const membership = await prisma.tenantMembership.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: admin.id,
        },
      },
      update: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
      create: {
        tenantId: tenant.id,
        userId: admin.id,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });

    console.log(`✅ Admin asignado al tenant: ${tenant.name} (SUPER_ADMIN)`);
    console.log('\n✅ ¡Listo! El error desaparecerá después de recargar el navegador.\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
