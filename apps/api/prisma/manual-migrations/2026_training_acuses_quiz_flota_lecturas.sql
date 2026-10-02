-- Migración manual: acuses de lectura + evaluaciones por mail en Capacitaciones
-- y acuse de lectura de documentos del chofer en Flota360 (Oct 2026).
-- Idempotente — aplicar en cada BD antes del deploy (sgi-postgres / sgi-postgres-testing).
--
-- "SgiTraining":
--   · quizQuestions (JSONB)  — preguntas custom del quiz; null = set por defecto
--   · quizMinScore           — % mínimo de aprobación (default 70)
-- "SgiTrainingAttendee":
--   · materialToken/materialSentAt/materialReadAt — envío de material + acuse de lectura
--   · quizToken/quizSentAt/quizAnswers            — evaluación enviada por mail
-- flota_documento_lecturas (nueva):
--   · acuse de lectura por documento + chofer desde el hub QR

BEGIN;

ALTER TABLE "SgiTraining" ADD COLUMN IF NOT EXISTS "quizQuestions" JSONB;
ALTER TABLE "SgiTraining" ADD COLUMN IF NOT EXISTS "quizMinScore" INTEGER NOT NULL DEFAULT 70;

ALTER TABLE "SgiTrainingAttendee" ADD COLUMN IF NOT EXISTS "materialToken" TEXT;
ALTER TABLE "SgiTrainingAttendee" ADD COLUMN IF NOT EXISTS "materialSentAt" TIMESTAMPTZ(3);
ALTER TABLE "SgiTrainingAttendee" ADD COLUMN IF NOT EXISTS "materialReadAt" TIMESTAMPTZ(3);
ALTER TABLE "SgiTrainingAttendee" ADD COLUMN IF NOT EXISTS "quizToken" TEXT;
ALTER TABLE "SgiTrainingAttendee" ADD COLUMN IF NOT EXISTS "quizSentAt" TIMESTAMPTZ(3);
ALTER TABLE "SgiTrainingAttendee" ADD COLUMN IF NOT EXISTS "quizAnswers" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "SgiTrainingAttendee_materialToken_key" ON "SgiTrainingAttendee"("materialToken");
CREATE UNIQUE INDEX IF NOT EXISTS "SgiTrainingAttendee_quizToken_key" ON "SgiTrainingAttendee"("quizToken");

CREATE TABLE IF NOT EXISTS flota_documento_lecturas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"       UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "documentoId"    UUID NOT NULL REFERENCES flota_documentos(id) ON DELETE CASCADE,
  "vehiculoId"     UUID,
  "conductorId"    UUID,
  "conductorNombre" TEXT NOT NULL,
  "viewedAt"       TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flota_documento_lecturas_tenant_idx ON flota_documento_lecturas("tenantId");
CREATE INDEX IF NOT EXISTS flota_documento_lecturas_documento_idx ON flota_documento_lecturas("documentoId");
CREATE INDEX IF NOT EXISTS flota_documento_lecturas_conductor_idx ON flota_documento_lecturas("conductorId");

COMMIT;
