-- Resultados del Negocio: moneda por defecto por empresa (null = moneda local del país)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "monedaResultados" TEXT;
