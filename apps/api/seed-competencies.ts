import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.competency.count();
  console.log('Competencies in DB:', count);
  
  if (count === 0) {
    console.log('Creating sample competencies...');
    await prisma.competency.createMany({
      data: [
        { name: 'Programación', category: 'technical', description: 'Capacidad para escribir código eficiente' },
        { name: 'Liderazgo', category: 'leadership', description: 'Capacidad para guiar equipos' },
        { name: 'Comunicación', category: 'behavioral', description: 'Habilidad para transmitir ideas' },
        { name: 'Resolución de problemas', category: 'technical', description: 'Capacidad analítica' },
        { name: 'Trabajo en equipo', category: 'behavioral', description: 'Colaboración efectiva' }
      ]
    });
    console.log('✅ Sample competencies created');
  } else {
    console.log('✅ Competencies already exist');
  }
  
  const all = await prisma.competency.findMany();
  console.log('All competencies:', all);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
