// ============================================================
// Acceso a datos del Centro Empresarial — API /centro-empresa.
// ============================================================
import { apiFetch } from '@/lib/api';
import type { EmpresaConfig, ResumenResponse } from './types';

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

// Preferencia de plantilla por usuario (localStorage). El default de
// empresa viene de config.defaultTemplate.
const TPL_KEY = 'ce-template';
export function templatePref(): 'campus' | 'procesos' | null {
  try {
    const v = localStorage.getItem(TPL_KEY);
    return v === 'campus' || v === 'procesos' ? v : null;
  } catch { return null; }
}
export function saveTemplatePref(t: 'campus' | 'procesos') {
  try { localStorage.setItem(TPL_KEY, t); } catch {}
}
