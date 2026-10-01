-- ═══════════════════════════════════════════════════════════════
-- Flota 360 — Rentabilidad y financiación de unidades
-- Fecha: 2026-09-30
--
-- 1) Datos de compra/financiación en flota_vehiculos: permite
--    distinguir desembolso inicial (anticipo) del total financiado
--    en cuotas, trackear cuotas pagadas/restantes y considerar la
--    cuota mensual como costo fijo de la unidad.
-- 2) flota_ingresos: facturación por unidad (viaje, contrato,
--    período) para margen y costo de oportunidad.
-- 3) flota_vencimientos.monto: costo estimado del trámite para el
--    cash flow proyectado.
-- ═══════════════════════════════════════════════════════════════

-- ── 1) Financiación de la unidad ──────────────────────────────
ALTER TABLE flota_vehiculos ADD COLUMN IF NOT EXISTS "fechaCompra" timestamptz;
ALTER TABLE flota_vehiculos ADD COLUMN IF NOT EXISTS "anticipoCompra" float8; -- entrega/desembolso inicial (≠ valorAdquisicion total)
ALTER TABLE flota_vehiculos ADD COLUMN IF NOT EXISTS "cuotaMensual" float8;   -- cuota del préstamo/prenda
ALTER TABLE flota_vehiculos ADD COLUMN IF NOT EXISTS "cuotasTotales" int4;
ALTER TABLE flota_vehiculos ADD COLUMN IF NOT EXISTS "primerCuotaAt" timestamptz; -- cuotas pagadas = meses transcurridos desde esta fecha
ALTER TABLE flota_vehiculos ADD COLUMN IF NOT EXISTS "valorResidual" float8;  -- valor de reventa estimado (para ROI/reemplazo)

-- ── 2) Ingresos por unidad ────────────────────────────────────
CREATE TABLE IF NOT EXISTS flota_ingresos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "vehiculoId"  uuid NOT NULL REFERENCES flota_vehiculos(id) ON DELETE CASCADE,
  "conductorId" uuid,

  fecha    timestamptz NOT NULL DEFAULT now(),
  monto    float8      NOT NULL,
  concepto text NOT NULL DEFAULT 'VIAJE', -- VIAJE | CONTRATO | PERIODO | OTRO
  descripcion text,
  origen   text,
  destino  text,

  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flota_ingresos_tenant    ON flota_ingresos("tenantId");
CREATE INDEX IF NOT EXISTS idx_flota_ingresos_vehiculo  ON flota_ingresos("vehiculoId");
CREATE INDEX IF NOT EXISTS idx_flota_ingresos_fecha     ON flota_ingresos(fecha);

-- ── 3) Costo estimado de vencimientos (cash flow) ─────────────
ALTER TABLE flota_vencimientos ADD COLUMN IF NOT EXISTS monto float8;
