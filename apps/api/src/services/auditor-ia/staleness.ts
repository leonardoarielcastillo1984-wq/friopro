// ──────────────────────────────────────────────────────────────
// Auditor IA — detección de staleness (spec §7.5)
//
// Una evaluación queda STALE cuando alguna fuente citada cambió
// desde el snapshot guardado (hash o updatedAt distinto). El
// dictamen NO se invalida automáticamente: solo se marca el eje
// workStatus=STALE y se registra en decisionLog para que la
// persona decida reevaluar.
// ──────────────────────────────────────────────────────────────

import type { PrismaClient, Prisma } from '@prisma/client';
import { getConnector } from './connectors/index.js';

type Db = PrismaClient | Prisma.TransactionClient;

interface SnapshotItem {
  type: string;
  id: string;
  updatedAt?: string | null;
  hash?: string | null;
}

/**
 * Compara el sourceSnapshot guardado contra el estado actual de
 * cada fuente. Devuelve las fuentes que cambiaron (vacío = fresco).
 */
export async function findChangedSources(
  db: Db,
  tenantId: string,
  sourceSnapshot: unknown,
): Promise<SnapshotItem[]> {
  const items = (sourceSnapshot as { items?: SnapshotItem[] } | null)?.items ?? [];
  if (!items.length) return [];

  const changed: SnapshotItem[] = [];
  for (const item of items) {
    // Resolver conector por tipo de entidad (mismo mapa que orchestrator)
    const connectorKey = ENTITY_CONNECTOR[item.type];
    if (!connectorKey) continue;
    const connector = getConnector(connectorKey);
    if (!connector) continue;
    try {
      const current = await connector.snapshot(db, tenantId, item.id);
      if (!current) {
        // Fuente eliminada → cuenta como cambio
        changed.push({ ...item, hash: 'DELETED' });
        continue;
      }
      if (
        (item.hash && current.hash && item.hash !== current.hash) ||
        (item.updatedAt && current.updatedAt && item.updatedAt !== current.updatedAt)
      ) {
        changed.push(item);
      }
    } catch {
      // Error consultando la fuente: no marcar stale por errores transitorios
      continue;
    }
  }
  return changed;
}

const ENTITY_CONNECTOR: Record<string, string> = {
  Document: 'documents',
  SgiObjective: 'objectives',
  Position: 'competence',
  EmployeeCompetency: 'competence',
  SgiTraining: 'competence',
  Supplier: 'suppliers',
  OrganizationContext: 'context',
  Stakeholder: 'context',
  Risk: 'risks',
  Indicator: 'indicators',
  NonConformity: 'ncr',
  Audit: 'internal_audits',
  ManagementReview: 'management_review',
};

/**
 * Marca STALE las evaluaciones de una revisión cuyas fuentes
 * cambiaron. Devuelve cuántas se marcaron.
 */
export async function markStaleEvaluations(
  db: Db,
  tenantId: string,
  reviewId: string,
): Promise<number> {
  // Solo el último intento por requisito: un intento viejo ya fue
  // reemplazado y marcarlo STALE sería ruido (además los reintentos
  // los saltean igualmente).
  const evaluations = await db.auditorEvaluation.findMany({
    where: { reviewId, tenantId, workStatus: 'EVALUATED' },
    orderBy: [{ requirementId: 'asc' }, { attempt: 'desc' }],
    select: { id: true, requirementId: true, sourceSnapshot: true },
  });
  const latestOnly: typeof evaluations = [];
  const seen = new Set<string>();
  for (const ev of evaluations) {
    if (seen.has(ev.requirementId)) continue;
    seen.add(ev.requirementId);
    latestOnly.push(ev);
  }

  let marked = 0;
  for (const ev of latestOnly) {
    const changed = await findChangedSources(db, tenantId, ev.sourceSnapshot);
    if (changed.length) {
      await db.auditorEvaluation.update({
        where: { id: ev.id },
        data: { workStatus: 'STALE' },
      });
      await db.auditorDecisionLog.create({
        data: {
          tenantId,
          evaluationId: ev.id,
          axis: 'workStatus',
          fromValue: 'EVALUATED',
          toValue: 'STALE',
          actorId: null, // sistema
          comment: `Fuentes modificadas: ${changed.map((c) => c.type).join(', ')}`.slice(0, 300),
        },
      });
      marked++;
    }
  }
  return marked;
}
