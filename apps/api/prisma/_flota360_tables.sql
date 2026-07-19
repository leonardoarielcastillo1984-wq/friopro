CREATE TABLE IF NOT EXISTS flota360_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  phone text,
  "passwordHash" text,
  "avatarUrl" text,
  status text NOT NULL DEFAULT 'ACTIVE',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  UNIQUE ("tenantId", email)
);
CREATE INDEX IF NOT EXISTS flota360_users_tenant_idx ON flota360_users ("tenantId");
CREATE INDEX IF NOT EXISTS flota360_users_status_idx ON flota360_users (status);

CREATE TABLE IF NOT EXISTS flota360_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL,
  name text NOT NULL,
  description text,
  permissions jsonb,
  "isSystem" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  UNIQUE ("tenantId", name)
);

CREATE TABLE IF NOT EXISTS flota360_tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL,
  "userId" uuid NOT NULL REFERENCES flota360_users(id) ON DELETE CASCADE,
  "roleId" uuid NOT NULL REFERENCES flota360_roles(id) ON DELETE CASCADE,
  "isPrimary" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  UNIQUE ("tenantId", "userId")
);
