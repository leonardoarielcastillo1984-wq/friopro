-- Migración aditiva: nombre libre del responsable en tareas Project360
-- Aplicar: docker exec -i sgi-postgres[-testing] psql -U sgi -d sgi < 2026_project360_task_responsiblename.sql
ALTER TABLE "project360_task" ADD COLUMN IF NOT EXISTS "responsibleName" TEXT;
