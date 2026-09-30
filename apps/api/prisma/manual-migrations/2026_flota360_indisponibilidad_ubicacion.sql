-- ═══════════════════════════════════════════════════════════════
-- FLOTA 360 — Episodios de indisponibilidad + etapas, ubicación
-- declarada y WorkOrder.retiraDeServicio.
-- Idempotente: seguro de re-ejecutar (IF NOT EXISTS en todo).
-- Datos: la conversión eventos→episodios la hace
-- src/scripts/migrarIndisponibilidades.ts (idempotente por unidad).
-- ═══════════════════════════════════════════════════════════════

-- Ubicación declarada actual de la unidad (espejo del último evento)
ALTER TABLE "flota_vehiculos"
  ADD COLUMN IF NOT EXISTS "ubicacionTipo"    TEXT,
  ADD COLUMN IF NOT EXISTS "ubicacionDetalle" TEXT,
  ADD COLUMN IF NOT EXISTS "ubicacionDesde"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "ubicacionPor"     TEXT;

-- La OT retira la unidad del servicio al entrar en proceso
ALTER TABLE "work_orders"
  ADD COLUMN IF NOT EXISTS "retiraDeServicio" BOOLEAN NOT NULL DEFAULT FALSE;

-- Episodios de indisponibilidad (un episodio ABIERTA = unidad retirada)
CREATE TABLE IF NOT EXISTS "flota_unidad_indisponibilidades" (
  "id"                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"                    UUID NOT NULL,
  "vehiculoId"                  UUID NOT NULL,
  "inicioAt"                    TIMESTAMPTZ NOT NULL,
  "finAt"                       TIMESTAMPTZ,
  "estado"                      TEXT NOT NULL DEFAULT 'ABIERTA',
  "origen"                      TEXT NOT NULL DEFAULT 'MANUAL',
  "motivo"                      TEXT,
  "workOrderIds"                TEXT[] NOT NULL DEFAULT '{}',
  "tallerTipo"                  TEXT,
  "tallerId"                    UUID,
  "tallerNombre"                TEXT,
  "fechaIngresoTaller"          TIMESTAMPTZ,
  "fechaSalidaTaller"           TIMESTAMPTZ,
  "fechaDevolucionEstimada"     TIMESTAMPTZ,
  "responsableSeguimientoNombre" TEXT,
  "observaciones"               TEXT,
  "ambiguo"                     BOOLEAN NOT NULL DEFAULT FALSE,
  "cerradaPorNombre"            TEXT,
  "cierreMotivo"                TEXT,
  "createdAt"                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "fk_uind_tenant"   FOREIGN KEY ("tenantId")   REFERENCES "Tenant"("id")            ON DELETE CASCADE,
  CONSTRAINT "fk_uind_vehiculo" FOREIGN KEY ("vehiculoId") REFERENCES "flota_vehiculos"("id")   ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_uind_tenant_vehiculo" ON "flota_unidad_indisponibilidades"("tenantId", "vehiculoId");
CREATE INDEX IF NOT EXISTS "idx_uind_tenant_estado"   ON "flota_unidad_indisponibilidades"("tenantId", "estado");

-- Etapas/motivos dentro del episodio (append-only)
CREATE TABLE IF NOT EXISTS "flota_unidad_indisponibilidad_etapas" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"            UUID NOT NULL,
  "indisponibilidadId"  UUID NOT NULL,
  "etapa"               TEXT NOT NULL,
  "comentario"          TEXT,
  "inicioAt"            TIMESTAMPTZ NOT NULL,
  "finAt"               TIMESTAMPTZ,
  "workOrderId"         UUID,
  "responsableNombre"   TEXT,
  "registradoPorId"     UUID,
  "registradoPorName"   TEXT,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "fk_uetapa_episodio" FOREIGN KEY ("indisponibilidadId") REFERENCES "flota_unidad_indisponibilidades"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_uetapa_episodio_inicio" ON "flota_unidad_indisponibilidad_etapas"("indisponibilidadId", "inicioAt");

-- Ubicación declarada (auditable; no determina disponibilidad)
CREATE TABLE IF NOT EXISTS "flota_vehiculo_ubicacion_eventos" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"      UUID NOT NULL,
  "vehiculoId"    UUID NOT NULL,
  "tipo"          TEXT NOT NULL,
  "detalle"       TEXT,
  "notas"         TEXT,
  "createdByName" TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "fk_uubi_vehiculo" FOREIGN KEY ("vehiculoId") REFERENCES "flota_vehiculos"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_uubi_vehiculo_fecha" ON "flota_vehiculo_ubicacion_eventos"("vehiculoId", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_uubi_tenant"         ON "flota_vehiculo_ubicacion_eventos"("tenantId");
