-- IATF 16949 §10.2.3 — Extensión sistémica de la no conformidad.
-- Cuando se detecta una NC hay obligación de verificar si se repite
-- en otros procesos/departamentos y dejar evidencia del análisis.
--
-- systemicCheck: PENDING | DONE | NOT_REQUIRED
-- systemicCheckResult: texto libre con el análisis (dónde se verificó, qué se encontró)

ALTER TABLE "action_plans"
  ADD COLUMN IF NOT EXISTS "systemicCheck" TEXT NOT NULL DEFAULT 'PENDING';

ALTER TABLE "action_plans"
  ADD COLUMN IF NOT EXISTS "systemicCheckResult" TEXT;
