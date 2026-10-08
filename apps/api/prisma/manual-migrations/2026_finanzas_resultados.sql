-- ═══════════════════════════════════════════════════════════════════
-- RESULTADOS DEL NEGOCIO — módulo /resultados (consolidador económico)
-- Tablas nuevas: finanza_centros_costo, finanza_facturas,
-- finanza_factura_items, finanza_cobros, finanza_gastos
-- Campos nuevos: employees."costoMensual" + "centroCostoId",
--                vehiculos."centroCostoId", flota_servicios."centroCostoId"
-- Idempotente: seguro de re-ejecutar.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS finanza_centros_costo (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  tipo       TEXT NOT NULL DEFAULT 'CENTRO_COSTO', -- UNIDAD_NEGOCIO | CENTRO_COSTO
  "parentId" UUID,
  activo     BOOLEAN NOT NULL DEFAULT true,
  notas      TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS finanza_centros_costo_tenant_idx  ON finanza_centros_costo("tenantId");
CREATE INDEX IF NOT EXISTS finanza_centros_costo_parent_idx  ON finanza_centros_costo("parentId");

CREATE TABLE IF NOT EXISTS finanza_facturas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  numero          TEXT,
  "puntoVenta"    TEXT,
  "tipoComprobante" TEXT NOT NULL DEFAULT 'FACTURA', -- FACTURA, NOTA_CREDITO, BOLETA, OTRO
  "fechaEmision"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "fechaVencimiento" TIMESTAMPTZ,
  "clienteId"     UUID,         -- escalar, sin FK dura (Customer del tenant)
  "clienteNombre" TEXT NOT NULL, -- snapshot histórico
  neto   NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total  NUMERIC(14,2) NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'ARS',
  estado TEXT NOT NULL DEFAULT 'EMITIDA', -- EMITIDA, PARCIALMENTE_COBRADA, COBRADA, VENCIDA, ANULADA
  "centroCostoId" UUID,
  "servicioId"    UUID,
  "fileUrl"  TEXT,
  "fileName" TEXT,
  "mimeType" TEXT,
  notas TEXT,
  "uploadedById"     UUID,
  "uploadedByNombre" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS finanza_facturas_tenant_idx   ON finanza_facturas("tenantId");
CREATE INDEX IF NOT EXISTS finanza_facturas_fecha_idx    ON finanza_facturas("fechaEmision");
CREATE INDEX IF NOT EXISTS finanza_facturas_estado_idx   ON finanza_facturas(estado);
CREATE INDEX IF NOT EXISTS finanza_facturas_cliente_idx  ON finanza_facturas("clienteId");
CREATE INDEX IF NOT EXISTS finanza_facturas_cc_idx       ON finanza_facturas("centroCostoId");

CREATE TABLE IF NOT EXISTS finanza_factura_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "facturaId" UUID NOT NULL REFERENCES finanza_facturas(id) ON DELETE CASCADE,
  concepto       TEXT NOT NULL,
  cantidad       NUMERIC(12,2) NOT NULL DEFAULT 1,
  "precioUnitario" NUMERIC(14,2) NOT NULL,
  subtotal       NUMERIC(14,2) NOT NULL,
  "servicioId"    UUID,
  "centroCostoId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS finanza_factura_items_factura_idx ON finanza_factura_items("facturaId");

CREATE TABLE IF NOT EXISTS finanza_cobros (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  UUID NOT NULL,
  "facturaId" UUID NOT NULL REFERENCES finanza_facturas(id) ON DELETE CASCADE,
  fecha   TIMESTAMPTZ NOT NULL DEFAULT now(),
  importe NUMERIC(14,2) NOT NULL,
  moneda  TEXT NOT NULL DEFAULT 'ARS',
  referencia TEXT,
  "medioPago" TEXT,
  notas TEXT,
  "createdById"     UUID,
  "createdByNombre" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS finanza_cobros_tenant_idx  ON finanza_cobros("tenantId");
CREATE INDEX IF NOT EXISTS finanza_cobros_factura_idx ON finanza_cobros("facturaId");
CREATE INDEX IF NOT EXISTS finanza_cobros_fecha_idx   ON finanza_cobros(fecha);

CREATE TABLE IF NOT EXISTS finanza_gastos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  fecha     TIMESTAMPTZ NOT NULL DEFAULT now(),
  proveedor TEXT,
  concepto  TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'OTRO',
  "tipoGasto" TEXT NOT NULL DEFAULT 'OPERATIVO', -- OPERATIVO, ESTRUCTURA, OTRO
  "centroCostoId" UUID,
  total  NUMERIC(14,2) NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'ARS',
  "esRecurrente" BOOLEAN NOT NULL DEFAULT false,
  "fechaDesde"  TIMESTAMPTZ,
  "fechaHasta"  TIMESTAMPTZ,
  "fileUrl"  TEXT,
  "fileName" TEXT,
  "mimeType" TEXT,
  notas TEXT,
  "uploadedById"     UUID,
  "uploadedByNombre" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS finanza_gastos_tenant_idx  ON finanza_gastos("tenantId");
CREATE INDEX IF NOT EXISTS finanza_gastos_fecha_idx   ON finanza_gastos(fecha);
CREATE INDEX IF NOT EXISTS finanza_gastos_tipo_idx    ON finanza_gastos("tipoGasto");
CREATE INDEX IF NOT EXISTS finanza_gastos_cc_idx      ON finanza_gastos("centroCostoId");

-- Campos nuevos en tablas existentes (imputación económica / costo laboral)
ALTER TABLE "Employee"       ADD COLUMN IF NOT EXISTS "costoMensual"  NUMERIC(14,2);
ALTER TABLE "Employee"       ADD COLUMN IF NOT EXISTS "centroCostoId" UUID;
ALTER TABLE flota_vehiculos  ADD COLUMN IF NOT EXISTS "centroCostoId" UUID;
ALTER TABLE flota_servicios  ADD COLUMN IF NOT EXISTS "centroCostoId" UUID;
