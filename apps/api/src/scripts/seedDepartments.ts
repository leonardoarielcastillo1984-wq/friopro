/**
 * seedDepartments.ts — Creates sample departments for the demo tenant
 *
 * Pre-requisites:
 *   1. seedUsers.ts (creates Demo Company tenant and users)
 *
 * Run:
 *   cd apps/api && node --import tsx src/scripts/seedDepartments.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface DepartmentConfig {
  name: string;
  description: string;
  color: string;
}

// Sample departments with colors
const DEPARTMENTS: DepartmentConfig[] = [
  {
    name: 'Tecnología e Informática',
    description: 'Infraestructura tecnológica y sistemas de información',
    color: '#3B82F6', // Blue
  },
  {
    name: 'Recursos Humanos',
    description: 'Gestión y desarrollo del personal',
    color: '#8B5CF6', // Purple
  },
  {
    name: 'Finanzas y Contabilidad',
    description: 'Planificación financiera y gestión contable',
    color: '#10B981', // Green
  },
  {
    name: 'Operaciones',
    description: 'Excelencia operativa y gestión de procesos',
    color: '#F59E0B', // Amber
  },
  {
    name: 'Calidad y Cumplimiento',
    description: 'Aseguramiento de la calidad y cumplimiento normativo',
    color: '#EF4444', // Red
  },
  {
    name: 'Marketing y Comunicaciones',
    description: 'Estrategia de marketing y comunicaciones',
    color: '#EC4899', // Pink
  },
  {
    name: 'Ventas y Desarrollo Comercial',
    description: 'Operaciones de venta y desarrollo de negocios',
    color: '#06B6D4', // Cyan
  },
  {
    name: 'Investigación y Desarrollo',
    description: 'Innovación e investigación',
    color: '#14B8A6', // Teal
  },
  {
    name: 'Seguridad y Medio Ambiente',
    description: 'Seguridad ocupacional y salud ambiental',
    color: '#6366F1', // Indigo
  },
  {
    name: 'Atención al Cliente',
    description: 'Soporte y relaciones con clientes',
    color: '#F97316', // Orange
  },
];

async function main() {
  console.log('🌱 Seeding departments...\n');

  // ── Get demo tenant ──
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  if (!tenant) {
    throw new Error('Demo tenant not found. Run seedUsers.ts first.');
  }

  console.log(`📦 Found tenant: ${tenant.name}`);

  // ── Get admin user ──
  const adminUser = await prisma.platformUser.findUnique({
    where: { email: 'calidad@demo.com' },
  });
  if (!adminUser) {
    throw new Error('Admin user not found. Run seedUsers.ts first.');
  }

  // ── Get other users for department membership ──
  const users = await prisma.platformUser.findMany({
    where: {
      email: { in: ['usuario@demo.com', 'calidad@demo.com', 'seguridad@demo.com', 'ambiente@demo.com', 'rrhh@demo.com'] },
    },
  });

  console.log(`👥 Found ${users.length} users for departments\n`);

  let departmentCount = 0;
  let memberCount = 0;

  for (const deptConfig of DEPARTMENTS) {
    // Create or update department
    const department = await prisma.department.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: deptConfig.name,
        },
      },
      update: {
        description: deptConfig.description,
        color: deptConfig.color,
      },
      create: {
        tenantId: tenant.id,
        name: deptConfig.name,
        description: deptConfig.description,
        color: deptConfig.color,
        createdById: adminUser.id,
        updatedById: adminUser.id,
      },
    });

    departmentCount++;
    console.log(`✓ Department: ${department.name}`);

    // Add department members
    // First user is always MANAGER
    if (users.length > 0) {
      const manager = users[departmentCount % users.length];
      await prisma.departmentMember.upsert({
        where: {
          departmentId_userId: {
            departmentId: department.id,
            userId: manager.id,
          },
        },
        update: { role: 'MANAGER' },
        create: {
          departmentId: department.id,
          userId: manager.id,
          role: 'MANAGER',
          createdById: adminUser.id,
        },
      });
      memberCount++;

      // Add 1-2 more members as MEMBER
      const numMembers = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < numMembers && users.length > 0; i++) {
        const memberIdx = (departmentCount + i + 1) % users.length;
        const member = users[memberIdx];

        // Skip if already manager
        if (member.id === manager.id) continue;

        await prisma.departmentMember.upsert({
          where: {
            departmentId_userId: {
              departmentId: department.id,
              userId: member.id,
            },
          },
          update: { role: 'MEMBER' },
          create: {
            departmentId: department.id,
            userId: member.id,
            role: 'MEMBER',
            createdById: adminUser.id,
          },
        });
        memberCount++;
      }
    }
  }

  console.log(`\n✅ Seeding complete!`);
  console.log(`   📊 Departments created: ${departmentCount}`);
  console.log(`   👥 Department members added: ${memberCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
