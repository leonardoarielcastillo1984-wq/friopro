-- ============================================================
-- Gestión de Cambios Enterprise (ISO 9001:2015 §6.3)
-- Migración ADITIVA e IDEMPOTENTE. No altera datos existentes.
-- Todas las columnas nuevas son nullable o con DEFAULT.
-- El registro GC-0001 y los cambios existentes permanecen intactos.
-- ============================================================

-- 1) Columnas nuevas en gestion_cambio (evaluación multidimensional, nivel global,
--    planificación, flags, proyecto vinculado, cierre controlado)
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "impactoOperativo"     TEXT;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "impactoTecnologico"   TEXT;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "impactoLegal"         TEXT;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "impactoContinuidad"   TEXT;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "nivelGlobal"          TEXT;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "requiereComunicacion" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "objetivoCambio"       TEXT;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "alcance"              TEXT;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "fechaInicioPrevista"  TIMESTAMPTZ;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "responsableGeneralId" UUID;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "planComunicacion"     TEXT;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "planCapacitacion"     TEXT;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "planContingencia"     TEXT;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "criteriosAceptacion"  TEXT;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "condicionesPrevias"   TEXT;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "requiereProyecto"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "projectId"            UUID;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "cierreComentario"     TEXT;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "cerradoPor"           UUID;

-- 2) Evaluación multidimensional detallada (una fila por dimensión)
CREATE TABLE IF NOT EXISTS "gestion_cambio_evaluacion" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cambioId"        UUID NOT NULL,
  "tenantId"        UUID NOT NULL,
  "dimension"       TEXT NOT NULL,
  "nivel"           TEXT NOT NULL,
  "justificacion"   TEXT,
  "responsableId"   UUID,
  "fechaEvaluacion" TIMESTAMPTZ,
  "evidencia"       TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "gestion_cambio_evaluacion_cambioId_fkey" FOREIGN KEY ("cambioId")
    REFERENCES "gestion_cambio"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "gestion_cambio_evaluacion_cambioId_dimension_key" ON "gestion_cambio_evaluacion" ("cambioId", "dimension");
CREATE INDEX IF NOT EXISTS "gestion_cambio_evaluacion_tenantId_idx" ON "gestion_cambio_evaluacion" ("tenantId");

-- 3) Procesos/áreas afectadas
CREATE TABLE IF NOT EXISTS "gestion_cambio_proceso" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cambioId"    UUID NOT NULL,
  "tenantId"    UUID NOT NULL,
  "processId"   UUID,
  "processName" TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "gestion_cambio_proceso_cambioId_fkey" FOREIGN KEY ("cambioId")
    REFERENCES "gestion_cambio"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "gestion_cambio_proceso_tenantId_idx" ON "gestion_cambio_proceso" ("tenantId");
CREATE INDEX IF NOT EXISTS "gestion_cambio_proceso_cambioId_idx" ON "gestion_cambio_proceso" ("cambioId");

-- 4) Partes interesadas afectadas
CREATE TABLE IF NOT EXISTS "gestion_cambio_parte" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cambioId"        UUID NOT NULL,
  "tenantId"        UUID NOT NULL,
  "stakeholderId"   UUID,
  "stakeholderName" TEXT NOT NULL,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "gestion_cambio_parte_cambioId_fkey" FOREIGN KEY ("cambioId")
    REFERENCES "gestion_cambio"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "gestion_cambio_parte_tenantId_idx" ON "gestion_cambio_parte" ("tenantId");
CREATE INDEX IF NOT EXISTS "gestion_cambio_parte_cambioId_idx" ON "gestion_cambio_parte" ("cambioId");

-- 5) Riesgos vinculados (relación al módulo oficial de riesgos)
CREATE TABLE IF NOT EXISTS "gestion_cambio_riesgo" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cambioId"  UUID NOT NULL,
  "tenantId"  UUID NOT NULL,
  "riskId"    UUID,
  "riskType"  TEXT NOT NULL DEFAULT 'RISK',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "gestion_cambio_riesgo_cambioId_fkey" FOREIGN KEY ("cambioId")
    REFERENCES "gestion_cambio"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "gestion_cambio_riesgo_tenantId_idx" ON "gestion_cambio_riesgo" ("tenantId");
CREATE INDEX IF NOT EXISTS "gestion_cambio_riesgo_cambioId_idx" ON "gestion_cambio_riesgo" ("cambioId");

-- 6) Documentos vinculados + estado frente al cambio
CREATE TABLE IF NOT EXISTS "gestion_cambio_documento" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cambioId"     UUID NOT NULL,
  "tenantId"     UUID NOT NULL,
  "documentId"   UUID,
  "estadoFrente" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "gestion_cambio_documento_cambioId_fkey" FOREIGN KEY ("cambioId")
    REFERENCES "gestion_cambio"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "gestion_cambio_documento_tenantId_idx" ON "gestion_cambio_documento" ("tenantId");
CREATE INDEX IF NOT EXISTS "gestion_cambio_documento_cambioId_idx" ON "gestion_cambio_documento" ("cambioId");

-- 7) Evidencias del cambio
CREATE TABLE IF NOT EXISTS "gestion_cambio_evidencia" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cambioId"          UUID NOT NULL,
  "tenantId"          UUID NOT NULL,
  "titulo"            TEXT NOT NULL,
  "descripcion"       TEXT,
  "tipo"              TEXT NOT NULL DEFAULT 'OTRO',
  "fecha"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "fileUrl"           TEXT,
  "fileName"          TEXT,
  "areaProceso"       TEXT,
  "registradoPor"     UUID,
  "registradoPorName" TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "gestion_cambio_evidencia_cambioId_fkey" FOREIGN KEY ("cambioId")
    REFERENCES "gestion_cambio"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "gestion_cambio_evidencia_tenantId_idx" ON "gestion_cambio_evidencia" ("tenantId");
CREATE INDEX IF NOT EXISTS "gestion_cambio_evidencia_cambioId_idx" ON "gestion_cambio_evidencia" ("cambioId");

-- 8) Verificación de eficacia
CREATE TABLE IF NOT EXISTS "gestion_cambio_verificacion" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cambioId"          UUID NOT NULL,
  "tenantId"          UUID NOT NULL,
  "fechaPrevista"     TIMESTAMPTZ,
  "fechaReal"         TIMESTAMPTZ,
  "responsableId"     UUID,
  "metodo"            TEXT,
  "criteriosEficacia" TEXT,
  "resultado"         TEXT,
  "observaciones"     TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "gestion_cambio_verificacion_cambioId_fkey" FOREIGN KEY ("cambioId")
    REFERENCES "gestion_cambio"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "gestion_cambio_verificacion_tenantId_idx" ON "gestion_cambio_verificacion" ("tenantId");
CREATE INDEX IF NOT EXISTS "gestion_cambio_verificacion_cambioId_idx" ON "gestion_cambio_verificacion" ("cambioId");
