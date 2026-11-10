/**
 * seedDemoFull.ts — Extensión del seed demo: cubre los módulos que
 * seedDemoData.ts no toca (RRHH, Flota, Mantenimiento, Proveedores,
 * Auditorías, Objetivos, Clientes, Requisitos legales).
 *
 * Pre-requisitos: seedPlans.ts + seedUsers.ts + seedDemoData.ts
 * Run (en el contenedor): docker exec -w /app/apps/api sgi-api npx tsx src/scripts/seedDemoFull.ts
 * Idempotente: usa findFirst/upsert por códigos con prefijo DEMO-.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400_000);

async function findOrCreate<T>(find: () => Promise<T | null>, create: () => Promise<T>): Promise<T> {
  const existing = await find();
  return existing ?? create();
}

async function main() {
  console.log('🌱 Seeding FULL demo data (módulos extendidos)...\n');

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('Demo tenant not found. Run seedUsers.ts first.');
  const user = await prisma.platformUser.findUnique({ where: { email: 'usuario@demo.com' } });
  if (!user) throw new Error('Demo user not found.');
  const T = tenant.id, U = user.id;

  // ═══ RRHH: Departments + Positions + Employees ═══
  const deptNames = ['Calidad', 'Operaciones', 'Seguridad e Higiene', 'Recursos Humanos', 'Logística'];
  const depts: Record<string, string> = {};
  for (const name of deptNames) {
    const d = await findOrCreate(
      () => prisma.department.findFirst({ where: { tenantId: T, name } }),
      () => prisma.department.create({ data: { tenantId: T, name, createdById: U } })
    );
    depts[name] = d.id;
  }
  console.log(`  ✅ ${deptNames.length} departamentos`);

  const positionDefs = [
    { name: 'Gerente de Calidad', dept: 'Calidad' },
    { name: 'Analista de Calidad', dept: 'Calidad' },
    { name: 'Supervisor de Planta', dept: 'Operaciones' },
    { name: 'Operario de Producción', dept: 'Operaciones' },
    { name: 'Responsable HSE', dept: 'Seguridad e Higiene' },
    { name: 'Analista RRHH', dept: 'Recursos Humanos' },
    { name: 'Chofer Profesional', dept: 'Logística' },
    { name: 'Supervisor de Flota', dept: 'Logística' },
  ];
  const positions: Record<string, string> = {};
  for (const p of positionDefs) {
    const pos = await findOrCreate(
      () => prisma.position.findFirst({ where: { tenantId: T, name: p.name } }),
      () => prisma.position.create({ data: { tenantId: T, name: p.name, createdById: U } })
    );
    positions[p.name] = pos.id;
  }
  console.log(`  ✅ ${positionDefs.length} puestos`);

  const employees = [
    { fn: 'Mariana', ln: 'González', dni: '28456123', pos: 'Gerente de Calidad', dept: 'Calidad', hire: 1800 },
    { fn: 'Carlos', ln: 'Pérez', dni: '30789456', pos: 'Analista de Calidad', dept: 'Calidad', hire: 900 },
    { fn: 'Roberto', ln: 'Fernández', dni: '25123789', pos: 'Supervisor de Planta', dept: 'Operaciones', hire: 2500 },
    { fn: 'Laura', ln: 'Martínez', dni: '33456789', pos: 'Operario de Producción', dept: 'Operaciones', hire: 400 },
    { fn: 'Diego', ln: 'Romero', dni: '29654321', pos: 'Operario de Producción', dept: 'Operaciones', hire: 700 },
    { fn: 'Andrea', ln: 'Suárez', dni: '31987654', pos: 'Responsable HSE', dept: 'Seguridad e Higiene', hire: 1400 },
    { fn: 'Martín', ln: 'López', dni: '27456123', pos: 'Analista RRHH', dept: 'Recursos Humanos', hire: 1100 },
    { fn: 'Sergio', ln: 'Alvarez', dni: '24123654', pos: 'Chofer Profesional', dept: 'Logística', hire: 2000 },
    { fn: 'Pablo', ln: 'Méndez', dni: '26789456', pos: 'Chofer Profesional', dept: 'Logística', hire: 1600 },
    { fn: 'Gabriela', ln: 'Torres', dni: '30456789', pos: 'Supervisor de Flota', dept: 'Logística', hire: 1900 },
  ];
  let empCount = 0;
  for (const e of employees) {
    const email = `${e.fn.toLowerCase()}.${e.ln.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@demo.com`;
    await findOrCreate(
      () => prisma.employee.findFirst({ where: { tenantId: T, dni: e.dni } }),
      () => prisma.employee.create({
        data: {
          tenantId: T, firstName: e.fn, lastName: e.ln, dni: e.dni, email,
          positionId: positions[e.pos], departmentId: depts[e.dept],
          hireDate: daysAgo(e.hire), contractType: 'PERMANENT',
          location: 'Planta Central', createdById: U,
        }
      })
    );
    empCount++;
  }
  console.log(`  ✅ ${empCount} empleados`);

  // ═══ FLOTA: Conductores + Vehículos + Vencimientos ═══
  const conductores = [
    { nombre: 'Sergio Alvarez', dni: '24123654', cat: 'E', lic: daysFromNow(300) },
    { nombre: 'Pablo Méndez', dni: '26789456', cat: 'D', lic: daysFromNow(180) },
    { nombre: 'Jorge Quiroga', dni: '25741236', cat: 'E', lic: daysFromNow(45) },
    { nombre: 'Héctor Bazán', dni: '23987456', cat: 'B', lic: daysFromNow(15) },
  ];
  const conductorIds: string[] = [];
  for (const c of conductores) {
    const cond = await findOrCreate(
      () => prisma.conductor.findFirst({ where: { tenantId: T, dni: c.dni } }),
      () => prisma.conductor.create({
        data: {
          tenantId: T, nombre: c.nombre, dni: c.dni, categoria: c.cat,
          nroLicencia: `L-${c.dni}`, licenciaVto: c.lic,
          psicofisicoVto: daysFromNow(200), telefono: '+54 9 351 555-0000',
          email: `${c.nombre.split(' ')[0].toLowerCase()}@demo.com`,
        }
      })
    );
    conductorIds.push(cond.id);
  }
  console.log(`  ✅ ${conductores.length} conductores`);

  const vehiculos = [
    { dominio: 'DEMO-AB123CD', tipo: 'CAMION', marca: 'Scania', modelo: 'P360', anio: 2021, km: 145000, cond: 0 },
    { dominio: 'DEMO-AE456FG', tipo: 'CAMION', marca: 'Mercedes-Benz', modelo: 'Atego 1726', anio: 2020, km: 210000, cond: 1 },
    { dominio: 'DEMO-AD789HI', tipo: 'TRACTOR', marca: 'Volvo', modelo: 'FH 460', anio: 2022, km: 98000, cond: 2 },
    { dominio: 'DEMO-SM001AA', tipo: 'SEMI', marca: 'Randon', modelo: 'SR BS', anio: 2019, km: 0, cond: -1 },
    { dominio: 'DEMO-AF555JK', tipo: 'UTILITARIO', marca: 'Renault', modelo: 'Master', anio: 2023, km: 42000, cond: 3 },
    { dominio: 'DEMO-AG777LM', tipo: 'CAMION', marca: 'Iveco', modelo: 'Tector 170E28', anio: 2018, km: 320000, cond: -1 },
  ];
  const vehIds: string[] = [];
  for (const v of vehiculos) {
    const veh = await findOrCreate(
      () => prisma.vehiculo.findFirst({ where: { tenantId: T, dominio: v.dominio } }),
      () => prisma.vehiculo.create({
        data: {
          tenantId: T, dominio: v.dominio, tipo: v.tipo, marca: v.marca, modelo: v.modelo,
          anio: v.anio, currentOdometer: v.km, status: 'ACTIVO',
          perfilUso: 'RUTA', kmMesEstimado: 8000,
          valorAdquisicion: 85000, tipoCombustible: 'DIESEL',
          conductorId: v.cond >= 0 ? conductorIds[v.cond] : null,
        }
      })
    );
    vehIds.push(veh.id);

    // Vencimientos: VTV, seguro, habilitación
    const vencs = [
      { tipo: 'VTV', dias: 45 }, { tipo: 'SEGURO', dias: 120 }, { tipo: 'RUTA', dias: 20 },
    ];
    for (const vc of vencs) {
      await findOrCreate(
        () => prisma.vencimientoDocumento.findFirst({ where: { tenantId: T, vehiculoId: veh.id, tipo: vc.tipo } }),
        () => prisma.vencimientoDocumento.create({
          data: { tenantId: T, vehiculoId: veh.id, tipo: vc.tipo, descripcion: `${vc.tipo} ${v.dominio}`, fechaVto: daysFromNow(vc.dias) }
        })
      );
    }
  }
  console.log(`  ✅ ${vehiculos.length} vehículos + vencimientos`);

  // ═══ MANTENIMIENTO: Assets + Technicians + Plans + SpareParts + WorkOrders ═══
  const assets = [
    { code: 'DEMO-ACT-001', name: 'Compresor Industrial Atlas Copco', cat: 'MACHINERY', loc: 'Planta - Sector A' },
    { code: 'DEMO-ACT-002', name: 'Autoelevador Toyota 2.5T', cat: 'VEHICLE', loc: 'Depósito' },
    { code: 'DEMO-ACT-003', name: 'Grupo Electrógeno 150kVA', cat: 'INFRASTRUCTURE', loc: 'Sala de máquinas' },
    { code: 'DEMO-ACT-004', name: 'Soldadora Miller 350', cat: 'TOOL', loc: 'Taller' },
    { code: 'DEMO-ACT-005', name: 'Sistema de Extinción Incendios', cat: 'SAFETY', loc: 'Planta completa' },
    { code: 'DEMO-ACT-006', name: 'Balanzas Camioneras', cat: 'ELECTRONIC', loc: 'Playa' },
  ];
  const assetIds: string[] = [];
  for (const a of assets) {
    const asset = await findOrCreate(
      () => prisma.maintenanceAsset.findFirst({ where: { code: a.code } }),
      () => prisma.maintenanceAsset.create({
        data: {
          tenantId: T, code: a.code, name: a.name, category: a.cat, location: a.loc,
          status: 'ACTIVE', purchaseDate: daysAgo(700), acquisitionCost: 25000,
          nextMaintenanceDate: daysFromNow(15), lastMaintenanceDate: daysAgo(45),
        }
      })
    );
    assetIds.push(asset.id);
  }
  console.log(`  ✅ ${assets.length} activos`);

  const techs = [
    { code: 'DEMO-TEC-001', name: 'Fernando Ruiz', spec: 'Mecánica industrial' },
    { code: 'DEMO-TEC-002', name: 'Claudio Ibarra', spec: 'Electricidad' },
    { code: 'DEMO-TEC-003', name: 'Walter Gómez', spec: 'Hidráulica y neumática' },
  ];
  const techIds: string[] = [];
  for (const t of techs) {
    const tech = await findOrCreate(
      () => prisma.maintenanceTechnician.findFirst({ where: { code: t.code } }),
      () => prisma.maintenanceTechnician.create({ data: { tenantId: T, code: t.code, name: t.name, specialization: t.spec } })
    );
    techIds.push(tech.id);
  }
  console.log(`  ✅ ${techs.length} técnicos`);

  const plans = [
    { code: 'DEMO-PLAN-001', title: 'Service mensual compresor', asset: 0, fv: 30, fu: 'DAYS' },
    { code: 'DEMO-PLAN-002', title: 'Revisión trimestral autoelevador', asset: 1, fv: 90, fu: 'DAYS' },
    { code: 'DEMO-PLAN-003', title: 'Prueba semanal grupo electrógeno', asset: 2, fv: 7, fu: 'DAYS' },
    { code: 'DEMO-PLAN-004', title: 'Inspección semestral sistema incendios', asset: 4, fv: 6, fu: 'MONTHS' },
    { code: 'DEMO-PLAN-005', title: 'Calibración anual balanzas', asset: 5, fv: 12, fu: 'MONTHS' },
  ];
  const planIds: string[] = [];
  for (const p of plans) {
    const plan = await findOrCreate(
      () => prisma.maintenancePlan.findFirst({ where: { code: p.code } }),
      () => prisma.maintenancePlan.create({
        data: {
          tenantId: T, code: p.code, title: p.title, type: 'PREVENTIVE', status: 'ACTIVE',
          assetId: assetIds[p.asset], frequencyValue: p.fv, frequencyUnit: p.fu,
          nextExecutionDate: daysFromNow(10), lastExecutionDate: daysAgo(20), totalExecutions: 3,
        }
      })
    );
    planIds.push(plan.id);
  }
  console.log(`  ✅ ${plans.length} planes de mantenimiento`);

  const parts = [
    { code: 'DEMO-REP-001', name: 'Filtro de aceite compresor', stock: 12, min: 4, cost: 45000 },
    { code: 'DEMO-REP-002', name: 'Kit frenos autoelevador', stock: 3, min: 2, cost: 180000 },
    { code: 'DEMO-REP-003', name: 'Correa de distribución', stock: 6, min: 3, cost: 32000 },
    { code: 'DEMO-REP-004', name: 'Aceite hidráulico ISO 46 (20L)', stock: 8, min: 5, cost: 95000 },
    { code: 'DEMO-REP-005', name: 'Batería 12V 75Ah', stock: 4, min: 2, cost: 210000 },
    { code: 'DEMO-REP-006', name: 'Pastillas de freno Iveco', stock: 2, min: 4, cost: 87000 },
    { code: 'DEMO-REP-007', name: 'Filtro de aire motor', stock: 15, min: 6, cost: 28000 },
    { code: 'DEMO-REP-008', name: 'Extintor ABC 5kg (repuesto)', stock: 5, min: 3, cost: 65000 },
  ];
  for (const p of parts) {
    await findOrCreate(
      () => prisma.maintenanceSparePart.findFirst({ where: { code: p.code } }),
      () => prisma.maintenanceSparePart.create({
        data: { tenantId: T, code: p.code, name: p.name, currentStock: p.stock, minStock: p.min, unitCost: p.cost, location: 'Depósito repuestos' }
      })
    );
  }
  console.log(`  ✅ ${parts.length} repuestos`);

  const workOrders = [
    { code: 'DEMO-OT-001', title: 'Cambio de aceite y filtros compresor', type: 'PREVENTIVE', prio: 'MEDIUM', st: 'COMPLETED', asset: 0, tech: 0, done: 10 },
    { code: 'DEMO-OT-002', title: 'Reparación fuga hidráulica autoelevador', type: 'CORRECTIVE', prio: 'HIGH', st: 'IN_PROGRESS', asset: 1, tech: 2 },
    { code: 'DEMO-OT-003', title: 'Prueba mensual grupo electrógeno', type: 'PREVENTIVE', prio: 'MEDIUM', st: 'PENDING', asset: 2, tech: 1, sched: 3 },
    { code: 'DEMO-OT-004', title: 'Reemplazo balanza de carga dañada', type: 'CORRECTIVE', prio: 'HIGH', st: 'PENDING', asset: 5, tech: 1, sched: 5 },
    { code: 'DEMO-OT-005', title: 'Recarga extintores sector depósito', type: 'PREVENTIVE', prio: 'LOW', st: 'COMPLETED', asset: 4, tech: 0, done: 30 },
    { code: 'DEMO-OT-006', title: 'Falla eléctrica tablero principal', type: 'EMERGENCY', prio: 'CRITICAL', st: 'COMPLETED', asset: 2, tech: 1, done: 5 },
    { code: 'DEMO-OT-007', title: 'Inspección vibraciones soldadora', type: 'PREDICTIVE', prio: 'LOW', st: 'PENDING', asset: 3, tech: 0, sched: 12 },
    { code: 'DEMO-OT-008', title: 'Service 10.000 km Scania P360', type: 'PREVENTIVE', prio: 'MEDIUM', st: 'IN_PROGRESS', asset: 1, tech: 2 },
  ];
  for (const o of workOrders) {
    await findOrCreate(
      () => prisma.workOrder.findFirst({ where: { code: o.code } }),
      () => prisma.workOrder.create({
        data: {
          tenantId: T, code: o.code, title: o.title, type: o.type, priority: o.prio,
          status: o.st, assetId: assetIds[o.asset], technicianId: techIds[o.tech],
          description: `Orden de trabajo demo: ${o.title}`,
          scheduledDate: o.sched ? daysFromNow(o.sched) : daysAgo(o.done || 5),
          completedAt: o.st === 'COMPLETED' ? daysAgo(o.done || 5) : null,
          startedAt: o.st !== 'PENDING' ? daysAgo((o.done || 5) + 1) : null,
          laborCost: o.st === 'COMPLETED' ? 85000 : 0,
          totalCost: o.st === 'COMPLETED' ? 210000 : 0,
        }
      })
    );
  }
  console.log(`  ✅ ${workOrders.length} órdenes de trabajo`);

  // ═══ PROVEEDORES ═══
  const suppliers = [
    { code: 'DEMO-PROV-001', name: 'Repuestos del Centro SA', cat: 'Repuestos', st: 'APPROVED', score: 92 },
    { code: 'DEMO-PROV-002', name: 'Lubricentro Industrial', cat: 'Insumos', st: 'APPROVED', score: 88 },
    { code: 'DEMO-PROV-003', name: 'EPP Seguridad Total', cat: 'Seguridad', st: 'CONDITIONAL', score: 71 },
    { code: 'DEMO-PROV-004', name: 'Transportes Rápidos SRL', cat: 'Logística', st: 'APPROVED', score: 95 },
    { code: 'DEMO-PROV-005', name: 'Laboratorio Calibraciones SA', cat: 'Servicios', st: 'PENDING', score: null },
  ];
  for (const s of suppliers) {
    await findOrCreate(
      () => prisma.supplier.findFirst({ where: { tenantId: T, code: s.code } }),
      () => prisma.supplier.create({
        data: {
          tenantId: T, code: s.code, name: s.name, category: s.cat, status: s.st,
          email: `contacto@${s.code.toLowerCase()}.demo`, phone: '+54 351 456-7890',
          contactName: 'Contacto Comercial', evaluationScore: s.score,
          lastEvaluationDate: s.score ? daysAgo(90) : null, nextEvaluationDate: s.score ? daysFromNow(275) : null,
        }
      })
    );
  }
  console.log(`  ✅ ${suppliers.length} proveedores`);

  // ═══ AUDITORÍAS: Programa anual + auditorías ═══
  const year = new Date().getFullYear();
  const program = await findOrCreate(
    () => prisma.auditProgram.findFirst({ where: { tenantId: T, year } }),
    () => prisma.auditProgram.create({
      data: { tenantId: T, year, name: `Programa Anual de Auditorías ${year}`, description: 'Programa interno de auditorías del SGI', createdById: U }
    })
  );

  const audits = [
    { code: `DEMO-AUD-${year}-001`, title: 'Auditoría interna ISO 9001 — Gestión de Calidad', type: 'INTERNAL', st: 'COMPLETED', std: ['ISO 9001'], area: 'Planta Central', done: 60 },
    { code: `DEMO-AUD-${year}-002`, title: 'Auditoría interna ISO 14001 — Gestión Ambiental', type: 'INTERNAL', st: 'COMPLETED', std: ['ISO 14001'], area: 'Planta Central', done: 30 },
    { code: `DEMO-AUD-${year}-003`, title: 'Auditoría interna ISO 45001 — SST', type: 'INTERNAL', st: 'SCHEDULED', std: ['ISO 45001'], area: 'Depósito y Taller', sched: 20 },
    { code: `DEMO-AUD-${year}-004`, title: 'Auditoría de seguimiento proveedor crítico', type: 'SUPPLIER', st: 'PLANNED', std: ['ISO 9001'], area: 'Repuestos del Centro SA', sched: 45 },
  ];
  for (const a of audits) {
    await findOrCreate(
      () => prisma.audit.findFirst({ where: { tenantId: T, code: a.code } }),
      () => prisma.audit.create({
        data: {
          tenantId: T, programId: program.id, code: a.code, title: a.title,
          type: a.type as any, status: a.st as any, isoStandard: a.std, area: a.area,
          description: `Auditoría demo: ${a.title}`,
          plannedStartDate: a.sched ? daysFromNow(a.sched) : daysAgo(a.done || 30),
          actualStartDate: a.st === 'COMPLETED' ? daysAgo(a.done!) : null,
          actualEndDate: a.st === 'COMPLETED' ? daysAgo(a.done! - 1) : null,
          leadAuditorId: U, createdById: U,
        }
      })
    );
  }
  console.log(`  ✅ 1 programa + ${audits.length} auditorías`);

  // ═══ OBJETIVOS ═══
  const objectives = [
    { code: 'DEMO-OBJ-001', title: 'Reducir NCRs abiertas en 30%', year, target: 'Reducir a <5 NCRs abiertas', st: 'IN_PROGRESS', prog: 60 },
    { code: 'DEMO-OBJ-002', title: 'Certificar ISO 39001', year, target: 'Obtener certificación', st: 'IN_PROGRESS', prog: 40 },
    { code: 'DEMO-OBJ-003', title: 'Capacitar al 100% del personal en EPP', year, target: '100% personal capacitado', st: 'ACHIEVED', prog: 100 },
    { code: 'DEMO-OBJ-004', title: 'Reducir consumo de combustible 10%', year, target: '-10% consumo diesel', st: 'IN_PROGRESS', prog: 25 },
    { code: 'DEMO-OBJ-005', title: 'Implementar sistema de inspecciones QR', year, target: 'QR en 100% de activos', st: 'PLANNED', prog: 10 },
  ];
  for (const o of objectives) {
    await findOrCreate(
      () => prisma.sgiObjective.findFirst({ where: { tenantId: T, code: o.code } }),
      () => prisma.sgiObjective.create({
        data: {
          tenantId: T, code: o.code, title: o.title, year: o.year, target: o.target,
          status: o.st, progress: o.prog, startDate: daysAgo(120), endDate: daysFromNow(120),
          description: `Objetivo estratégico demo: ${o.title}`,
        }
      })
    );
  }
  console.log(`  ✅ ${objectives.length} objetivos`);

  // ═══ CLIENTES ═══
  const customers = [
    { code: 'DEMO-CLI-001', name: 'Distribuidora Norte SA', ind: 'Distribución', cat: 'A' },
    { code: 'DEMO-CLI-002', name: 'Frigorífico Andino', ind: 'Alimentos', cat: 'A' },
    { code: 'DEMO-CLI-003', name: 'Agroexport del Litoral', ind: 'Agroindustria', cat: 'B' },
    { code: 'DEMO-CLI-004', name: 'Constructora Sur SRL', ind: 'Construcción', cat: 'B' },
    { code: 'DEMO-CLI-005', name: 'Minera Cordillera', ind: 'Minería', cat: 'C' },
  ];
  for (const c of customers) {
    await findOrCreate(
      () => prisma.customer.findFirst({ where: { tenantId: T, code: c.code } }),
      () => prisma.customer.create({
        data: {
          tenantId: T, code: c.code, name: c.name, industry: c.ind, category: c.cat,
          type: 'CLIENT', status: 'ACTIVE', email: `comercial@${c.code.toLowerCase()}.demo`,
          contactName: 'Responsable de cuenta', createdById: U,
        }
      })
    );
  }
  console.log(`  ✅ ${customers.length} clientes`);

  // ═══ REQUISITOS LEGALES ═══
  const legal = [
    { fw: 'ENVIRONMENTAL', src: 'Ley 24.051', title: 'Residuos peligrosos — gestión y disposición', result: 'COMPLIANT' },
    { fw: 'OHAS', src: 'Ley 19.587', title: 'Higiene y seguridad en el trabajo', result: 'COMPLIANT' },
    { fw: 'OHAS', src: 'Decreto 351/79', title: 'Reglamentación de higiene y seguridad', result: 'PARTIAL' },
    { fw: 'OHAS', src: 'Res. SRT 905/15', title: 'Uso obligatorio de EPP', result: 'COMPLIANT' },
    { fw: 'ENVIRONMENTAL', src: 'Ley 25.675', title: 'Presupuestos mínimos ambiente', result: 'PARTIAL' },
    { fw: 'QUALITY', src: 'CNRT Res. 267/10', title: 'Habilitación transporte de cargas', result: 'COMPLIANT' },
  ];
  for (const l of legal) {
    await findOrCreate(
      () => prisma.legalRequirement.findFirst({ where: { tenantId: T, source: l.src, title: l.title } }),
      () => prisma.legalRequirement.create({
        data: {
          tenantId: T, framework: l.fw, source: l.src, title: l.title,
          appliesTo: 'Operación general', lastEvaluationDate: daysAgo(120),
          lastEvaluationResult: l.result, nextEvaluationDate: daysFromNow(245),
          isActive: true,
        }
      })
    );
  }
  console.log(`  ✅ ${legal.length} requisitos legales`);

  console.log('\n🎉 Seed FULL completado.');
  console.log('   Login: usuario@demo.com / User123!  (tenant: Demo Company)');
  console.log('   Admins: admin@sgi360.com / Admin123!');
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (e) => { console.error('❌ Error:', e); await prisma.$disconnect(); process.exit(1); });
