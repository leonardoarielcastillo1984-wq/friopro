-- Vincula un Plan de Acción al desvío que lo originó (centro-empresa "Atención hoy").
-- Clave estable: fin:{tipo} para alertas financieras, dept:{key}:{slug} para alertas por depto.
-- Idempotente — segura de correr en cualquier BD.
ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;
CREATE INDEX IF NOT EXISTS action_plans_sourceRef_idx ON action_plans ("sourceRef");
