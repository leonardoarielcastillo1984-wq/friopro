import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserPermissions() {
  try {
    // Find the user for employee 5d312212-da04-4290-b820-41d852656d8d
    const employee = await prisma.employee.findUnique({
      where: { id: '5d312212-da04-4290-b820-41d852656d8d' },
      include: { user: true }
    });

    if (!employee) {
      console.log('Employee not found');
      return;
    }

    if (!employee.user) {
      console.log('Employee has no user');
      return;
    }

    console.log('Employee ID:', employee.id);
    console.log('User ID:', employee.user.id);
    console.log('User email:', employee.user.email);
    console.log('Permissions in DB:', JSON.stringify(employee.user.permissions, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserPermissions();
