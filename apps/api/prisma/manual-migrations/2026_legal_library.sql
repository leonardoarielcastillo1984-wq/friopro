-- Biblioteca legal compartida multi-país (sin tenantId)
-- Normas SST/ambientales/otras que se sugieren a cada tenant según su país
-- y se importan a su registro de legal_requirements.

CREATE TABLE IF NOT EXISTS legal_library (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country              TEXT NOT NULL,                 -- AR | CL | ALL (transversal)
  framework            TEXT NOT NULL,                 -- ENVIRONMENTAL | OHAS | QUALITY | OTHER
  jurisdiction         TEXT,
  source               TEXT NOT NULL,
  article              TEXT,
  title                TEXT NOT NULL,
  description          TEXT,
  "appliesTo"          TEXT,
  "enforcingAuthority" TEXT,
  "sourceUrl"          TEXT,
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "createdAt"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_library_country_idx   ON legal_library (country);
CREATE INDEX IF NOT EXISTS legal_library_framework_idx ON legal_library (framework);
CREATE INDEX IF NOT EXISTS legal_library_isActive_idx  ON legal_library ("isActive");
