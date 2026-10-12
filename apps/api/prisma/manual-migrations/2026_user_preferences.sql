-- Preferencias de UI por usuario (plantilla del Centro Empresarial, etc.)
-- 100% aditivo: columna JSON nullable en users.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferences" JSONB;
