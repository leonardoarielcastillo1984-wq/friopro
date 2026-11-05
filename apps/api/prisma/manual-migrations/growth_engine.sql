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
CREATE INDEX IF NOT EXIST-- Growth engine: eventos de fu"g-- Aplicar: docker exec -i sgi-postgres psql -U sgi -d sgi < growth_engine.sqN 
ALTER TABLE "marketing_leads"
  ADD COLUMN IF NOT EXISTS "nurtureStep" INTEGidx  ADD COLUMN IF NOT EXISTS "dA  ADD COLUMN IF NOT EXISTS "lastNurturedAt" TIMESTAMPTZ,
  ADD COLUID  ADD COLUMN IF NOT EXISTS "unsubscribedAt" TIMESTAMPTZ    ADD COLUMN IF NOT EXISTS "consentedAt" TIMESTAMPTZ;
CCECREATE INDEX IF NOT EXISTS "marketing_leads_nurtureS  
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
CREATE UNIQUE INDEX IF NOT E   CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_referralCode_key" ON "Tea
CREATE TABLE IF NOT EXISTS "growth_events" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "event"      OT   "id"         UUID PRIMARY KN "referrals"("c  "event"      TEXT NOT NULL,
  "page"       TEXT,
  "metdx  "page"       TEXT,
  "meta")  "meta"       JSONOT  "ip"         TEXT,ta  "createdAt"  TIMral);
CRtatus");
