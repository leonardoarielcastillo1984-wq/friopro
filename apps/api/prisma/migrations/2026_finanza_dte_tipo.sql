-- Código DTE del SII (33 afecta, 34 exenta, 61 NC, 56 ND...). Afecta y exenta
-- numeran por separado: sin este campo la dedup del RCV confundía folios iguales.
ALTER TABLE "finanza_facturas" ADD COLUMN IF NOT EXISTS "dteTipo" TEXT;
ALTER TABLE "finanza_gastos" ADD COLUMN IF NOT EXISTS "dteTipo" TEXT;

-- Backfill de documentos chilenos existentes: la afecta (33) siempre lleva IVA, la exenta (34) no.
UPDATE "finanza_facturas" SET "dteTipo" = CASE
    WHEN "tipoComprobante" = 'NOTA_CREDITO' THEN '61'
    WHEN "tipoComprobante" = 'NOTA_DEBITO' THEN '56'
    WHEN "tipoComprobante" = 'FACTURA' AND "iva" > 0 THEN '33'
    WHEN "tipoComprobante" = 'FACTURA' THEN '34'
  END
WHERE "dteTipo" IS NULL AND "moneda" = 'CLP'
  AND "tipoComprobante" IN ('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO');

UPDATE "finanza_gastos" SET "dteTipo" = CASE
    WHEN "tipoComprobante" = 'NOTA_CREDITO' THEN '61'
    WHEN "tipoComprobante" = 'NOTA_DEBITO' THEN '56'
    WHEN "tipoComprobante" = 'FACTURA' AND "iva" > 0 THEN '33'
    WHEN "tipoComprobante" = 'FACTURA' THEN '34'
  END
WHERE "dteTipo" IS NULL AND "moneda" = 'CLP' AND "origen" = 'IMPORT_RCV'
  AND "tipoComprobante" IN ('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO');
