// ──────────────────────────────────────────────────────────────
// Auditor IA — contrato de conectores de evidencia (spec §6)
//
// Cada conector lee entidades REALES del SGI del tenant y devuelve
// ítems resumidos (≤800 chars) para que el evaluador IA los use.
// Nunca escribe. Nunca inventa disponibilidad: si el usuario no
// tiene permiso del módulo fuente o la consulta falla, lo informa
// en coverage.reason.
// ──────────────────────────────────────────────────────────────

import type { Prisma, PrismaClient } from '@prisma/client';

export type ConnectorDb = PrismaClient | Prisma.TransactionClient;

/** Permisos del usuario por módulo fuente (User.permissions). */
export type UserPerms = Record<string, string> | 'admin';

export interface ConnectorContext {
  tenantId: string;
  userPerms: UserPerms;
  /** Filtro de alcance: ids de Process del mapa de procesos. Vacío = todos. */
  processIds: string[];
  /** Sedes (strings libres como Process.sites). Vacío = todas. */
  sites: string[];
  periodFrom?: Date;
  periodTo?: Date;
  db: ConnectorDb;
  /**
   * Segunda pasada autónoma: cuando la primera no encuentra evidencia,
   * el orquestador reintenta con criterios más amplios (más términos,
   * número de cláusula, contenido del documento).
   */
  relaxed?: boolean;
}

export interface RequirementRef {
  id: string;
  clauseNumber: string;
  statement: string;
  verificationTypes: string[];
  requiresDocumentedInfo: boolean;
}

export interface EvidenceItem {
  entityType: string; // 'Document' | 'SgiObjective' | ...
  entityId: string;
  title: string;
  version?: string;
  updatedAt?: Date;
  url: string; // ruta web para que el humano la abra
  inPeriod: boolean;
  summary: string; // ≤800 chars, campos seleccionados
  hash: string; // huella para detectar cambios (staleness)
}

export interface CollectResult {
  items: EvidenceItem[]; // ≤15
  coverage: {
    queried: boolean; // se intentó la consulta
    available: boolean; // la fuente respondió con datos o vacío real
    reason?: string; // 'sin permiso' | 'sin datos' | 'error: ...'
  };
}

export interface SearchCandidate {
  entityType: string;
  entityId: string;
  title: string;
  url: string;
  detail?: string;
}

export interface SourceSnapshot {
  type: string;
  id: string;
  updatedAt?: string;
  hash?: string;
}

export interface EvidenceConnector {
  key: string;
  label: string;
  /** Clave de User.permissions del módulo fuente (null = sin gate extra). */
  permissionModule: string | null;
  collect(ctx: ConnectorContext, requirement: RequirementRef): Promise<CollectResult>;
  search(ctx: ConnectorContext, q: string): Promise<SearchCandidate[]>;
  snapshot(db: ConnectorDb, tenantId: string, entityId: string): Promise<SourceSnapshot | null>;
}

// ── Helpers compartidos ────────────────────────────────────────

export const MAX_ITEMS = 15;
export const MAX_SUMMARY = 800;

export function inPeriod(
  date: Date | null | undefined,
  from?: Date,
  to?: Date,
): boolean {
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function hasModuleAccess(perms: UserPerms, module: string | null): boolean {
  if (perms === 'admin') return true;
  if (!module) return true;
  const level = perms[module];
  return level === 'view' || level === 'edit';
}

export function trunc(text: string, max = MAX_SUMMARY): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : clean.slice(0, max - 1) + '…';
}

export function noPermission(module: string): CollectResult {
  return {
    items: [],
    coverage: {
      queried: false,
      available: false,
      reason: `sin permiso sobre el módulo ${module}`,
    },
  };
}

export function queryError(err: unknown): CollectResult {
  return {
    items: [],
    coverage: {
      queried: true,
      available: false,
      reason: `error: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200),
    },
  };
}

export function empty(): CollectResult {
  return { items: [], coverage: { queried: true, available: true, reason: 'sin datos' } };
}
