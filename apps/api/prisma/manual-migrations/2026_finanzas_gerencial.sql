-- ═══════════════════════════════════════════════════════════════════════════
-- RESULTADO DE NEGOCIO — capa gerencial
--   Cuentas por pagar (finanza_pagos + vencimientos), clasificación de costos
--   (fijo/variable), comentarios de período, config del tenant.
-- Idempotente: seguro de re-ejecutar.
-- ═══════════════════════════════════════════════════════════════════════════

-- CxP en gastos manuales
ALTER TABLE finanza_gastos ADD COLUMN IF NOT EXISTS "fechaVencimiento" TIMESTAMPTZ;
ALTER TABLE finanza_gastos ADD COLUMN IF NOT EXISTS "claseCosto" TEXT;
CREATE INDEX IF NOT EXISTS finanza_gastos_venc_idx ON finanza_gastos("fechaVencimiento");

-- CxP en facturas de proveedor de flota (pago simple)
ALTER TABLE flota_facturas ADD COLUMN IF NOT EXISTS "fechaVencimiento" TIMESTAMPTZ;
ALTER TABLE flota_facturas ADD COLUMN IF NOT EXISTS "pagadaAt" TIMESTAMPTZ;

-- Pagos (parciales o totales) aplicados a un gasto
CREATE TABLE IF NOT EXISTS finanza_pagos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "gastoId"  UUID NOT NULL REFERENCES finanza_gastos(id) ON DELETE CASCADE,
  fecha      TIMESTAMPTZ NOT NULL DEFAULT now(),
  importe    NUMERIC(14,2) NOT NULL,
  moneda     TEXT NOT NULL DEFAULT 'ARS',
  referencia TEXT,
  "medioPago" TEXT,
  notas      TEXT,
  "createdById"     UUID,
  "createdByNombre" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS finanza_pagos_tenant_idx ON finanza_pagos("tenantId");
CREATE INDEX IF NOT EXISTS finanza_pagos_gasto_idx  ON finanza_pagos("gastoId");
CREATE INDEX IF NOT EXISTS finanza_pagos_fecha_idx  ON finanza_pagos(fecha);

-- Comentarios gerenciales por período
CREATE TABLE IF NOT EXISTS finanza_comentarios_periodo (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "mesKey"   TEXT NOT NULL,
  "centroCostoId" UUID,
  texto      TEXT NOT NULL,
  "createdById"     UUID,
  "createdByNombre" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS finanza_comentarios_tenant_mes_idx ON finanza_comentarios_periodo("tenantId","mesKey");

-- Config del tenant para Resultado de Negocio
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "resultadosConfig" JSONB;
