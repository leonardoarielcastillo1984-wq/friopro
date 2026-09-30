-- Presupuesto mensual por unidad (Flota 360).
-- Permite asignar un tope de gasto mensual a cada camión/semi y
-- compararlo contra el gasto real del período. Aditivo e idempotente.

ALTER TABLE flota_vehiculos
  ADD COLUMN IF NOT EXISTS "presupuestoMensual" DOUBLE PRECISION;
