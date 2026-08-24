-- Migration: ActionItem (CAPA) → ActionPlan
-- Copies all non-deleted ActionItem records into action_plans,
-- mapping 8D fields. Uses ON CONFLICT DO NOTHING for idempotency.
-- Run: docker exec sgi-postgres psql -U sgi -d sgi -f /tmp/2026_migrate_actionitem_to_actionplan.sql

INSERT INTO action_plans (
  id,
  "tenantId",
  code,
  type,
  status,
  origin,
  area,
  "findingDescription",
  "immediateCorrection",
  "rootCauseAnalysis",
  "analysisMethod",
  "validatedRootCause",
  "plannedAction",
  "requiredResources",
  "executorId",
  "plannedEndDate",
  "actualEndDate",
  "progressPercent",
  effectiveness,
  "effectivenessMethod",
  "effectivenessCheckDate",
  observations,
  priority,
  "detectedBy",
  "preventiveAction",
  "processChanges",
  "documentationChanges",
  "initialProbability",
  "initialImpact",
  "initialRiskLevel",
  "residualProbability",
  "residualImpact",
  "residualRiskLevel",
  "riskReduction",
  "closedAt",
  "createdAt",
  "updatedAt",
  "createdById",
  "updatedById"
)
SELECT
  ai.id,
  ai."tenantId",
  ai.code,
  -- Map CAPA type to ActionPlan type
  CASE ai.type
    WHEN 'CORRECTIVE'  THEN 'CORRECTIVE'
    WHEN 'PREVENTIVE'  THEN 'PREVENTIVE'
    WHEN 'IMPROVEMENT' THEN 'IMPROVEMENT'
    ELSE 'CORRECTIVE'
  END,
  -- Map CAPA status to ActionPlan status
  CASE ai.status
    WHEN 'OPEN'         THEN 'OPEN'
    WHEN 'IN_PROGRESS'  THEN 'IN_EXECUTION'
    WHEN 'VERIFICATION' THEN 'PENDING_EFFECTIVENESS'
    WHEN 'CLOSED'       THEN 'CLOSED'
    WHEN 'CANCELLED'    THEN 'CANCELLED'
    ELSE 'OPEN'
  END,
  -- Map sourceType/origin
  CASE COALESCE(ai.origin, ai."sourceType")
    WHEN 'AUDIT'        THEN 'AUDIT'
    WHEN 'NCR'          THEN 'NCR'
    WHEN 'INDICATOR'    THEN 'INDICATOR'
    WHEN 'RISK'         THEN 'RISK'
    WHEN 'REVIEW'       THEN 'MANAGEMENT_REVIEW'
    WHEN 'INCIDENT'     THEN 'INCIDENT'
    WHEN 'CLIENT'       THEN 'COMPLAINT'
    ELSE 'MANUAL'
  END,
  ai."affectedArea",
  -- Combine title + description as findingDescription
  CASE
    WHEN ai.description IS NOT NULL AND ai.description <> ''
    THEN ai.title || E'\n\n' || ai.description
    ELSE ai.title
  END,
  ai."containmentActions",
  ai."rootCause",
  -- Map analysis method
  CASE ai."rootCauseMethod"
    WHEN 'FIVE_WHY'  THEN 'FIVE_WHYS'
    WHEN 'ISHIKAWA'  THEN 'ISHIKAWA'
    WHEN 'OTHER'     THEN 'OTHER'
    ELSE NULL
  END,
  NULL, -- validatedRootCause
  ai."correctiveAction",
  ai."correctiveResources",
  ai."assignedToId",
  ai."correctiveDueDate",
  ai."closedAt",
  COALESCE(ai.progress, 0),
  -- Map effectiveness
  CASE ai."effectivenessResult"
    WHEN 'EFFECTIVE'     THEN 'EFFECTIVE'
    WHEN 'NOT_EFFECTIVE' THEN 'NOT_EFFECTIVE'
    ELSE 'PENDING'
  END,
  ai."verificationMethod",
  ai."effectivenessEvaluatedAt",
  -- Combine closure comments and notes as observations
  CASE
    WHEN ai."closureComments" IS NOT NULL THEN ai."closureComments"
    WHEN ai.notes IS NOT NULL THEN ai.notes
    ELSE NULL
  END,
  ai.priority,
  ai."detectedBy",
  ai."preventiveAction",
  ai."processChanges",
  ai."documentationChanges",
  ai."initialProbability",
  ai."initialImpact",
  ai."initialRiskLevel",
  ai."residualProbability",
  ai."residualImpact",
  ai."residualRiskLevel",
  ai."riskReduction",
  ai."closedAt",
  ai."createdAt",
  ai."updatedAt",
  ai."createdById",
  ai."updatedById"
FROM action_items ai
WHERE ai."deletedAt" IS NULL
ON CONFLICT (id) DO NOTHING;

-- Verify
SELECT
  'ActionItems migrated' AS info,
  COUNT(*) AS total
FROM action_plans ap
INNER JOIN action_items ai ON ai.id = ap.id
WHERE ai."deletedAt" IS NULL;
