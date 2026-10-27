-- Sueldo mensual por empleado importado desde la planilla de liquidaciones.
-- Si existe una fila para (tenantId, employeeId, anio, mes), Resultados usa ese
-- monto (COSTO EMPRESA) en vez de Employee.costoMensual.

CREATE TABLE IF NOT EXISTS "EmployeeSalary" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "tipoGasto" TEXT NOT NULL DEFAULT 'OPERATIVO',
    "origen" TEXT NOT NULL DEFAULT 'IMPORT_SUELDOS',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "EmployeeSalary_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmployeeSalary_tenantId_anio_mes_idx" ON "EmployeeSalary"("tenantId", "anio", "mes");

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeSalary_tenantId_employeeId_anio_mes_key" ON "EmployeeSalary"("tenantId", "employeeId", "anio", "mes");

ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
