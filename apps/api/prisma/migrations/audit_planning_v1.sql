-- Migration: audit_planning_v1
-- Adds planning/coordination fields to audits table
-- Creates audit_agenda_items and audit_change_logs tables
-- ALL CHANGES ARE ADDITIVE — no existing data is modified

-- ───────────────────────────────────────────────
-- 1. New columns on audits
-- ───────────────────────────────────────────────
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS plannedstarttime         TEXT,
  ADD COLUMN IF NOT EXISTS plannedendtime           TEXT,
  ADD COLUMN IF NOT EXISTS modality                 TEXT,
  ADD COLUMN IF NOT EXISTS auditlocation            TEXT,
  ADD COLUMN IF NOT EXISTS locationaddress          TEXT,
  ADD COLUMN IF NOT EXISTS virtualmeetinglink       TEXT,
  ADD COLUMN IF NOT EXISTS auditedprocessowner      TEXT,
  ADD COLUMN IF NOT EXISTS auditedprocessowneremail TEXT,
  ADD COLUMN IF NOT EXISTS expectedparticipants     TEXT,
  ADD COLUMN IF NOT EXISTS additionalauditteam      TEXT,
  ADD COLUMN IF NOT EXISTS logisticobservations     TEXT,
  ADD COLUMN IF NOT EXISTS specialinstructions      TEXT,
  ADD COLUMN IF NOT EXISTS requiresopeningmeeting   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS requiresclosingmeeting   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notificationstatus       TEXT,
  ADD COLUMN IF NOT EXISTS cancelledat              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelreason             TEXT,
  ADD COLUMN IF NOT EXISTS reschedulecount          INTEGER NOT NULL DEFAULT 0;

-- ───────────────────────────────────────────────
-- 2. audit_agenda_items
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_agenda_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"             UUID NOT NULL,
  "auditId"              UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  "order"                INTEGER NOT NULL DEFAULT 0,
  "itemDate"             TEXT,
  "startTime"            TEXT,
  "endTime"              TEXT,
  "durationMinutes"      INTEGER,
  activity               TEXT NOT NULL,
  processoortopic        TEXT,
  criterion              TEXT,
  responsibleauditorid   UUID,
  requiredparticipants   TEXT,
  location               TEXT,
  expectedevidence       TEXT,
  observations           TEXT,
  createdbyid            UUID NOT NULL,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt"            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audit_agenda_items_tenant  ON audit_agenda_items("tenantId");
CREATE INDEX IF NOT EXISTS idx_audit_agenda_items_audit   ON audit_agenda_items("auditId");

-- ───────────────────────────────────────────────
-- 3. audit_change_logs
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_change_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   UUID NOT NULL,
  "auditId"    UUID NOT NULL,
  action       TEXT NOT NULL,
  fieldchanged TEXT,
  oldvalue     TEXT,
  newvalue     TEXT,
  reason       TEXT,
  userid       UUID NOT NULL,
  username     TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_change_logs_tenant ON audit_change_logs("tenantId");
CREATE INDEX IF NOT EXISTS idx_audit_change_logs_audit  ON audit_change_logs("auditId");
