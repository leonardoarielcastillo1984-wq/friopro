// ============================================================
// Centro de Control Empresarial — tipos compartidos UI/motor.
// ============================================================

export type DeptLayer = 'STRATEGIC' | 'OPERATIONAL' | 'SUPPORT';
export type DeptSalud = 'ok' | 'warn' | 'crit' | 'nodata';
export type TemplateKey = 'campus' | 'procesos';

export interface EmpresaDept {
  key: string;
  name: string;
  sub?: string;
  responsable?: string;
  model: string;
  moduleKey?: string | null;
  moduleHref?: string | null;
  layer: DeptLayer;
  enabled: boolean;
  campusPos?: { x: number; z: number } | null;
  procPos?: { x: number; z: number } | null;
}

export interface EmpresaConn {
  from: string;
  to: string;
  label?: string | null;
  tipo?: string | null;
}

export interface EmpresaConfig {
  defaultTemplate: TemplateKey;
  departments: EmpresaDept[];
  connections: EmpresaConn[];
}

export interface DeptKpi { label: string; value: string | number }
export interface DeptAlerta { label: string; nivel: 'warn' | 'crit' }

export interface DeptResumen extends Pick<EmpresaDept, 'key' | 'name' | 'sub' | 'responsable' | 'moduleHref' | 'layer'> {
  kpis: DeptKpi[];
  alertas: DeptAlerta[];
  salud: DeptSalud;
}

export interface ResumenEjecutivo {
  departamentos: number;
  enObjetivo: number;
  conDesvio: number;
  criticos: number;
  sinDatos: number;
  ncAbiertas: number | null;
  ncVencidas: number | null;
  objetivos: { activos: number | null; total: number | null } | null;
  indicadores: number | null;
  procesosEnMapa: number | null;
}

export interface ResumenResponse {
  departments: DeptResumen[];
  connections: EmpresaConn[];
  resumen: ResumenEjecutivo;
}

export const SALUD_META: Record<DeptSalud, { label: string; color: string; hex: number }> = {
  ok:     { label: 'En objetivo',  color: '#34d399', hex: 0x34d399 },
  warn:   { label: 'Seguimiento',  color: '#fbbf24', hex: 0xfbbf24 },
  crit:   { label: 'Crítico',      color: '#f87171', hex: 0xf87171 },
  nodata: { label: 'Sin datos',    color: '#94a3b8', hex: 0x64748b },
};

export const LAYER_META: Record<DeptLayer, { label: string; band: string; tint: number }> = {
  STRATEGIC:   { label: 'Estratégico', band: 'PROCESOS ESTRATÉGICOS',   tint: 0x274472 },
  OPERATIONAL: { label: 'Operativo',   band: 'PROCESOS OPERATIVOS',     tint: 0x1d4e3f },
  SUPPORT:     { label: 'De apoyo',    band: 'PROCESOS DE APOYO',       tint: 0x4a3b6e },
};
