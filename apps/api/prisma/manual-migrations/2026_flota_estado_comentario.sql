-- Comentario del estado vigente de la unidad (Flota 360).
-- Ej.: "estacionada porque no hay chofer", "en taller por embrague".
-- Aditivo e idempotente.

ALTER TABLE flota_vehiculos
  ADD COLUMN IF NOT EXISTS "estadoComentario"    TEXT,
  ADD COLUMN IF NOT EXISTS "estadoComentarioAt"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "estadoComentarioPor" TEXT;
