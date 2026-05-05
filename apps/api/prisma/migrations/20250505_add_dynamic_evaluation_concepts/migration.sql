-- Create EvaluationConcept table
CREATE TABLE "evaluation_concepts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_concepts_pkey" PRIMARY KEY ("id")
);

-- Create EvaluationScore table
CREATE TABLE "evaluation_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "evaluationId" UUID NOT NULL,
    "conceptId" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_scores_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "evaluation_scores_evaluationId_conceptId_key" UNIQUE ("evaluationId", "conceptId")
);

-- Create indexes
CREATE INDEX "evaluation_concepts_tenantId_idx" ON "evaluation_concepts"("tenantId");
CREATE INDEX "evaluation_scores_evaluationId_idx" ON "evaluation_scores"("evaluationId");
CREATE INDEX "evaluation_scores_conceptId_idx" ON "evaluation_scores"("conceptId");
CREATE INDEX "evaluation_scores_tenantId_idx" ON "evaluation_scores"("tenantId");

-- Add foreign key constraints
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "supplier_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "evaluation_concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Insert default evaluation concepts for existing tenants
-- These will be the default concepts that match the legacy fields
INSERT INTO "evaluation_concepts" ("tenantId", "name", "description", "weight", "isActive", "order")
SELECT DISTINCT 
    "tenantId",
    'Calidad',
    'Evaluación de la calidad de los productos/servicios',
    1.0,
    true,
    1
FROM "suppliers"
ON CONFLICT DO NOTHING;

INSERT INTO "evaluation_concepts" ("tenantId", "name", "description", "weight", "isActive", "order")
SELECT DISTINCT 
    "tenantId",
    'Cumplimiento de entrega',
    'Evaluación del cumplimiento de tiempos de entrega',
    1.0,
    true,
    2
FROM "suppliers"
ON CONFLICT DO NOTHING;

INSERT INTO "evaluation_concepts" ("tenantId", "name", "description", "weight", "isActive", "order")
SELECT DISTINCT 
    "tenantId",
    'Precio',
    'Evaluación de competitividad de precios',
    1.0,
    true,
    3
FROM "suppliers"
ON CONFLICT DO NOTHING;

INSERT INTO "evaluation_concepts" ("tenantId", "name", "description", "weight", "isActive", "order")
SELECT DISTINCT 
    "tenantId",
    'Servicio',
    'Evaluación del servicio al cliente y soporte',
    1.0,
    true,
    4
FROM "suppliers"
ON CONFLICT DO NOTHING;

INSERT INTO "evaluation_concepts" ("tenantId", "name", "description", "weight", "isActive", "order")
SELECT DISTINCT 
    "tenantId",
    'Documentación',
    'Evaluación de la calidad de documentación',
    1.0,
    true,
    5
FROM "suppliers"
ON CONFLICT DO NOTHING;
