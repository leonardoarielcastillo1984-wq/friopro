-- Growth engine: eventos de funnel + programa de referidos + nurture de leads
-- Aplicar: docker exec -i sgi-postgres psql -U sgi -d sgi < growth_engine.sql

ALTER TABLE "marketing_leads"
  ADD COLUMN IF NOT EXISTS "nurtureStep" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastNurturedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "unsubscribedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "consentedAt" TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS "marketing_leads_nurtureStep_idx" ON "marketing_leads"("nurtureStep");

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_referralCode_key" ON "Tenant"("referralCode") WHERE "referralCode" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "growth_events" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "event"      TEXT NOT NULL,
  "page"       TEXT,
  "meta"       JSONB,
  "ip"         TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "growth_events_event_idx" ON "growth_events"("event");
CREATE INDEX IF NOT EXISTS "growth_events_page_idx" ON "growth_events"("page");
CREATE INDEX IF NOT EXISTS "growth_events_createdAt_idx" ON "growth_events"("createdAt");

CREATE TABLE IF NOT EXISTS "referrals" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"          TEXT NOT NULL,
  "referrerId"    UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "referredId"    UUID,
  "referredEmail" TEXT,
  "status"        TEXT NOT NULL DEFAULT 'CLICKED',
  "rewardDays"    INTEGER NOT NULL DEFAULT 30,
  "rewardedAt"    TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "referrals_code_idx" ON "referrals"("code");
CREATE INDEX IF NOT EXISTS "referrals_referrerId_idx" ON "referrals"("referrerId");
CREATE INDEX IF NOT EXISTS "referrals_status_idx" ON "referrals"("status");
