CREATE TABLE IF NOT EXISTS p360_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL,
  email text NOT NULL,
  name text,
  phone text,
  "passwordHash" text,
  "avatarUrl" text,
  status text NOT NULL DEFAULT 'ACTIVE',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  UNIQUE ("tenantId", email)
);
CREATE UNIQUE INDEX IF NOT EXISTS p360_users_email_unique ON p360_users (email) WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS p360_users_tenant_idx ON p360_users ("tenantId");
CREATE INDEX IF NOT EXISTS p360_users_status_idx ON p360_users (status);

CREATE TABLE IF NOT EXISTS p360_password_resets (
  token text PRIMARY KEY,
  "userId" uuid NOT NULL,
  email text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
