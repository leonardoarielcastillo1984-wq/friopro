'use client';
// ============================================================
// Barra inferior de KPIs ejecutivos — estilo mockup:
// chips con icono, valor grande y etiqueta. Solo datos reales
// del agregador (null → '—', nunca inventados).
// ============================================================
import { Gauge, CheckCircle2, AlertTriangle, Target, Layers } from 'lucide-react';
import type { ResumenEjecutivo } from './types';

export function KpiStrip({ r }: { r: ResumenEjecutivo }) {
  const score = r.departamentos ? Math.round((r.enObjetivo / r.departamentos) * 100) : null;
  const items = [
    { icon: Gauge,          label: 'Desempeño global',    value: score !== null ? `${score}%` : '—', cls: score === null ? '' : r.criticos > 0 ? 'crit' : 'ok' },
    { icon: CheckCircle2,   label: 'Procesos en objetivo', value: `${r.enObjetivo}/${r.departamentos}`, cls: 'ok' },
    { icon: AlertTriangle,  label: 'Con alertas',          value: String(r.conDesvio + r.criticos), cls: r.criticos > 0 ? 'crit' : r.conDesvio > 0 ? 'warn' : 'ok' },
    { icon: Target,         label: 'Objetivos activos',    value: r.objetivos?.activos != null ? `${r.objetivos.activos}/${r.objetivos.total ?? '—'}` : '—', cls: '' },
    { icon: Layers,         label: 'NC vencidas',          value: r.ncVencidas !== null ? String(r.ncVencidas) : '—', cls: (r.ncVencidas ?? 0) > 0 ? 'crit' : 'ok' },
    { icon: CheckCircle2,   label: 'Unidades con datos',   value: `${r.departamentos - r.sinDatos}/${r.departamentos}`, cls: r.sinDatos > 0 ? 'warn' : 'ok' },
  ];
  return (
    <div className="ce-strip">
      {items.map((it, i) => (
        <div key={i} className={`ce-chip ${it.cls}`}>
          <it.icon size={15} />
          <div><b>{it.value}</b><small>{it.label}</small></div>
        </div>
      ))}
    </div>
  );
}
