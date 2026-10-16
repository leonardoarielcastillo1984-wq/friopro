-- MarketingLead: leads públicos capturados desde landings (lead magnets)
CREATE TABLE IF NOT EXISTS marketing_leads (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"       TEXT NOT NULL,
  "nombre"      TEXT,
  "empresa"     TEXT,
  "telefono"    TEXT,
  "source"      TEXT NOT NULL,
  "meta"        JSONB,
  "ip"          TEXT,
  "utmSource"   TEXT,
  "utmMedium"   TEXT,
  "utmCampaign" TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_leads_email_idx   ON marketing_leads ("email");
CREATE INDEX IF NOT EXISTS marketing_leads_source_idx  ON marketing_leads ("source");
CREATE INDEX IF NOT EXISTS marketing_leads_created_idx ON marketing_leads ("createdAt");
