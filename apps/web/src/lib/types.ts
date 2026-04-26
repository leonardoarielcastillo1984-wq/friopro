export type AuthUser = {
  id: string;
  email: string;
  globalRole?: 'SUPER_ADMIN' | null;
  tenantRole?: 'TENANT_ADMIN' | 'TENANT_USER' | null;
};

export type TenantOption = {
  tenantId: string;
  name: string;
  slug: string;
  role: 'TENANT_ADMIN' | 'TENANT_USER';
};

export type LoginResponse = {
  user?: AuthUser;
  activeTenant?: { id: string; name: string; slug: string };
  tenantRole?: 'TENANT_ADMIN' | 'TENANT_USER';
  needsTenantSwitch?: boolean;
  csrfToken?: string;
  // 2FA response fields
  requires2FA?: boolean;
  sessionToken?: string;
  accessToken?: string; // Cambiado de token a accessToken
};

export type DocumentRow = {
  id: string;
  title: string;
  type: string;
  status: 'DRAFT' | 'EFFECTIVE' | 'OBSOLETE';
  version: number;
  normativeId?: string | null;
  departmentId?: string | null;
  process?: string | null;
  ownerId?: string | null;
  owner?: { id: string; email: string } | null;
  reviewDate?: string | null;
  nextReviewDate?: string | null;
  reviewStatus?: 'APPROVED' | 'REQUIRES_UPDATE';
  documentQualityStatus?: 'ADEQUATE' | 'IMPROVABLE' | 'NON_CONFORMING';
  autoStatus?: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'SIN_FECHA';
  createdAt: string;
  updatedAt: string;
};

export type DocumentReview = {
  id: string;
  documentId: string;
  reviewedAt: string;
  result: 'APPROVED' | 'REQUIRES_UPDATE';
  comments?: string | null;
  reviewedBy?: { id: string; email: string } | null;
  createdAt: string;
};

// ── Módulo de Cumplimiento Normativo ──

export type NormativeStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'ERROR' | 'ARCHIVED';

export type NormativeStandard = {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  version: string;
  description: string | null;
  status: NormativeStatus;
  totalClauses: number;
  originalFileName: string;
  fileSize: number;
  filePath: string;
  fileHash: string;
  processingJobId: string;
  errorMessage: string | null;
  extractedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  updatedById: string;
  deletedAt: string | null;
};

export type NormativeClause = {
  id: string;
  clauseNumber: string;
  title: string;
  content: string;
  level: number;
  parentClauseId: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  extractionOrder: number;
  pageNumber: number | null;
  keywords: string[] | null;
  _count?: {
    childClauses: number;
    documentMappings: number;
  };
};

export type NormativeProcessingStatus = {
  id: string;
  status: NormativeStatus;
  errorMessage: string | null;
  totalClauses: number;
  extractedAt: string | null;
  progress: number | null;
};

// ── Motor de IA Auditora ──

export type AuditRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type AuditRun = {
  id: string;
  type: 'document_vs_norma' | 'tenant_audit';
  status: AuditRunStatus;
  documentId: string | null;
  normativeId: string | null;
  document?: { id: string; title: string } | null;
  normative?: { id: string; name: string; code: string } | null;
  totalClauses: number;
  coveredClauses: number;
  missingClauses: number;
  findingsCount: number;
  jobId: string | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type AiFinding = {
  id: string;
  severity: 'MUST' | 'SHOULD';
  standard: string;
  clause: string;
  title: string;
  description: string;
  auditType: string | null;
  documentId: string | null;
  normativeId: string | null;
  confidence: number | null;
  evidence: string | null;
  suggestedActions: string[] | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  document?: { id: string; title: string } | null;
  normative?: { id: string; name: string; code: string } | null;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

// ── Módulo de No Conformidades ──

export type NCRSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'OBSERVATION';
export type NCRStatus = 'OPEN' | 'IN_ANALYSIS' | 'ACTION_PLANNED' | 'IN_PROGRESS' | 'VERIFICATION' | 'CLOSED' | 'CANCELLED';
export type NCRSource = 'INTERNAL_AUDIT' | 'EXTERNAL_AUDIT' | 'CUSTOMER_COMPLAINT' | 'PROCESS_DEVIATION' | 'SUPPLIER_ISSUE' | 'AI_FINDING' | 'OTHER';

export type NonConformity = {
  id: string;
  code: string;
  title: string;
  description: string;
  severity: NCRSeverity;
  source: NCRSource;
  status: NCRStatus;
  standard: string | null;
  clause: string | null;
  rootCause: string | null;
  correctiveAction: string | null;
  preventiveAction: string | null;
  dueDate: string | null;
  closedAt: string | null;
  assignedTo: { id: string; email: string } | null;
  createdBy: { id: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type NCRStats = {
  total: number;
  open: number;
  inProgress: number;
  closed: number;
  critical: number;
  major: number;
  minor: number;
  overdue: number;
};

// ── Módulo de Riesgos ──

export type RiskStatus = 'IDENTIFIED' | 'ASSESSED' | 'MITIGATING' | 'MONITORED' | 'CLOSED';
export type RiskAspectType = 'AMBIENTAL' | 'CALIDAD' | 'SEGURIDAD' | 'LEGAL' | 'IATF' | 'TECNOLOGICO' | 'FINANCIERO' | 'REPUTACIONAL';
export type RiskStrategy = 'EVITAR' | 'MITIGAR' | 'TRANSFERIR' | 'ACEPTAR';

export type Risk = {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  process: string | null;
  standard: string | null;
  identificationDate: string;
  reviewDate: string | null;
  closureDate: string | null;
  inherentProbability: number | null;
  inherentImpact: number | null;
  inherentLevel: number | null;
  probability: number;
  impact: number;
  riskLevel: number;
  residualProb: number | null;
  residualImpact: number | null;
  residualLevel: number | null;
  treatmentPlan: string | null;
  controls: string | null;
  status: RiskStatus;
  // Campos ISO específicos
  requirement: string | null;
  aspectType: RiskAspectType | null;
  hazard: string | null;
  environmentalAspect: string | null;
  legalRequirement: boolean | null;
  legalReference: string | null;
  riskSource: string | null;
  strategy: RiskStrategy | null;
  responsible: string | null;
  effectiveness: number | null;
  // Relaciones
  owner: { id: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type RiskStats = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  byCategory: { category: string; count: number }[];
  matrix: { probability: number; impact: number; level: number }[];
  trends?: { month: string; identified: number; closed: number; critical: number }[];
};

// ── Módulo de Indicadores (KPI) ──

export type IndicatorFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type IndicatorTrend = 'UP' | 'DOWN' | 'STABLE';

export type IndicatorDirection = 'HIGHER_BETTER' | 'LOWER_BETTER';
export type IndicatorStatus = 'ON_TARGET' | 'WARNING' | 'OFF_TARGET' | 'NO_DATA';

export type IndicatorMeasurement = {
  id: string;
  value: number;
  period: string;
  notes: string | null;
  measuredAt: string;
};

export type IndicatorRiskLink = {
  id: string;
  offTargetProbDelta: number;
  warningProbDelta: number;
  minSuggestedProb: number | null;
  risk: {
    id: string;
    code: string;
    title: string;
    probability: number;
    impact: number;
    riskLevel: number;
    status?: string;
  };
};

export type Indicator = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  process: string | null;
  standard: string | null;
  currentValue: number | null;
  targetValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string;
  direction?: IndicatorDirection;
  warningValue?: number | null;
  criticalValue?: number | null;
  status?: IndicatorStatus;
  lastMeasuredAt?: string | null;
  nextDueAt?: string | null;
  offTargetStreak?: number;
  ncrTriggerStreak?: number;
  frequency: IndicatorFrequency;
  trend: IndicatorTrend;
  isActive: boolean;
  owner: { id: string; email: string } | null;
  measurements: IndicatorMeasurement[];
  riskLinks?: IndicatorRiskLink[];
  createdAt: string;
  updatedAt: string;
};

export type IndicatorStats = {
  total: number;
  active: number;
  onTarget: number;
  belowTarget: number;
  trending: { up: number; down: number; stable: number };
  categories: Record<string, number>;
};

// ── Módulo de Capacitaciones ──

export type TrainingStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type Training = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: string;
  modality: string;
  instructor: string | null;
  location: string | null;
  durationHours: number;
  scheduledDate: string | null;
  completedDate: string | null;
  status: TrainingStatus;
  standard: string | null;
  expectedParticipants: number;
  coordinator: { id: string; email: string } | null;
  _count?: { attendees: number };
  createdAt: string;
  updatedAt: string;
};

export type TrainingStats = {
  total: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  totalHours: number;
  totalParticipants: number;
  categories: Record<string, number>;
};

// ── Dashboard ──

export type DashboardData = {
  documents: { total: number; effective: number; draft: number; recent: any[] };
  normatives: { total: number; ready: number; totalClauses: number };
  departments: number;
  ncrs: { total: number; closed: number; open: number; inProgress: number; critical: number; overdue: number };
  risks: { total: number; critical: number; high: number; medium: number; low: number };
  findings: { total: number; open: number };
  trainings: { total: number; completed: number };
};

// ── Notificaciones ──

export type NotificationType =
  | 'NCR_ASSIGNED' | 'NCR_STATUS_CHANGED' | 'NCR_OVERDUE'
  | 'RISK_CRITICAL' | 'AUDIT_COMPLETED' | 'AUDIT_FAILED'
  | 'FINDING_NEW' | 'TRAINING_SCHEDULED' | 'TRAINING_REMINDER'
  | 'MEMBER_INVITED' | 'SYSTEM_ALERT';

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type DocumentClauseMapping = {
  id: string;
  documentId: string;
  clauseId: string;
  complianceType: 'CUMPLE' | 'REFERENCIA' | 'IMPLEMENTA' | 'NO_APLICA';
  notes: string | null;
  createdAt: string;
  clause: {
    id: string;
    clauseNumber: string;
    title: string;
    normative: {
      id: string;
      name: string;
      code: string;
    };
  };
};
