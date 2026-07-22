-- Migration: add systemModuleUrl to Document table
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "systemModuleUrl" TEXT;
