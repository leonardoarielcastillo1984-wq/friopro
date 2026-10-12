-- Centro de Control Empresarial — configuración del campus 3D por tenant.
-- 100% aditivo: columna JSON nullable en company_settings.
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS "centroEmpresaConfig" JSONB;
