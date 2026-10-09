'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { BookOpen, Pencil, Check, X, BadgeCheck, Building2, Globe } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Referencias técnicas por componente — configurables por empresa.
// El motor de proyección da prioridad a las referencias propias del
// tenant sobre las globales: editar una global crea el override
// automáticamente (POST) sin tocar el catálogo compartido.
// ═══════════════════════════════════════════════════════════════

const METRICA_LABEL: Record<string, string> = {
  INTERVALO_MANTENIMIENTO: 'Intervalo de mantenimiento',
  VIDA_SERVICIO_REF: 'Vida útil de referencia',
  CONDICION_MEDIDA: 'Condición medida',
};
const ESTADO_LABEL: Record<string, { label: string; cls: string }> = {
  VERIFICADA: { label: 'Verificada', cls: 'bg-green-100 text-green-700' },
  INTERNA_APROBADA: { label: 'Interna aprobada', cls: 'bg-blue-100 text-blue-700' },
  PROVISIONAL: { label: 'Hipótesis', cls: 'bg-amber-100 text-amber-700' },
  FALTANTE: { label: 'Sin referencia', cls: 'bg-neutral-100 text-neutral-500' },
};

type Ref = {
  id: string; tenantId: string | null; componentKey: string; componentLabel: string;
  sistema: string; tipoMetrica: string; tarea?: string | null;
  intervaloKm?: number | null; intervaloMeses?: number | null;
  rangoMinKm?: number | null; rangoMaxKm?: number | null;
  unidad?: string | null; fuente?: string | null; estado: string; notas?: string | null;
  matchRegex?: string | null;
};

// Referencia aplicable por componente: la propia del tenant si existe
// y tiene valores; si no, la global con valores; si no, cualquiera.
function refAplicable(refs: Ref[], key: string): Ref | null {
  const cands = refs.filter(r => r.componentKey === key);
  if (!cands.length) return null;
  const tieneValores = (r: Ref) => r.intervaloKm != null || r.intervaloMeses != null || r.rangoMinKm != null || r.rangoMaxKm != null;
  const score = (r: Ref) =>
    (r.tenantId ? 100 : 0) +
    (tieneValores(r) ? 50 : 0) +
    (r.estado === 'VERIFICADA' ? 20 : r.estado === 'INTERNA_APROBADA' ? 15 : r.estado === 'PROVISIONAL' ? 5 : 0);
  return cands.slice().sort((a, b) => score(b) - score(a))[0];
}

export default function ReferenciasPanel() {
  const [refs, setRefs] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cargar = () => {
    setLoading(true);
    apiFetch<{ referencias: Ref[] }>('/flota/referencias-componentes')
      .then(res => setRefs(res.referencias || []))
      .catch(() => setRefs([]))
      .finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  // Vista consolidada: una fila por componentKey con la referencia que APLICA
  const filas = useMemo(() => {
    const keys = [...new Set(refs.map(r => r.componentKey))].sort();
    return keys.map(k => {
      const aplicada = refAplicable(refs, k);
      const propia = refs.find(r => r.componentKey === k && r.tenantId);
      const globales = refs.filter(r => r.componentKey === k && !r.tenantId);
      return { key: k, aplicada, propia, globales };
    });
  }, [refs]);

  const iniciarEdicion = (ref: Ref) => {
    setEditando(ref.componentKey);
    setForm({
      componentLabel: ref.componentLabel,
      intervaloKm: ref.intervaloKm != null ? String(ref.intervaloKm) : '',
      intervaloMeses: ref.intervaloMeses != null ? String(ref.intervaloMeses) : '',
      rangoMinKm: ref.rangoMinKm != null ? String(ref.rangoMinKm) : '',
      rangoMaxKm: ref.rangoMaxKm != null ? String(ref.rangoMaxKm) : '',
      notas: ref.notas || '',
    });
    setMsg(null);
  };

  const guardar = async (ref: Ref) => {
    setSaving(true);
    setMsg(null);
    try {
      const num = (k: string) => (form[k] !== '' && !Number.isNaN(Number(form[k])) ? Number(form[k]) : null);
      const body: any = {
        componentKey: ref.componentKey,
        componentLabel: form.componentLabel || ref.componentLabel,
        sistema: ref.sistema,
        tipoMetrica: ref.tipoMetrica,
        tarea: ref.tarea || null,
        intervaloKm: num('intervaloKm'),
        intervaloMeses: num('intervaloMeses'),
        rangoMinKm: num('rangoMinKm'),
        rangoMaxKm: num('rangoMaxKm'),
        unidad: ref.unidad || 'km',
        estado: 'INTERNA_APROBADA',
        fuente: 'Configuración propia de la empresa',
        documentoSeccion: 'Parámetros de mantenimiento — configuración',
        notas: form.notas || null,
        matchRegex: ref.matchRegex || null,
      };
      if (ref.tenantId) {
        // Ya es referencia propia → actualizar en el lugar (versiona si cambian valores)
        await apiFetch(`/flota/referencias-componentes/${ref.id}`, { method: 'PATCH', json: body });
        setMsg('Referencia propia actualizada.');
      } else {
        // Es global → crear override propio del tenant
        await apiFetch('/flota/referencias-componentes', { method: 'POST', json: body });
        setMsg('Referencia propia creada: tu valor pisa al estándar global en esta empresa.');
      }
      setEditando(null);
      cargar();
    } catch (e: any) {
      setMsg(e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const fmtRef = (r: Ref | null): string => {
    if (!r) return '—';
    const partes: string[] = [];
    if (r.intervaloKm != null) partes.push(`cada ${r.intervaloKm.toLocaleString('es-AR')} km`);
    if (r.intervaloMeses != null) partes.push(`cada ${r.intervaloMeses} meses`);
    if (r.rangoMinKm != null || r.rangoMaxKm != null)
      partes.push(`${r.rangoMinKm?.toLocaleString('es-AR') ?? '—'}–${r.rangoMaxKm?.toLocaleString('es-AR') ?? '—'} km`);
    return partes.join(' · ') || '—';
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen className="h-4 w-4 text-violet-600" />
        <h2 className="text-sm font-semibold text-neutral-800">Referencias técnicas por componente</h2>
      </div>
      <p className="text-xs text-neutral-500 mb-4">
        Intervalos de mantenimiento y rangos de vida útil que usa el gemelo digital en la proyección.
        Cada valor que edites queda como referencia propia de tu empresa y pisa al estándar global.
      </p>

      {msg && <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5 mb-3">{msg}</p>}
      {loading && <p className="text-xs text-neutral-400">Cargando catálogo…</p>}

      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-neutral-400 border-b border-neutral-100">
                <th className="py-1.5 pr-3 font-medium">Componente</th>
                <th className="py-1.5 pr-3 font-medium">Métrica</th>
                <th className="py-1.5 pr-3 font-medium">Valor aplicado</th>
                <th className="py-1.5 pr-3 font-medium">Origen</th>
                <th className="py-1.5 pr-3 font-medium">Estado</th>
                <th className="py-1.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f => {
                const r = f.aplicada;
                const esEdicion = editando === f.key;
                if (!r) return null;
                return (
                  <tr key={f.key} className="border-b border-neutral-50 align-top">
                    {esEdicion ? (
                      <td colSpan={6} className="py-2.5">
                        <div className="rounded-md border border-violet-200 bg-violet-50/50 p-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <input value={form.componentLabel || ''} onChange={e => setForm({ ...form, componentLabel: e.target.value })}
                              className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium w-64" />
                            <span className="text-[10px] text-neutral-400">{METRICA_LABEL[r.tipoMetrica]}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            {r.tipoMetrica === 'INTERVALO_MANTENIMIENTO' && (
                              <>
                                <label className="flex items-center gap-1.5 text-[11px] text-neutral-600">
                                  cada <input type="number" value={form.intervaloKm || ''} onChange={e => setForm({ ...form, intervaloKm: e.target.value })} className="w-24 rounded border border-neutral-300 px-1.5 py-1" /> km
                                </label>
                                <label className="flex items-center gap-1.5 text-[11px] text-neutral-600">
                                  o cada <input type="number" value={form.intervaloMeses || ''} onChange={e => setForm({ ...form, intervaloMeses: e.target.value })} className="w-16 rounded border border-neutral-300 px-1.5 py-1" /> meses
                                </label>
                              </>
                            )}
                            {r.tipoMetrica === 'VIDA_SERVICIO_REF' && (
                              <label className="flex items-center gap-1.5 text-[11px] text-neutral-600">
                                vida útil de referencia
                                <input type="number" value={form.rangoMinKm || ''} onChange={e => setForm({ ...form, rangoMinKm: e.target.value })} className="w-24 rounded border border-neutral-300 px-1.5 py-1" />
                                a
                                <input type="number" value={form.rangoMaxKm || ''} onChange={e => setForm({ ...form, rangoMaxKm: e.target.value })} className="w-24 rounded border border-neutral-300 px-1.5 py-1" />
                                km
                              </label>
                            )}
                            {r.tipoMetrica === 'CONDICION_MEDIDA' && (
                              <span className="text-[11px] text-neutral-400">Se evalúa por mediciones reales de condición — no hay intervalo que configurar.</span>
                            )}
                          </div>
                          <input value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })}
                            placeholder="Nota interna (ej: estándar de taller, manual, experiencia de flota)"
                            className="w-full rounded border border-neutral-300 px-2 py-1 text-[11px]" />
                          <div className="flex items-center gap-2">
                            <button onClick={() => guardar(r)} disabled={saving}
                              className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50">
                              <Check className="h-3 w-3" /> {saving ? 'Guardando…' : f.propia ? 'Guardar' : 'Guardar como referencia propia'}
                            </button>
                            <button onClick={() => setEditando(null)} className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50">
                              <X className="h-3 w-3" /> Cancelar
                            </button>
                            {!f.propia && <span className="text-[10px] text-neutral-400">El estándar global queda intacto — tu valor aplica solo a tu empresa.</span>}
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="py-2 pr-3">
                          <p className="font-medium text-neutral-700">{r.componentLabel}</p>
                          <p className="text-[10px] text-neutral-400">{r.tarea || r.sistema}</p>
                        </td>
                        <td className="py-2 pr-3 text-neutral-500">{METRICA_LABEL[r.tipoMetrica] || r.tipoMetrica}</td>
                        <td className="py-2 pr-3 font-medium text-neutral-700">{fmtRef(r)}</td>
                        <td className="py-2 pr-3">
                          {r.tenantId ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-700"><Building2 className="h-3 w-3" /> Propia</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400"><Globe className="h-3 w-3" /> Global</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${ESTADO_LABEL[r.estado]?.cls || 'bg-neutral-100'}`}>{ESTADO_LABEL[r.estado]?.label || r.estado}</span>
                        </td>
                        <td className="py-2">
                          <button onClick={() => iniciarEdicion(r)} className="rounded-md border border-neutral-200 p-1 text-neutral-400 hover:text-violet-600 hover:border-violet-300" title="Configurar para esta empresa">
                            {r.tipoMetrica === 'CONDICION_MEDIDA' ? <BadgeCheck className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
