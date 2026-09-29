-- Migración aditiva: banda del Mapa General de procesos.
-- Clasifica cada ProcessMap dentro de la vista general corporativa:
--   STRATEGIC   → banda superior (Dirección, Gestión de Calidad, Adm. y Finanzas…)
--   OPERATIONAL → carriles centrales en paralelo (Tráfico, Armado de Ruedas, CKD…)
--   COMMERCIAL  → banda transversal comercial
--   SUPPORT     → banda inferior de soporte
-- NULL = la vista deduce la banda por heurística de nombre (retrocompatible).

ALTER TABLE process_maps ADD COLUMN IF NOT EXISTS "mapBand" TEXT;

COMMENT ON COLUMN process_maps."mapBand"
  IS 'Banda en el Mapa General de procesos: STRATEGIC | OPERATIONAL | COMMERCIAL | SUPPORT. NULL = heurística por nombre.';
