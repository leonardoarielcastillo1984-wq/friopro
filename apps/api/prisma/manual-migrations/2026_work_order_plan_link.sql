-- Migración aditiva e idempotente: vincular Órdenes de Trabajo a su Plan de mantenimiento origen

ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "planId" UUID
  REFERENCES "maintenance_plans"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "work_orders_planId_idx" ON "work_orders" ("planId");
