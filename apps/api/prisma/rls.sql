-- Base RLS para SGI 360 (shared schema)
--
-- Estrategia:
-- - Backend setea por request:
--   SELECT set_config('app.user_id', '<uuid>', true);
--   SELECT set_config('app.tenant_id', '<uuid>', true);
-- - Las policies usan current_setting('app.user_id', true) y membership.
--
-- Nota: Prisma migrations se integrarán luego. Este script sirve como referencia/aplicación manual.

-- Helper: safe getters
-- current_setting(..., true) devuelve NULL si no está seteado.

-- TENANT_MEMBERSHIPS
ALTER TABLE "TenantMembership" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_membership_is_owner_or_admin
ON "TenantMembership"
FOR SELECT
USING (
  "userId" = current_setting('app.user_id', true)::uuid
);

-- TENANTS: visible solo si el usuario tiene membership al tenant.
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_visible_if_member
ON "Tenant"
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM "TenantMembership" tm
    WHERE tm."tenantId" = "Tenant"."id"
      AND tm."userId" = current_setting('app.user_id', true)::uuid
      AND tm."status" = 'ACTIVE'
      AND tm."deletedAt" IS NULL
  )
);

-- Ejemplo para tablas tenant-scoped (AiFinding)
ALTER TABLE "AiFinding" ENABLE ROW LEVEL SECURITY;

CREATE POLICY aifinding_tenant_isolation
ON "AiFinding"
FOR ALL
USING (
  "tenantId" = current_setting('app.tenant_id', true)::uuid
  AND EXISTS (
    SELECT 1
    FROM "TenantMembership" tm
    WHERE tm."tenantId" = "AiFinding"."tenantId"
      AND tm."userId" = current_setting('app.user_id', true)::uuid
      AND tm."status" = 'ACTIVE'
      AND tm."deletedAt" IS NULL
  )
)
WITH CHECK (
  "tenantId" = current_setting('app.tenant_id', true)::uuid
);

-- SUPER ADMIN / auditor global:
-- Se implementará vía conexión separada (rol DB) o claim especial y bypass controlado.
-- No debe desactivar RLS globalmente; debe consultar siempre filtrando por tenant.
