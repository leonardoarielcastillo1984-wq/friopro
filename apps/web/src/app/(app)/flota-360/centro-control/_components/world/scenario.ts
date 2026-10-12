// ============================================================
// Registro de escenarios del Centro de Control.
// Multi-tenant: cada empresa puede tener un predio propio.
// La selección se hace por tenantId (o slug) → clave de escenario.
// ============================================================
import { genericScenario } from './layout';
import { dadaScenario } from './layout-dada';
import type { Scenario } from './layout-core';

export const SCENARIOS: Record<string, Scenario> = {
  generic: genericScenario,
  dada: dadaScenario,
};

// Etiquetas para el selector de escenario en la UI del Centro de Control
export const SCENARIO_LABELS: Record<string, string> = {
  generic: 'Predio genérico',
  dada: 'DADA',
};

// tenantId (uuid) o slug → clave de escenario. Agregar futuros predios aquí.
const TENANT_SCENARIO: Record<string, string> = {
  // Ejemplo: 'a1b2c3d4-....': 'dada',
};

// Slugs que resuelven al escenario DADA (fallback de identificación)
const SLUG_SCENARIO: Record<string, string> = {
  dada: 'dada',
};

export function scenarioKeyForTenant(tenant: { id?: string | null; slug?: string | null; name?: string | null } | null | undefined): string {
  if (!tenant) return 'generic';
  if (tenant.id && TENANT_SCENARIO[tenant.id]) return TENANT_SCENARIO[tenant.id];
  const slug = (tenant.slug ?? '').toLowerCase();
  if (slug && TENANT_SCENARIO[slug]) return TENANT_SCENARIO[slug];
  if (slug && SLUG_SCENARIO[slug]) return SLUG_SCENARIO[slug];
  // último recurso: nombre comercial contiene la clave
  const name = (tenant.name ?? '').toLowerCase();
  for (const k of Object.keys(SLUG_SCENARIO)) if (name.includes(k)) return SLUG_SCENARIO[k];
  return 'generic';
}

// Override por URL (?yard=dada) — para preview y capturas de verificación
export function scenarioOverride(): string | null {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('yard');
  return v && SCENARIOS[v] ? v : null;
}

export function scenarioForTenant(tenant: { id?: string | null; slug?: string | null; name?: string | null } | null | undefined): Scenario {
  const key = scenarioOverride() ?? scenarioKeyForTenant(tenant);
  return SCENARIOS[key] ?? genericScenario;
}
