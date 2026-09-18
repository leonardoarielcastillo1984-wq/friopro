-- Migración aditiva e idempotente: separación de técnicos por scope
-- INFRA = técnicos de Infraestructura (default, comportamiento previo)
-- FLEET = mecánicos de Flota 360

ALTER TABLE maintenance_technicians
  ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'INFRA';

-- Reasignar mecánicos conocidos de Flota 360 a scope FLEET
UPDATE maintenance_technicians
  SET "scope" = 'FLEET'
  WHERE lower("name") LIKE '%adrian%goncalves%'
     OR lower("name") LIKE '%adrian goncalves%';
