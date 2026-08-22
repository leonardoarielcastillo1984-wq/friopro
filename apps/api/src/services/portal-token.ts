import { createHash, randomUUID } from 'node:crypto';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generatePortalToken(): string {
  return randomUUID() + '-' + randomUUID();
}

export function getTokenPrefix(token: string): string {
  return token.substring(0, 8);
}

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export function createSession(): { sessionToken: string; sessionExpiresAt: Date } {
  return {
    sessionToken: randomUUID(),
    sessionExpiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  };
}

export function isSessionValid(sessionExpiresAt: Date | null | undefined): boolean {
  if (!sessionExpiresAt) return false;
  return new Date(sessionExpiresAt).getTime() > Date.now();
}

export interface PortalAccessInfo {
  id: string;
  tenantId: string;
  recipientName: string;
  recipientEmail: string;
  sector: string | null;
  area: string | null;
  process: string | null;
  executorId: string | null;
  canEdit: boolean;
  canAttachEvidence: boolean;
  canDownloadPdf: boolean;
  canChangeStatus: boolean;
  canEditFields: string[];
  status: string;
  expiresAt: Date | null;
  lastAccessAt: Date | null;
  accessCount: number;
  maxAccesses: number | null;
}

export function isAccessValid(access: PortalAccessInfo): { valid: boolean; reason?: string } {
  if (access.status === 'REVOKED') return { valid: false, reason: 'Acceso revocado' };
  if (access.status === 'SUSPENDED') return { valid: false, reason: 'Acceso suspendado' };
  if (access.status === 'EXPIRED') return { valid: false, reason: 'Acceso expirado' };
  if (access.expiresAt && new Date(access.expiresAt).getTime() < Date.now()) {
    return { valid: false, reason: 'Token expirado' };
  }
  if (access.maxAccesses !== null && access.accessCount >= access.maxAccesses) {
    return { valid: false, reason: 'Límite de accesos alcanzado' };
  }
  return { valid: true };
}

export const FIELDS_REQUIRING_APPROVAL = [
  'validatedRootCause',
  'plannedAction',
  'plannedStartDate',
  'plannedEndDate',
  'effectivenessResult',
  'status',
];

export const FIELDS_DIRECT_EDIT = [
  'immediateCorrection',
  'rootCauseAnalysis',
  'expectedResult',
  'progressPercent',
  'requiredResources',
  'observations',
  'analysisMethod',
  'findingDescription',
  'requirement',
  'classification',
];

export const ALL_EDITABLE_FIELDS = [...FIELDS_DIRECT_EDIT, ...FIELDS_REQUIRING_APPROVAL];
