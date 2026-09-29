-- 2026_risk_nature_opportunities.sql
-- Gestión separada de oportunidades en el módulo de riesgos (ISO 9001:2015 cl. 6.1).
-- 1) Columna nature en risks: RISK (default, retrocompatible) | OPPORTUNITY.
-- 2) Nuevos valores en enum RiskStrategy para estrategias de oportunidad.
-- Migración aditiva e idempotente.

ALTER TABLE "Risk" ADD COLUMN IF NOT EXISTS "nature" TEXT NOT NULL DEFAULT 'RISK';

CREATE INDEX IF NOT EXISTS "Risk_nature_idx" ON "Risk" ("nature");

ALTER TYPE "RiskStrategy" ADD VALUE IF NOT EXISTS 'EXPLOTAR';
ALTER TYPE "RiskStrategy" ADD VALUE IF NOT EXISTS 'POTENCIAR';
ALTER TYPE "RiskStrategy" ADD VALUE IF NOT EXISTS 'COMPARTIR';
