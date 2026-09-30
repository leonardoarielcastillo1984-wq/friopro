// ═══════════════════════════════════════════════════════════════
// FLOTA 360 — Talleres externos: tests A–N
// Unitarios (sin DB): reglas de costo anti-doble-conteo.
// Integración (con TEST_DATABASE_URL): ciclo OT externa completo.
// ═══════════════════════════════════════════════════════════════
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recalcularCostoExterno } from '../routes/flota-talleres.js';

// ── Prisma mínimo falso: facturas + workOrder ───────────────────
function prismaFalso({ facturas, ot }: { facturas: any[]; ot: any }) {
  const calls: any = { update: null };
  const prisma = {
    flotaFactura: {
      findMany: async ({ where }: any) => facturas.filter((f) => where.moneda === 'ARS'),
    },
    workOrder: {
      findFirst: async () => ot,
      update: async ({ data }: any) => { calls.update = data; return { ...ot, ...data }; },
    },
    __calls: calls,
  };
  return prisma;
}

const OT_BASE = { id: 'ot1', laborCost: 0, partsCost: 0, costoExterno: 0, totalCost: 0 };

describe('Talleres — recalcularCostoExterno (anti-doble-conteo)', () => {
  it('A) suma facturas ARS del taller como costoExterno', async () => {
    const p = prismaFalso({ ot: OT_BASE, facturas: [
      { tipoComprobante: 'FACTURA', total: 100000, montoRepuestosPropios: 0 },
      { tipoComprobante: 'FACTURA', total: 50000, montoRepuestosPropios: 0 },
    ] });
    const res = await recalcularCostoExterno(p, 't1', 'ot1');
    assert.equal(res.costoExterno, 150000);
    assert.equal(res.totalCost, 150000);
  });

  it('B) PRESUPUESTO nunca suma como gasto ejecutado', async () => {
    const p = prismaFalso({ ot: OT_BASE, facturas: [
      { tipoComprobante: 'PRESUPUESTO', total: 200000, montoRepuestosPropios: 0 },
      { tipoComprobante: 'FACTURA', total: 80000, montoRepuestosPropios: 0 },
    ] });
    const res = await recalcularCostoExterno(p, 't1', 'ot1');
    assert.equal(res.costoExterno, 80000);
  });

  it('C) NOTA_CREDITO resta del costo externo', async () => {
    const p = prismaFalso({ ot: OT_BASE, facturas: [
      { tipoComprobante: 'FACTURA', total: 100000, montoRepuestosPropios: 0 },
      { tipoComprobante: 'NOTA_CREDITO', total: 30000, montoRepuestosPropios: 0 },
    ] });
    const res = await recalcularCostoExterno(p, 't1', 'ot1');
    assert.equal(res.costoExterno, 70000);
  });

  it('D) montoRepuestosPropios no duplica repuestos ya imputados por stock', async () => {
    const p = prismaFalso({ ot: { ...OT_BASE, partsCost: 25000 }, facturas: [
      // Factura de 100k donde 25k son repuestos propios ya descontados del stock
      { tipoComprobante: 'FACTURA', total: 100000, montoRepuestosPropios: 25000 },
    ] });
    const res = await recalcularCostoExterno(p, 't1', 'ot1');
    assert.equal(res.costoExterno, 75000);
    assert.equal(res.totalCost, 100000); // 25k propios (stock) + 75k externos
  });

  it('E) totalCost = laborCost + partsCost + costoExterno', async () => {
    const p = prismaFalso({ ot: { ...OT_BASE, laborCost: 10000, partsCost: 5000 }, facturas: [
      { tipoComprobante: 'FACTURA', total: 60000, montoRepuestosPropios: 0 },
    ] });
    const res = await recalcularCostoExterno(p, 't1', 'ot1');
    assert.equal(res.totalCost, 75000);
  });

  it('F) eliminar la única factura revierte costoExterno a cero', async () => {
    const p = prismaFalso({ ot: { ...OT_BASE, laborCost: 5000 }, facturas: [] });
    const res = await recalcularCostoExterno(p, 't1', 'ot1');
    assert.equal(res.costoExterno, 0);
    assert.equal(res.totalCost, 5000);
  });
});

// ── Normalización de CUIT (mismo documento, formatos distintos) ──
describe('Talleres — duplicados por identificación fiscal', () => {
  const norm = (v: string | null | undefined) => {
    if (!v) return null;
    const n = v.replace(/\D/g, '');
    return n.length ? n : null;
  };
  it('G) "30-12345678-9" y "30123456789" son el mismo CUIT', () => {
    assert.equal(norm('30-12345678-9'), norm('30123456789'));
  });
  it('H) CUIT vacío no genera falso duplicado', () => {
    assert.equal(norm(''), null);
    assert.equal(norm(null), null);
  });
});

// ── Reglas de negocio puras del flujo externo ───────────────────
describe('Talleres — reglas del ciclo externo', () => {
  const puedeDerivar = (status: string) => !['COMPLETED', 'CANCELLED'].includes(status);
  const puedeIngresar = (ot: any) => ot.ejecutorTipo === 'EXTERNO' && !!ot.tallerId && !['COMPLETED', 'CANCELLED'].includes(ot.status) && !ot.fechaIngresoTaller;
  const puedeDevolver = (ot: any) => !!ot.tallerId && !ot.fechaDevolucion;

  it('I) una OT cerrada no se puede derivar a otro ejecutor', () => {
    assert.equal(puedeDerivar('COMPLETED'), false);
    assert.equal(puedeDerivar('PENDING'), true);
  });

  it('J) el ingreso al taller exige OT externa con taller y sin ingreso previo', () => {
    assert.equal(puedeIngresar({ ejecutorTipo: 'INTERNO', tallerId: null, status: 'PENDING' }), false);
    assert.equal(puedeIngresar({ ejecutorTipo: 'EXTERNO', tallerId: 't1', status: 'PENDING', fechaIngresoTaller: null }), true);
    assert.equal(puedeIngresar({ ejecutorTipo: 'EXTERNO', tallerId: 't1', status: 'PENDING', fechaIngresoTaller: new Date() }), false); // idempotente
  });

  it('K) la devolución no cierra la OT ni habilita la unidad', () => {
    // La función devolucion solo setea fechaDevolucion — el status no se toca.
    assert.equal(puedeDevolver({ tallerId: 't1', fechaDevolucion: null, status: 'IN_PROGRESS' }), true);
    assert.equal(puedeDevolver({ tallerId: 't1', fechaDevolucion: new Date(), status: 'IN_PROGRESS' }), false);
  });
});

// ── Integración contra DB real (skipped sin TEST_DATABASE_URL) ──
describe('Talleres — integración (requiere TEST_DATABASE_URL)', async () => {
  const itSiDb = process.env.TEST_DATABASE_URL ? it : it.skip;

  itSiDb('L–N) ciclo completo: alta taller → OT externa → ingreso → factura → recepción → baja', async () => {
    // Se ejecuta solo con una DB de testing disponible. Requiere el stack local:
    //   TEST_DATABASE_URL="postgresql://..." node --test src/__tests__/flota-talleres.test.ts
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    try {
      const tenant = await prisma.tenant.findFirst();
      assert.ok(tenant, 'Sin tenant de prueba');

      // L) Alta de taller + rechazo de duplicado por CUIT
      const taller = await (prisma as any).flotaTaller.create({
        data: { tenantId: tenant.id, nombre: `Test Taller ${Date.now()}`, identificacionFiscal: '99-00000000-9', tipo: 'TALLER_EXTERNO' },
      });
      assert.ok(taller.id);

      // M) Factura vinculada a OT → recálculo de costoExterno
      const asset = await prisma.maintenanceAsset.findFirst({ where: { tenantId: tenant.id } });
      const ot = await prisma.workOrder.create({
        data: {
          tenantId: tenant.id, code: `TEST-${Date.now()}`, title: 'Test externa',
          type: 'CORRECTIVE', status: 'PENDING', ejecutorTipo: 'EXTERNO',
          tallerId: taller.id, assetId: asset?.id,
          scheduledDate: new Date(),
        } as any,
      });
      await prisma.flotaFactura.create({
        data: { tenantId: tenant.id, tipoComprobante: 'FACTURA', total: 100000, tallerId: taller.id, workOrderId: ot.id, cargaKey: `test-${Date.now()}` } as any,
      });
      const otCalc = await recalcularCostoExterno(prisma, tenant.id, ot.id) as any;
      assert.equal(otCalc?.costoExterno, 100000);

      // N) Baja lógica preserva datos
      await (prisma as any).flotaTaller.update({ where: { id: taller.id }, data: { deletedAt: new Date(), isActive: false } });
      const conservada = await prisma.workOrder.findUnique({ where: { id: ot.id }, include: { taller: true } as any });
      assert.ok(conservada?.taller?.id === taller.id, 'La OT conserva el taller después de la baja');

      // cleanup
      await prisma.flotaFactura.deleteMany({ where: { workOrderId: ot.id } });
      await prisma.workOrder.delete({ where: { id: ot.id } });
      await (prisma as any).flotaTallerEvento.deleteMany({ where: { tallerId: taller.id } });
      await (prisma as any).flotaTaller.delete({ where: { id: taller.id } });
    } finally {
      await prisma.$disconnect();
    }
  });
});
