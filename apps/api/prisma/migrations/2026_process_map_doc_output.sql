-- Migration: Add entityRef column to document_output_definitions
-- Allows linking a DocumentOutputDefinition to a specific entity (e.g., ProcessMap.id)
-- Idempotent: safe to run multiple times

DO $$
BEGIN
  -- Add entityRef column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_output_definitions'
      AND column_name = 'entity_ref'
  ) THEN
    ALTER TABLE "document_output_definitions"
      ADD COLUMN "entity_ref" UUID;
  END IF;

  -- Add index on [tenantId, entityRef] if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'document_output_definitions_tenant_id_entity_ref_idx'
  ) THEN
    CREATE INDEX "document_output_definitions_tenant_id_entity_ref_idx"
      ON "document_output_definitions" ("tenant_id", "entity_ref");
  END IF;
END $$;
