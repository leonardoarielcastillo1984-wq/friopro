-- Update WorkOrderStatus enum: remove legacy variants and map existing rows

-- Drop default before changing enum/type (Postgres can't always cast defaults automatically)
ALTER TABLE "work_orders" ALTER COLUMN "status" DROP DEFAULT;

-- 1) Rename old enum type
ALTER TYPE "WorkOrderStatus" RENAME TO "WorkOrderStatus_old";

-- 2) Create new enum type with the desired variants
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- 3) Alter column type using an explicit mapping for legacy values
ALTER TABLE "work_orders"
  ALTER COLUMN "status" TYPE "WorkOrderStatus"
  USING (
    CASE
      WHEN "status"::text = 'PENDING_APPROVAL' THEN 'CANCELLED'
      WHEN "status"::text = 'CLOSED' THEN 'COMPLETED'
      ELSE "status"::text
    END
  )::"WorkOrderStatus";

-- 4) Drop old enum type
DROP TYPE "WorkOrderStatus_old";

-- Restore default
ALTER TABLE "work_orders" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
