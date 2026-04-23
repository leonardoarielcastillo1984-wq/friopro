ALTER TABLE processes ADD COLUMN code TEXT;
ALTER TABLE processes ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE processes ADD COLUMN sites TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE processes ADD COLUMN "departmentId" UUID;
ALTER TABLE processes RENAME COLUMN indicators TO "indicators_legacy";
ALTER TABLE processes RENAME COLUMN documents TO "documents_legacy";
ALTER TABLE processes RENAME COLUMN risks TO "risks_legacy";

CREATE UNIQUE INDEX processes_tenantId_code_key ON processes("tenantId", code);

CREATE TABLE process_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "processId" UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    "indicatorId" UUID NOT NULL,
    CONSTRAINT process_indicators_processId_indicatorId_key UNIQUE ("processId", "indicatorId")
);
CREATE INDEX process_indicators_processId_idx ON process_indicators("processId");
CREATE INDEX process_indicators_indicatorId_idx ON process_indicators("indicatorId");

CREATE TABLE process_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "processId" UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    "documentId" UUID NOT NULL,
    CONSTRAINT process_documents_processId_documentId_key UNIQUE ("processId", "documentId")
);
CREATE INDEX process_documents_processId_idx ON process_documents("processId");
CREATE INDEX process_documents_documentId_idx ON process_documents("documentId");

CREATE TABLE process_risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "processId" UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    "riskId" UUID NOT NULL,
    CONSTRAINT process_risks_processId_riskId_key UNIQUE ("processId", "riskId")
);
CREATE INDEX process_risks_processId_idx ON process_risks("processId");
CREATE INDEX process_risks_riskId_idx ON process_risks("riskId");
