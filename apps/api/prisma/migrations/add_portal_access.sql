-- Migration: add_portal_access
-- Creates tables for external portal access management

-- Enums
DO $$ BEGIN
  CREATE TYPE "PortalAccessStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'APPLIED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- portal_access_tokens
CREATE TABLE IF NOT EXISTS "portal_access_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenPrefix" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "recipientPhone" TEXT,
  "sector" TEXT,
  "area" TEXT,
  "process" TEXT,
  "executorId" UUID,
  "canEdit" BOOLEAN NOT NULL DEFAULT true,
  "canEditFields" JSONB NOT NULL DEFAULT '[]',
  "canAttachEvidence" BOOLEAN NOT NULL DEFAULT true,
  "canDownloadPdf" BOOLEAN NOT NULL DEFAULT true,
  "canChangeStatus" BOOLEAN NOT NULL DEFAULT false,
  "status" "PortalAccessStatus" NOT NULL DEFAULT 'ACTIVE',
  "maxAccesses" INTEGER,
  "accessCount" INTEGER NOT NULL DEFAULT 0,
  "lastAccessAt" TIMESTAMPTZ,
  "expiresAt" TIMESTAMPTZ,
  "notes" TEXT,
  "createdById" UUID,
  "revokedById" UUID,
  "revokedAt" TIMESTAMPTZ,
  "revokeReason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "portal_access_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "portal_access_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "portal_access_tokens_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "PlatformUser"("id") ON DELETE SET NULL,
  CONSTRAINT "portal_access_tokens_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "PlatformUser"("id") ON DELETE SET NULL,
  CONSTRAINT "portal_access_tokens_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL,
  CONSTRAINT "portal_access_tokens_tokenHash_key" UNIQUE ("tokenHash")
);

CREATE INDEX IF NOT EXISTS "portal_access_tokens_tenantId_idx" ON "portal_access_tokens"("tenantId");
CREATE INDEX IF NOT EXISTS "portal_access_tokens_tokenHash_idx" ON "portal_access_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "portal_access_tokens_tokenPrefix_idx" ON "portal_access_tokens"("tokenPrefix");

-- portal_access_logs
CREATE TABLE IF NOT EXISTS "portal_access_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "accessTokenId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "actionPlanId" UUID,
  "field" TEXT,
  "oldValue" TEXT,
  "newValue" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "portal_access_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "portal_access_logs_accessTokenId_fkey" FOREIGN KEY ("accessTokenId") REFERENCES "portal_access_tokens"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "portal_access_logs_accessTokenId_idx" ON "portal_access_logs"("accessTokenId");
CREATE INDEX IF NOT EXISTS "portal_access_logs_actionPlanId_idx" ON "portal_access_logs"("actionPlanId");

-- portal_draft_snapshots
CREATE TABLE IF NOT EXISTS "portal_draft_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "accessTokenId" UUID NOT NULL,
  "actionPlanId" UUID NOT NULL,
  "draftData" JSONB NOT NULL,
  "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMPTZ,
  "reviewedAt" TIMESTAMPTZ,
  "reviewedById" UUID,
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "portal_draft_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "portal_draft_snapshots_accessTokenId_fkey" FOREIGN KEY ("accessTokenId") REFERENCES "portal_access_tokens"("id") ON DELETE CASCADE,
  CONSTRAINT "portal_draft_snapshots_actionPlanId_fkey" FOREIGN KEY ("actionPlanId") REFERENCES "action_plans"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "portal_draft_snapshots_accessTokenId_idx" ON "portal_draft_snapshots"("accessTokenId");
CREATE INDEX IF NOT EXISTS "portal_draft_snapshots_actionPlanId_idx" ON "portal_draft_snapshots"("actionPlanId");
