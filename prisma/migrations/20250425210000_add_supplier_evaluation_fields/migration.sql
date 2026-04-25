-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "providerType" TEXT;

-- AlterTable
ALTER TABLE "supplier_evaluations" ADD COLUMN     "documentationScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
