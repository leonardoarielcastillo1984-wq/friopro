-- 2026_seh_column_defaults.sql
-- Las tablas seh_* se crearon sin defaults en id / updatedAt / createdAt.
-- Sin defaults, prisma.create/createMany envía INSERTs que violan NOT NULL
-- (ej: auto-creación del cliente "Principal" en GET /seh360/clients).
-- Idempotente: solo toca columnas NOT NULL sin default existente.

DO $$
DECLARE r RECORD;
BEGIN
  -- id → gen_random_uuid()
  FOR r IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name LIKE 'seh\_%'
      AND column_name = 'id' AND is_nullable = 'NO' AND column_default IS NULL
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET DEFAULT gen_random_uuid()', r.table_name);
  END LOOP;

  -- updatedAt → now()
  FOR r IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name LIKE 'seh\_%'
      AND column_name = 'updatedAt' AND is_nullable = 'NO' AND column_default IS NULL
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "updatedAt" SET DEFAULT now()', r.table_name);
  END LOOP;

  -- createdAt → now()
  FOR r IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name LIKE 'seh\_%'
      AND column_name = 'createdAt' AND is_nullable = 'NO' AND column_default IS NULL
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "createdAt" SET DEFAULT now()', r.table_name);
  END LOOP;
END $$;
