-- Vínculo NC → factura: una nota de crédito puede apuntar a la factura que
-- cancela. Su monto descuenta el saldo de ESA factura (y deja de mostrarla
-- vencida) en vez de netearse contra la deuda más vieja del cliente.
-- Idempotente: safe para correr más de una vez.

ALTER TABLE "finanza_facturas" ADD COLUMN IF NOT EXISTS "aplicaAFacturaId" UUID;
CREATE INDEX IF NOT EXISTS "finanza_facturas_aplicaAFacturaId_idx"
    ON "finanza_facturas" ("aplicaAFacturaId");
