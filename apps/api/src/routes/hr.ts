import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { sendEmail, notificationEmail } from '../services/email.js';
import ExcelJS from 'exceljs';

// Validation schemas
const emptyToUndefined = (val: unknown) => (val === '' || val === null || val === undefined ? undefined : val);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanUUID = (v: string | undefined | null) => (v && UUID_RE.test(v)) ? v : undefined;

const createEmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dni: z.string().min(1),
  birthDate: z.string(),
  address: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  cuil: z.string().optional(),
  hireDate: z.string(),
  contractType: z.enum(['PERMANENT', 'TEMPORARY', 'CONTRACTOR', 'INTERN', 'PART_TIME', 'FULL_TIME']),
  location: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  departmentId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  positionId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  supervisorId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  reportsToPositionId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  notes: z.string().optional(),
  employeeCompetencies: z.any().optional(),
  supervisorType: z.any().optional(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  roleId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const updateEmployeeSchema = createEmployeeSchema.partial();

const createPositionSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  category: z.string().optional(),
  level: z.string().optional(),
  objective: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  tasks: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  kpis: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
});

const createCompetencySchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  levels: z.array(z.string()).optional().default([]),
});

const createTrainingSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['INTERNAL', 'EXTERNAL', 'ONLINE', 'WORKSHOP', 'CERTIFICATION']),
  duration: z.number().optional(),
  cost: z.number().optional(),
  competencyIds: z.array(z.string()).optional(),
});

export default async function hrRoutes(fastify: FastifyInstance) {
  // ========== EMPLOYEES ==========
  
  // Get all employees
  fastify.get('/employees', async (request, reply) => {
    const tenantId = request.db?.tenantId;
    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id is required for tenant-scoped requests' });
    }
    
    const employees = await fastify.prisma.employee.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        department: true,
        position: true,
        supervisor: {
          select: { id: true, firstName: true, lastName: true }
        },
        user: {
          select: { id: true, email: true, status: true }
        },
        _count: {
          select: {
            subordinates: true,
            employeeCompetencies: true,
            trainingAssignments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return { employees };
  });

  // Get employee by ID
  fastify.get('/employees/:id', async (request, reply) => {
    const tenantId = request.db?.tenantId;
    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id is required for tenant-scoped requests' });
    }
    const { id } = request.params as { id: string };

    const employee = await fastify.prisma.employee.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        department: true,
        position: true,
        supervisor: {
          select: { id: true, firstName: true, lastName: true }
        },
        subordinates: {
          select: { id: true, firstName: true, lastName: true, position: true }
        },
        user: {
          include: {
            roles: {
              include: { role: true }
            }
          }
        },
        employeeCompetencies: {
          include: {
            competency: true
          }
        },
        trainingAssignments: {
          include: {
            training: true
          }
        }
      }
    });

    if (!employee) {
      return reply.code(404).send({ error: 'Employee not found' });
    }

    return { employee };
  });

  // Create employee
  fastify.post('/employees', async (request, reply) => {
    try {
      const { tenantId, userId } = request;
      let data;
    try {
      data = createEmployeeSchema.parse(request.body);
    } catch (e: any) {
      console.error('[hr POST /employees] Zod validation error:', e.errors || e.message, 'Body keys:', Object.keys(request.body || {}));
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

      // Check for duplicate DNI or email
      const existing = await fastify.prisma.employee.findFirst({
        where: {
          OR: [
            { dni: data.dni },
            { email: data.email }
          ],
          tenantId
        }
      });

      if (existing) {
        return reply.code(400).send({ error: 'Employee with this DNI or email already exists' });
      }

      const supervisorId = cleanUUID(data.supervisorId) ?? null;
      const departmentId = cleanUUID(data.departmentId) ?? null;
      const positionId = cleanUUID(data.positionId) ?? null;
      const reportsToPositionId = cleanUUID(data.reportsToPositionId) ?? null;

      // Parse DD/MM/YYYY or ISO dates
      const parseDate = (val: string) => {
        if (!val) return undefined;
        if (val.includes('/')) {
          const [d, m, y] = val.split('/');
          return new Date(`${y}-${m}-${d}`);
        }
        return new Date(val);
      };

      // Exclude relation/unknown fields from create data
      const { employeeCompetencies, supervisorType, contractType, ...employeeData } = data as any;

      // Map frontend contractType values to Prisma enum values
      const contractTypeMap: Record<string, string> = {
        'FULL_TIME': 'PERMANENT',
      };
      const mappedContractType = contractTypeMap[contractType] || contractType;

      const employee = await fastify.prisma.employee.create({
        data: {
          ...employeeData,
          ...(mappedContractType && { contractType: mappedContractType }),
          supervisorId,
          departmentId,
          positionId,
          reportsToPositionId,
          birthDate: parseDate(data.birthDate),
          hireDate: parseDate(data.hireDate),
          tenantId,
          createdById: userId
        }
      });

      return { employee };
    } catch (error) {
      console.error('[HR] Error creating employee:', error);
      return reply.code(500).send({ 
        error: 'Error interno del servidor', 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Update employee
  fastify.patch('/employees/:id', async (request, reply) => {
    try {
      const { tenantId, userId } = request;
      const { id } = request.params as { id: string };
      const data = updateEmployeeSchema.parse(request.body);

      // Parse DD/MM/YYYY or ISO dates
      const parseDate = (val: string) => {
        if (!val) return undefined;
        if (val.includes('/')) {
          const [d, m, y] = val.split('/');
          return new Date(`${y}-${m}-${d}`);
        }
        return new Date(val);
      };

      // Exclude relation/unknown fields from update data
      const { employeeCompetencies, supervisorType, contractType, ...employeeData } = data as any;

      // Map frontend contractType values to Prisma enum values
      const contractTypeMap: Record<string, string> = {
        'FULL_TIME': 'PERMANENT',
      };
      const mappedContractType = contractTypeMap[contractType] || contractType;

      const employee = await fastify.prisma.employee.update({
        where: { id, tenantId },
        data: {
          ...employeeData,
          ...(mappedContractType && { contractType: mappedContractType }),
          ...(data.birthDate && { birthDate: parseDate(data.birthDate) }),
          ...(data.hireDate && { hireDate: parseDate(data.hireDate) }),
          updatedById: userId
        },
        include: {
          department: true,
          position: true,
          supervisor: {
            select: { id: true, firstName: true, lastName: true }
          }
        }
      });

      return { employee };
    } catch (error) {
      console.error('[HR] Error updating employee:', error);
      return reply.code(500).send({
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Delete employee (soft delete)
  fastify.delete('/employees/:id', async (request, reply) => {
    const tenantId = request.db?.tenantId;
    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id is required for tenant-scoped requests' });
    }
    const { id } = request.params as { id: string };

    await fastify.prisma.employee.update({
      where: { id, tenantId },
      data: { deletedAt: new Date() }
    });

    return { message: 'Employee deleted successfully' };
  });

  // ========== ROLES ==========
  
  // Get all roles
  fastify.get('/roles', async (request, reply) => {
    const tenantId = request.db?.tenantId;
    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id is required for tenant-scoped requests' });
    }

    const roles = await fastify.prisma.role.findMany({
      orderBy: { name: 'asc' }
    });

    return { roles };
  });

  // Create role
  fastify.post('/roles', async (request, reply) => {
    const { userId } = request;
    const tenantId = request.db?.tenantId;
    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id is required for tenant-scoped requests' });
    }

    const data = createRoleSchema.parse(request.body);

    const role = await fastify.prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        tenantId,
        createdById: userId,
      }
    });

    return { role };
  });

  // ========== USERS (System Access) ==========
  
  // Create user for employee
  fastify.post('/employees/:id/users', async (request, reply) => {
    const { userId } = request;
    const { id } = request.params as { id: string };
    const data = createUserSchema.parse(request.body);

    // Check employee exists
    const employee = await fastify.prisma.employee.findUnique({
      where: { id },
      include: { tenant: true }
    });

    if (!employee) {
      return reply.code(404).send({ error: 'Employee not found' });
    }

    // Check if platform user already exists (from previous deletion)
    let platformUser = await fastify.prisma.platformUser.findUnique({
      where: { email: data.email }
    });

    // Hash password using argon2
    const hashedPassword = await argon2.hash(data.password);

    if (platformUser) {
      // Reactivate existing platform user and update password
      platformUser = await fastify.prisma.platformUser.update({
        where: { id: platformUser.id },
        data: {
          passwordHash: hashedPassword,
          isActive: true
        }
      });

      // Check if membership already exists
      const existingMembership = await fastify.prisma.tenantMembership.findFirst({
        where: {
          tenantId: employee.tenantId,
          userId: platformUser.id
        }
      });

      if (!existingMembership) {
        // Create TenantMembership for the employee's tenant
        await fastify.prisma.tenantMembership.create({
          data: {
            tenantId: employee.tenantId,
            userId: platformUser.id,
            role: 'TENANT_USER'
          }
        });
      }
    } else {
      // Create new PlatformUser (required for login)
      platformUser = await fastify.prisma.platformUser.create({
        data: {
          email: data.email,
          passwordHash: hashedPassword,
          firstName: employee.firstName,
          lastName: employee.lastName,
          isActive: true
        }
      });

      // Create TenantMembership for the employee's tenant
      await fastify.prisma.tenantMembership.create({
        data: {
          tenantId: employee.tenantId,
          userId: platformUser.id,
          role: 'TENANT_USER'
        }
      });
    }

    // Create internal User record linked to employee
    const user = await fastify.prisma.user.create({
      data: {
        employeeId: id,
        email: data.email,
        password: hashedPassword
      },
      include: {
        roles: {
          include: { role: true }
        }
      }
    });

    // Send invitation email to the employee
    const appUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
    try {
      const emailPayload = notificationEmail({
        userEmail: data.email,
        title: 'Bienvenido a SGI 360 - Acceso a la plataforma',
        message: `Hola ${employee.firstName} ${employee.lastName},\n\n` +
          `Se te ha otorgado acceso a la plataforma <strong>SGI 360</strong>.\n\n` +
          `<strong>Tus credenciales de acceso:</strong>\n` +
          `• <strong>Usuario:</strong> ${data.email}\n` +
          `• <strong>Contraseña:</strong> ${data.password}\n\n` +
          `Accedé a la plataforma desde: ${appUrl}`,
        actionLabel: 'Iniciar sesión en SGI 360',
        actionUrl: `${appUrl}/login`,
        type: 'info',
      });

      const emailResult = await sendEmail(emailPayload);
      if (emailResult.success) {
        fastify.log.info(`[HR] Email de invitación enviado a ${data.email}`);
      } else {
        fastify.log.error(`[HR] Error enviando email de invitación: ${emailResult.error}`);
      }
    } catch (emailError) {
      fastify.log.error(`[HR] Error enviando email de invitación: ${emailError}`);
    }

    return { user: { ...user, platformUserId: platformUser.id } };
  });

  // Delete user from employee
  fastify.delete('/employees/:id/users/:userId', async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };

    const employee = await fastify.prisma.employee.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!employee) {
      return reply.code(404).send({ error: 'Empleado no encontrado' });
    }

    if (!employee.user || employee.user.id !== userId) {
      return reply.code(404).send({ error: 'Usuario no encontrado para este empleado' });
    }

    // Delete user
    await fastify.prisma.user.delete({
      where: { id: userId }
    });

    return { success: true };
  });

  // Get current user's permissions (by PlatformUser email)
  fastify.get('/users/me/permissions', async (request, reply) => {
    const userId = (request as any).auth?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Get PlatformUser
    const platformUser = await fastify.prisma.platformUser.findUnique({
      where: { id: userId }
    });

    if (!platformUser) {
      return reply.code(404).send({ error: 'User not found' });
    }

    // Find internal User by email (linked to employee)
    const user = await fastify.prisma.user.findUnique({
      where: { email: platformUser.email }
    });

    if (!user) {
      return reply.code(404).send({ error: 'No employee user account found' });
    }

    return { permissions: user.permissions || {} };
  });

  // Get user permissions
  fastify.get('/employees/:id/users/permissions', async (request, reply) => {
    const { id } = request.params as { id: string };

    const employee = await fastify.prisma.employee.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!employee) {
      return reply.code(404).send({ error: 'Employee not found' });
    }

    if (!employee.user) {
      return reply.code(404).send({ error: 'Employee has no user account' });
    }

    return { permissions: employee.user.permissions || {} };
  });

  // Save user permissions
  fastify.post('/employees/:id/users/permissions', async (request, reply) => {
    const { id } = request.params as { id: string };

    const permissionsSchema = z.object({
      permissions: z.record(z.enum(['none', 'view', 'edit']))
    });
    const data = permissionsSchema.parse(request.body);

    const employee = await fastify.prisma.employee.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!employee) {
      return reply.code(404).send({ error: 'Empleado no encontrado' });
    }

    if (!employee.user) {
      return reply.code(404).send({ error: 'El empleado no tiene cuenta de usuario' });
    }

    const updatedUser = await fastify.prisma.user.update({
      where: { id: employee.user.id },
      data: { permissions: data.permissions }
    });

    return { success: true, permissions: updatedUser.permissions };
  });

  // ========== DEPARTMENTS ==========
  
  // Get all departments
  fastify.get('/departments', async (request, reply) => {
    const tenantId = request.db?.tenantId;
    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id is required for tenant-scoped requests' });
    }

    const departments = await fastify.prisma.department.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        _count: {
          select: { employees: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return { departments };
  });

  // Create department
  fastify.post('/departments', async (request, reply) => {
    const tenantId = request.db?.tenantId;
    const userId = request.auth?.userId;

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id is required for tenant-scoped requests' });
    }

    const data = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      color: z.string().optional(),
    }).parse(request.body);

    const department = await fastify.runWithDbContext(request, async (tx) => {
      return tx.department.create({
        data: {
          ...data,
          tenantId,
          createdById: userId,
        },
      });
    });

    return { department };
  });

  // Update department
  fastify.put('/departments/:id', async (request, reply) => {
    const tenantId = request.db?.tenantId;
    const userId = request.auth?.userId;
    const { id } = request.params as { id: string };

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id is required for tenant-scoped requests' });
    }

    const data = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      color: z.string().optional(),
    }).parse(request.body);

    const department = await fastify.runWithDbContext(request, async (tx) => {
      return tx.department.update({
        where: { id, tenantId },
        data: {
          ...data,
          updatedById: userId,
        },
      });
    });

    return { department };
  });

  // Delete department (soft delete)
  fastify.delete('/departments/:id', async (request, reply) => {
    const tenantId = request.db?.tenantId;
    const userId = request.auth?.userId;
    const { id } = request.params as { id: string };

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id is required for tenant-scoped requests' });
    }

    await fastify.runWithDbContext(request, async (tx) => {
      await tx.department.update({
        where: { id, tenantId },
        data: { deletedAt: new Date(), updatedById: userId },
      });
    });

    return { message: 'Department deleted successfully' };
  });

  // ========== POSITIONS ==========
  
  fastify.get('/positions', async (request, reply) => {
    const { tenantId } = request;

    const positions = await fastify.prisma.position.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        _count: {
          select: { employees: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return { positions };
  });

  fastify.post('/positions', async (request, reply) => {
    const { tenantId, userId } = request;
    const data = createPositionSchema.parse(request.body);

    const position = await fastify.prisma.position.create({
      data: {
        ...data,
        tenantId,
        createdById: userId
      }
    });

    return { position };
  });

  // Update position
  fastify.put('/positions/:id', async (request, reply) => {
    const { tenantId, userId } = request;
    const { id } = request.params as { id: string };
    const data = createPositionSchema.partial().parse(request.body);

    const position = await fastify.prisma.position.update({
      where: { id, tenantId },
      data: {
        ...data,
        updatedById: userId
      }
    });

    return { position };
  });

  // Delete position (soft delete)
  fastify.delete('/positions/:id', async (request, reply) => {
    const { tenantId } = request;
    const { id } = request.params as { id: string };

    await fastify.prisma.position.update({
      where: { id, tenantId },
      data: { deletedAt: new Date() }
    });

    return { message: 'Position deleted successfully' };
  });

  // ========== COMPETENCIES ==========
  
  fastify.get('/competencies', async (request, reply) => {
    const competencies = await fastify.prisma.competency.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });

    return { competencies };
  });

  fastify.post('/competencies', async (request, reply) => {
    const data = createCompetencySchema.parse(request.body);

    const competency = await fastify.prisma.competency.create({
      data: {
        ...data,
        levels: data.levels || []
      }
    });

    return { competency };
  });

  // Update competency
  fastify.put('/competencies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = createCompetencySchema.partial().parse(request.body);

    const competency = await fastify.prisma.competency.update({
      where: { id },
      data
    });

    return { competency };
  });

  // Delete competency
  fastify.delete('/competencies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    await fastify.prisma.competency.delete({
      where: { id }
    });

    return { message: 'Competency deleted successfully' };
  });

  // ========== TRAININGS ==========
  
  fastify.get('/trainings', async (request, reply) => {
    const { tenantId } = request;

    const trainings = await fastify.prisma.training.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        _count: {
          select: { assignments: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return { trainings };
  });

  fastify.post('/trainings', async (request, reply) => {
    const { tenantId, userId } = request;
    const data = createTrainingSchema.parse(request.body);

    const training = await fastify.prisma.training.create({
      data: {
        ...data,
        tenantId,
        createdById: userId
      }
    });

    return { training };
  });

  // ========== TRAINING ASSIGNMENTS ==========

  // Get assignments for a training
  fastify.get('/trainings/:id/assignments', async (request, reply) => {
    const { id } = request.params as { id: string };

    const assignments = await fastify.prisma.trainingAssignment.findMany({
      where: { trainingId: id },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    return { assignments };
  });

  // Assign training to employee
  fastify.post('/trainings/:id/assignments', async (request, reply) => {
    const { id } = request.params as { id: string };
    let data;
    try {
      data = z.object({
        employeeId: z.string().uuid(),
        dueDate: z.string().optional()
      }).parse(request.body);
    } catch (e: any) {
      console.error('[hr POST /trainings/:id/assignments] Zod validation error:', e.errors || e.message, 'Body keys:', Object.keys(request.body || {}));
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

    const assignment = await fastify.prisma.trainingAssignment.create({
      data: {
        trainingId: id,
        employeeId: data.employeeId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: 'PENDING'
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        training: true
      }
    });

    return { assignment };
  });

  // Update assignment status
  fastify.patch('/trainings/assignments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = z.object({
      status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED']),
      score: z.number().optional(),
      certificate: z.string().optional()
    }).parse(request.body);

    const assignment = await fastify.prisma.trainingAssignment.update({
      where: { id },
      data: {
        status: data.status,
        score: data.score,
        certificate: data.certificate,
        completedAt: data.status === 'COMPLETED' ? new Date() : null
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        training: true
      }
    });

    return { assignment };
  });

  // Remove assignment
  fastify.delete('/trainings/assignments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    await fastify.prisma.trainingAssignment.delete({
      where: { id }
    });

    return { message: 'Assignment removed successfully' };
  });

  // ========== EMPLOYEE COMPETENCIES ==========

  // Get competencies for an employee
  fastify.get('/employees/:id/competencies', async (request, reply) => {
    const { id } = request.params as { id: string };

    const competencies = await fastify.prisma.employeeCompetency.findMany({
      where: { employeeId: id },
      include: {
        competency: true
      }
    });

    return { competencies };
  });

  // Add competency to employee
  fastify.post('/employees/:id/competencies', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request;
    let data;
    try {
      data = z.object({
        competencyId: z.string().uuid(),
        currentLevel: z.number().min(1).max(5),
        notes: z.string().optional()
      }).parse(request.body);
    } catch (e: any) {
      console.error('[hr POST /employees/:id/competencies] Zod validation error:', e.errors || e.message, 'Body keys:', Object.keys(request.body || {}));
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

    const employeeCompetency = await fastify.prisma.employeeCompetency.create({
      data: {
        employeeId: id,
        competencyId: data.competencyId,
        currentLevel: data.currentLevel,
        notes: data.notes,
        assessedBy: userId,
        assessedAt: new Date()
      },
      include: {
        competency: true,
        employee: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    return { employeeCompetency };
  });

  // Update employee competency level
  fastify.put('/employees/competencies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request;
    const data = z.object({
      currentLevel: z.number().min(1).max(5),
      notes: z.string().optional()
    }).parse(request.body);

    const employeeCompetency = await fastify.prisma.employeeCompetency.update({
      where: { id },
      data: {
        currentLevel: data.currentLevel,
        notes: data.notes,
        assessedBy: userId,
        assessedAt: new Date()
      },
      include: {
        competency: true,
        employee: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    return { employeeCompetency };
  });

  // Remove competency from employee
  fastify.delete('/employees/competencies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    await fastify.prisma.employeeCompetency.delete({
      where: { id }
    });

    return { message: 'Competency removed from employee successfully' };
  });

  // Get all employee competencies with gaps (for competency dashboard)
  fastify.get('/employee-competencies', async (request, reply) => {
    const { tenantId } = request.query as { tenantId?: string };

    const employees = await fastify.prisma.employee.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        position: true,
        department: true,
        employeeCompetencies: {
          include: { competency: true }
        }
      }
    });

    const positions = await fastify.prisma.position.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        positionCompetencies: {
          include: { competency: true }
        }
      }
    });

    // Calculate gaps for each employee
    const employeeCompetenciesWithGaps = employees.flatMap(emp => {
      const position = positions.find(p => p.id === emp.positionId);
      const requiredCompetencies = position?.positionCompetencies || [];

      return emp.employeeCompetencies.map(ec => {
        const required = requiredCompetencies.find(rc => rc.competencyId === ec.competencyId);
        const requiredLevel = required?.requiredLevel || ec.currentLevel;
        const gap = Math.max(0, requiredLevel - ec.currentLevel);
        
        return {
          id: ec.id,
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          position: position?.name || 'Sin puesto',
          department: emp.department?.name || 'Sin departamento',
          competencyId: ec.competencyId,
          competencyName: ec.competency.name,
          competencyCategory: ec.competency.category,
          currentLevel: ec.currentLevel,
          requiredLevel: requiredLevel,
          gap: gap,
          priority: gap >= 2 ? 'high' : gap >= 1 ? 'medium' : 'low',
          lastEvaluated: ec.assessedAt?.toISOString() || new Date().toISOString(),
          assessedBy: ec.assessedBy
        };
      });
    });

    return { 
      employeeCompetencies: employeeCompetenciesWithGaps,
      stats: {
        total: employeeCompetenciesWithGaps.length,
        criticalGaps: employeeCompetenciesWithGaps.filter(ec => ec.gap >= 2).length,
        highPriority: employeeCompetenciesWithGaps.filter(ec => ec.priority === 'high').length,
        mediumPriority: employeeCompetenciesWithGaps.filter(ec => ec.priority === 'medium').length,
        lowPriority: employeeCompetenciesWithGaps.filter(ec => ec.priority === 'low').length
      }
    };
  });

  // ========== POSITION COMPETENCIES ==========
  
  // Get required competencies for a position
  fastify.get('/positions/:id/competencies', async (request, reply) => {
    const { id } = request.params as { id: string };

    const positionCompetencies = await fastify.prisma.positionCompetency.findMany({
      where: { positionId: id },
      include: {
        competency: true
      }
    });

    return { positionCompetencies };
  });

  // Add competency requirement to position
  fastify.post('/positions/:id/competencies', async (request, reply) => {
    const { id } = request.params as { id: string };
    let data;
    try {
      data = z.object({
        competencyId: z.string().uuid(),
        requiredLevel: z.number().min(1).max(5)
      }).parse(request.body);
    } catch (e: any) {
      console.error('[hr POST /positions/:id/competencies] Zod validation error:', e.errors || e.message, 'Body keys:', Object.keys(request.body || {}));
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

    const positionCompetency = await fastify.prisma.positionCompetency.create({
      data: {
        positionId: id,
        competencyId: data.competencyId,
        requiredLevel: data.requiredLevel
      },
      include: {
        competency: true,
        position: {
          select: { id: true, name: true }
        }
      }
    });

    return { positionCompetency };
  });

  // Update required level
  fastify.put('/positions/competencies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = z.object({
      requiredLevel: z.number().min(1).max(5)
    }).parse(request.body);

    const positionCompetency = await fastify.prisma.positionCompetency.update({
      where: { id },
      data: { requiredLevel: data.requiredLevel },
      include: {
        competency: true,
        position: {
          select: { id: true, name: true }
        }
      }
    });

    return { positionCompetency };
  });

  // Remove competency from position
  fastify.delete('/positions/competencies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    await fastify.prisma.positionCompetency.delete({
      where: { id }
    });

    return { message: 'Competency requirement removed successfully' };
  });

  // ========== ORG CHART ==========
  
  fastify.get('/org-chart', async (request, reply) => {
    const tenantId = request.tenantId ?? request.db?.tenantId;
    
    console.log('🔵 ORG CHART - tenantId:', tenantId);
    
    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id is required for tenant-scoped requests' });
    }

    try {
      const employees = await fastify.prisma.employee.findMany({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: { select: { name: true } },
          department: { select: { name: true } },
          supervisorId: true,
          subordinates: {
            select: { id: true }
          }
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
      });

      console.log('🔵 ORG CHART - employees found:', employees.length);

      // Build tree structure
      const buildOrgChart = (employees: any[], supervisorId: string | null = null): any[] => {
        return employees
          .filter(emp => emp.supervisorId === supervisorId)
          .map(emp => ({
            ...emp,
            children: buildOrgChart(employees, emp.id)
          }));
      };

      const orgChart = buildOrgChart(employees);

      console.log('🔵 ORG CHART - tree built, root nodes:', orgChart.length);

      return { orgChart };
    } catch (error) {
      console.error('🔴 ORG CHART - Error:', error);
      return reply.code(500).send({ error: 'Error interno del servidor', details: (error as Error).message });
    }
  });

  // ========== STATS ==========
  
  fastify.get('/employees/stats', async (request, reply) => {
    const { tenantId } = request;

    const [
      totalEmployees,
      activeEmployees,
      byDepartment,
      byPosition,
      byContractType
    ] = await Promise.all([
      fastify.prisma.employee.count({
        where: { tenantId, deletedAt: null }
      }),
      fastify.prisma.employee.count({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' }
      }),
      fastify.prisma.employee.groupBy({
        by: ['departmentId'],
        where: { tenantId, deletedAt: null },
        _count: true
      }),
      fastify.prisma.employee.groupBy({
        by: ['positionId'],
        where: { tenantId, deletedAt: null },
        _count: true
      }),
      fastify.prisma.employee.groupBy({
        by: ['contractType'],
        where: { tenantId, deletedAt: null },
        _count: true
      })
    ]);

    return {
      stats: {
        total: totalEmployees,
        active: activeEmployees,
        inactive: totalEmployees - activeEmployees,
        byDepartment,
        byPosition,
        byContractType
      }
    };
  });

  // ========== HR DASHBOARD STATS ==========
  
  fastify.get('/stats', async (request, reply) => {
    const tenantId = request.tenantId ?? request.db?.tenantId;
    
    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id is required for tenant-scoped requests' });
    }
    
    console.log('🔵 HR STATS - tenantId:', tenantId);

    const [
      totalEmployees,
      activeEmployees,
      departments,
      positions,
      trainings,
      competencies
    ] = await Promise.all([
      fastify.prisma.employee.count({
        where: { tenantId, deletedAt: null }
      }),
      fastify.prisma.employee.count({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' }
      }),
      fastify.prisma.department.count({
        where: { tenantId, deletedAt: null }
      }),
      fastify.prisma.position.count({
        where: { tenantId, deletedAt: null }
      }),
      fastify.prisma.training.count({
        where: { tenantId, deletedAt: null }
      }),
      fastify.prisma.competency.count({})
    ]);
    
    console.log('🔵 HR STATS - results:', { totalEmployees, activeEmployees, departments, positions, trainings, competencies });

    return {
      stats: {
        totalEmployees,
        activeEmployees,
        departments,
        positions,
        trainings,
        competencies
      }
    };
  });

  // ─── Competency Matrix Routes ───

  // GET /hr/competencies/matrix - all data needed for the versatility matrix
  fastify.get('/competencies/matrix', async (req, reply) => {
    if (!req.db?.tenantId) return reply.status(403).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const prisma = req.db.prisma;

    const [employees, competencies, positionCompetencies, employeeCompetencies] = await Promise.all([
      prisma.employee.findMany({
        where: { tenantId, deletedAt: null },
        include: { position: true, department: true },
      }),
      prisma.competency.findMany({}),
      prisma.positionCompetency.findMany({
        where: { position: { tenantId } },
        include: { position: true },
      }),
      prisma.employeeCompetency.findMany({
        where: { employee: { tenantId, deletedAt: null } },
        include: { employee: true, competency: true },
      }),
    ]);

    return reply.send({
      employees: employees.map((e) => ({
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        positionId: e.positionId,
        departmentId: e.departmentId,
        department: e.department ? { name: e.department.name } : null,
        position: e.position ? { name: e.position.name } : null,
      })),
      competencies: competencies.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        category: c.category,
      })),
      positionCompetencies: positionCompetencies.map((pc) => ({
        id: pc.id,
        positionId: pc.positionId,
        competencyId: pc.competencyId,
        requiredLevel: pc.requiredLevel,
      })),
      employeeCompetencies: employeeCompetencies.map((ec) => ({
        id: ec.id,
        employeeId: ec.employeeId,
        competencyId: ec.competencyId,
        currentLevel: ec.currentLevel,
      })),
    });
  });

  // POST /hr/employee-competencies (upsert)
  fastify.post('/employee-competencies', async (req, reply) => {
    const tenantId = req.db?.tenantId || (req as any).tenant?.tenantId || req.auth?.tenantId;
    if (!tenantId) return reply.status(403).send({ error: 'Se requiere contexto de tenant' });
    const body = req.body as any;
    const { employeeId, competencyId, currentLevel } = body || {};
    if (!employeeId || !competencyId || typeof currentLevel !== 'number') {
      return reply.status(400).send({ error: 'Missing required fields' });
    }
    const prisma = req.db?.prisma || fastify.prisma;

    const existing = await prisma.employeeCompetency.findFirst({
      where: { employeeId, competencyId, employee: { tenantId } },
    });

    if (existing) {
      const updated = await prisma.employeeCompetency.update({
        where: { id: existing.id },
        data: { currentLevel },
      });
      return reply.send(updated);
    }

    const created = await prisma.employeeCompetency.create({
      data: { employeeId, competencyId, currentLevel, assessedBy: req.auth?.userId || null },
    });
    return reply.status(201).send(created);
  });

  // GET /hr/position-competencies
  fastify.get('/position-competencies', async (req, reply) => {
    if (!req.db?.tenantId) return reply.status(403).send({ error: 'Se requiere contexto de tenant' });
    const items = await req.db.prisma.positionCompetency.findMany({
      where: { position: { tenantId: req.db.tenantId } },
      include: { position: true, competency: true },
    });
    return reply.send(items);
  });

  // POST /hr/position-competencies (upsert)
  fastify.post('/position-competencies', async (req, reply) => {
    const tenantId = req.db?.tenantId || (req as any).tenant?.tenantId || req.auth?.tenantId;
    if (!tenantId) return reply.status(403).send({ error: 'Se requiere contexto de tenant' });
    const body = req.body as any;
    const { positionId, competencyId, requiredLevel } = body || {};
    if (!positionId || !competencyId || typeof requiredLevel !== 'number') {
      return reply.status(400).send({ error: 'Missing required fields' });
    }
    const prisma = req.db?.prisma || fastify.prisma;

    const existing = await prisma.positionCompetency.findFirst({
      where: { positionId, competencyId, position: { tenantId } },
    });

    if (existing) {
      const updated = await prisma.positionCompetency.update({
        where: { id: existing.id },
        data: { requiredLevel },
      });
      return reply.send(updated);
    }

    const created = await prisma.positionCompetency.create({
      data: { positionId, competencyId, requiredLevel },
    });
    return reply.status(201).send(created);
  });

  // ========== EXCEL IMPORT/EXPORT ==========
  
  // GET /hr/employees/template - Descargar plantilla Excel
  fastify.get('/employees/template', async (req, reply) => {
    const tenantId = req.db?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SGI360';
    workbook.created = new Date();

    // HOJA 1: EMPLEADOS
    const sheet = workbook.addWorksheet('EMPLEADOS');
    
    // Encabezados
    const headers = [
      'Nombre', 'Apellido', 'DNI', 'CUIL', 'FechaNacimiento', 'Email', 
      'Telefono', 'Direccion', 'Departamento', 'Puesto', 'SupervisorTipo', 
      'Supervisor', 'TipoContrato', 'FechaIngreso', 'Estado', 'Notas'
    ];
    
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0066CC' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Validaciones dropdown
    const supervisorTypes = ['PERSONA', 'PUESTO'];
    const contractTypes = ['Permanente', 'Temporal', 'Pasantía', 'Contratista'];
    const statuses = ['Activo', 'Inactivo', 'Licencia'];

    // Agregar validaciones
    sheet.getCell('K2').dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${supervisorTypes.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'error',
      error: 'Valor inválido'
    };
    
    sheet.getCell('N2').dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${contractTypes.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'error',
      error: 'Valor inválido'
    };
    
    sheet.getCell('P2').dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${statuses.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'error',
      error: 'Valor inválido'
    };

    // Ajustar columnas
    sheet.columns.forEach((column) => {
      column.width = 20;
    });
    sheet.getRow(1).height = 30;

    // Congelar primera fila
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // HOJA 2: INSTRUCCIONES
    const instructionsSheet = workbook.addWorksheet('INSTRUCCIONES');
    const instrRow = instructionsSheet.addRow(['INSTRUCCIONES DE IMPORTACIÓN']);
    instrRow.font = { bold: true, size: 14 };
    instructionsSheet.addRow([]);
    
    instructionsSheet.addRow(['CAMPOS OBLIGATORIOS:']);
    instructionsSheet.addRow(['- Nombre: Primer nombre del empleado']);
    instructionsSheet.addRow(['- Apellido: Apellido del empleado']);
    instructionsSheet.addRow(['- DNI: Documento nacional de identidad (único)']);
    instructionsSheet.addRow(['- Email: Correo electrónico válido']);
    instructionsSheet.addRow(['- Telefono: Número de contacto']);
    instructionsSheet.addRow(['- TipoContrato: Permanente, Temporal, Pasantía, Contratista']);
    instructionsSheet.addRow(['- FechaIngreso: Formato DD/MM/YYYY']);
    instructionsSheet.addRow(['- Estado: Activo, Inactivo, Licencia']);
    instructionsSheet.addRow([]);
    
    instructionsSheet.addRow(['CAMPOS OPCIONALES:']);
    instructionsSheet.addRow(['- CUIL: Código único de identificación laboral']);
    instructionsSheet.addRow(['- FechaNacimiento: Formato DD/MM/YYYY']);
    instructionsSheet.addRow(['- Direccion: Dirección postal']);
    instructionsSheet.addRow(['- Departamento: Nombre del departamento (se crea si no existe)']);
    instructionsSheet.addRow(['- Puesto: Nombre del puesto (se crea si no existe)']);
    instructionsSheet.addRow(['- SupervisorTipo: PERSONA o PUESTO']);
    instructionsSheet.addRow(['- Supervisor: Nombre del supervisor o nombre del puesto']);
    instructionsSheet.addRow(['- Notas: Observaciones adicionales']);
    instructionsSheet.addRow([]);
    
    instructionsSheet.addRow(['REGLAS DE IMPORTACIÓN:']);
    instructionsSheet.addRow(['- Los DNIs deben ser únicos']);
    instructionsSheet.addRow(['- Los emails deben ser válidos']);
    instructionsSheet.addRow(['- Las fechas deben estar en formato DD/MM/YYYY']);
    instructionsSheet.addRow(['- Departamentos y puestos inexistentes se crean automáticamente']);
    instructionsSheet.addRow(['- Puede actualizar empleados existentes marcando la opción correspondiente']);

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename=plantilla_empleados.xlsx');
    return reply.send(buffer);
  });

  // GET /hr/employees/template/ - Descargar plantilla Excel (con slash)
  fastify.get('/employees/template/', async (req, reply) => {
    const tenantId = req.db?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SGI360';
    workbook.created = new Date();

    // HOJA 1: EMPLEADOS
    const sheet = workbook.addWorksheet('EMPLEADOS');
    
    // Encabezados
    const headers = [
      'Nombre', 'Apellido', 'DNI', 'CUIL', 'FechaNacimiento', 'Email', 
      'Telefono', 'Direccion', 'Departamento', 'Puesto', 'SupervisorTipo', 
      'Supervisor', 'TipoContrato', 'FechaIngreso', 'Estado', 'Notas'
    ];
    
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0066CC' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Validaciones dropdown
    const supervisorTypes = ['PERSONA', 'PUESTO'];
    const contractTypes = ['Permanente', 'Temporal', 'Pasantía', 'Contratista'];
    const statuses = ['Activo', 'Inactivo', 'Licencia'];

    // Agregar validaciones
    sheet.getCell('K2').dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${supervisorTypes.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'error',
      error: 'Valor inválido'
    };
    
    sheet.getCell('N2').dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${contractTypes.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'error',
      error: 'Valor inválido'
    };
    
    sheet.getCell('P2').dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${statuses.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'error',
      error: 'Valor inválido'
    };

    // Ajustar columnas
    sheet.columns.forEach((column) => {
      column.width = 20;
    });
    sheet.getRow(1).height = 30;

    // Congelar primera fila
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // HOJA 2: INSTRUCCIONES
    const instructionsSheet = workbook.addWorksheet('INSTRUCCIONES');
    const instrRow = instructionsSheet.addRow(['INSTRUCCIONES DE IMPORTACIÓN']);
    instrRow.font = { bold: true, size: 14 };
    instructionsSheet.addRow([]);
    
    instructionsSheet.addRow(['CAMPOS OBLIGATORIOS:']);
    instructionsSheet.addRow(['- Nombre: Primer nombre del empleado']);
    instructionsSheet.addRow(['- Apellido: Apellido del empleado']);
    instructionsSheet.addRow(['- DNI: Documento nacional de identidad (único)']);
    instructionsSheet.addRow(['- Email: Correo electrónico válido']);
    instructionsSheet.addRow(['- Telefono: Número de contacto']);
    instructionsSheet.addRow(['- TipoContrato: Permanente, Temporal, Pasantía, Contratista']);
    instructionsSheet.addRow(['- FechaIngreso: Formato DD/MM/YYYY']);
    instructionsSheet.addRow(['- Estado: Activo, Inactivo, Licencia']);
    instructionsSheet.addRow([]);
    
    instructionsSheet.addRow(['CAMPOS OPCIONALES:']);
    instructionsSheet.addRow(['- CUIL: Código único de identificación laboral']);
    instructionsSheet.addRow(['- FechaNacimiento: Formato DD/MM/YYYY']);
    instructionsSheet.addRow(['- Direccion: Dirección postal']);
    instructionsSheet.addRow(['- Departamento: Nombre del departamento (se crea si no existe)']);
    instructionsSheet.addRow(['- Puesto: Nombre del puesto (se crea si no existe)']);
    instructionsSheet.addRow(['- SupervisorTipo: PERSONA o PUESTO']);
    instructionsSheet.addRow(['- Supervisor: Nombre del supervisor o nombre del puesto']);
    instructionsSheet.addRow(['- Notas: Observaciones adicionales']);
    instructionsSheet.addRow([]);
    
    instructionsSheet.addRow(['REGLAS DE IMPORTACIÓN:']);
    instructionsSheet.addRow(['- Los DNIs deben ser únicos']);
    instructionsSheet.addRow(['- Los emails deben ser válidos']);
    instructionsSheet.addRow(['- Las fechas deben estar en formato DD/MM/YYYY']);
    instructionsSheet.addRow(['- Departamentos y puestos inexistentes se crean automáticamente']);
    instructionsSheet.addRow(['- Puede actualizar empleados existentes marcando la opción correspondiente']);

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename=plantilla_empleados.xlsx');
    return reply.send(buffer);
  });

  // POST /hr/employees/import - Importación masiva (preview)
  fastify.post('/employees/import', async (req, reply) => {
    const tenantId = req.db?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const prisma = req.db?.prisma || fastify.prisma;
    const body = req.body as any;
    
    try {
      const data = await req.file();
      if (!data) return reply.code(400).send({ error: 'No se proporcionó archivo' });

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.read(data.file);
      
      const sheet = workbook.getWorksheet('EMPLEADOS');
      if (!sheet) return reply.code(400).send({ error: 'Hoja EMPLEADOS no encontrada' });

      const validEmployees: any[] = [];
      const errors: any[] = [];
      
      // Obtener datos existentes
      const [existingDepts, existingPositions, existingEmployees] = await Promise.all([
        prisma.department.findMany({ where: { tenantId } }),
        prisma.position.findMany({ where: { tenantId } }),
        prisma.employee.findMany({ where: { tenantId } }),
      ]);

      const deptMap = new Map(existingDepts.map(d => [d.name.toLowerCase(), d.id]));
      const positionMap = new Map(existingPositions.map(p => [p.name.toLowerCase(), p.id]));
      const dniMap = new Map(existingEmployees.map(e => [e.dni, e.id]));
      const employeeNameMap = new Map(existingEmployees.map(e => [`${e.firstName} ${e.lastName}`.toLowerCase(), e.id]));

      const updateExisting = body?.updateExisting === true;

      // Leer filas (saltando encabezado)
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Saltar encabezado

        const cells = row.values as any[];
        const rowData = {
          row: rowNumber,
          nombre: cells[1],
          apellido: cells[2],
          dni: cells[3],
          cuil: cells[4],
          fechaNacimiento: cells[5],
          email: cells[6],
          telefono: cells[7],
          direccion: cells[8],
          departamento: cells[9],
          puesto: cells[10],
          supervisorTipo: cells[11],
          supervisor: cells[12],
          tipoContrato: cells[13],
          fechaIngreso: cells[14],
          estado: cells[15],
          notas: cells[16],
        };

        // Validaciones
        const rowErrors: string[] = [];
        const rowWarnings: string[] = [];

        if (!rowData.nombre) rowErrors.push('Nombre es obligatorio');
        if (!rowData.apellido) rowErrors.push('Apellido es obligatorio');
        if (!rowData.dni) rowErrors.push('DNI es obligatorio');
        if (!rowData.email) rowErrors.push('Email es obligatorio');
        if (!rowData.telefono) rowErrors.push('Telefono es obligatorio');
        if (!rowData.tipoContrato) rowErrors.push('TipoContrato es obligatorio');
        if (!rowData.fechaIngreso) rowErrors.push('FechaIngreso es obligatorio');
        if (!rowData.estado) rowErrors.push('Estado es obligatorio');

        // Validar email
        if (rowData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rowData.email)) {
          rowErrors.push('Email inválido');
        }

        // Validar DNI duplicado
        if (rowData.dni && dniMap.has(rowData.dni)) {
          if (updateExisting) {
            rowWarnings.push('DNI ya existe, se actualizará');
          } else {
            rowErrors.push('DNI ya existe');
          }
        }

        // Validar fechas
        const parseDate = (dateStr: string) => {
          if (!dateStr) return null;
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            const [day, month, year] = parts;
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
          return null;
        };

        const fechaNacimiento = parseDate(rowData.fechaNacimiento);
        const fechaIngreso = parseDate(rowData.fechaIngreso);

        if (rowData.fechaNacimiento && !fechaNacimiento) {
          rowErrors.push('FechaNacimiento inválida (formato DD/MM/YYYY)');
        }
        if (rowData.fechaIngreso && !fechaIngreso) {
          rowErrors.push('FechaIngreso inválida (formato DD/MM/YYYY)');
        }

        // Validar supervisor
        if (rowData.supervisor && rowData.supervisorTipo) {
          if (rowData.supervisorTipo === 'PERSONA') {
            const supervisorId = employeeNameMap.get(rowData.supervisor.toLowerCase());
            if (!supervisorId) rowErrors.push('Supervisor no encontrado');
          } else if (rowData.supervisorTipo === 'PUESTO') {
            const positionId = positionMap.get(rowData.supervisor.toLowerCase());
            if (!positionId) rowErrors.push('Puesto de supervisor no encontrado');
          }
        }

        // Mapear tipo de contrato
        const contractTypeMap: Record<string, string> = {
          'Permanente': 'PERMANENT',
          'Temporal': 'TEMPORARY',
          'Pasantía': 'INTERN',
          'Contratista': 'CONTRACTOR',
        };
        const contractType = contractTypeMap[rowData.tipoContrato] || 'PERMANENT';

        // Mapear estado
        const statusMap: Record<string, string> = {
          'Activo': 'ACTIVE',
          'Inactivo': 'INACTIVE',
          'Licencia': 'ON_LEAVE',
        };
        const status = statusMap[rowData.estado] || 'ACTIVE';

        if (rowErrors.length > 0) {
          errors.push({
            row: rowData.row,
            errors: rowErrors,
            data: rowData,
          });
        } else {
          validEmployees.push({
            ...rowData,
            contractType,
            status,
            fechaNacimiento: fechaNacimiento?.toISOString(),
            fechaIngreso: fechaIngreso?.toISOString(),
            warnings: rowWarnings,
          });
        }
      });

      // Preparar respuesta de preview
      return reply.send({
        valid: validEmployees.length,
        warnings: validEmployees.reduce((sum, e) => sum + e.warnings.length, 0),
        errorCount: errors.length,
        validEmployees: validEmployees.map(e => ({
          row: e.row,
          nombre: e.nombre,
          apellido: e.apellido,
          dni: e.dni,
          email: e.email,
          warnings: e.warnings,
        })),
        validationErrors: errors.map(e => ({
          row: e.row,
          errors: e.errors,
          data: e.data,
        })),
      });
    } catch (error: any) {
      console.error('Error importando empleados:', error);
      return reply.code(500).send({ error: error.message || 'Error al importar empleados' });
    }
  });

  // POST /hr/employees/import/confirm - Confirmar importación
  function parseDate(val: string | undefined): Date | undefined {
    if (!val) return undefined;
    // Soporta DD/MM/YYYY y YYYY-MM-DD
    const dmyMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmyMatch) return new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d;
  }

  function mapContractType(val: string | undefined): string {
    if (!val) return 'PERMANENT';
    const map: Record<string, string> = {
      'Permanente': 'PERMANENT',
      'Temporal': 'TEMPORARY',
      'Contratista': 'CONTRACTOR',
      'Pasantía': 'INTERN',
      'Pasante': 'INTERN',
      'Part-time': 'PART_TIME',
      'Medio tiempo': 'PART_TIME',
    };
    return map[val] || 'PERMANENT';
  }

  function mapStatus(val: string | undefined): string {
    if (!val) return 'ACTIVE';
    const map: Record<string, string> = {
      'Activo': 'ACTIVE',
      'Inactivo': 'INACTIVE',
      'Licencia': 'ON_LEAVE',
      'Baja': 'INACTIVE',
    };
    return map[val] || 'ACTIVE';
  }

  fastify.post('/employees/import/confirm', async (req, reply) => {
    const tenantId = req.db?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const prisma = req.db?.prisma || fastify.prisma;
    const { employees, updateExisting } = req.body as any;
    
    if (!employees || !Array.isArray(employees)) {
      return reply.code(400).send({ error: 'Datos inválidos' });
    }

    try {
      const results = [];
      
      // Obtener datos existentes
      const [existingDepts, existingPositions, existingEmployees] = await Promise.all([
        prisma.department.findMany({ where: { tenantId } }),
        prisma.position.findMany({ where: { tenantId } }),
        prisma.employee.findMany({ where: { tenantId } }),
      ]);

      const deptMap = new Map(existingDepts.map(d => [d.name.toLowerCase(), d.id]));
      const positionMap = new Map(existingPositions.map(p => [p.name.toLowerCase(), p.id]));
      const employeeNameMap = new Map(existingEmployees.map(e => [`${e.firstName} ${e.lastName}`.toLowerCase(), e.id]));
      
      for (const emp of employees) {
        // Obtener o crear departamento
        let departmentId: string | undefined;
        if (emp.departamento) {
          departmentId = deptMap.get(emp.departamento.toLowerCase());
          if (!departmentId) {
            const newDept = await prisma.department.create({
              data: {
                tenantId,
                name: emp.departamento,
                createdById: req.auth?.userId,
              },
            });
            departmentId = newDept.id;
            deptMap.set(emp.departamento.toLowerCase(), newDept.id);
          }
        }

        // Obtener o crear puesto
        let positionId: string | undefined;
        if (emp.puesto) {
          positionId = positionMap.get(emp.puesto.toLowerCase());
          if (!positionId) {
            const newPos = await prisma.position.create({
              data: {
                tenantId,
                name: emp.puesto,
                createdById: req.auth?.userId,
              },
            });
            positionId = newPos.id;
            positionMap.set(emp.puesto.toLowerCase(), newPos.id);
          }
        }

        // Obtener supervisor
        let supervisorId: string | undefined;
        let reportsToPositionId: string | undefined;
        if (emp.supervisor && emp.supervisorTipo) {
          if (emp.supervisorTipo === 'PERSONA') {
            supervisorId = employeeNameMap.get(emp.supervisor.toLowerCase());
          } else if (emp.supervisorTipo === 'PUESTO') {
            reportsToPositionId = positionMap.get(emp.supervisor.toLowerCase());
          }
        }

        const existingEmployee = await prisma.employee.findFirst({
          where: { dni: emp.dni, tenantId },
        });

        if (existingEmployee && updateExisting) {
          // Actualizar empleado existente
          const updated = await prisma.employee.update({
            where: { id: existingEmployee.id },
            data: {
              firstName: emp.nombre,
              lastName: emp.apellido,
              cuil: emp.cuil,
              birthDate: parseDate(emp.fechaNacimiento),
              email: emp.email,
              phone: emp.telefono,
              address: emp.direccion,
              departmentId,
              positionId,
              supervisorId,
              reportsToPositionId,
              contractType: mapContractType(emp.TipoContrato) as any,
              hireDate: parseDate(emp.fechaIngreso) ?? new Date(),
              status: mapStatus(emp.Estado) as any,
              notes: emp.notas,
            },
          });
          results.push({ action: 'updated', id: updated.id, dni: emp.dni });
        } else if (!existingEmployee) {
          // Crear nuevo empleado
          const createData: any = {
            tenantId,
            firstName: emp.nombre,
            lastName: emp.apellido,
            dni: emp.dni,
            cuil: emp.cuil,
            email: emp.email,
            phone: emp.telefono,
            address: emp.direccion,
            departmentId,
            positionId,
            supervisorId,
            reportsToPositionId,
            contractType: mapContractType(emp.TipoContrato) as any,
            hireDate: parseDate(emp.fechaIngreso) ?? new Date(),
            status: mapStatus(emp.Estado) as any,
            notes: emp.notas,
            createdById: req.auth?.userId,
          };
          
          if (emp.fechaNacimiento) {
            createData.birthDate = parseDate(emp.fechaNacimiento);
          }
          
          const created = await prisma.employee.create({
            data: createData,
          });
          results.push({ action: 'created', id: created.id, dni: emp.dni });
        }
      }

      return reply.send({
        success: true,
        results,
        total: results.length,
        created: results.filter(r => r.action === 'created').length,
        updated: results.filter(r => r.action === 'updated').length,
      });
    } catch (error: any) {
      console.error('Error confirmando importación:', error);
      return reply.code(500).send({ error: error.message || 'Error al confirmar importación' });
    }
  });

  // GET /hr/employees/export - Exportar empleados
  fastify.get('/employees/export', async (req, reply) => {
    const tenantId = req.db?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const prisma = req.db?.prisma || fastify.prisma;

    const employees = await prisma.employee.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        department: true,
        position: true,
        supervisor: true,
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SGI360';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('EMPLEADOS');

    // Encabezados
    const headers = [
      'Nombre', 'Apellido', 'DNI', 'CUIL', 'FechaNacimiento', 'Email', 
      'Telefono', 'Direccion', 'Departamento', 'Puesto', 'SupervisorTipo', 
      'Supervisor', 'TipoContrato', 'FechaIngreso', 'Estado', 'Notas'
    ];
    
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0066CC' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Mapear tipo de contrato
    const contractTypeMap: Record<string, string> = {
      'PERMANENT': 'Permanente',
      'TEMPORARY': 'Temporal',
      'INTERN': 'Pasantía',
      'CONTRACTOR': 'Contratista',
    };

    // Mapear estado
    const statusMap: Record<string, string> = {
      'ACTIVE': 'Activo',
      'INACTIVE': 'Inactivo',
      'ON_LEAVE': 'Licencia',
    };

    // Agregar datos
    employees.forEach(emp => {
      sheet.addRow([
        emp.firstName,
        emp.lastName,
        emp.dni,
        emp.cuil || '',
        emp.birthDate ? new Date(emp.birthDate).toLocaleDateString('es-ES') : '',
        emp.email,
        emp.phone,
        emp.address || '',
        emp.department?.name || '',
        emp.position?.name || '',
        emp.supervisorId ? 'PERSONA' : '',
        emp.supervisor ? `${emp.supervisor.firstName} ${emp.supervisor.lastName}` : '',
        contractTypeMap[emp.contractType] || emp.contractType,
        emp.hireDate ? new Date(emp.hireDate).toLocaleDateString('es-ES') : '',
        statusMap[emp.status] || emp.status,
        emp.notes || '',
      ]);
    });

    // Ajustar columnas
    sheet.columns.forEach((column) => {
      column.width = 20;
    });
    sheet.getRow(1).height = 30;

    // Congelar primera fila
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename=empleados_export.xlsx');
    return reply.send(buffer);
  });

}
