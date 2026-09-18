-- Flota 360 — Hub del chofer (QR), facturas, multas, mediciones de neumáticos.
-- 100% aditivo e idempotente (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- ── Columnas nuevas en tablas existentes ──────────────────────────────────
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "flotaPresupuestoMensual" DOUBLE PRECISION;
ALTER TABLE flota_vehiculos ADD COLUMN IF NOT EXISTS "valorAdquisicion" DOUBLE PRECISION;
ALTER TABLE flota_conductores ADD COLUMN IF NOT EXISTS "licenciaFileUrl" TEXT;
ALTER TABLE flota_conductores ADD COLUMN IF NOT EXISTS "psicofisicoFileUrl" TEXT;
ALTER TABLE flota_combustible ALTER COLUMN litros DROP NOT NULL;

ALTER TABLE maintenance_component_rule_assets ADD COLUMN IF NOT EXISTS "tecnicoSugeridoId" UUID;
ALTER TABLE maintenance_component_rule_assets ADD COLUMN IF NOT EXISTS "accionVencimientoOverride" TEXT;
ALTER TABLE maintenance_component_rule_assets ADD COLUMN IF NOT EXISTS "kmBase" DOUBLE PRECISION;
ALTER TABLE maintenance_component_rule_assets ADD COLUMN IF NOT EXISTS "proximaEjecucion" TIMESTAMPTZ;

-- ── Hub del chofer (QR público) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flota_incidentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "vehiculoId" UUID NOT NULL REFERENCES flota_vehiculos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  gravedad TEXT NOT NULL DEFAULT 'MEDIA',
  descripcion TEXT,
  "hayLesionados" BOOLEAN NOT NULL DEFAULT false,
  "lesionadosDetalle" TEXT,
  "tercerosInvolucrados" TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  "ubicacionTexto" TEXT,
  odometro DOUBLE PRECISION,
  fotos JSONB,
  "reportadoPorNombre" TEXT NOT NULL,
  "reportadoPorTelefono" TEXT,
  estado TEXT NOT NULL DEFAULT 'ABIERTO',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flota_incidentes_tenantId_idx ON flota_incidentes ("tenantId");
CREATE INDEX IF NOT EXISTS flota_incidentes_vehiculoId_idx ON flota_incidentes ("vehiculoId");

CREATE TABLE IF NOT EXISTS flota_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "vehiculoId" UUID REFERENCES flota_vehiculos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'GENERAL',
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "uploadedById" UUID,
  "uploadedByNombre" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flota_documentos_tenantId_idx ON flota_documentos ("tenantId");
CREATE INDEX IF NOT EXISTS flota_documentos_vehiculoId_idx ON flota_documentos ("vehiculoId");

CREATE TABLE IF NOT EXISTS flota_servicio_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "vehiculoId" UUID NOT NULL REFERENCES flota_vehiculos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  odometro DOUBLE PRECISION,
  notas TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  fotos JSONB,
  "horasTrabajadas" DOUBLE PRECISION,
  "horasDescanso" DOUBLE PRECISION,
  "descansoInsuficiente" BOOLEAN NOT NULL DEFAULT false,
  "jornadaExcesiva" BOOLEAN NOT NULL DEFAULT false,
  "odometroSospechoso" BOOLEAN NOT NULL DEFAULT false,
  origen TEXT,
  destino TEXT,
  carga TEXT,
  "conductorId" UUID,
  "reportadoPorNombre" TEXT NOT NULL,
  "reportadoPorTelefono" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flota_servicio_registros_tenantId_idx ON flota_servicio_registros ("tenantId");
CREATE INDEX IF NOT EXISTS flota_servicio_registros_vehiculoId_idx ON flota_servicio_registros ("vehiculoId");

CREATE TABLE IF NOT EXISTS flota_controles_pre_servicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "vehiculoId" UUID NOT NULL REFERENCES flota_vehiculos(id) ON DELETE CASCADE,
  "presionSistolica" INTEGER,
  "presionDiastolica" INTEGER,
  alcoholemia DOUBLE PRECISION,
  temperatura DOUBLE PRECISION,
  "horasDescanso" DOUBLE PRECISION,
  "nivelFatiga" INTEGER,
  "tomaMedicamentos" BOOLEAN NOT NULL DEFAULT false,
  "medicamentosDetalle" TEXT,
  apto BOOLEAN NOT NULL DEFAULT true,
  motivos TEXT,
  observaciones TEXT,
  "reportadoPorNombre" TEXT NOT NULL,
  "reportadoPorTelefono" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flota_controles_pre_servicio_tenantId_idx ON flota_controles_pre_servicio ("tenantId");
CREATE INDEX IF NOT EXISTS flota_controles_pre_servicio_vehiculoId_idx ON flota_controles_pre_servicio ("vehiculoId");
CREATE INDEX IF NOT EXISTS flota_controles_pre_servicio_createdAt_idx ON flota_controles_pre_servicio ("createdAt");

-- ── Mediciones de banda, facturas y multas ────────────────────────────────
CREATE TABLE IF NOT EXISTS flota_neumatico_mediciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "neumaticoId" UUID NOT NULL REFERENCES flota_neumaticos(id) ON DELETE CASCADE,
  "vehiculoId" UUID,
  eje INTEGER,
  lado TEXT,
  posicion TEXT,
  "profBanda" DOUBLE PRECISION NOT NULL,
  "kmAlMedir" DOUBLE PRECISION,
  presion DOUBLE PRECISION,
  observador TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  notas TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flota_neumatico_mediciones_tenantId_idx ON flota_neumatico_mediciones ("tenantId");
CREATE INDEX IF NOT EXISTS flota_neumatico_mediciones_neumaticoId_idx ON flota_neumatico_mediciones ("neumaticoId");
CREATE INDEX IF NOT EXISTS flota_neumatico_mediciones_vehiculoId_idx ON flota_neumatico_mediciones ("vehiculoId");

CREATE TABLE IF NOT EXISTS flota_facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "vehiculoId" UUID REFERENCES flota_vehiculos(id) ON DELETE CASCADE,
  "tipoComprobante" TEXT NOT NULL DEFAULT 'FACTURA',
  numero TEXT,
  "puntoVenta" TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  proveedor TEXT,
  "cuitProveedor" TEXT,
  neto DOUBLE PRECISION,
  iva DOUBLE PRECISION,
  total DOUBLE PRECISION NOT NULL,
  concepto TEXT,
  categoria TEXT NOT NULL DEFAULT 'REPARACION',
  "workOrderId" UUID,
  "intervencionId" UUID,
  "neumaticoId" UUID,
  "sparePartId" UUID,
  "fileUrl" TEXT,
  "fileName" TEXT,
  "mimeType" TEXT,
  notas TEXT,
  "uploadedById" UUID,
  "uploadedByNombre" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flota_facturas_tenantId_idx ON flota_facturas ("tenantId");
CREATE INDEX IF NOT EXISTS flota_facturas_vehiculoId_idx ON flota_facturas ("vehiculoId");
CREATE INDEX IF NOT EXISTS flota_facturas_fecha_idx ON flota_facturas (fecha);
CREATE INDEX IF NOT EXISTS flota_facturas_categoria_idx ON flota_facturas (categoria);

CREATE TABLE IF NOT EXISTS flota_multas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "vehiculoId" UUID NOT NULL REFERENCES flota_vehiculos(id) ON DELETE CASCADE,
  "conductorId" UUID REFERENCES flota_conductores(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'TRANSITO',
  descripcion TEXT,
  "actaNumero" TEXT,
  lugar TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  monto DOUBLE PRECISION NOT NULL,
  "fechaVtoPago" TIMESTAMPTZ,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE',
  "pagadaAt" TIMESTAMPTZ,
  "responsablePago" TEXT,
  "incidenteId" UUID,
  "fileUrl" TEXT,
  "fileName" TEXT,
  notas TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flota_multas_tenantId_idx ON flota_multas ("tenantId");
CREATE INDEX IF NOT EXISTS flota_multas_vehiculoId_idx ON flota_multas ("vehiculoId");
CREATE INDEX IF NOT EXISTS flota_multas_conductorId_idx ON flota_multas ("conductorId");
CREATE INDEX IF NOT EXISTS flota_multas_estado_idx ON flota_multas (estado);
