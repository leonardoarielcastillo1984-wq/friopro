-- Add RRHH configuration JSON fields to company_settings
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "hrPositionCategories" JSONB;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "hrContractTypes" JSONB;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "hrTrainingCategories" JSONB;
