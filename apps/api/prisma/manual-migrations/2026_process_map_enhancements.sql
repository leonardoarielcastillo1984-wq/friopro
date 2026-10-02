-- Migración manual idempotente — Mapa General de Procesos (IATF 16949)
-- Aplicar en cada entorno antes del deploy del código:
--   docker exec -i sgi-postgres psql -U sgi -d sgi < 2026_process_map_enhancements.sql
--   docker exec -i sgi-postgres-testing psql -U sgi -d sgi < 2026_process_map_enhancements.sql
--
-- Cambios:
--   1) process_maps: order (secuencia operativa) + campos de control documental
--   2) processes: controls (controles y reacción ante desvíos)
--   3) process_interactions: interacciones etiquetadas entre procesos (persisten las
--      flechas del mapa general con origen/destino/sedes/qué se transfiere)
--   4) outsourced_processes: sección configurable de procesos externalizados

BEGIN;

-- 1) process_maps ──────────────────────────────────────────────────────────
ALTER TABLE process_maps ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE process_maps ADD COLUMN IF NOT EXISTS "docCode" TEXT;
ALTER TABLE process_maps ADD COLUMN IF NOT EXISTS "docVersion" TEXT;
ALTER TABLE process_maps ADD COLUMN IF NOT EXISTS "docStatus" TEXT;
ALTER TABLE process_maps ADD COLUMN IF NOT EXISTS "docApprovedBy" TEXT;
ALTER TABLE process_maps ADD COLUMN IF NOT EXISTS "docReviewDate" TIMESTAMPTZ;

-- 2) processes ─────────────────────────────────────────────────────────────
ALTER TABLE processes ADD COLUMN IF NOT EXISTS "controls" TEXT;

-- 3) process_interactions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS process_interactions (
  "id"        UUID PRIMARY KEY,
  "tenantId"  UUID NOT NULL,
  "fromId"    UUID NOT NULL,
  "toId"      UUID NOT NULL,
  "label"     TEXT,
  "fromSite"  TEXT,
  "toSite"    TEXT,
  "notes"     TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS process_interactions_tenantId_idx ON process_interactions ("tenantId");
CREATE INDEX IF NOT EXISTS process_interactions_fromId_idx   ON process_interactions ("fromId");
CREATE INDEX IF NOT EXISTS process_interactions_toId_idx     ON process_interactions ("toId");

-- 4) outsourced_processes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outsourced_processes (
  "id"        UUID PRIMARY KEY,
  "tenantId"  UUID NOT NULL,
  "name"      TEXT NOT NULL,
  "supplier"  TEXT,
  "scope"     TEXT,
  "control"   TEXT,
  "order"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS outsourced_processes_tenantId_idx ON outsourced_processes ("tenantId");

COMMIT;
