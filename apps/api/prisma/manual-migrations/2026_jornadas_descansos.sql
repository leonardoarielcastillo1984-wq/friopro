-- ════════════════════════════════════════════════════════════════════════════
-- Migración aditiva e idempotente: Jornadas explícitas, descanso verificado y
-- política configurable por organización (Flota 360 — hub del chofer).
--
--   • flota_conductores        + pinHash/pinSetAt/pinSetById (identidad PIN)
--   • flota_servicio_registros + jornadaId, clienteEventoId, eventoAt,
--                              motivoRechazo, reglaAplicada
--   • flota_jornadas           entidad explícita INICIO→FIN por conductor
--   • flota_jornada_correcciones  correcciones trazables (no destructivas)
--   • flota_jornada_avisos        avisos de duración (único por tipo/jornada)
--   • flota_jornada_politicas     política por tenant (default 12h ADVERTENCIA)
--   • flota_jornada_politica_historial  versiones de política
--   • flota_habilitaciones_descanso     primera habilitación sin historial
--
-- Backfill conservador:
--   Sólo se agrupan en jornadas los registros CON conductorId (identidad
--   inequívoca). Un INICIO con jornada ya abierta o un FIN sin INICIO quedan
--   SIN vincular (jornadaId NULL) → conciliación. Nada se borra ni se altera.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Columnas nuevas ──────────────────────────────────────────────────────

ALTER TABLE flota_conductores
  ADD COLUMN IF NOT EXISTS "pinHash"    TEXT,
  ADD COLUMN IF NOT EXISTS "pinSetAt"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "pinSetById" UUID;

ALTER TABLE flota_controles_pre_servicio
  ADD COLUMN IF NOT EXISTS "conductorId" UUID;
CREATE INDEX IF NOT EXISTS flota_controles_conductor_idx
  ON flota_controles_pre_servicio ("conductorId");

ALTER TABLE flota_servicio_registros
  ADD COLUMN IF NOT EXISTS "jornadaId"        UUID,
  ADD COLUMN IF NOT EXISTS "clienteEventoId"  TEXT,
  ADD COLUMN IF NOT EXISTS "eventoAt"         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "motivoRechazo"    TEXT,
  ADD COLUMN IF NOT EXISTS "reglaAplicada"    JSONB;

-- eventoAt = createdAt para registros existentes (hora del servidor)
UPDATE flota_servicio_registros SET "eventoAt" = "createdAt" WHERE "eventoAt" IS NULL;
ALTER TABLE flota_servicio_registros ALTER COLUMN "eventoAt" SET DEFAULT NOW();

-- ── 2. Tablas nuevas ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS flota_jornadas (
  "id"                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"                    UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "conductorId"                 UUID NOT NULL REFERENCES flota_conductores(id) ON DELETE CASCADE,
  "estado"                      TEXT NOT NULL DEFAULT 'ABIERTA',
  "inicioAt"                    TIMESTAMPTZ NOT NULL,
  "finAt"                       TIMESTAMPTZ,
  "unidades"                    JSONB NOT NULL DEFAULT '[]',
  "origen"                      TEXT,
  "destino"                     TEXT,
  "carga"                       TEXT,
  "descansoPrevioHoras"         DOUBLE PRECISION,
  "evaluacionDescanso"          TEXT,
  "evaluacionDescansoOriginal"  TEXT,
  "descansoPrevioHorasOriginal" DOUBLE PRECISION,
  "horasTrabajadas"             DOUBLE PRECISION,
  "jornadaExcesiva"             BOOLEAN NOT NULL DEFAULT FALSE,
  "descansoDeclaradoHoras"      DOUBLE PRECISION,
  "discrepanciaDeclaradoCalc"   BOOLEAN NOT NULL DEFAULT FALSE,
  "habilitacionInicialId"       UUID,
  "politicaVersion"             INTEGER,
  "politicaSnapshot"            JSONB,
  "cierreTipo"                  TEXT,
  "cierreMotivo"                TEXT,
  "cerradaPorUserId"            UUID,
  "notas"                       TEXT,
  "createdAt"                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS flota_jornadas_tenant_conductor_estado_idx
  ON flota_jornadas ("tenantId", "conductorId", "estado");
CREATE INDEX IF NOT EXISTS flota_jornadas_tenant_inicio_idx
  ON flota_jornadas ("tenantId", "inicioAt");

-- Una sola jornada ABIERTA por conductor y organización (índice parcial —
-- no expresable en Prisma; el control transaccional de la app lo refuerza).
CREATE UNIQUE INDEX IF NOT EXISTS flota_jornadas_abierta_unq
  ON flota_jornadas ("tenantId", "conductorId") WHERE "estado" = 'ABIERTA';

ALTER TABLE flota_servicio_registros
  DROP CONSTRAINT IF EXISTS flota_servicio_registros_jornadaId_fkey,
  ADD CONSTRAINT flota_servicio_registros_jornadaId_fkey
    FOREIGN KEY ("jornadaId") REFERENCES flota_jornadas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS flota_servicio_registros_jornada_idx
  ON flota_servicio_registros ("jornadaId");
CREATE INDEX IF NOT EXISTS flota_servicio_registros_tenant_conductor_tipo_idx
  ON flota_servicio_registros ("tenantId", "conductorId", "tipo");

-- Idempotencia de eventos (un clienteEventoId por evento por tenant)
CREATE UNIQUE INDEX IF NOT EXISTS flota_servicio_registros_cliente_evento_unq
  ON flota_servicio_registros ("tenantId", "clienteEventoId")
  WHERE "clienteEventoId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS flota_jornada_correcciones (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"       UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "jornadaId"      UUID NOT NULL REFERENCES flota_jornadas(id) ON DELETE CASCADE,
  "campo"          TEXT NOT NULL,
  "valorAnterior"  TEXT,
  "valorNuevo"     TEXT,
  "motivo"         TEXT NOT NULL,
  "evidencia"      TEXT,
  "corregidoPorId" UUID NOT NULL,
  "corregidoEn"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS flota_jornada_correcciones_jornada_idx
  ON flota_jornada_correcciones ("tenantId", "jornadaId");

CREATE TABLE IF NOT EXISTS flota_jornada_avisos (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"       UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "jornadaId"      UUID NOT NULL REFERENCES flota_jornadas(id) ON DELETE CASCADE,
  "tipo"           TEXT NOT NULL,
  "horasAlAviso"   DOUBLE PRECISION,
  "programadoPara" TIMESTAMPTZ NOT NULL,
  "enviadoAt"      TIMESTAMPTZ,
  "estadoEntrega"  TEXT NOT NULL DEFAULT 'PENDIENTE',
  "detalleError"   TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS flota_jornada_avisos_unq
  ON flota_jornada_avisos ("jornadaId", "tipo");
CREATE INDEX IF NOT EXISTS flota_jornada_avisos_pend_idx
  ON flota_jornada_avisos ("tenantId", "estadoEntrega");

CREATE TABLE IF NOT EXISTS flota_jornada_politicas (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"               UUID NOT NULL UNIQUE REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "descansoMinHoras"       DOUBLE PRECISION NOT NULL DEFAULT 12,
  "modoAplicacion"         TEXT NOT NULL DEFAULT 'ADVERTENCIA',
  "jornadaAlertaHoras"     DOUBLE PRECISION NOT NULL DEFAULT 12,
  "avisoAnticipacionHoras" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "destinatarios"          JSONB NOT NULL DEFAULT '"ADMINS"',
  "politicaRevisada"       BOOLEAN NOT NULL DEFAULT FALSE,
  "version"                INTEGER NOT NULL DEFAULT 1,
  "updatedById"            UUID,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flota_jornada_politica_historial (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"    UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "politicaId"  UUID NOT NULL REFERENCES flota_jornada_politicas(id) ON DELETE CASCADE,
  "version"     INTEGER NOT NULL,
  "valores"     JSONB NOT NULL,
  "changedById" UUID,
  "changedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS flota_jornada_politica_hist_tenant_idx
  ON flota_jornada_politica_historial ("tenantId");

CREATE TABLE IF NOT EXISTS flota_habilitaciones_descanso (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"               UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "conductorId"            UUID NOT NULL REFERENCES flota_conductores(id) ON DELETE CASCADE,
  "tipo"                   TEXT NOT NULL DEFAULT 'SIN_HISTORIAL',
  "descansoDeclaradoHoras" DOUBLE PRECISION,
  "fundamento"             TEXT NOT NULL,
  "autorizadoPorId"        UUID NOT NULL,
  "usadaEnJornadaId"       UUID,
  "usadaAt"                TIMESTAMPTZ,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS flota_habilitaciones_conductor_idx
  ON flota_habilitaciones_descanso ("tenantId", "conductorId");

-- ── 3. Política por defecto: reglas actuales explícitas (12h, ADVERTENCIA,
--       no revisada). No cambia el comportamiento de ninguna flota. ──────────

INSERT INTO flota_jornada_politicas ("tenantId")
SELECT t.id FROM "Tenant" t
WHERE t."deletedAt" IS NULL
ON CONFLICT ("tenantId") DO NOTHING;

-- ── 4. Backfill conservador: jornadas solo para pares INICIO→FIN con
--       conductorId inequívoco. Ambigüedades quedan sin vincular. ────────────

DO $$
DECLARE
  ev          RECORD;
  jornada_id  UUID;
  prev_fin    TIMESTAMPTZ;
  unidad_prev JSONB;
BEGIN
  FOR ev IN
    SELECT r.* FROM flota_servicio_registros r
    WHERE r."conductorId" IS NOT NULL
      AND r.tipo IN ('INICIO_SERVICIO', 'FIN_SERVICIO')
      AND r."jornadaId" IS NULL
    ORDER BY r."tenantId", r."conductorId", r."createdAt" ASC
  LOOP
    IF ev.tipo = 'INICIO_SERVICIO' THEN
      -- Si ya hay una jornada abierta para este conductor → ambigüedad:
      -- se deja sin vincular para conciliación (no se inventa cierre).
      SELECT j.id INTO jornada_id FROM flota_jornadas j
        WHERE j."tenantId" = ev."tenantId" AND j."conductorId" = ev."conductorId"
          AND j."estado" = 'ABIERTA';
      IF jornada_id IS NOT NULL THEN
        jornada_id := NULL; -- no vincular este INICIO
        CONTINUE;
      END IF;

      -- Último cierre válido del mismo conductor (historial inequívoco)
      SELECT j."finAt" INTO prev_fin FROM flota_jornadas j
        WHERE j."tenantId" = ev."tenantId" AND j."conductorId" = ev."conductorId"
          AND j."estado" = 'CERRADA' AND j."finAt" IS NOT NULL
        ORDER BY j."finAt" DESC LIMIT 1;

      INSERT INTO flota_jornadas (
        "tenantId", "conductorId", "estado", "inicioAt", "unidades",
        "origen", "destino", "carga",
        "descansoPrevioHoras", "evaluacionDescanso",
        "politicaVersion", "createdAt", "updatedAt"
      ) VALUES (
        ev."tenantId", ev."conductorId", 'ABIERTA',
        COALESCE(ev."eventoAt", ev."createdAt"),
        jsonb_build_array(jsonb_build_object(
          'vehiculoId', ev."vehiculoId", 'desde', COALESCE(ev."eventoAt", ev."createdAt"))),
        ev.origen, ev.destino, ev.carga,
        -- conservar el valor calculado históricamente en el registro
        ev."horasDescanso",
        CASE
          WHEN prev_fin IS NULL AND ev."horasDescanso" IS NULL THEN 'SIN_HISTORIAL'
          WHEN ev."descansoInsuficiente" THEN 'INSUFICIENTE'
          WHEN ev."horasDescanso" IS NOT NULL THEN 'CUMPLE'
          ELSE 'SIN_HISTORIAL'
        END,
        1, ev."createdAt", ev."createdAt"
      ) RETURNING id INTO jornada_id;

      UPDATE flota_servicio_registros SET "jornadaId" = jornada_id WHERE id = ev.id;
    ELSE
      -- FIN_SERVICIO: cerrar la jornada abierta del MISMO conductor (la más
      -- reciente). Si no hay → registro huérfano, queda para conciliación.
      SELECT j.id INTO jornada_id FROM flota_jornadas j
        WHERE j."tenantId" = ev."tenantId" AND j."conductorId" = ev."conductorId"
          AND j."estado" = 'ABIERTA'
        ORDER BY j."inicioAt" DESC LIMIT 1;
      IF jornada_id IS NULL THEN CONTINUE; END IF;

      UPDATE flota_jornadas SET
        "estado" = 'CERRADA',
        "finAt" = COALESCE(ev."eventoAt", ev."createdAt"),
        "horasTrabajadas" = ev."horasTrabajadas",
        "jornadaExcesiva" = COALESCE(ev."jornadaExcesiva", FALSE),
        "cierreTipo" = 'NORMAL',
        "updatedAt" = ev."createdAt"
      WHERE id = jornada_id;

      UPDATE flota_servicio_registros SET "jornadaId" = jornada_id WHERE id = ev.id;
      jornada_id := NULL;
    END IF;
  END LOOP;
END $$;

-- Jornadas que quedaron ABIERTAS por el backfill al final de la historia de un
-- conductor son legítimas (servicio en curso). Si quedó más de una abierta por
-- conductor (imposible por el algoritmo) el índice único lo habría rechazado.
