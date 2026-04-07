import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.log('No tenant found');
    process.exit(1);
  }
  
  const user = await prisma.platformUser.findFirst();
  if (!user) {
    console.log('No user found');
    process.exit(1);
  }

  const competencies = await prisma.competency.findMany();
  
  const today = new Date();
  
  const sampleTrainings = [
    {
      title: 'Seguridad en el Trabajo - Nivel 1',
      category: 'Seguridad',
      description: 'Capacitación obligatoria en seguridad industrial',
      objectives: 'Conocer y aplicar normas de seguridad básicas',
      contentProgram: '1. Introducción a seguridad 2. EPP 3. Procedimientos de emergencia',
      methodologyDetails: 'Presencial con prácticas',
      evaluationCriteria: 'Evaluación teórica y práctica',
      modality: 'PRESENCIAL',
      instructor: 'Juan Pérez - Instructor Externo',
      instructorType: 'EXTERNAL',
      location: 'Sala de Capacitaciones A',
      durationHours: 8,
      scheduledDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 9, 0),
      expectedParticipants: 20,
      standard: 'ISO 45001:2018',
      status: 'SCHEDULED',
    },
    {
      title: 'Liderazgo Efectivo para Mandos Medios',
      category: 'Liderazgo',
      description: 'Desarrollo de habilidades de liderazgo',
      objectives: 'Desarrollar competencias de liderazgo situacional',
      contentProgram: '1. Estilos de liderazgo 2. Comunicación 3. Gestión de equipos',
      methodologyDetails: 'Mixta - 50% presencial 50% virtual',
      evaluationCriteria: 'Proyecto práctico y evaluación 360',
      modality: 'MIXTA',
      instructor: 'María García - RRHH Interna',
      instructorType: 'INTERNAL',
      location: 'Sala de Juntas B',
      durationHours: 16,
      scheduledDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5, 14, 0),
      expectedParticipants: 12,
      standard: 'ISO 9001:2015',
      status: 'SCHEDULED',
      competencyId: competencies.find(c => c.category === 'leadership')?.id,
      gapLevel: 3,
    },
    {
      title: 'Gestión de Calidad ISO 9001:2015',
      category: 'Calidad',
      description: 'Fundamentos del sistema de gestión de calidad',
      objectives: 'Comprender los requisitos de ISO 9001:2015',
      contentProgram: '1. Contexto de la organización 2. Liderazgo 3. Planificación 4. Soporte',
      methodologyDetails: 'Virtual con casos prácticos',
      evaluationCriteria: 'Examen de certificación interna',
      modality: 'VIRTUAL',
      instructor: 'Carlos Rodríguez - Consultor Externo',
      instructorType: 'EXTERNAL',
      location: 'Zoom',
      durationHours: 12,
      scheduledDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 8, 10, 0),
      expectedParticipants: 15,
      standard: 'ISO 9001:2015',
      status: 'SCHEDULED',
    },
    {
      title: 'Primeros Auxilios y Emergencias',
      category: 'Primeros Auxilios',
      description: 'Respuesta ante emergencias médicas',
      objectives: 'Aplicar primeros auxilios en situaciones de emergencia',
      contentProgram: '1. RCP 2. Manejo de heridas 3. Shock 4. Fracturas',
      methodologyDetails: 'Presencial con maniquíes',
      evaluationCriteria: 'Práctica demostrada',
      modality: 'PRESENCIAL',
      instructor: 'Laura Martínez - Enfermera Externa',
      instructorType: 'EXTERNAL',
      location: 'Centro Médico',
      durationHours: 4,
      scheduledDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 12, 8, 0),
      expectedParticipants: 25,
      standard: 'ISO 45001:2018',
      status: 'SCHEDULED',
    },
    {
      title: 'Gestión Ambiental ISO 14001',
      category: 'Ambiente',
      description: 'Concienciación ambiental y gestión de residuos',
      objectives: 'Reducir impacto ambiental de operaciones',
      contentProgram: '1. Aspectos ambientales 2. Residuos 3. Ahorro energético',
      methodologyDetails: 'E-Learning con evaluaciones',
      evaluationCriteria: 'Evaluación online',
      modality: 'E_LEARNING',
      instructor: 'Sistema - Plataforma Interna',
      instructorType: 'INTERNAL',
      location: 'Plataforma E-learning',
      durationHours: 6,
      scheduledDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 15, 0, 0),
      expectedParticipants: 50,
      standard: 'ISO 14001:2015',
      status: 'SCHEDULED',
    },
  ];

  console.log('Creating sample trainings...');
  
  for (const trainingData of sampleTrainings) {
    const year = new Date().getFullYear();
    const count = await prisma.sgiTraining.count({
      where: { tenantId: tenant.id, code: { startsWith: `TRN-${year}-` } },
    });
    const code = `TRN-${year}-${String(count + 1).padStart(3, '0')}`;
    
    await prisma.sgiTraining.create({
      data: {
        tenantId: tenant.id,
        code,
        title: trainingData.title,
        description: trainingData.description,
        category: trainingData.category,
        modality: trainingData.modality,
        instructor: trainingData.instructor,
        instructorType: trainingData.instructorType,
        location: trainingData.location,
        durationHours: trainingData.durationHours,
        scheduledDate: trainingData.scheduledDate,
        expectedParticipants: trainingData.expectedParticipants,
        standard: trainingData.standard,
        status: 'SCHEDULED',
        objectives: trainingData.objectives,
        contentProgram: trainingData.contentProgram,
        methodologyDetails: trainingData.methodologyDetails,
        evaluationCriteria: trainingData.evaluationCriteria,
        competencyId: trainingData.competencyId || null,
        gapLevel: trainingData.gapLevel || null,
        coordinatorId: user.id,
        createdById: user.id,
        updatedById: user.id,
      },
    });
    console.log(`Created: ${trainingData.title}`);
  }
  
  console.log('\n✅ 5 sample trainings created with scheduled dates!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
