const Fastify = require('fastify');
const cors = require('@fastify/cors');
const path = require('path');
const fs = require('fs');

const app = Fastify({ logger: false });

// Register CORS plugin
app.register(cors, {
  origin: ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
});

// Add JSON body parser
app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  try {
    const json = JSON.parse(body);
    done(null, json);
  } catch (err) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

// In-memory storage for demo purposes
const departments = [
  { id: 'dept-1', name: 'Tecnología', description: 'Departamento de tecnología', _count: { employees: 5 }, createdAt: '2023-01-01T00:00:00.000Z', updatedAt: '2023-01-01T00:00:00.000Z' },
  { id: 'dept-2', name: 'Recursos Humanos', description: 'Departamento de RRHH', _count: { employees: 3 }, createdAt: '2023-01-01T00:00:00.000Z', updatedAt: '2023-01-01T00:00:00.000Z' },
  { id: 'dept-3', name: 'Operaciones', description: 'Departamento de operaciones', _count: { employees: 8 }, createdAt: '2023-01-01T00:00:00.000Z', updatedAt: '2023-01-01T00:00:00.000Z' }
];
const positions = [
  { id: 'pos-1', name: 'Desarrollador Senior', category: 'TI', level: 'Senior', _count: { employees: 3 }, createdAt: '2023-01-01T00:00:00.000Z', updatedAt: '2023-01-01T00:00:00.000Z' },
  { id: 'pos-2', name: 'Gerente de TI', category: 'TI', level: 'Gerencial', _count: { employees: 1 }, createdAt: '2023-01-01T00:00:00.000Z', updatedAt: '2023-01-01T00:00:00.000Z' },
  { id: 'pos-3', name: 'Analista RRHH', category: 'RRHH', level: 'Analista', _count: { employees: 2 }, createdAt: '2023-01-01T00:00:00.000Z', updatedAt: '2023-01-01T00:00:00.000Z' }
];
const employees = [
  {
    id: 'emp-1',
    firstName: 'Juan',
    lastName: 'Pérez',
    dni: '12345678',
    email: 'juan.perez@empresa.com',
    phone: '+54 11 1234-5678',
    status: 'ACTIVE',
    hireDate: '2023-01-15T00:00:00.000Z',
    contractType: 'PERMANENT',
    departmentId: 'dept-1',
    positionId: 'pos-1',
    supervisorId: null,
    user: null,
    _count: { subordinates: 0, employeeCompetencies: 5, trainingAssignments: 3 },
    birthDate: '1990-01-01',
    address: 'Dirección de ejemplo',
    cuil: '20-12345678-9',
    location: 'Oficina Central',
    notes: 'Empleado de ejemplo',
    createdAt: '2023-01-15T00:00:00.000Z',
    updatedAt: '2023-01-15T00:00:00.000Z'
  }
];

// Load HR data from JSON file
function loadHRData() {
  try {
    const dataPath = path.join(__dirname, 'data', 'hr-data.json');
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      departments.push(...data.departments);
      positions.push(...data.positions);
      employees.push(...data.employees);
      console.log('📚 Loaded HR data from file');
    }
  } catch (error) {
    console.error('Error loading HR data:', error);
  }
}

// Save HR data to JSON file
function saveHRData() {
  try {
    const dataPath = path.join(__dirname, 'data', 'hr-data.json');
    const data = {
      departments,
      positions,
      employees
    };
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log('💾 Saved HR data to file');
  } catch (error) {
    console.error('Error saving HR data:', error);
  }
}

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load HR data on startup
loadHRData();

// Health check
app.get('/health', async () => ({ status: 'ok' }));

// HR Module endpoints
app.get('/hr/employees', async () => {
  return { employees };
});

app.post('/hr/employees', async (request, reply) => {
  console.log('🔵 POST /hr/employees called');
  console.log('🔵 Request body:', request.body);
  
  const employeeData = request.body;
  
  // Create new employee with generated ID
  const newEmployee = {
    id: 'emp-' + Date.now(),
    firstName: employeeData.firstName,
    lastName: employeeData.lastName,
    dni: employeeData.dni,
    email: employeeData.email,
    phone: employeeData.phone,
    status: 'ACTIVE',
    hireDate: employeeData.hireDate,
    contractType: employeeData.contractType,
    departmentId: employeeData.departmentId || null,
    positionId: employeeData.positionId || null,
    supervisorId: employeeData.supervisorId || null,
    user: null,
    _count: { subordinates: 0, employeeCompetencies: 0, trainingAssignments: 0 },
    birthDate: employeeData.birthDate,
    address: employeeData.address,
    cuil: employeeData.cuil,
    location: employeeData.location,
    notes: employeeData.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Add to in-memory storage
  employees.push(newEmployee);

  // Save to file
  saveHRData();

  console.log('✅ New employee created:', newEmployee);
  console.log('🔵 Total employees:', employees.length);
  
  return { 
    employee: newEmployee,
    message: 'Employee created successfully'
  };
});

// Departments endpoints
app.get('/hr/departments', async () => {
  return { departments };
});

app.post('/hr/departments', async (request, reply) => {
  console.log('🔵 POST /hr/departments called');
  console.log('🔵 Request body:', request.body);
  
  const deptData = request.body;
  
  if (!deptData || !deptData.name) {
    console.log('❌ Missing name in request body');
    return reply.status(400).send({ error: 'Name is required' });
  }
  
  const newDepartment = {
    id: 'dept-' + Date.now(),
    name: deptData.name,
    description: deptData.description || null,
    _count: { employees: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Add to in-memory storage
  departments.push(newDepartment);

  // Save to file
  saveHRData();

  console.log('✅ New department created:', newDepartment);
  console.log('🔵 Total departments:', departments.length);
  
  return { 
    department: newDepartment,
    message: 'Department created successfully'
  };
});

// Positions endpoints  
app.get('/hr/positions', async () => {
  return { positions };
});

app.post('/hr/positions', async (request, reply) => {
  console.log('🔵 POST /hr/positions called');
  console.log('🔵 Request body:', request.body);
  
  const posData = request.body;
  
  if (!posData || !posData.name) {
    console.log('❌ Missing name in request body');
    return reply.status(400).send({ error: 'Name is required' });
  }
  
  const newPosition = {
    id: 'pos-' + Date.now(),
    name: posData.name,
    code: posData.code || null,
    category: posData.category || null,
    level: posData.level || null,
    objective: posData.objective || null,
    responsibilities: posData.responsibilities || [],
    tasks: posData.tasks || [],
    requirements: posData.requirements || [],
    kpis: posData.kpis || [],
    risks: posData.risks || [],
    _count: { employees: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Add to in-memory storage
  positions.push(newPosition);

  // Save to file
  saveHRData();

  console.log('✅ New position created:', newPosition);
  console.log('🔵 Total positions:', positions.length);
  
  return { 
    position: newPosition,
    message: 'Position created successfully'
  };
});

// Employee status update endpoint
app.patch('/hr/employees/:id/status', async (request, reply) => {
  console.log('🔵 PATCH /hr/employees/:id/status called');
  console.log('🔵 Params:', request.params);
  console.log('🔵 Request body:', request.body);
  
  const employeeId = request.params.id;
  const { status } = request.body;
  
  console.log('🔵 Employee ID:', employeeId);
  console.log('🔵 New status:', status);
  
  if (!status || !['ACTIVE', 'INACTIVE', 'TERMINATED'].includes(status)) {
    console.log('❌ Invalid status:', status);
    return reply.status(400).send({ error: 'Invalid status' });
  }
  
  const employeeIndex = employees.findIndex(emp => emp.id === employeeId);
  console.log('🔵 Employee index:', employeeIndex);
  
  if (employeeIndex === -1) {
    console.log('❌ Employee not found:', employeeId);
    return reply.status(404).send({ error: 'Employee not found' });
  }
  
  const oldStatus = employees[employeeIndex].status;
  employees[employeeIndex].status = status;
  employees[employeeIndex].updatedAt = new Date().toISOString();
  
  // Save to file
  saveHRData();
  
  console.log('✅ Employee status updated:');
  console.log('  - Old status:', oldStatus);
  console.log('  - New status:', status);
  console.log('  - Employee:', employees[employeeIndex]);
  
  return { 
    employee: employees[employeeIndex],
    message: 'Status updated successfully'
  };
});

// Employee delete endpoint
app.delete('/hr/employees/:id', async (request, reply) => {
  console.log('🔵 DELETE /hr/employees/:id called');
  
  const employeeId = request.params.id;
  
  const employeeIndex = employees.findIndex(emp => emp.id === employeeId);
  if (employeeIndex === -1) {
    return reply.status(404).send({ error: 'Employee not found' });
  }
  
  const deletedEmployee = employees[employeeIndex];
  employees.splice(employeeIndex, 1);
  
  // Save to file
  saveHRData();
  
  console.log('✅ Employee deleted:', deletedEmployee);
  
  return { 
    employee: deletedEmployee,
    message: 'Employee deleted successfully'
  };
});

// Start server
const start = async () => {
  try {
    await app.listen({ port: 3002, host: '0.0.0.0' });
    console.log('🚀 HR API running on http://localhost:3002');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
