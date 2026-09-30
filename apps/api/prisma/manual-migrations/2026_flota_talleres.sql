-- ══════════════════════════════════════════════════════════════════════════
-- FLOTA 360 — TALLERES EXTERNOS / SERVICES OFICIALES
-- Migración aditiva: no toca datos existentes. Preserva asignaciones internas.
-- ══════════════════════════════════════════════════════════════════════════

-- Tabla de talleres
CREATE TABLE IF NOT EXISTS flota_talleres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  "razonSocial" TEXT,
  "identificacionFiscal" TEXT,
  tipo TEXT NOT NULL DEFAULT 'TALLER_EXTERNO',
  marcas TEXT[] NOT NULL DEFAULT '{}',
  especialidades TEXT[] NOT NULL DEFAULT '{}',
  direccion TEXT,
  localidad TEXT,
  "contactoNombre" TEXT,
  telefono TEXT,
  email TEXT,
  observaciones TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "supplierId" UUID,
  "deletedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flota_talleres_tenantId_idx ON flota_talleres ("tenantId");
CREATE INDEX IF NOT EXISTS flota_talleres_tenant_activo_idx ON flota_talleres ("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS flota_talleres_identificacion_idx ON flota_talleres ("identificacionFiscal");

-- Bitácora de trazabilidad OT ↔ taller
CREATE TABLE IF NOT EXISTS flota_taller_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "tallerId" UUID NOT NULL REFERENCES flota_talleres(id) ON DELETE CASCADE,
  "workOrderId" UUID,
  tipo TEXT NOT NULL,
  detalle TEXT,
  "usuarioId" UUID,
  "usuarioNombre" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flota_taller_eventos_tenant_idx ON flota_taller_eventos ("tenantId");
CREATE INDEX IF NOT EXISTS flota_taller_eventos_taller_idx ON flota_taller_eventos ("tallerId");
CREATE INDEX IF NOT EXISTS flota_taller_eventos_ot_idx ON flota_taller_eventos ("workOrderId");

-- WorkOrder: ejecución externa
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "ejecutorTipo" TEXT NOT NULL DEFAULT 'INTERNO';
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "tallerId" UUID REFERENCES flota_talleres(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "responsableSeguimientoId" UUID;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "responsableSeguimientoNombre" TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "fechaIngresoTaller" TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "fechaEntregaEstimada" TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "fechaDevolucion" TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "trabajoSolicitado" TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "trabajoRealizado" TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "referenciaExterna" TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "observacionesExternas" TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "costoExterno" DOUBLE PRECISION NOT NULL DEFAULT 0;
-- Recepción / conformidad
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "recepcionAt" TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "recepcionUsuarioId" UUID;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "recepcionUsuarioNombre" TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "recepcionResultado" TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "recepcionNotas" TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "recepcionEvidenciaUrl" TEXT;
-- Garantía
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "garantiaAlcance" TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "garantiaInicio" TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "garantiaFechaLimite" TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "garantiaKmLimite" DOUBLE PRECISION;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "garantiaCondiciones" TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "garantiaDocUrl" TEXT;
-- Reclamo / garantía vinculada
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "reclamoDeOtId" UUID REFERENCES work_orders(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS "sinCargo" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS work_orders_taller_idx ON work_orders ("tallerId");
CREATE INDEX IF NOT EXISTS work_orders_reclamo_idx ON work_orders ("reclamoDeOtId");

-- FlotaFactura: vínculo al taller, moneda, idempotencia y anti-doble-conteo
ALTER TABLE flota_facturas ADD COLUMN IF NOT EXISTS "tallerId" UUID REFERENCES flota_talleres(id) ON DELETE SET NULL;
ALTER TABLE flota_facturas ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS';
ALTER TABLE flota_facturas ADD COLUMN IF NOT EXISTS "montoRepuestosPropios" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE flota_facturas ADD COLUMN IF NOT EXISTS "cargaKey" TEXT;
ALTER TABLE flota_facturas ADD COLUMN IF NOT EXISTS "notaCreditoDeId" UUID;
CREATE INDEX IF NOT EXISTS flota_facturas_taller_idx ON flota_facturas ("tallerId");
CREATE INDEX IF NOT EXISTS flota_facturas_ot_idx ON flota_facturas ("workOrderId");
-- idempotencia: un cargaKey no puede repetirse dentro del tenant
CREATE UNIQUE INDEX IF NOT EXISTS flota_facturas_carga_key_idx
  ON flota_facturas ("tenantId", "cargaKey") WHERE "cargaKey" IS NOT NULL;

-- WorkOrderSparePart: origen del repuesto
ALTER TABLE work_order_spare_parts ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'PROPIO';
