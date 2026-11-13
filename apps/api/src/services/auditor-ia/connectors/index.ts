// ──────────────────────────────────────────────────────────────
// Registro de conectores disponibles (v1: sin policies/processes)
// ──────────────────────────────────────────────────────────────

import type { EvidenceConnector } from './types.js';
import { documentsConnector } from './documents.js';
import { objectivesConnector } from './objectives.js';
import { competenceConnector } from './competence.js';
import { suppliersConnector } from './suppliers.js';
import { contextConnector } from './context.js';
import { risksConnector } from './risks.js';
import { indicatorsConnector } from './indicators.js';
import { ncrConnector } from './ncr.js';
import { internalAuditsConnector } from './internalAudits.js';
import { managementReviewConnector } from './managementReview.js';

const CONNECTORS: ReadonlyMap<string, EvidenceConnector> = new Map(
  [
    documentsConnector,
    objectivesConnector,
    competenceConnector,
    suppliersConnector,
    contextConnector,
    risksConnector,
    indicatorsConnector,
    ncrConnector,
    internalAuditsConnector,
    managementReviewConnector,
  ].map((c) => [c.key, c]),
);

export const CONNECTOR_KEYS: readonly string[] = [...CONNECTORS.keys()];

export function getConnector(key: string): EvidenceConnector | undefined {
  return CONNECTORS.get(key);
}

export function connectorCatalog(): Array<{ key: string; label: string; permissionModule: string | null }> {
  return [...CONNECTORS.values()].map((c) => ({
    key: c.key,
    label: c.label,
    permissionModule: c.permissionModule,
  }));
}

export * from './types.js';
