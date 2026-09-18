-- Migración aditiva e idempotente: separación de técnicos por scope
-- INFRA = técnicos de Infraestructura (default, comportamiento previo)
-- FLEET = mecánicos de Flota 360

ALTER TABLE maintenance_technicians
  ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'INFRA';

-- Columna que el schema Prisma ya declaraba pero nunca se migró a la BD
-- (sin ella, el Prisma Client nuevo rompe TODAS las queries de técnicos)
ALTER TABLE maintenance_technicians
  ADD COLUMN IF NOT EXISTS "dailyCapacityHours" DOUBLE PRECISION NOT NULL DEFAULT 8;

-- Reasignar mecánicos conocidos de Flota 360 a scope FLEET
UPDATE maintenance_technicians
  SET "scope" = 'FLEET'
  WHERE lower("name") LIKE '%adrian%goncalves%'
     OR lower("name") LIKE '%adrian goncalves%';
