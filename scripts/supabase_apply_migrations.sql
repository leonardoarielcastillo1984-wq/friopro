-- Consolidated Prisma migrations for Supabase SQL Editor
-- Source: prisma/migrations/**/migration.sql
-- IMPORTANT:
-- - Run blocks in order.
-- - Do NOT wrap everything in a single transaction.
-- - If a block fails because it was already applied, you can usually continue to the next block.


-- =====================================================================
-- MIGRATION: 20260115210354_add_nextauth_tables
-- =====================================================================
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('SPLIT_INVERTER', 'SPLIT_ON_OFF', 'HELADERA', 'FREEZER', 'CAMARA');

-- CreateEnum
CREATE TYPE "WorkOrderServiceType" AS ENUM ('FALLA', 'MANTENIMIENTO', 'INSTALACION');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL', 'CLOSED');

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('FREE', 'PRO', 'PRO_PLUS');

-- CreateEnum
CREATE TYPE "UsageEventType" AS ENUM ('WORKORDER_CREATED', 'PDF_GENERATED', 'AI_CALL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TECHNICIAN',
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "phone" TEXT,
    "logo_url" TEXT,
    "address" TEXT,
    "currency" TEXT DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT,
    "type" "EquipmentType" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serial" TEXT,
    "refrigerant" TEXT,
    "capacity" TEXT,
    "location_address" TEXT,
    "public_id" TEXT NOT NULL,

    CONSTRAINT "equipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "service_type" "WorkOrderServiceType" NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "symptoms" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurements" (
    "workorder_id" TEXT NOT NULL,
    "suction_pressure" DOUBLE PRECISION,
    "discharge_pressure" DOUBLE PRECISION,
    "return_temp" DOUBLE PRECISION,
    "supply_temp" DOUBLE PRECISION,
    "compressor_current" DOUBLE PRECISION,
    "voltage" DOUBLE PRECISION,
    "ambient_temp" DOUBLE PRECISION,
    "vacuum_value" DOUBLE PRECISION,
    "vacuum_time" INTEGER,
    "piping_length" DOUBLE PRECISION,
    "leak_test" TEXT,
    "notes" TEXT,

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("workorder_id")
);

-- CreateTable
CREATE TABLE "evidence_photos" (
    "id" TEXT NOT NULL,
    "workorder_id" TEXT NOT NULL,
    "category" TEXT,
    "file_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "workorder_id" TEXT NOT NULL,
    "ai_hypotheses" JSONB,
    "ai_recommendations" TEXT,
    "ai_client_summary" TEXT,
    "ai_alerts" TEXT,
    "technician_notes" TEXT,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("workorder_id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" TEXT NOT NULL,
    "workorder_id" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "workorder_id" TEXT NOT NULL,
    "signer_name" TEXT NOT NULL,
    "signature_file_url" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("workorder_id")
);

-- CreateTable
CREATE TABLE "pdf_reports" (
    "workorder_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,

    CONSTRAINT "pdf_reports_pkey" PRIMARY KEY ("workorder_id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" "PlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "max_workorders_per_month" INTEGER NOT NULL,
    "max_equipments" INTEGER NOT NULL,
    "ai_enabled" BOOLEAN NOT NULL DEFAULT false,
    "pdf_enabled" BOOLEAN NOT NULL DEFAULT false,
    "qr_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "type" "UsageEventType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "clients_user_id_idx" ON "clients"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipments_public_id_key" ON "equipments"("public_id");

-- CreateIndex
CREATE INDEX "equipments_user_id_idx" ON "equipments"("user_id");

-- CreateIndex
CREATE INDEX "equipments_client_id_idx" ON "equipments"("client_id");

-- CreateIndex
CREATE INDEX "work_orders_user_id_idx" ON "work_orders"("user_id");

-- CreateIndex
CREATE INDEX "work_orders_client_id_idx" ON "work_orders"("client_id");

-- CreateIndex
CREATE INDEX "work_orders_equipment_id_idx" ON "work_orders"("equipment_id");

-- CreateIndex
CREATE INDEX "evidence_photos_workorder_id_idx" ON "evidence_photos"("workorder_id");

-- CreateIndex
CREATE INDEX "quote_items_workorder_id_idx" ON "quote_items"("workorder_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "licenses_user_id_idx" ON "licenses"("user_id");

-- CreateIndex
CREATE INDEX "licenses_plan_id_idx" ON "licenses"("plan_id");

-- CreateIndex
CREATE INDEX "licenses_expires_at_idx" ON "licenses"("expires_at");

-- CreateIndex
CREATE INDEX "usage_events_license_id_idx" ON "usage_events"("license_id");

-- CreateIndex
CREATE INDEX "usage_events_type_created_at_idx" ON "usage_events"("type", "created_at");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_workorder_id_fkey" FOREIGN KEY ("workorder_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_photos" ADD CONSTRAINT "evidence_photos_workorder_id_fkey" FOREIGN KEY ("workorder_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_workorder_id_fkey" FOREIGN KEY ("workorder_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_workorder_id_fkey" FOREIGN KEY ("workorder_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_workorder_id_fkey" FOREIGN KEY ("workorder_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_reports" ADD CONSTRAINT "pdf_reports_workorder_id_fkey" FOREIGN KEY ("workorder_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- =====================================================================
-- MIGRATION: 20260115211754_saas_status_fields
-- =====================================================================
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');

-- AlterTable
ALTER TABLE "licenses" ADD COLUMN "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "licenses_status_idx" ON "licenses"("status");


-- =====================================================================
-- MIGRATION: 20260115231711_equipment_type_custom
-- =====================================================================
-- AlterEnum
ALTER TYPE "EquipmentType" ADD VALUE 'VENTANA';
ALTER TYPE "EquipmentType" ADD VALUE 'OTRO';

-- AlterTable
ALTER TABLE "equipments" ADD COLUMN "custom_type" TEXT;


-- =====================================================================
-- MIGRATION: 20260115232835_maintenance_reminders
-- =====================================================================
-- CreateTable
CREATE TABLE "maintenance_plans" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "next_date" TIMESTAMP(3) NOT NULL,
    "notify_email" BOOLEAN NOT NULL DEFAULT false,
    "notify_message" BOOLEAN NOT NULL DEFAULT false,
    "days_before" INTEGER NOT NULL DEFAULT 7,
    "last_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT,
    "equipment_id" TEXT,
    "channel" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_plans_equipment_id_key" ON "maintenance_plans"("equipment_id");

-- CreateIndex
CREATE INDEX "maintenance_plans_next_date_idx" ON "maintenance_plans"("next_date");

-- CreateIndex
CREATE INDEX "maintenance_plans_last_notified_at_idx" ON "maintenance_plans"("last_notified_at");

-- CreateIndex
CREATE INDEX "notification_logs_user_id_idx" ON "notification_logs"("user_id");

-- CreateIndex
CREATE INDEX "notification_logs_client_id_idx" ON "notification_logs"("client_id");

-- CreateIndex
CREATE INDEX "notification_logs_equipment_id_idx" ON "notification_logs"("equipment_id");

-- CreateIndex
CREATE INDEX "notification_logs_channel_idx" ON "notification_logs"("channel");

-- CreateIndex
CREATE INDEX "notification_logs_status_idx" ON "notification_logs"("status");

-- AddForeignKey
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- =====================================================================
-- MIGRATION: 20260116001829_payments
-- =====================================================================
-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_code" "PlanCode" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- =====================================================================
-- MIGRATION: 20260116091000_workorder_status_enum_update
-- =====================================================================
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
