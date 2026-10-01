-- Alcance normativo por mapa de procesos (ISO 9001 / IATF 16949).
-- null = aplica a todas las normas (default, retrocompatible).
ALTER TABLE process_maps ADD COLUMN IF NOT EXISTS norm text;
