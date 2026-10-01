-- 2026 — Buzón de sugerencias al desarrollador (ícono 💡 en la app)
CREATE TABLE IF NOT EXISTS feedback_sugerencias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"      UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL,
  mensaje         TEXT NOT NULL,
  pagina          TEXT,
  "usuarioId"     UUID,
  "usuarioNombre" TEXT,
  "usuarioEmail"  TEXT,
  leido           BOOLEAN NOT NULL DEFAULT FALSE,
  respondida      BOOLEAN NOT NULL DEFAULT FALSE,
  "notasDev"      TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_sugerencias_tenant_idx  ON feedback_sugerencias ("tenantId");
CREATE INDEX IF NOT EXISTS feedback_sugerencias_fecha_idx   ON feedback_sugerencias ("createdAt");
