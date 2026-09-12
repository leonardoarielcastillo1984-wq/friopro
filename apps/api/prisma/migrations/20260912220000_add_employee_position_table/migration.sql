-- CreateTable: EmployeePosition (many-to-many Employee <-> Position)
CREATE TABLE IF NOT EXISTS "EmployeePosition" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeePosition_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on (employeeId, positionId)
CREATE UNIQUE INDEX IF NOT EXISTS "EmployeePosition_employeeId_positionId_key" ON "EmployeePosition"("employeeId", "positionId");

-- Create indexes
CREATE INDEX IF NOT EXISTS "EmployeePosition_employeeId_idx" ON "EmployeePosition"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeePosition_positionId_idx" ON "EmployeePosition"("positionId");

-- Add foreign key constraints
ALTER TABLE "EmployeePosition" ADD CONSTRAINT "EmployeePosition_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE;
ALTER TABLE "EmployeePosition" ADD CONSTRAINT "EmployeePosition_positionId_fkey"
    FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE;

-- Migrate existing positionId data to EmployeePosition
INSERT INTO "EmployeePosition" ("employeeId", "positionId", "createdAt")
SELECT "id", "positionId", NOW()
FROM "Employee"
WHERE "positionId" IS NOT NULL
ON CONFLICT DO NOTHING;
