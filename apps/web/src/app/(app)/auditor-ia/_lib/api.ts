// Auditor IA — helpers de API + tipos compartidos del frontend.
import { apiFetch } from '@/lib/api';

const BASE = '/auditor-ia';

// ── Tipos ────────────────────────────────────────────────────

export interface Norma {
  id: string;
  name: string;
  code: string;
  version: string;
  status: string;
  hasPdf: boolean;
  totalClauses: number | null;
  extraction: {
    id: string;
    status: string;
    revision: number;
    pageCount: number | null;
    requirementCount: number;
    createdAt: string;
  } | null;
}

export interface Requirement {
  id: string;
  code: string;
  clauseNumber: string;
  statement: string;
  verificationTypes: string[];
  connectorKeys: string[];
  page: number | null;
  requiresDocumentedInfo: boolean;
  origin: string;
  status: 'PROPOSED' | 'APPROVED' | 'DISCARDED';
  order: number;
  clause?: { id: string; title: string } | null;
}

export interface Extraction {
  id: string;
  tenantId: string;
  normativeId: string;
  revision: number;
  status: string;
  method: string | null;
  pageCount: number | null;
  diagnostic: unknown;
  createdAt: string;
  normative: { id: string; name: string; code: string; version: string };
  requirements: Requirement[];
}

export interface ReviewSummary {
  id: string;
  status: string;
  progress: number;
  scope: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  sites: string[];
  estTokens: number;
  usedTokens: number;
  totals: unknown;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  extraction?: { normative: { name: string; code: string; version: string } };
}

export interface EvaluationRow {
  id: string;
  requirementId: string;
  attempt: number;
  noProvider?: boolean;
  limitations?: string[] | null;
  workStatus: string;
  evidenceStatus: string;
  aiVerdict: string;
  humanDecision: string;
  tokens: number;
  updatedAt: string;
  requirement: { code: string; clauseNumber: string; statement: string; page: number | null };
}

export interface ReviewDetail extends ReviewSummary {
  extraction: {
    id: string;
    revision: number;
    status: string;
    normative: { id: string; name: string; code: string; version: string };
  };
  evaluations: EvaluationRow[];
}

export interface EvidenceLink {
  id: string;
  connectorKey: string;
  entityType: string;
  entityId: string;
  title: string;
  summary: string | null;
  url: string | null;
  origin: string;
  aiAssessment: string | null;
  inPeriod: boolean | null;
}

export interface DecisionLog {
  id: string;
  axis: string;
  fromValue: string | null;
  toValue: string;
  actorId: string | null;
  comment: string | null;
  createdAt: string;
}

export interface EvaluationDetail {
  id: string;
  attempt: number;
  workStatus: string;
  evidenceStatus: string;
  aiVerdict: string;
  humanDecision: string;
  explanation: string | null;
  limitations: string[] | null;
  gaps: Array<{ description: string; relatedRefs?: string[] }> | null;
  proposals: Array<{ action: string; target?: string }> | null;
  auditQuestions: string[] | null;
  externalChecks: string[] | null;
  sourcesConsulted: string[] | null;
  sourcesUnavailable: Array<{ connectorKey: string; reason: string }> | null;
  noProvider: boolean;
  naJustification: string | null;
  requirement: {
    code: string; clauseNumber: string; statement: string; page: number | null;
    verificationTypes: string[]; requiresDocumentedInfo: boolean;
  };
  evidenceLinks: EvidenceLink[];
  decisionLogs: DecisionLog[];
  review: { id: string; normativeId: string; periodFrom: string | null; periodTo: string | null };
}

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: string;
  clause: string;
  status: string;
  validationStatus: string | null;
  actionPlanId: string | null;
  createdAt: string;
}

// ── Endpoints ────────────────────────────────────────────────

export const normas = () => apiFetch<{ items: Norma[] }>(`${BASE}/normas`);

export const startExtraction = (normativeId: string) =>
  apiFetch<{ extractionId: string; status: string }>(
    `${BASE}/normas/${normativeId}/extracciones`,
    { method: 'POST', json: {} },
  );

export const getExtraction = (id: string) =>
  apiFetch<Extraction>(`${BASE}/extracciones/${id}`);

export const getSourcePage = (extractionId: string, page: number) =>
  apiFetch<{ page: number; text: string }>(`${BASE}/extracciones/${extractionId}/paginas/${page}`);

export const patchRequirement = (id: string, body: Record<string, unknown>) =>
  apiFetch<Requirement>(`${BASE}/requisitos/${id}`, { method: 'PATCH', json: body });

export const approveExtraction = (id: string) =>
  apiFetch<{ status: string }>(`${BASE}/extracciones/${id}/aprobar`, { method: 'POST', json: {} });

export const rejectExtraction = (id: string, reason: string) =>
  apiFetch<{ status: string }>(`${BASE}/extracciones/${id}/rechazar`, { method: 'POST', json: { reason } });

export const estimateReview = (extractionId: string, requirementIds?: string[]) =>
  apiFetch<{ requirements: number; estTokens: number }>(`${BASE}/revisiones/estimar`, {
    method: 'POST',
    json: { extractionId, ...(requirementIds?.length ? { requirementIds } : {}) },
  });

export const createReview = (body: {
  extractionId: string;
  scope?: string;
  processIds?: string[];
  sites?: string[];
  periodFrom?: string;
  periodTo?: string;
  requirementIds?: string[];
  tokenBudget?: number;
}) => apiFetch<{ reviewId: string }>(`${BASE}/revisiones`, { method: 'POST', json: body });

export const listReviews = (params = '') =>
  apiFetch<{ items: ReviewSummary[] }>(`${BASE}/revisiones${params}`);

export const getReview = (id: string) =>
  apiFetch<ReviewDetail>(`${BASE}/revisiones/${id}`);

export const cancelReview = (id: string) =>
  apiFetch(`${BASE}/revisiones/${id}/cancelar`, { method: 'POST', json: {} });

export const retryReview = (id: string) =>
  apiFetch(`${BASE}/revisiones/${id}/reintentar`, { method: 'POST', json: {} });

export const getEvaluation = (id: string) =>
  apiFetch<EvaluationDetail>(`${BASE}/evaluaciones/${id}`);

export const decideEvaluation = (id: string, decision: string, comment?: string) =>
  apiFetch(`${BASE}/evaluaciones/${id}/decision`, { method: 'POST', json: { decision, comment } });

export const proposeNA = (id: string, justification: string) =>
  apiFetch(`${BASE}/evaluaciones/${id}/na-proponer`, { method: 'POST', json: { justification } });

export const approveNA = (id: string, approve: boolean, comment?: string) =>
  apiFetch(`${BASE}/evaluaciones/${id}/na-aprobar`, { method: 'POST', json: { approve, comment } });

export const reevaluate = (id: string) =>
  apiFetch(`${BASE}/evaluaciones/${id}/reevaluar`, { method: 'POST', json: {} });

export const reevaluateAll = (reviewId: string) =>
  apiFetch<{ queued: number }>(`${BASE}/revisiones/${reviewId}/reevaluar-todas`, {
    method: 'POST', json: {},
  });

export const checkStaleness = (reviewId: string) =>
  apiFetch<{ markedStale: number }>(`${BASE}/revisiones/${reviewId}/verificar-staleness`, {
    method: 'POST', json: {},
  });

export const searchConnector = (key: string, q: string) =>
  apiFetch<{ items: Array<{ entityType: string; entityId: string; title: string }> }>(
    `${BASE}/conectores/${key}/buscar?q=${encodeURIComponent(q)}`,
  );

export const addEvidence = (id: string, body: { connectorKey: string; entityType: string; entityId: string; title?: string; note?: string }) =>
  apiFetch<EvidenceLink>(`${BASE}/evaluaciones/${id}/evidencias`, { method: 'POST', json: body });

export const removeEvidence = (id: string, linkId: string) =>
  apiFetch(`${BASE}/evaluaciones/${id}/evidencias/${linkId}`, { method: 'DELETE' });

export const createFinding = (evaluationId: string, body: { title: string; description: string; severity: string }) =>
  apiFetch<Finding>(`${BASE}/evaluaciones/${evaluationId}/hallazgo`, { method: 'POST', json: body });

export const listFindings = (reviewId: string) =>
  apiFetch<{ items: Finding[] }>(`${BASE}/hallazgos?reviewId=${reviewId}`);

export const validateFinding = (id: string, approve: boolean, note?: string) =>
  apiFetch(`${BASE}/hallazgos/${id}/validar`, { method: 'POST', json: { approve, note } });

export const findingToNCR = (id: string, body: Record<string, unknown> = {}) =>
  apiFetch<{ ncrId: string; code: string }>(`${BASE}/hallazgos/${id}/a-nc`, { method: 'POST', json: body });

export const findingToPlan = (id: string, body: Record<string, unknown>) =>
  apiFetch<{ actionPlanId: string }>(`${BASE}/hallazgos/${id}/a-plan`, { method: 'POST', json: body });

export const getPreparacion = (reviewId: string) =>
  apiFetch<{
    normative: { name: string; code: string; version: string };
    review: { id: string; scope: string | null; periodFrom: string | null; periodTo: string | null; sites: string[] };
    pendingDecisions: number;
    staleEvaluations: number;
    gaps: Array<{ code: string; clauseNumber: string; statement: string; aiVerdict: string; humanDecision: string }>;
    auditQuestions: string[];
    externalChecks: string[];
    findings: Array<{ id: string; title: string; validationStatus: string | null }>;
  }>(`${BASE}/revisiones/${reviewId}/preparacion`);

export const consultar = (reviewId: string, question: string) =>
  apiFetch<{ answer: string; citations: Array<{ ref: string; text: string }>; outOfScope: boolean; tokens: number }>(
    `${BASE}/revisiones/${reviewId}/consultar`,
    { method: 'POST', json: { question } },
  );

// ── Labels (compartidos entre páginas) ───────────────────────

export const L = {
  extractionStatus: {
    NOT_STARTED: 'Sin iniciar', EXTRACTING: 'Extrayendo', PENDING_APPROVAL: 'Pendiente aprobación',
    APPROVED: 'Aprobada', REJECTED: 'Rechazada', UNREADABLE: 'No legible', FAILED: 'Error',
  } as Record<string, string>,
  reviewStatus: {
    DRAFT: 'Borrador', QUEUED: 'En cola', RUNNING: 'En curso', COMPLETED: 'Completada',
    PARTIAL: 'Parcial', FAILED: 'Fallida', CANCELLED: 'Cancelada',
  } as Record<string, string>,
  workStatus: {
    PENDING: 'Pendiente', IN_PROGRESS: 'En curso', EVALUATED: 'Evaluado',
    CANNOT_EVALUATE: 'No evaluable', STALE: 'Obsoleto',
  } as Record<string, string>,
  evidenceStatus: {
    NOT_SEARCHED: 'Sin buscar', FOUND: 'Encontrada', PARTIAL: 'Parcial',
    ABSENT: 'Ausente', SOURCE_UNAVAILABLE: 'Fuente no disponible',
  } as Record<string, string>,
  aiVerdict: {
    NONE: '—', EVIDENCE_SUPPORTS: 'Evidencia respalda', POSSIBLE_GAP: 'Posible brecha',
    REQUIRES_EXTERNAL_VERIFICATION: 'Requiere verif. externa', INSUFFICIENT_EVIDENCE: 'Evidencia insuficiente',
  } as Record<string, string>,
  humanDecision: {
    PENDING: 'Pendiente', VALIDATED: 'Validada', GAP_CONFIRMED: 'Brecha confirmada',
    MORE_EVIDENCE_REQUESTED: 'Más evidencia', AI_REJECTED: 'Dictamen rechazado',
    NA_PROPOSED: 'N/A propuesta', NA_APPROVED: 'N/A aprobada', NA_REJECTED: 'N/A rechazada',
  } as Record<string, string>,
  connector: {
    objectives: 'Objetivos SGI', risks: 'Riesgos', documents: 'Documentos',
    indicators: 'Indicadores', ncr: 'No Conformidades', internal_audits: 'Auditorías internas',
    management_review: 'Revisión Dirección', context: 'Contexto/Partes int.',
    suppliers: 'Proveedores', competence: 'Competencias',
  } as Record<string, string>,
};
