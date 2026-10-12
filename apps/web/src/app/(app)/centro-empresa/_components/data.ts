// ============================================================
// Acceso a datos del Centro Empresarial — API /centro-empresa.
// ============================================================
import { apiFetch } from '@/lib/api';
import type { EmpresaConfig, ResumenResponse, ProcesoDisponible, TemplateKey } from './types';

export async function fetchConfig(): Promise<{ config: EmpresaConfig; models: string[] }> {
  const r = await apiFetch<{ config: EmpresaConfig; models: string[] }>('/centro-empresa/config');
  if (!r?.config?.departments) throw new Error('config inválida');
  return r;
}

export async function saveConfig(config: EmpresaConfig): Promise<void> {
  await apiFetch('/centro-empresa/config', { method: 'PUT', json: config });
}

export async function fetchResumen(): Promise<ResumenResponse> {
  const r = await apiFetch<ResumenResponse>('/centro-empresa/resumen');
  if (!r?.departments) throw new Error('resumen inválido');
  return r;
}

export async function fetchProcesos(): Promise<ProcesoDisponible[]> {
  try {
    const r = await apiFetch<{ procesos: ProcesoDisponible[] }>('/centro-empresa/procesos-disponibles');
    return r?.procesos ?? [];
  } catch { return []; }
}

// Preferencia de plantilla por usuario: backend (User.preferences) con
// localStorage como caché/fallback.
const TPL_KEY = 'ce-template';
export async function templatePref(): Promise<TemplateKey | null> {
  try {
    const r = await apiFetch<{ template: TemplateKey | null }>('/centro-empresa/preferencia');
    if (r?.template) {
      try { localStorage.setItem(TPL_KEY, r.template); } catch {}
      return r.template;
    }
  } catch { /* sin backend → fallback local */ }
  try {
    const v = localStorage.getItem(TPL_KEY);
    return v === 'campus' || v === 'procesos' ? v : null;
  } catch { return null; }
}
export async function saveTemplatePref(t: TemplateKey): Promise<void> {
  try { localStorage.setItem(TPL_KEY, t); } catch {}
  try { await apiFetch('/centro-empresa/preferencia', { method: 'PUT', json: { template: t } }); } catch {}
}

// ── Etiquetas sobre edificios ────────────────────────────────
// Valor: primer KPI que contenga '%' (o el primero disponible).
// Flecha: derivada de la salud (▲ ok · ▶ seguimiento · ▼ crítico).
export function tagDataFor(depts: { key: string; salud: string; kpis: { label: string; value: string | number }[] }[]) {
  const m = new Map<string, { value?: string; dir?: 'up' | 'down' | 'flat' }>();
  for (const d of depts) {
    const kpi = d.kpis.find((k) => String(k.value).includes('%')) ?? d.kpis[0];
    m.set(d.key, {
      value: kpi ? String(kpi.value) : undefined,
      dir: d.salud === 'ok' ? 'up' : d.salud === 'crit' ? 'down' : d.salud === 'warn' ? 'flat' : undefined,
    });
  }
  return m;
}

// ── Grafo de impacto ─────────────────────────────────────────
// BFS desde un departamento siguiendo las conexiones configuradas.
export function impactSet(
  fromKey: string,
  connections: { from: string; to: string }[],
  direction: 'out' | 'in' = 'out',
  maxDepth = 3,
): Set<string> {
  const seen = new Set<string>([fromKey]);
  let frontier = [fromKey];
  for (let d = 0; d < maxDepth && frontier.length; d++) {
    const next: string[] = [];
    for (const k of frontier) {
      for (const c of connections) {
        const hit = direction === 'out' ? (c.from === k ? c.to : null) : (c.to === k ? c.from : null);
        if (hit && !seen.has(hit)) { seen.add(hit); next.push(hit); }
      }
    }
    frontier = next;
  }
  seen.delete(fromKey);
  return seen;
}
