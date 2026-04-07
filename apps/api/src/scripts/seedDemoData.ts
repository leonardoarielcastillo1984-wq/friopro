/**
 * seedDemoData.ts — Populates the demo tenant with rich sample data.
 *
 * Pre-requisites:
 *   1. seedPlans.ts (creates BASIC/PROFESSIONAL/PREMIUM plans)
 *   2. seedUsers.ts (creates admin@sgi360.com, usuario@demo.com, Demo Company tenant)
 *
 * Run:
 *   cd apps/api && node --import tsx src/scripts/seedDemoData.ts
 */

import 'dotenv/config';
import { PrismaClient, NotificationType, SgiTrainingStatus, SgiTrainingModality } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

function randomId() {
  return crypto.randomUUID();
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400_000);
}

function daysFromNow(n: number) {
  return new Date(Date.now() + n * 86400_000);
}

async function main() {
  console.log('🌱 Seeding demo data...\n');

  // ── Get tenant & user ──
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('Demo tenant not found. Run seedUsers.ts first.');

  const user = await prisma.platformUser.findUnique({ where: { email: 'usuario@demo.com' } });
  if (!user) throw new Error('Demo user not found. Run seedUsers.ts first.');

  // ── Create additional users ──
  const password = await argon2.hash('User123!');

  const users = [];
  const additionalEmails = ['calidad@demo.com', 'seguridad@demo.com', 'ambiente@demo.com', 'rrhh@demo.com'];

  for (const email of additionalEmails) {
    const u = await prisma.platformUser.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash: password, isActive: true },
    });
    users.push(u);

    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: u.id } },
      update: {},
      create: {
        tenantId: tenant.id,
        userId: u.id,
        role: email === 'calidad@demo.com' ? 'TENANT_ADMIN' : 'TENANT_USER',
        status: 'ACTIVE',
      },
    });
  }
  console.log(`  ✅ ${additionalEmails.length} usuarios adicionales creados`);

  const allUserIds = [user.id, ...users.map(u => u.id)];

  // ── Documents ──
  const documents = [
    { title: 'Manual de Calidad SGI', type: 'manual', status: 'EFFECTIVE' as const, version: 3 },
    { title: 'Procedimiento de Auditoría Interna', type: 'procedure', status: 'EFFECTIVE' as const, version: 2 },
    { title: 'Política de Seguridad Vial', type: 'policy', status: 'EFFECTIVE' as const, version: 1 },
    { title: 'Procedimiento de Control de Documentos', type: 'procedure', status: 'EFFECTIVE' as const, version: 4 },
    { title: 'Plan de Gestión Ambiental', type: 'plan', status: 'EFFECTIVE' as const, version: 1 },
    { title: 'Procedimiento de No Conformidades', type: 'procedure', status: 'EFFECTIVE' as const, version: 2 },
    { title: 'Manual de Seguridad y Salud Ocupacional', type: 'manual', status: 'EFFECTIVE' as const, version: 1 },
    { title: 'Registro de Capacitaciones (Borrador)', type: 'record', status: 'DRAFT' as const, version: 1 },
    { title: 'Instructivo de Manejo Defensivo', type: 'instruction', status: 'EFFECTIVE' as const, version: 2 },
    { title: 'Política de Calidad (Obsoleta v1)', type: 'policy', status: 'OBSOLETE' as const, version: 1 },
    { title: 'Procedimiento de Compras', type: 'procedure', status: 'DRAFT' as const, version: 1 },
    { title: 'Plan de Emergencias', type: 'plan', status: 'EFFECTIVE' as const, version: 2 },
  ];

  for (const doc of documents) {
    const existing = await prisma.document.findFirst({
      where: { tenantId: tenant.id, title: doc.title },
    });
    if (existing) continue;

    await prisma.document.create({
      data: {
        tenantId: tenant.id,
        title: doc.title,
        type: doc.type,
        status: doc.status,
        version: doc.version,
        content: `Contenido de ejemplo para: ${doc.title}.\n\nEste documento forma parte del Sistema de Gestión Integrado de la organización.`,
        createdById: user.id,
        updatedById: user.id,
      },
    });
  }
  console.log(`  ✅ ${documents.length} documentos creados`);

  // ── Non-Conformities (NCRs) ──
  const ncrs = [
    { code: 'NCR-2026-001', title: 'Falta de calibración de equipos', severity: 'MAJOR' as const, source: 'INTERNAL_AUDIT' as const, status: 'OPEN' as const, standard: 'ISO 9001', clause: '7.1.5', dueDate: daysFromNow(15) },
    { code: 'NCR-2026-002', title: 'Registro de capacitación incompleto', severity: 'MINOR' as const, source: 'INTERNAL_AUDIT' as const, status: 'IN_ANALYSIS' as const, standard: 'ISO 9001', clause: '7.2', dueDate: daysFromNow(30) },
    { code: 'NCR-2026-003', title: 'Derrame de aceite sin contención', severity: 'CRITICAL' as const, source: 'PROCESS_DEVIATION' as const, status: 'ACTION_PLANNED' as const, standard: 'ISO 14001', clause: '8.2', dueDate: daysFromNow(7), rootCause: 'Falta de bandeja de contención en zona de mantenimiento' },
    { code: 'NCR-2026-004', title: 'Señalización vial faltante', severity: 'MAJOR' as const, source: 'EXTERNAL_AUDIT' as const, status: 'IN_PROGRESS' as const, standard: 'ISO 39001', clause: '8.1', dueDate: daysFromNow(10), correctiveAction: 'Instalar señalización vertical y horizontal en zona de carga' },
    { code: 'NCR-2026-005', title: 'EPP deteriorado sin reemplazo', severity: 'MAJOR' as const, source: 'CUSTOMER_COMPLAINT' as const, status: 'VERIFICATION' as const, standard: 'ISO 45001', clause: '8.1.2', dueDate: daysFromNow(-5) },
    { code: 'NCR-2026-006', title: 'Proveedor sin evaluación anual', severity: 'MINOR' as const, source: 'INTERNAL_AUDIT' as const, status: 'CLOSED' as const, standard: 'ISO 9001', clause: '8.4', dueDate: daysAgo(10), closedAt: daysAgo(2) },
    { code: 'NCR-2026-007', title: 'Incidente con vehículo de flota', severity: 'CRITICAL' as const, source: 'PROCESS_DEVIATION' as const, status: 'OPEN' as const, standard: 'ISO 39001', clause: '8.2', dueDate: daysFromNow(3) },
    { code: 'NCR-2026-008', title: 'Residuos peligrosos sin rotulación', severity: 'OBSERVATION' as const, source: 'INTERNAL_AUDIT' as const, status: 'CLOSED' as const, standard: 'ISO 14001', clause: '8.1', dueDate: daysAgo(20), closedAt: daysAgo(15) },
  ];

  for (const ncr of ncrs) {
    await prisma.nonConformity.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: ncr.code } },
      update: {},
      create: {
        tenantId: tenant.id,
        code: ncr.code,
        title: ncr.title,
        description: `Descripción detallada de la no conformidad: ${ncr.title}. Se detectó durante ${ncr.source.replace(/_/g, ' ').toLowerCase()}.`,
        severity: ncr.severity,
        source: ncr.source,
        status: ncr.status,
        standard: ncr.standard,
        clause: ncr.clause,
        rootCause: ncr.rootCause || null,
        correctiveAction: ncr.correctiveAction || null,
        dueDate: ncr.dueDate,
        closedAt: ncr.closedAt || null,
        assignedToId: allUserIds[Math.floor(Math.random() * allUserIds.length)],
        createdById: user.id,
      },
    });
  }
  console.log(`  ✅ ${ncrs.length} no conformidades creadas`);

  // ── Risks ──
  const risks = [
    { code: 'RSK-2026-001', title: 'Incendio en planta', category: 'Seguridad', probability: 2, impact: 5, status: 'ASSESSED' as const, standard: 'ISO 45001' },
    { code: 'RSK-2026-002', title: 'Contaminación de suelo por derrames', category: 'Ambiental', probability: 3, impact: 4, status: 'MITIGATING' as const, standard: 'ISO 14001', treatmentPlan: 'Instalar sistemas de contención secundaria' },
    { code: 'RSK-2026-003', title: 'Falla en sistema de gestión documental', category: 'Operacional', probability: 2, impact: 3, status: 'MONITORED' as const, standard: 'ISO 9001' },
    { code: 'RSK-2026-004', title: 'Accidente vial con vehículo de flota', category: 'Seguridad Vial', probability: 3, impact: 5, status: 'MITIGATING' as const, standard: 'ISO 39001', treatmentPlan: 'Programa de capacitación en manejo defensivo' },
    { code: 'RSK-2026-005', title: 'Incumplimiento regulatorio ambiental', category: 'Legal', probability: 2, impact: 4, status: 'ASSESSED' as const, standard: 'ISO 14001' },
    { code: 'RSK-2026-006', title: 'Pérdida de personal clave', category: 'Operacional', probability: 3, impact: 3, status: 'IDENTIFIED' as const },
    { code: 'RSK-2026-007', title: 'Falla en proveedor crítico', category: 'Calidad', probability: 2, impact: 4, status: 'MONITORED' as const, standard: 'ISO 9001', controls: 'Evaluación semestral de proveedores' },
    { code: 'RSK-2026-008', title: 'Exposición a ruido excesivo', category: 'Seguridad', probability: 4, impact: 3, status: 'MITIGATING' as const, standard: 'ISO 45001', residualProb: 2, residualImpact: 2 },
    { code: 'RSK-2026-009', title: 'Obsolescencia tecnológica', category: 'Operacional', probability: 3, impact: 2, status: 'IDENTIFIED' as const },
    { code: 'RSK-2026-010', title: 'Pandemia o emergencia sanitaria', category: 'Operacional', probability: 1, impact: 5, status: 'MONITORED' as const },
  ];

  for (const r of risks) {
    await prisma.risk.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: r.code } },
      update: {},
      create: {
        tenantId: tenant.id,
        code: r.code,
        title: r.title,
        description: `Análisis de riesgo: ${r.title}. Categoría: ${r.category}.`,
        category: r.category,
        standard: r.standard || null,
        probability: r.probability,
        impact: r.impact,
        riskLevel: r.probability * r.impact,
        residualProb: r.residualProb || null,
        residualImpact: r.residualImpact || null,
        residualLevel: r.residualProb && r.residualImpact ? r.residualProb * r.residualImpact : null,
        treatmentPlan: r.treatmentPlan || null,
        controls: r.controls || null,
        status: r.status,
        ownerId: allUserIds[Math.floor(Math.random() * allUserIds.length)],
        createdById: user.id,
      },
    });
  }
  console.log(`  ✅ ${risks.length} riesgos creados`);

  // ── Indicators (KPIs) ──
  const indicators = [
    { code: 'KPI-001', name: 'Cumplimiento de auditorías', category: 'Calidad', unit: '%', target: 95, current: 87, trend: 'UP' as const },
    { code: 'KPI-002', name: 'Tasa de NCRs cerradas a tiempo', category: 'Calidad', unit: '%', target: 90, current: 78, trend: 'DOWN' as const },
    { code: 'KPI-003', name: 'Incidentes viales por mes', category: 'Seguridad Vial', unit: 'cant', target: 0, current: 2, trend: 'STABLE' as const },
    { code: 'KPI-004', name: 'Horas de capacitación por empleado', category: 'RRHH', unit: 'hrs', target: 40, current: 28, trend: 'UP' as const },
    { code: 'KPI-005', name: 'Residuos reciclados', category: 'Ambiente', unit: '%', target: 60, current: 52, trend: 'UP' as const },
    { code: 'KPI-006', name: 'Satisfacción del cliente', category: 'Calidad', unit: '%', target: 85, current: 91, trend: 'UP' as const },
    { code: 'KPI-007', name: 'Índice de frecuencia accidentes', category: 'Seguridad', unit: 'IF', target: 5, current: 3.2, trend: 'DOWN' as const },
    { code: 'KPI-008', name: 'Consumo energético por unidad', category: 'Ambiente', unit: 'kWh', target: 150, current: 165, trend: 'STABLE' as const },
  ];

  for (const ind of indicators) {
    const existing = await prisma.indicator.findFirst({
      where: { tenantId: tenant.id, code: ind.code },
    });
    if (existing) continue;

    const indicator = await prisma.indicator.create({
      data: {
        tenantId: tenant.id,
        code: ind.code,
        name: ind.name,
        category: ind.category,
        unit: ind.unit,
        targetValue: ind.target,
        currentValue: ind.current,
        trend: ind.trend,
        frequency: 'MONTHLY',
        isActive: true,
        ownerId: allUserIds[Math.floor(Math.random() * allUserIds.length)],
        createdById: user.id,
      },
    });

    // Add 6 months of historical measurements
    for (let m = 5; m >= 0; m--) {
      const date = new Date();
      date.setMonth(date.getMonth() - m);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const variation = (Math.random() - 0.5) * 20;
      const value = Math.max(0, Math.round((ind.current + variation) * 10) / 10);

      await prisma.indicatorMeasurement.upsert({
        where: { indicatorId_period: { indicatorId: indicator.id, period } },
        update: {},
        create: {
          indicatorId: indicator.id,
          value,
          period,
          measuredAt: date,
        },
      });
    }
  }
  console.log(`  ✅ ${indicators.length} indicadores con datos históricos creados`);

  // ── Trainings ──
  const trainings = [
    { code: 'CAP-2026-001', title: 'Manejo Defensivo Nivel 1', category: 'Seguridad Vial', modality: 'PRESENCIAL' as SgiTrainingModality, hours: 8, status: 'COMPLETED' as SgiTrainingStatus, standard: 'ISO 39001', expected: 20 },
    { code: 'CAP-2026-002', title: 'Auditor Interno ISO 9001', category: 'Calidad', modality: 'PRESENCIAL' as SgiTrainingModality, hours: 16, status: 'COMPLETED' as SgiTrainingStatus, standard: 'ISO 9001', expected: 10 },
    { code: 'CAP-2026-003', title: 'Gestión Ambiental Básica', category: 'Ambiente', modality: 'VIRTUAL' as SgiTrainingModality, hours: 4, status: 'SCHEDULED' as SgiTrainingStatus, standard: 'ISO 14001', expected: 30, scheduledDate: daysFromNow(14) },
    { code: 'CAP-2026-004', title: 'Primeros Auxilios y RCP', category: 'Seguridad', modality: 'PRESENCIAL' as SgiTrainingModality, hours: 6, status: 'IN_PROGRESS' as SgiTrainingStatus, standard: 'ISO 45001', expected: 25 },
    { code: 'CAP-2026-005', title: 'Gestión de Riesgos 5x5', category: 'Normativo', modality: 'MIXTA' as SgiTrainingModality, hours: 12, status: 'SCHEDULED' as SgiTrainingStatus, expected: 15, scheduledDate: daysFromNow(30) },
    { code: 'CAP-2026-006', title: 'Uso de EPP Especializado', category: 'Seguridad', modality: 'PRESENCIAL' as SgiTrainingModality, hours: 3, status: 'COMPLETED' as SgiTrainingStatus, standard: 'ISO 45001', expected: 40, completedDate: daysAgo(20) },
  ];

  for (const t of trainings) {
    await prisma.sgiTraining.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: t.code } },
      update: {},
      create: {
        tenantId: tenant.id,
        code: t.code,
        title: t.title,
        description: `Capacitación en ${t.title}. ${t.category}.`,
        category: t.category,
        modality: t.modality,
        durationHours: t.hours,
        status: t.status,
        standard: t.standard || null,
        expectedParticipants: t.expected,
        scheduledDate: t.scheduledDate || (t.status === 'COMPLETED' ? daysAgo(30) : null),
        completedDate: t.completedDate || (t.status === 'COMPLETED' ? daysAgo(25) : null),
        coordinatorId: allUserIds[Math.floor(Math.random() * allUserIds.length)],
        createdById: user.id,
      },
    });
  }
  console.log(`  ✅ ${trainings.length} capacitaciones creadas`);

  // ── AI Findings (sample) ──
  const findings = [
    { standard: 'ISO 9001', clause: '4.1', title: 'Contexto organizacional incompleto', severity: 'SHOULD' as const, confidence: 0.82 },
    { standard: 'ISO 9001', clause: '7.1.5', title: 'Falta programa de calibración documentado', severity: 'MUST' as const, confidence: 0.95 },
    { standard: 'ISO 14001', clause: '6.1.2', title: 'Aspectos ambientales sin actualizar', severity: 'MUST' as const, confidence: 0.88 },
    { standard: 'ISO 45001', clause: '8.1.2', title: 'Jerarquía de controles no documentada', severity: 'SHOULD' as const, confidence: 0.76 },
    { standard: 'ISO 39001', clause: '8.1', title: 'Plan de seguridad vial sin metas medibles', severity: 'MUST' as const, confidence: 0.91 },
  ];

  for (const f of findings) {
    const existing = await prisma.aiFinding.findFirst({
      where: { tenantId: tenant.id, clause: f.clause, standard: f.standard },
    });
    if (existing) continue;

    await prisma.aiFinding.create({
      data: {
        tenantId: tenant.id,
        standard: f.standard,
        clause: f.clause,
        title: f.title,
        severity: f.severity,
        description: `El análisis de IA detectó que el requisito ${f.clause} de ${f.standard} no se cumple completamente. ${f.title}.`,
        confidence: f.confidence,
        auditType: 'document_vs_norma',
        status: 'OPEN',
        suggestedActions: JSON.stringify([
          `Revisar documentación relacionada con ${f.clause}`,
          `Actualizar procedimiento para cumplir con ${f.standard}`,
        ]),
      },
    });
  }
  console.log(`  ✅ ${findings.length} hallazgos de IA creados`);

  // ── Notifications ──
  const notifications: { type: NotificationType; title: string; message: string; isRead: boolean }[] = [
    { type: NotificationType.NCR_ASSIGNED, title: 'NCR asignada: Falta de calibración de equipos', message: 'Se te asignó la NCR-2026-001. Revisá los detalles y tomá acción.', isRead: false },
    { type: NotificationType.NCR_OVERDUE, title: 'NCR vencida: Incidente con vehículo de flota', message: 'La NCR-2026-007 superó su fecha límite. Requiere atención inmediata.', isRead: false },
    { type: NotificationType.RISK_CRITICAL, title: 'Riesgo crítico detectado', message: 'El riesgo "Accidente vial con vehículo de flota" tiene nivel ≥15. Revisá el plan de tratamiento.', isRead: false },
    { type: NotificationType.AUDIT_COMPLETED, title: 'Auditoría completada', message: 'El análisis de cumplimiento ISO 9001 finalizó con 5 hallazgos.', isRead: true },
    { type: NotificationType.TRAINING_SCHEDULED, title: 'Capacitación programada', message: 'Gestión Ambiental Básica programada para dentro de 14 días.', isRead: true },
    { type: NotificationType.TRAINING_REMINDER, title: 'Recordatorio de capacitación', message: 'Primeros Auxilios y RCP está en curso. Completá tu asistencia.', isRead: false },
    { type: NotificationType.FINDING_NEW, title: 'Nuevo hallazgo de auditoría', message: 'Se detectó "Falta programa de calibración documentado" en ISO 9001 cláusula 7.1.5.', isRead: true },
    { type: NotificationType.SYSTEM_ALERT, title: 'Bienvenido a SGI 360', message: 'Tu organización está configurada. Explorá las funcionalidades del sistema.', isRead: true },
  ];

  for (const n of notifications) {
    const existing = await prisma.notification.findFirst({
      where: { tenantId: tenant.id, userId: user.id, title: n.title },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
      },
    });
  }
  console.log(`  ✅ ${notifications.length} notificaciones creadas`);

  console.log('\n🎉 Demo data seed completado.\n');
  console.log('Credenciales adicionales (todas con password User123!):');
  additionalEmails.forEach(e => console.log(`  ${e}`));
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ Error:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
