-- ═══════════════════════════════════════════════════════════════
-- FLOTA 360 — ANÁLISIS DE REPARACIONES RECURRENTES POR COMPONENTE
-- Tablas aditivas: catálogo de componentes, instancias instaladas,
-- vínculo OT↔componente, reglas de recurrencia, casos, alternativas
-- y eventos de trazabilidad. Idempotente (CREATE TABLE IF NOT EXISTS).
-- Aplicar: docker exec -i sgi-postgres[-testing] psql -U sgi -d sgi < archivo.sql
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fleet_components (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "nombre"     TEXT NOT NULL,
  "categoria"  TEXT NOT NULL DEFAULT 'GENERAL',
  "sinonimos"  TEXT[] NOT NULL DEFAULT '{}',
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fleet_components_tenant_idx ON fleet_components("tenantId");

CREATE TABLE IF NOT EXISTS fleet_component_instances (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"     UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "componentId"  UUID NOT NULL REFERENCES fleet_components(id) ON DELETE CASCADE,
  "serialNumber" TEXT,
  "notas"        TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fleet_component_instances_tenant_idx ON fleet_component_instances("tenantId");
CREATE INDEX IF NOT EXISTS fleet_component_instances_component_idx ON fleet_component_instances("componentId");

CREATE TABLE IF NOT EXISTS fleet_component_installations (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"    UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "instanceId"  UUID NOT NULL REFERENCES fleet_component_instances(id) ON DELETE CASCADE,
  "vehiculoId"  UUID NOT NULL REFERENCES flota_vehiculos(id) ON DELETE CASCADE,
  "installedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "installedKm" DOUBLE PRECISION,
  "removedAt"   TIMESTAMPTZ,
  "removedKm"   DOUBLE PRECISION,
  "motivo"      TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fleet_component_installations_tenant_idx ON fleet_component_installations("tenantId");
CREATE INDEX IF NOT EXISTS fleet_component_installations_instance_idx ON fleet_component_installations("instanceId");
CREATE INDEX IF NOT EXISTS fleet_component_installations_vehiculo_idx ON fleet_component_installations("vehiculoId");

CREATE TABLE IF NOT EXISTS fleet_work_order_components (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"         UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "workOrderId"      UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  "componentId"      UUID NOT NULL REFERENCES fleet_components(id) ON DELETE CASCADE,
  "instanceId"       UUID REFERENCES fleet_component_instances(id) ON DELETE SET NULL,
  "subcomponente"    TEXT,
  "sintoma"          TEXT,
  "diagnostico"      TEXT,
  "causa"            TEXT,
  "trabajoRealizado" TEXT,
  "clasificacion"    TEXT NOT NULL DEFAULT 'CONFIRMADA',
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdBy"        UUID
);
CREATE INDEX IF NOT EXISTS fleet_woc_tenant_idx ON fleet_work_order_components("tenantId");
CREATE INDEX IF NOT EXISTS fleet_woc_wo_idx ON fleet_work_order_components("workOrderId");
CREATE INDEX IF NOT EXISTS fleet_woc_component_idx ON fleet_work_order_components("componentId");
CREATE INDEX IF NOT EXISTS fleet_woc_instance_idx ON fleet_work_order_components("instanceId");

CREATE TABLE IF NOT EXISTS fleet_recurrence_rules (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"          UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "componentId"       UUID NOT NULL REFERENCES fleet_components(id) ON DELETE CASCADE,
  "maxIntervenciones" INTEGER NOT NULL DEFAULT 3,
  "ventanaDias"       INTEGER NOT NULL DEFAULT 180,
  "kmMaxEntre"        DOUBLE PRECISION,
  "soloFallas"        BOOLEAN NOT NULL DEFAULT true,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fleet_recurrence_rules_tenant_idx ON fleet_recurrence_rules("tenantId");
CREATE INDEX IF NOT EXISTS fleet_recurrence_rules_component_idx ON fleet_recurrence_rules("componentId");

CREATE TABLE IF NOT EXISTS fleet_recurrence_cases (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"             UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "vehiculoId"           UUID NOT NULL REFERENCES flota_vehiculos(id) ON DELETE CASCADE,
  "componentId"          UUID NOT NULL REFERENCES fleet_components(id) ON DELETE CASCADE,
  "instanceId"           UUID REFERENCES fleet_component_instances(id) ON DELETE SET NULL,
  "ruleId"               UUID REFERENCES fleet_recurrence_rules(id) ON DELETE SET NULL,
  "status"               TEXT NOT NULL DEFAULT 'DETECTADO',
  "motivoResumen"        TEXT,
  "datosFaltantes"       TEXT[] NOT NULL DEFAULT '{}',
  "alternativaElegida"   TEXT,
  "decisionFundamento"   TEXT,
  "decididoPor"          TEXT,
  "decididoAt"           TIMESTAMPTZ,
  "workOrderAccionId"    UUID,
  "accionEjecutadaAt"    TIMESTAMPTZ,
  "accionEjecutadaKm"    DOUBLE PRECISION,
  "instanciaNuevaId"     UUID,
  "revisionDias"         INTEGER,
  "revisionKm"           DOUBLE PRECISION,
  "seguimientoResultado" TEXT,
  "seguimientoNotas"     TEXT,
  "openedAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "closedAt"             TIMESTAMPTZ,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fleet_recurrence_cases_tenant_idx ON fleet_recurrence_cases("tenantId");
CREATE INDEX IF NOT EXISTS fleet_recurrence_cases_vehiculo_idx ON fleet_recurrence_cases("vehiculoId");
CREATE INDEX IF NOT EXISTS fleet_recurrence_cases_component_idx ON fleet_recurrence_cases("componentId");
CREATE INDEX IF NOT EXISTS fleet_recurrence_cases_status_idx ON fleet_recurrence_cases("status");

CREATE TABLE IF NOT EXISTS fleet_case_alternatives (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"               UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "caseId"                 UUID NOT NULL REFERENCES fleet_recurrence_cases(id) ON DELETE CASCADE,
  "tipo"                   TEXT NOT NULL,
  "descripcion"            TEXT,
  "costoInmediato"         DOUBLE PRECISION,
  "costoInstalacion"       DOUBLE PRECISION,
  "moneda"                 TEXT NOT NULL DEFAULT 'ARS',
  "fechaCotizacion"        TIMESTAMPTZ,
  "proveedor"              TEXT,
  "plazoInmovilizacionDias" DOUBLE PRECISION,
  "garantiaMeses"          INTEGER,
  "garantiaKm"             DOUBLE PRECISION,
  "costosFuturosEstimados" DOUBLE PRECISION,
  "baseEstimacion"         TEXT,
  "valorParadaPorDia"      DOUBLE PRECISION,
  "baseValorParada"        TEXT,
  "tipoCambio"             DOUBLE PRECISION,
  "fechaTipoCambio"        TIMESTAMPTZ,
  "fuenteTipoCambio"       TEXT,
  "seleccionada"           BOOLEAN NOT NULL DEFAULT false,
  "fundamentoRechazo"      TEXT,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fleet_case_alternatives_tenant_idx ON fleet_case_alternatives("tenantId");
CREATE INDEX IF NOT EXISTS fleet_case_alternatives_case_idx ON fleet_case_alternatives("caseId");

CREATE TABLE IF NOT EXISTS fleet_case_events (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "caseId"    UUID NOT NULL REFERENCES fleet_recurrence_cases(id) ON DELETE CASCADE,
  "tipo"      TEXT NOT NULL,
  "detalle"   TEXT,
  "userId"    UUID,
  "userName"  TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fleet_case_events_tenant_idx ON fleet_case_events("tenantId");
CREATE INDEX IF NOT EXISTS fleet_case_events_case_idx ON fleet_case_events("caseId");
