-- ═══════════════════════════════════════════════════════════════
-- FLOTA 360 — Ejecuciones de mantenimiento preventivo (idempotente)
-- Vinculación explícita tarea↔plan↔ejecución, intervalos km+días,
-- idempotencia, fecha real de ejecución y auditoría de reglas.
-- No borra historial ni inventa vínculos; solo migra lo inequívoco.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. MaintenancePlan: doble intervalo, vínculo a componente, política ──
ALTER TABLE maintenance_plans ADD COLUMN IF NOT EXISTS "frecuenciaDias" INT;
ALTER TABLE maintenance_plans ADD COLUMN IF NOT EXISTS "componentKey" TEXT;
ALTER TABLE maintenance_plans ADD COLUMN IF NOT EXISTS "intervaloModo" TEXT NOT NULL DEFAULT 'DESDE_EJECUCION';
ALTER TABLE maintenance_plans ADD COLUMN IF NOT EXISTS "requiereRevision" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS maintenance_plans_componentkey_idx ON maintenance_plans ("componentKey");

-- ── 2. MaintenancePlanExecution: idempotencia y dato real de ejecución ──
ALTER TABLE maintenance_plan_executions ADD COLUMN IF NOT EXISTS "odometroEjecucion" DOUBLE PRECISION;
ALTER TABLE maintenance_plan_executions ADD COLUMN IF NOT EXISTS "sourceKey" TEXT;
ALTER TABLE maintenance_plan_executions ADD COLUMN IF NOT EXISTS "referenciaAplicada" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE maintenance_plan_executions ADD COLUMN IF NOT EXISTS "registradoPor" UUID;

-- Backfill inequívoco: ejecuciones existentes con OT → clave por OT+plan
-- (soporta el caso futuro de una OT con varias tareas).
UPDATE maintenance_plan_executions
SET "sourceKey" = 'ot:' || "workOrderId"::text || '|' || "planId"::text
WHERE "workOrderId" IS NOT NULL AND "sourceKey" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS maintenance_plan_executions_sourcekey_uidx
  ON maintenance_plan_executions ("sourceKey") WHERE "sourceKey" IS NOT NULL;

-- ── 3. WorkOrder: fecha real de ejecución + clave de idempotencia de creación ──
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "executedAt" TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "creationKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS work_orders_creationkey_uidx
  ON work_orders ("creationKey") WHERE "creationKey" IS NOT NULL;

-- ── 4. Tareas preventivas por OT ──
CREATE TABLE IF NOT EXISTS work_order_tasks (
  "id"          UUID PRIMARY KEY,
  "tenantId"    UUID NOT NULL,
  "workOrderId" UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  "planId"      UUID NOT NULL REFERENCES maintenance_plans(id) ON DELETE CASCADE,
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  "completedAt" TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS work_order_tasks_ot_plan_uidx ON work_order_tasks ("workOrderId", "planId");
CREATE INDEX IF NOT EXISTS work_order_tasks_tenant_idx ON work_order_tasks ("tenantId");
CREATE INDEX IF NOT EXISTS work_order_tasks_ot_idx ON work_order_tasks ("workOrderId");
CREATE INDEX IF NOT EXISTS work_order_tasks_plan_idx ON work_order_tasks ("planId");

-- Backfill inequívoco: OTs existentes con planId → una tarea.
-- Las OTs ya COMPLETED marcan la tarea como COMPLETED (representa la ejecución ya registrada).
INSERT INTO work_order_tasks ("id", "tenantId", "workOrderId", "planId", "status", "completedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid(), w."tenantId", w.id, w."planId",
       CASE WHEN w.status = 'COMPLETED' THEN 'COMPLETED' ELSE 'PENDING' END,
       CASE WHEN w.status = 'COMPLETED' THEN w."completedAt" ELSE NULL END,
       now(), now()
FROM work_orders w
WHERE w."planId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM work_order_tasks t WHERE t."workOrderId" = w.id AND t."planId" = w."planId");

-- ── 5. Reglas de servicio: componentKey + auditoría ──
ALTER TABLE maintenance_component_rules ADD COLUMN IF NOT EXISTS "componentKey" TEXT;

CREATE TABLE IF NOT EXISTS maintenance_component_rule_audits (
  "id"            UUID PRIMARY KEY,
  "tenantId"      UUID NOT NULL,
  "ruleId"        UUID NOT NULL REFERENCES maintenance_component_rules(id) ON DELETE CASCADE,
  "accion"        TEXT NOT NULL,
  "alcance"       TEXT NOT NULL,
  "cambios"       JSONB NOT NULL,
  "planIds"       UUID[] NOT NULL DEFAULT '{}',
  "usuarioId"     UUID,
  "usuarioNombre" TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maintenance_component_rule_audits_tenant_idx ON maintenance_component_rule_audits ("tenantId");
CREATE INDEX IF NOT EXISTS maintenance_component_rule_audits_rule_idx ON maintenance_component_rule_audits ("ruleId");

-- ── 6. Backfill de planes generados por reglas (vínculo inequívoco) ──
-- Recupera la pata de días y el componente que el motor viejo había descartado.
UPDATE maintenance_plans p
SET "frecuenciaDias" = r."frecuenciaDias",
    "componentKey"   = r."componentKey"
FROM maintenance_component_rule_assets a
JOIN maintenance_component_rules r ON r.id = a."ruleId"
WHERE a."generatedPlanId" = p.id
  AND (p."frecuenciaDias" IS DISTINCT FROM r."frecuenciaDias" OR p."componentKey" IS DISTINCT FROM r."componentKey");

-- Planes por km generados desde una regla SIN frecuenciaDias: su
-- frequencyValue quedó poblado con el default 30 → ambiguo → requiere revisión.
UPDATE maintenance_plans p
SET "requiereRevision" = true
FROM maintenance_component_rule_assets a
JOIN maintenance_component_rules r ON r.id = a."ruleId"
WHERE a."generatedPlanId" = p.id
  AND p."frequencyUnit" = 'KM'
  AND r."frecuenciaDias" IS NULL;

-- Planes por km manuales (sin origen en regla): el viejo aplicador pudo haber
-- guardado días en frequencyValue → ambiguo → requiere revisión.
UPDATE maintenance_plans p
SET "requiereRevision" = true
WHERE p."frequencyUnit" = 'KM'
  AND p."frecuenciaDias" IS NULL
  AND NOT EXISTS (SELECT 1 FROM maintenance_component_rule_assets a WHERE a."generatedPlanId" = p.id);

-- ── 7. Historial por OT: deduplicar y hacer único por workOrderId ──
-- Conserva la fila más antigua por OT (no borra historial: solo quita el duplicado exacto).
DELETE FROM vehiculo_historial_mantenimiento h
WHERE h."workOrderId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM vehiculo_historial_mantenimiento h2
    WHERE h2."workOrderId" = h."workOrderId" AND h2.id < h.id
  );

CREATE UNIQUE INDEX IF NOT EXISTS vehiculo_historial_mantenimiento_ot_uidx
  ON vehiculo_historial_mantenimiento ("workOrderId") WHERE "workOrderId" IS NOT NULL;
