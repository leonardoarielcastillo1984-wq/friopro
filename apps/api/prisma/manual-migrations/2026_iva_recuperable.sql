-- IVA recuperable (crédito fiscal) — evidencia de recupero del IVA en costos.
-- false = el IVA no se recupera y pasa a formar parte del costo real.
-- Idempotente: safe para re-ejecutar.

ALTER TABLE finanza_gastos
  ADD COLUMN IF NOT EXISTS "ivaRecuperable" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE flota_facturas
  ADD COLUMN IF NOT EXISTS "ivaRecuperable" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE flota_combustible
  ADD COLUMN IF NOT EXISTS "iva" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "ivaUrea" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "ivaRecuperable" BOOLEAN NOT NULL DEFAULT true;
