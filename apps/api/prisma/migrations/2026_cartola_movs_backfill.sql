-- Backfill: reconstruye finanza_cartola_movs para las cartolas importadas
-- ANTES de que existiera la tabla. Los cobros/pagos ya aplicados guardan la
-- firma del movimiento en referencia = 'CARTOLA:{firma}'; se agrupan por
-- (tenantId, firma) y quedan como estado 'conciliado' con sus vínculos.
-- Idempotente: ON CONFLICT DO NOTHING + safe para correr más de una vez.
-- Los movimientos que quedaron sin match en su momento no se pueden
-- reconstruir (no dejaron cobros/pagos) — solo aparecen los conciliados.

-- ABONOS: cobros aplicados a facturas
WITH agr AS (
  SELECT
    c."tenantId",
    substring(c.referencia from 9) AS firma,
    min(c.fecha)                 AS fecha,
    sum(c.importe)               AS monto,
    min(c.moneda)                AS moneda,
    max(c."createdAt")           AS applied_at,
    string_agg(DISTINCT f."clienteNombre", ', ') AS desc_partes,
    jsonb_agg(jsonb_build_object(
      'doc', 'factura', 'id', f.id,
      'numero', nullif(concat_ws('-', f."puntoVenta", f.numero), ''),
      'cliente', f."clienteNombre",
      'aplicar', c.importe, 'moneda', c.moneda
    )) AS vinculos
  FROM finanza_cobros c
  JOIN finanza_facturas f ON f.id = c."facturaId"
  WHERE c.referencia LIKE 'CARTOLA:%'
  GROUP BY c."tenantId", substring(c.referencia from 9)
)
INSERT INTO finanza_cartola_movs
  (id, "tenantId", tipo, origen, firma, fecha, descripcion, referencia,
   monto, moneda, estado, como, motivo, vinculos, "appliedAt",
   "createdAt", "updatedAt")
SELECT
  gen_random_uuid(), "tenantId", 'ABONO', 'CARTOLA', firma, fecha,
  desc_partes || ' — cobro de cartola', NULL,
  monto, moneda, 'conciliado', 'historial',
  'Importado antes de la conciliación auditable — reconstruido desde cobros ya aplicados',
  vinculos, applied_at, now(), now()
FROM agr
ON CONFLICT ("tenantId", "firma", "origen") DO NOTHING;

-- CARGOS: pagos aplicados a gastos
WITH agr AS (
  SELECT
    p."tenantId",
    substring(p.referencia from 9) AS firma,
    min(p.fecha)                 AS fecha,
    sum(p.importe)               AS monto,
    min(p.moneda)                AS moneda,
    max(p."createdAt")           AS applied_at,
    string_agg(DISTINCT coalesce(g.proveedor, g.concepto), ', ') AS desc_partes,
    jsonb_agg(jsonb_build_object(
      'doc', 'gasto', 'id', g.id,
      'numero', g."numeroComprobante",
      'proveedor', g.proveedor,
      'aplicar', p.importe, 'moneda', p.moneda
    )) AS vinculos
  FROM finanza_pagos p
  JOIN finanza_gastos g ON g.id = p."gastoId"
  WHERE p.referencia LIKE 'CARTOLA:%'
  GROUP BY p."tenantId", substring(p.referencia from 9)
)
INSERT INTO finanza_cartola_movs
  (id, "tenantId", tipo, origen, firma, fecha, descripcion, referencia,
   monto, moneda, estado, como, motivo, vinculos, "appliedAt",
   "createdAt", "updatedAt")
SELECT
  gen_random_uuid(), "tenantId", 'CARGO', 'CARTOLA', firma, fecha,
  desc_partes || ' — pago de cartola', NULL,
  monto, moneda, 'conciliado', 'historial',
  'Importado antes de la conciliación auditable — reconstruido desde pagos ya aplicados',
  vinculos, applied_at, now(), now()
FROM agr
ON CONFLICT ("tenantId", "firma", "origen") DO NOTHING;
