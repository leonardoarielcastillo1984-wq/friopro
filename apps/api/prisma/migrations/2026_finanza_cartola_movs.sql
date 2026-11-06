-- Auditoría de movimientos de cartola/caja chica importados (conciliación).
-- Cada fila es un movimiento del archivo: quedó conciliado (con sus vínculos
-- a facturas/gastos), sin match (con el motivo), vinculado a mano, ignorado
-- o deshecho. La firma deduplica entre re-importaciones del mismo archivo.
-- Idempotente: safe para correr más de una vez.

CREATE TABLE IF NOT EXISTS "finanza_cartola_movs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,

    "tipo" TEXT NOT NULL,                -- ABONO | CARGO
    "origen" TEXT NOT NULL DEFAULT 'CARTOLA', -- CARTOLA | CAJA_CHICA
    "firma" TEXT NOT NULL,               -- firmaCobro(fila): dedupe

    "fecha" TIMESTAMPTZ NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "referencia" TEXT,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'CLP',

    "estado" TEXT NOT NULL,              -- conciliado | sin_match | vinculado_manual | deshecho | ignorado
    "como" TEXT,                         -- folio | rut | nombre | monto | manual
    "confianza" TEXT,                    -- alta | media | baja
    "motivo" TEXT,                       -- por qué quedó sin_match
    "excedente" DECIMAL(14,2),           -- parte del abono que no se imputó

    "vinculos" JSONB,                    -- [{ tipo:'factura'|'gasto', id, numero, cliente|proveedor, aplicar, moneda }]

    "appliedAt" TIMESTAMPTZ,             -- cuándo se aplicaron cobros/pagos
    "resueltoPor" TEXT,                  -- quién lo resolvió a mano

    "createdById" UUID,
    "createdByNombre" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finanza_cartola_movs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "finanza_cartola_movs_tenantId_firma_origen_key"
    ON "finanza_cartola_movs"("tenantId", "firma", "origen");
CREATE INDEX IF NOT EXISTS "finanza_cartola_movs_tenantId_tipo_idx"
    ON "finanza_cartola_movs"("tenantId", "tipo");
CREATE INDEX IF NOT EXISTS "finanza_cartola_movs_tenantId_estado_idx"
    ON "finanza_cartola_movs"("tenantId", "estado");
CREATE INDEX IF NOT EXISTS "finanza_cartola_movs_tenantId_fecha_idx"
    ON "finanza_cartola_movs"("tenantId", "fecha");

-- Fechas estimadas de cobro/pago: la fecha prometida por el cliente (o la
-- planificada de pago) tiene prioridad sobre el vencimiento en proyecciones.
ALTER TABLE "finanza_facturas" ADD COLUMN IF NOT EXISTS "fechaCobroEstimada" TIMESTAMPTZ;
ALTER TABLE "finanza_gastos"   ADD COLUMN IF NOT EXISTS "fechaPagoEstimada"  TIMESTAMPTZ;
