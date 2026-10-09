-- Resultados del Negocio v2: resultado sin IVA, importación RCV (SII), comprobantes de gastos
ALTER TABLE finanza_facturas ADD COLUMN IF NOT EXISTS "clienteRut" TEXT;
ALTER TABLE finanza_facturas ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'MANUAL';
CREATE INDEX IF NOT EXISTS "finanza_facturas_clienteRut_idx" ON finanza_facturas("clienteRut");

ALTER TABLE finanza_gastos ADD COLUMN IF NOT EXISTS neto NUMERIC(14,2);
ALTER TABLE finanza_gastos ADD COLUMN IF NOT EXISTS iva NUMERIC(14,2);
ALTER TABLE finanza_gastos ADD COLUMN IF NOT EXISTS "tipoComprobante" TEXT;
ALTER TABLE finanza_gastos ADD COLUMN IF NOT EXISTS "numeroComprobante" TEXT;
ALTER TABLE finanza_gastos ADD COLUMN IF NOT EXISTS "proveedorRut" TEXT;
ALTER TABLE finanza_gastos ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'MANUAL';
CREATE INDEX IF NOT EXISTS "finanza_gastos_proveedorRut_idx" ON finanza_gastos("proveedorRut");
