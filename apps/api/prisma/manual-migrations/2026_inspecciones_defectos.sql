-- ═══════════════════════════════════════════════════════════════
-- FLOTA 360 — Circuito de inspecciones: criticidad configurable,
-- casos de defecto (dedup de reportes), restricciones de servicio
-- y separación reparación/verificación/habilitación.
--
-- ADITIVO e IDEMPOTENTE:
--  - No borra ni modifica datos históricos.
--  - No inventa criticidades ni autorizaciones: toda plantilla queda
--    con criticidadRevisada = false ("pendiente de revisión").
--  - Backfill: solo vincula hallazgos ABIERTOS/EN_PROCESO a casos
--    cuando la unidad se resuelve de forma inequívoca
--    (QR→maintenanceAsset→vehículo, o dominio del semi informado).
--    Los hallazgos resueltos/cerrados quedan como reporte histórico
--    sin caso (visibles desde su inspección).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Plantillas: flag de revisión de criticidad ────────────────
ALTER TABLE inspeccion_plantillas
  ADD COLUMN IF NOT EXISTS "criticidadRevisada" BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Ítems: regla de criticidad por defecto + por respuesta ────
ALTER TABLE inspeccion_items
  ADD COLUMN IF NOT EXISTS "severidadHallazgo" TEXT,
  ADD COLUMN IF NOT EXISTS "bloqueaServicio"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "instruccionChofer" TEXT,
  ADD COLUMN IF NOT EXISTS "prioridadOt"       TEXT,
  ADD COLUMN IF NOT EXISTS "tipoDefecto"       TEXT,
  ADD COLUMN IF NOT EXISTS "componentKey"      TEXT,
  ADD COLUMN IF NOT EXISTS "posicion"          TEXT,
  ADD COLUMN IF NOT EXISTS "reglasRespuesta"   JSONB;

-- ── 3. Inspecciones: versión de plantilla + dedup de envío ───────
ALTER TABLE inspecciones
  ADD COLUMN IF NOT EXISTS "plantillaVersion" INTEGER,
  ADD COLUMN IF NOT EXISTS "submissionKey"    TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inspecciones_tenantId_submissionKey_key'
  ) THEN
    ALTER TABLE inspecciones
      ADD CONSTRAINT inspecciones_tenantId_submissionKey_key UNIQUE ("tenantId", "submissionKey");
  END IF;
END $$;

-- ── 4. Casos de defecto ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flota_defecto_casos (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"            UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "vehiculoId"          UUID NOT NULL REFERENCES flota_vehiculos(id) ON DELETE CASCADE,
  "maintenanceAssetId"  UUID,

  "itemKey"       TEXT NOT NULL,
  "itemLabel"     TEXT NOT NULL,
  "itemId"        UUID,
  "seccion"       TEXT,
  "equipoDestino" TEXT,
  "componentKey"  TEXT,
  "posicion"      TEXT,

  "severidad"  TEXT    NOT NULL DEFAULT 'MODERADO',
  "bloqueante" BOOLEAN NOT NULL DEFAULT false,
  "estado"     TEXT    NOT NULL DEFAULT 'ABIERTO',

  "primerReporteAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ultimoReporteAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "reportesCount"   INTEGER NOT NULL DEFAULT 1,

  "workOrderId"  UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  "responsable"  TEXT,
  "fechaLimite"  TIMESTAMPTZ,

  "reparacionInformadaAt"  TIMESTAMPTZ,
  "reparacionInformadaPor" TEXT,
  "verificadoAt"           TIMESTAMPTZ,
  "verificadoPorId"        UUID,
  "verificadoPorNombre"    TEXT,
  "verificacionResultado"  TEXT,
  "verificacionNotas"      TEXT,
  "habilitadoAt"           TIMESTAMPTZ,
  "habilitadoPorId"        UUID,
  "habilitadoPorNombre"    TEXT,

  "casoPrevioId" UUID REFERENCES flota_defecto_casos(id) ON DELETE SET NULL,

  "resueltoAt" TIMESTAMPTZ,
  "notas"      TEXT,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flota_defecto_casos_tenant_idx        ON flota_defecto_casos ("tenantId");
CREATE INDEX IF NOT EXISTS flota_defecto_casos_tenant_estado_idx ON flota_defecto_casos ("tenantId", "estado");
CREATE INDEX IF NOT EXISTS flota_defecto_casos_vehiculo_item_idx ON flota_defecto_casos ("vehiculoId", "itemKey");

-- ── 5. Auditoría de casos (append-only) ──────────────────────────
CREATE TABLE IF NOT EXISTS flota_defecto_caso_eventos (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"      UUID NOT NULL,
  "casoId"        UUID NOT NULL REFERENCES flota_defecto_casos(id) ON DELETE CASCADE,
  "tipo"          TEXT NOT NULL,
  "detalle"       TEXT,
  "usuarioId"     UUID,
  "usuarioNombre" TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flota_defecto_caso_eventos_caso_idx ON flota_defecto_caso_eventos ("casoId");

-- ── 6. Restricciones de servicio por unidad ──────────────────────
CREATE TABLE IF NOT EXISTS flota_restricciones_servicio (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"    UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "vehiculoId"  UUID NOT NULL REFERENCES flota_vehiculos(id) ON DELETE CASCADE,
  "casoId"      UUID REFERENCES flota_defecto_casos(id) ON DELETE SET NULL,
  "hallazgoId"  UUID,
  "motivo"      TEXT NOT NULL,
  "origen"      TEXT NOT NULL DEFAULT 'CHECKLIST',
  "activa"      BOOLEAN NOT NULL DEFAULT true,
  "levantadaAt"        TIMESTAMPTZ,
  "levantadaPorId"     UUID,
  "levantadaPorNombre" TEXT,
  "levantadaMotivo"    TEXT,
  "createdById"   UUID,
  "createdByName" TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flota_restricciones_tenant_activa_idx   ON flota_restricciones_servicio ("tenantId", "activa");
CREATE INDEX IF NOT EXISTS flota_restricciones_vehiculo_activa_idx ON flota_restricciones_servicio ("vehiculoId", "activa");

-- ── 7. Auditoría de configuración de criticidad de checklists ────
CREATE TABLE IF NOT EXISTS inspeccion_regla_audits (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"        UUID NOT NULL,
  "plantillaId"     UUID NOT NULL,
  "accion"          TEXT NOT NULL,
  "plantillaVersion" INTEGER NOT NULL,
  "cambios"         JSONB NOT NULL,
  "usuarioId"       UUID,
  "usuarioNombre"   TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inspeccion_regla_audits_tenant_idx    ON inspeccion_regla_audits ("tenantId");
CREATE INDEX IF NOT EXISTS inspeccion_regla_audits_plantilla_idx ON inspeccion_regla_audits ("plantillaId");

-- ── 8. Hallazgos: campos de reporte de defecto ───────────────────
ALTER TABLE inspeccion_hallazgos
  ADD COLUMN IF NOT EXISTS "itemId"             UUID,
  ADD COLUMN IF NOT EXISTS "valorRespuesta"     TEXT,
  ADD COLUMN IF NOT EXISTS "reglaSnapshot"      JSONB,
  ADD COLUMN IF NOT EXISTS "reporteKey"         TEXT,
  ADD COLUMN IF NOT EXISTS "bloqueante"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "prioridadOt"        TEXT,
  ADD COLUMN IF NOT EXISTS "instruccionChofer"  TEXT,
  ADD COLUMN IF NOT EXISTS "vehiculoId"         UUID,
  ADD COLUMN IF NOT EXISTS "maintenanceAssetId" UUID,
  ADD COLUMN IF NOT EXISTS "casoId"             UUID,
  ADD COLUMN IF NOT EXISTS "otId"               UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspeccion_hallazgos_itemId_fkey') THEN
    ALTER TABLE inspeccion_hallazgos
      ADD CONSTRAINT inspeccion_hallazgos_itemId_fkey
      FOREIGN KEY ("itemId") REFERENCES inspeccion_items(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspeccion_hallazgos_vehiculoId_fkey') THEN
    ALTER TABLE inspeccion_hallazgos
      ADD CONSTRAINT inspeccion_hallazgos_vehiculoId_fkey
      FOREIGN KEY ("vehiculoId") REFERENCES flota_vehiculos(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspeccion_hallazgos_casoId_fkey') THEN
    ALTER TABLE inspeccion_hallazgos
      ADD CONSTRAINT inspeccion_hallazgos_casoId_fkey
      FOREIGN KEY ("casoId") REFERENCES flota_defecto_casos(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspeccion_hallazgos_otId_fkey') THEN
    ALTER TABLE inspeccion_hallazgos
      ADD CONSTRAINT inspeccion_hallazgos_otId_fkey
      FOREIGN KEY ("otId") REFERENCES work_orders(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspeccion_hallazgos_tenantId_reporteKey_key') THEN
    ALTER TABLE inspeccion_hallazgos
      ADD CONSTRAINT inspeccion_hallazgos_tenantId_reporteKey_key UNIQUE ("tenantId", "reporteKey");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS inspeccion_hallazgos_caso_idx     ON inspeccion_hallazgos ("casoId");
CREATE INDEX IF NOT EXISTS inspeccion_hallazgos_vehiculo_idx ON inspeccion_hallazgos ("vehiculoId");

-- ═══════════════════════════════════════════════════════════════
-- BACKFILL conservador — SOLO relaciones inequívocas:
--   Hallazgos ABIERTOS/EN_PROCESO cuya inspección resuelve UNA
--   sola unidad de flota:
--     - equipoDestino SEMI  → vehículo por dominioSemi informado
--     - resto               → vehículo del QR (maintenanceAssetId)
--   Cada (vehículo, itemKey) abierto genera UN solo DefectoCaso;
--   el resto de reportes de ese defecto quedan vinculados a él.
--   No se crean restricciones ni OTs retroactivas, no se cambian
--   severidades ni estados operativos, no se marca nada revisado.
-- ═══════════════════════════════════════════════════════════════

-- Firma del defecto = itemLabel+sección normalizados (los ítems
-- históricos no tienen tipoDefecto configurado).
CREATE OR REPLACE FUNCTION _tmp_item_key(seccion TEXT, label TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' from lower(regexp_replace(
    coalesce(seccion,'') || '|' || coalesce(label,''), '[^a-z0-9|]+', '-', 'g')));
$$;

WITH hallazgos_unidad AS (
  SELECT h.id AS hallazgo_id, h."tenantId", h."itemLabel", h.severidad,
         h."createdAt", h."equipoDestino",
         CASE
           WHEN h."equipoDestino" = 'SEMI' THEN vsemi.id
           ELSE vqr.id
         END AS vehiculo_id,
         CASE
           WHEN h."equipoDestino" = 'SEMI' THEN vsemi."maintenanceAssetId"
           ELSE qr."maintenanceAssetId"
         END AS asset_id
  FROM inspeccion_hallazgos h
  JOIN inspecciones i   ON i.id = h."inspeccionId"
  JOIN inspeccion_qrs qr ON qr.id = i."qrId"
  LEFT JOIN flota_vehiculos vqr   ON vqr."maintenanceAssetId" = qr."maintenanceAssetId"
                                 AND vqr."tenantId" = h."tenantId"
  LEFT JOIN flota_vehiculos vsemi ON upper(vsemi.dominio) = upper(i."dominioSemi")
                                 AND vsemi."tenantId" = h."tenantId"
  WHERE h.estado IN ('ABIERTO','EN_PROCESO')
    AND h."casoId" IS NULL
),
-- Solo ambigüedad inequívoca: exactamente una unidad resuelta
resueltos AS (
  SELECT * FROM hallazgos_unidad WHERE vehiculo_id IS NOT NULL
),
firmas AS (
  SELECT DISTINCT vehiculo_id, "tenantId",
         _tmp_item_key(NULL, "itemLabel") AS item_key,
         min("itemLabel") AS item_label
  FROM resueltos
  GROUP BY vehiculo_id, "tenantId", _tmp_item_key(NULL, "itemLabel")
),
casos_nuevos AS (
  INSERT INTO flota_defecto_casos (
    "tenantId","vehiculoId","maintenanceAssetId","itemKey","itemLabel",
    "severidad","estado","primerReporteAt","ultimoReporteAt","reportesCount"
  )
  SELECT f."tenantId", f.vehiculo_id,
         (SELECT r.asset_id FROM resueltos r
           WHERE r.vehiculo_id = f.vehiculo_id AND _tmp_item_key(NULL, r."itemLabel") = f.item_key
           LIMIT 1),
         f.item_key, f.item_label,
         (SELECT r.severidad FROM resueltos r
           WHERE r.vehiculo_id = f.vehiculo_id AND _tmp_item_key(NULL, r."itemLabel") = f.item_key
           ORDER BY CASE r.severidad WHEN 'CRITICO' THEN 0 WHEN 'GRAVE' THEN 1 WHEN 'MODERADO' THEN 2 ELSE 3 END
           LIMIT 1),
         'ABIERTO',
         (SELECT min(r."createdAt") FROM resueltos r
           WHERE r.vehiculo_id = f.vehiculo_id AND _tmp_item_key(NULL, r."itemLabel") = f.item_key),
         (SELECT max(r."createdAt") FROM resueltos r
           WHERE r.vehiculo_id = f.vehiculo_id AND _tmp_item_key(NULL, r."itemLabel") = f.item_key),
         (SELECT count(*) FROM resueltos r
           WHERE r.vehiculo_id = f.vehiculo_id AND _tmp_item_key(NULL, r."itemLabel") = f.item_key)
  FROM firmas f
  WHERE NOT EXISTS (
    SELECT 1 FROM flota_defecto_casos c
    WHERE c."tenantId" = f."tenantId" AND c."vehiculoId" = f.vehiculo_id
      AND c."itemKey" = f.item_key AND c.estado NOT IN ('RESUELTO','CERRADO')
  )
  RETURNING id, "tenantId", "vehiculoId", "itemKey"
)
UPDATE inspeccion_hallazgos h
SET "casoId"  = c.id,
    "vehiculoId" = r.vehiculo_id,
    "maintenanceAssetId" = r.asset_id,
    "reporteKey" = 'legacy:' || h.id::text
FROM resueltos r
JOIN flota_defecto_casos c
  ON c."vehiculoId" = r.vehiculo_id AND c."tenantId" = r."tenantId"
 AND c."itemKey" = _tmp_item_key(NULL, r."itemLabel")
 AND c.estado NOT IN ('RESUELTO','CERRADO')
WHERE h.id = r.hallazgo_id;

-- Evento de auditoría del backfill por caso (trazabilidad del origen)
INSERT INTO flota_defecto_caso_eventos ("tenantId","casoId","tipo","detalle")
SELECT c."tenantId", c.id, 'NOTA',
       'Caso creado por migración: agrupa reportes históricos abiertos del mismo defecto (vínculo inequívoco por unidad+ítem).'
FROM flota_defecto_casos c
WHERE NOT EXISTS (
  SELECT 1 FROM flota_defecto_caso_eventos e WHERE e."casoId" = c.id
)
  AND EXISTS (SELECT 1 FROM inspeccion_hallazgos h WHERE h."casoId" = c.id);

DROP FUNCTION _tmp_item_key(TEXT, TEXT);
