import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// Validation schemas
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
  contractType: z.enum(['PERMANENT', 'TEMPORARY', 'CONTRACTOR', 'INTERN', 'PART_TIME']),
  location: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  supervisorId: z.string().uuid().optional(),
  reportsToPositionId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  roleId: z.string().uuid().optional(),
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
  levels: z.array(z.string()).optional(),
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
      const data = createEmployeeSchema.parse(request.body);

      let supervisorId = data.supervisorId;
      if (!supervisorId && data.reportsToPositionId) {
        const occupant = await fastify.prisma.employee.findFirst({
          where: {
            tenantId,
            positionId: data.reportsToPositionId,
            deletedAt: null,
            status: 'ACTIVE',
          },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        });
        supervisorId = occupant?.id;
      }

      // Check for duplicate DNI or email
      const existing = await fastify.prisma.employee.findFirst({
        where: {
          OR: [
            { dni: data.dni, tenantId },
            { email: data.email, tenantId }
          ],
          deletedAt: null
        }
      });

      if (existing) {
        return reply.code(400).send({ 
          error: 'Employee with this DNI or email already exists' 
        });
      }

      const employee = await fastify.prisma.employee.create({
        data: {
          ...data,
          supervisorId,
          birthDate: new Date(data.birthDate),
          hireDate: new Date(data.hireDate),
          tenantId,
          createdById: userId
        },
        include: {
          department: true,
          position: true,
          reportsToPosition: {
            select: { id: true, name: true }
          },
          supervisor: {
            select: { id: true, firstName: true, lastName: true }
          }
        }
      });

      return { employee };
    } catch (error) {
      console.error('[HR] Error creating employee:', error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Update employee
  fastify.patch('/employees/:id', async (request, reply) => {
    const { tenantId, userId } = request;
    const { id } = request.params as { id: string };
    const data = updateEmployeeSchema.parse(request.body);

    const employee = await fastify.prisma.employee.update({
      where: { id, tenantId },
      data: {
        ...data,
        ...(data.birthDate && { birthDate: new Date(data.birthDate) }),
        ...(data.hireDate && { hireDate: new Date(data.hireDate) }),
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
      where: { tenantId, deletedAt: null },
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
      where: { id }
    });

    if (!employee) {
      return reply.code(404).send({ error: 'Employee not found' });
    }

    // Check if user already exists
    const existingUser = await fastify.prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      return reply.code(400).send({ error: 'User with this email already exists' });
    }

    // Hash password (simple hash for demo - use bcrypt in production)
    const hashedPassword = data.password; // TODO: Implement bcrypt

    const user = await fastify.prisma.user.create({
      data: {
        employeeId: id,
        email: data.email,
        password: hashedPassword,
        roles: data.roleId ? {
          create: {
            roleId: data.roleId
          }
        } : undefined
      },
      include: {
        roles: {
          include: { role: true }
        }
      }
    });

    return { user };
  });

  // Get user permissions
  fastify.get('/employees/:id/users/permissions', async (request, reply) => {
    const { id } = request.params as { id: string };
    console.log('🔵 GET permissions for employee:', id);

    const employee = await fastify.prisma.employee.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!employee) {
      console.log('🔴 Employee not found:', id);
      return reply.code(404).send({ error: 'Employee not found' });
    }

    if (!employee.user) {
      console.log('🔴 Employee has no user:', id);
      return reply.code(404).send({ error: 'Employee has no user account' });
    }

    console.log('🔵 Returning permissions:', employee.user.permissions);
    return { permissions: employee.user.permissions || {} };
  });

  // Save user permissions
  fastify.post('/employees/:id/users/permissions', async (request, reply) => {
    const { id } = request.params as { id: string };
    console.log('🔵 POST permissions for employee:', id);
    
    const permissionsSchema = z.object({
      permissions: z.record(z.enum(['none', 'view', 'edit']))
    });
    const data = permissionsSchema.parse(request.body);
    console.log('🔵 Received permissions data:', data.permissions);

    const employee = await fastify.prisma.employee.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!employee) {
      console.log('🔴 Employee not found:', id);
      return reply.code(404).send({ error: 'Employee not found' });
    }

    if (!employee.user) {
      console.log('🔴 Employee has no user:', id);
      return reply.code(404).send({ error: 'Employee has no user account' });
    }

    console.log('🔵 BEFORE UPDATE - User permissions:', employee.user.permissions);
    console.log('🔵 Updating user:', employee.user.id, 'with permissions:', data.permissions);
    
    const updatedUser = await fastify.prisma.user.update({
      where: { id: employee.user.id },
      data: { permissions: data.permissions }
    });

    console.log('🔵 AFTER UPDATE - Updated user permissions:', updatedUser.permissions);
    
    // Verify by reading again
    const verifyUser = await fastify.prisma.user.findUnique({
      where: { id: employee.user.id }
    });
    console.log('🔵 VERIFICATION - User permissions in DB:', verifyUser?.permissions);

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
      orderBy: { category: 'asc', name: 'asc' }
    });

    return { competencies };
  });

  fastify.post('/competencies', async (request, reply) => {
    const data = createCompetencySchema.parse(request.body);

    const competency = await fastify.prisma.competency.create({
      data
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
    const data = z.object({
      employeeId: z.string().uuid(),
      dueDate: z.string().optional()
    }).parse(request.body);

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
    const data = z.object({
      competencyId: z.string().uuid(),
      currentLevel: z.number().min(1).max(5),
      notes: z.string().optional()
    }).parse(request.body);

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
    const data = z.object({
      competencyId: z.string().uuid(),
      requiredLevel: z.number().min(1).max(5)
    }).parse(request.body);

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
      return reply.code(500).send({ error: 'Internal server error', details: (error as Error).message });
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
    if (!req.db?.tenantId) return reply.status(403).send({ error: 'Tenant context required' });

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
    if (!req.db?.tenantId) return reply.status(403).send({ error: 'Tenant context required' });
    const body = req.body as any;
    const { employeeId, competencyId, currentLevel } = body || {};
    if (!employeeId || !competencyId || typeof currentLevel !== 'number') {
      return reply.status(400).send({ error: 'Missing required fields' });
    }
    const prisma = req.db.prisma;
    const tenantId = req.db.tenantId;

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
    if (!req.db?.tenantId) return reply.status(403).send({ error: 'Tenant context required' });
    const items = await req.db.prisma.positionCompetency.findMany({
      where: { position: { tenantId: req.db.tenantId } },
      include: { position: true, competency: true },
    });
    return reply.send(items);
  });

  // POST /hr/position-competencies (upsert)
  fastify.post('/position-competencies', async (req, reply) => {
    if (!req.db?.tenantId) return reply.status(403).send({ error: 'Tenant context required' });
    const body = req.body as any;
    const { positionId, competencyId, requiredLevel } = body || {};
    if (!positionId || !competencyId || typeof requiredLevel !== 'number') {
      return reply.status(400).send({ error: 'Missing required fields' });
    }
    const prisma = req.db.prisma;
    const tenantId = req.db.tenantId;

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

}
