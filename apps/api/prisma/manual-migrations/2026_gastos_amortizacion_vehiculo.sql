-- FinanzaGasto: amortización de gastos anuales, cuota variable e imputación a unidad.
-- Idempotente.
ALTER TABLE finanza_gastos
  ADD COLUMN IF NOT EXISTS "esAmortizable"  boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "variacionCuota" numeric(14,2),
  ADD COLUMN IF NOT EXISTS "vehiculoId"     uuid;

CREATE INDEX IF NOT EXISTS finanza_gastos_vehiculo_idx ON finanza_gastos ("vehiculoId");
