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
    name: 'IT & Technology',
    description: 'Information Technology and Digital Infrastructure',
    color: '#3B82F6', // Blue
  },
  {
    name: 'Human Resources',
    description: 'Personnel Management and Development',
    color: '#8B5CF6', // Purple
  },
  {
    name: 'Finance & Accounting',
    description: 'Financial Planning and Accounting Management',
    color: '#10B981', // Green
  },
  {
    name: 'Operations',
    description: 'Operational Excellence and Process Management',
    color: '#F59E0B', // Amber
  },
  {
    name: 'Quality & Compliance',
    description: 'Quality Assurance and Regulatory Compliance',
    color: '#EF4444', // Red
  },
  {
    name: 'Marketing & Communications',
    description: 'Marketing Strategy and Communications',
    color: '#EC4899', // Pink
  },
  {
    name: 'Sales & Business Development',
    description: 'Sales Operations and Business Development',
    color: '#06B6D4', // Cyan
  },
  {
    name: 'Research & Development',
    description: 'Innovation and Research',
    color: '#14B8A6', // Teal
  },
  {
    name: 'Safety & Environment',
    description: 'Occupational Safety and Environmental Health',
    color: '#6366F1', // Indigo
  },
  {
    name: 'Customer Service',
    description: 'Customer Support and Relations',
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
