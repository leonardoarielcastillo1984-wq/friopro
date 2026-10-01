-- Servicios comerciales de flota (ej. "Toyota — distribución diaria"):
-- alta de servicios fijos/puntuales + asignación de unidades con vigencia,
-- para medir rentabilidad por servicio sin cargar cada viaje.
-- Idempotente — se puede correr múltiples veces sin romper.

CREATE TABLE IF NOT EXISTS flota_servicios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"      uuid NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  cliente         text,
  tipo            text NOT NULL DEFAULT 'FIJO',         -- FIJO | PUNTUAL
  "modalidadCobro" text NOT NULL DEFAULT 'POR_DIA',     -- POR_DIA | POR_MES | POR_KM | VIAJE
  monto           double precision,
  "kmEstimadosDia" double precision,
  origen          text,
  destino         text,
  "diasSemana"    jsonb,                                -- [1..7]; null = todos
  activo          boolean NOT NULL DEFAULT true,
  notas           text,
  "createdAt"     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flota_servicios_tenant_idx ON flota_servicios("tenantId");
CREATE INDEX IF NOT EXISTS flota_servicios_activo_idx ON flota_servicios(activo);

CREATE TABLE IF NOT EXISTS flota_servicio_unidades (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   uuid NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "servicioId" uuid NOT NULL REFERENCES flota_servicios(id) ON DELETE CASCADE,
  "vehiculoId" uuid NOT NULL REFERENCES flota_vehiculos(id) ON DELETE CASCADE,
  desde        timestamptz NOT NULL DEFAULT now(),
  hasta        timestamptz,
  "createdAt"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flota_su_tenant_idx    ON flota_servicio_unidades("tenantId");
CREATE INDEX IF NOT EXISTS flota_su_servicio_idx  ON flota_servicio_unidades("servicioId");
CREATE INDEX IF NOT EXISTS flota_su_vehiculo_idx  ON flota_servicio_unidades("vehiculoId");

-- Un ingreso puede pertenecer a un servicio comercial
ALTER TABLE flota_ingresos
  ADD COLUMN IF NOT EXISTS "servicioId" uuid REFERENCES flota_servicios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS flota_ingresos_servicio_idx ON flota_ingresos("servicioId");
