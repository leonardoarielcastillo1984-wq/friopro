-- Excepción de frecuencia por activo en MaintenanceComponentRuleAsset.
-- Si está seteada, prevalece sobre la frecuencia general de la regla.
ALTER TABLE maintenance_component_rule_assets
  ADD COLUMN IF NOT EXISTS "frecuenciaKmOverride" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "frecuenciaDiasOverride" INTEGER;
