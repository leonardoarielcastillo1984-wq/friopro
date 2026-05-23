-- Migration: Project360 Pro Features
-- Fecha: 2025-08-19

-- ═══════════════════════════════════════════════════════════════
-- 1. Nuevos campos en Project360
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE "project360"
ADD COLUMN IF NOT EXISTS "budget" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "budgetCurrency" TEXT NOT NULL DEFAULT 'ARS',
ADD COLUMN IF NOT EXISTS "actualCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "licitationMode" TEXT,
ADD COLUMN IF NOT EXISTS "aiAnalysisId" UUID,
ADD COLUMN IF NOT EXISTS "templateId" UUID;

-- ═══════════════════════════════════════════════════════════════
-- 2. Nuevos campos en Project360Task
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE "project360_task"
ADD COLUMN IF NOT EXISTS "estimatedHours" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "actualHours" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "dependencies" JSONB NOT NULL DEFAULT '[]';

-- ═══════════════════════════════════════════════════════════════
-- 3. Nuevas tablas
-- ═══════════════════════════════════════════════════════════════

-- Project360Template
CREATE TABLE IF NOT EXISTS "project360_templates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "defaultTasks" JSONB NOT NULL DEFAULT '[]',
  "defaultBudgetItems" JSONB NOT NULL DEFAULT '[]',
  "defaultMilestones" JSONB NOT NULL DEFAULT '[]',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "project360_templates_tenantId_idx" ON "project360_templates"("tenantId");
CREATE INDEX IF NOT EXISTS "project360_templates_category_idx" ON "project360_templates"("category");

-- Project360BudgetItem
CREATE TABLE IF NOT EXISTS "project360_budget_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'MATERIAL',
  "estimated" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "actual" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "isExpense" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "project360_budget_items_tenantId_idx" ON "project360_budget_items"("tenantId");
CREATE INDEX IF NOT EXISTS "project360_budget_items_projectId_idx" ON "project360_budget_items"("projectId");

-- Project360Milestone
CREATE TABLE IF NOT EXISTS "project360_milestones" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "targetDate" TIMESTAMPTZ NOT NULL,
  "completedAt" TIMESTAMPTZ,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "project360_milestones_tenantId_idx" ON "project360_milestones"("tenantId");
CREATE INDEX IF NOT EXISTS "project360_milestones_projectId_idx" ON "project360_milestones"("projectId");

-- Project360AIAnalysis
CREATE TABLE IF NOT EXISTS "project360_ai_analyses" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "documentName" TEXT NOT NULL,
  "documentUrl" TEXT NOT NULL DEFAULT '',
  "analysisType" TEXT NOT NULL DEFAULT 'LICITACION',
  "summary" TEXT,
  "requirements" JSONB,
  "risks" JSONB,
  "timeline" TEXT,
  "costs" TEXT,
  "compliance" JSONB,
  "score" DOUBLE PRECISION,
  "extractedBrief" TEXT,
  "rawAnalysis" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "project360_ai_analyses_tenantId_idx" ON "project360_ai_analyses"("tenantId");
CREATE INDEX IF NOT EXISTS "project360_ai_analyses_projectId_idx" ON "project360_ai_analyses"("projectId");
