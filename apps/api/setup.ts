import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function setup() {
  console.log('🚀 Iniciando setup...\n');

  // 1. Crear admin
  const passwordHash = await argon2.hash('admin123');
  const admin = await prisma.platformUser.upsert({
    where: { email: 'admin@sgi360.com' },
    update: { passwordHash, isActive: true },
    create: {
      email: 'admin@sgi360.com',
      passwordHash,
      isActive: true,
      globalRole: 'SUPER_ADMIN'
    }
  });
  console.log('✅ Admin creado:', admin.email, `(${admin.id})`);

  // 2. Crear tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'empresa-principal' },
    update: {},
    create: {
      name: 'Empresa Principal',
      slug: 'empresa-principal',
      status: 'ACTIVE',
      createdById: admin.id
    }
  });
  console.log('✅ Tenant creado:', tenant.name, `(${tenant.id})`);

  // 3. Crear membership
  const existingMembership = await prisma.tenantMembership.findFirst({
    where: { userId: admin.id, tenantId: tenant.id }
  });
  
  if (!existingMembership) {
    await prisma.tenantMembership.create({
      data: {
        userId: admin.id,
        tenantId: tenant.id,
        role: 'TENANT_ADMIN',
        status: 'ACTIVE'
      }
    });
    console.log('✅ Membership creada');
  } else {
    console.log('✅ Membership ya existe');
  }

  console.log('\n🎉 Setup completado!');
  console.log('\n📧 Login:');
  console.log('   Email: admin@sgi360.com');
  console.log('   Password: admin123');
  console.log(`\n🏢 Tenant ID: ${tenant.id}`);
}

setup().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
}).finally(() => process.exit(0));
