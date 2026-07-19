CREATE TABLE IF NOT EXISTS siniestro360_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL,
  email text NOT NULL,
  name text,
  "firstName" text,
  "lastName" text,
  phone text,
  "passwordHash" text,
  "avatarUrl" text,
  status text NOT NULL DEFAULT 'ACTIVE',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  UNIQUE ("tenantId", email)
);
CREATE INDEX IF NOT EXISTS siniestro360_users_tenant_idx ON siniestro360_users ("tenantId");
CREATE INDEX IF NOT EXISTS siniestro360_users_status_idx ON siniestro360_users (status);

CREATE TABLE IF NOT EXISTS siniestro360_password_resets (
  token text PRIMARY KEY,
  "userId" uuid NOT NULL,
  email text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

-- Repuntar el FK de memberships desde PlatformUser hacia siniestro360_users (0 filas, seguro)
ALTER TABLE siniestro360_tenant_memberships DROP CONSTRAINT IF EXISTS "siniestro360_tenant_memberships_userId_fkey";
ALTER TABLE siniestro360_tenant_memberships ADD CONSTRAINT "siniestro360_tenant_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES siniestro360_users(id) ON DELETE CASCADE;
