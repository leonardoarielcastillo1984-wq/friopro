-- ═══════════════════════════════════════════════════════════════════════════
-- Flota 360 · Rentabilidad v2 — costo de personal, cobranza y cliente
--
--   1) flota_conductores.costoMensual: sueldo + cargas sociales mensuales.
--      Se prorratea a la unidad asignada como costo fijo en rentabilidad.
--   2) flota_ingresos.cliente: habilita margen por cliente.
--   3) flota_ingresos.cobradoAt / fechaCobroEstimada: un ingreso registrado
--      no es ingreso cobrado — alimenta el cash flow de entradas.
--
-- Idempotente: seguro re-ejecutar.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE flota_conductores ADD COLUMN IF NOT EXISTS "costoMensual" float8;
ALTER TABLE flota_ingresos    ADD COLUMN IF NOT EXISTS "cliente" text;
ALTER TABLE flota_ingresos    ADD COLUMN IF NOT EXISTS "cobradoAt" timestamptz;
ALTER TABLE flota_ingresos    ADD COLUMN IF NOT EXISTS "fechaCobroEstimada" timestamptz;
CREATE INDEX IF NOT EXISTS idx_flota_ingresos_cliente ON flota_ingresos("cliente");
