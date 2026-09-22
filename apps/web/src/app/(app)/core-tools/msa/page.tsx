'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Ruler, Plus, ArrowLeft, Calculator, Sparkles, Trash2, Loader2,
  CheckCircle, AlertTriangle, XCircle,
} from 'lucide-react';

const STUDY_TYPES: Record<string, string> = {
  GRR_CROSS: 'Gage R&R Cruzado',
  GRR_NESTED: 'Gage R&R Anidado',
  BIAS: 'Sesgo',
  LINEARITY: 'Linealidad',
  STABILITY: 'Estabilidad',
  ATTRIBUTE: 'Atributos (acuerdo)',
};

const VERDICT_STYLE: Record<string, { cls: string; icon: any }> = {
  ACEPTABLE: { cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle },
  CAPAZ: { cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle },
  EXCELENTE: { cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle },
  ESTABLE: { cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle },
  CONDICIONAL: { cls: 'bg-amber-100 text-amber-800 border-amber-300', icon: AlertTriangle },
  MARGINAL: { cls: 'bg-amber-100 text-amber-800 border-amber-300', icon: AlertTriangle },
  REVISAR: { cls: 'bg-amber-100 text-amber-800 border-amber-300', icon: AlertTriangle },
  INFORMATIVO: { cls: 'bg-blue-100 text-blue-800 border-blue-300', icon: CheckCircle },
  'NO ACEPTABLE': { cls: 'bg-red-100 text-red-800 border-red-300', icon: XCircle },
  'NO CAPAZ': { cls: 'bg-red-100 text-red-800 border-red-300', icon: XCircle },
};

function VerdictBadge({ verdict }: { verdict?: string }) {
  if (!verdict) return null;
  const s = VERDICT_STYLE[verdict] || VERDICT_STYLE.INFORMATIVO;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${s.cls}`}>
      <Icon className="h-3.5 w-3.5" /> {verdict}
    </span>
  );
}

function PctBar({ label, pct }: { label: string; pct: number }) {
  const color = pct < 10 ? 'bg-emerald-500' : pct <= 30 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="font-medium text-gray-600">{label}</span>
        <span className="font-bold text-gray-800">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

export default function MsaPage() {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '', studyType: 'GRR_CROSS', equipmentName: '', characteristic: '',
    partsCount: 10, operatorsCount: 3, trialsCount: 3, tolerance: '',
  });
  const [readingsText, setReadingsText] = useState('');
  const [refsText, setRefsText] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ items: any[] }>('/core-tools/msa');
      setItems(res.items || []);
    } catch (e: any) {
      setError(e?.message || 'Error cargando estudios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (id: string) => {
    const res = await apiFetch<{ item: any }>(`/core-tools/msa/${id}`);
    setSelected(res.item);
    setReadingsText(res.item.readings ? JSON.stringify(res.item.readings, null, 2) : '');
    setRefsText(res.item.referenceValues ? JSON.stringify(res.item.referenceValues, null, 2) : '');
  };

  const create = async () => {
    try {
      await apiFetch('/core-tools/msa', {
        method: 'POST',
        json: {
          ...form,
          tolerance: form.tolerance ? Number(form.tolerance) : null,
          equipmentName: form.equipmentName || null,
          characteristic: form.characteristic || null,
        },
      });
      setShowCreate(false);
      setForm({ name: '', studyType: 'GRR_CROSS', equipmentName: '', characteristic: '', partsCount: 10, operatorsCount: 3, trialsCount: 3, tolerance: '' });
      load();
    } catch (e: any) {
      setError(e?.message || 'Error creando estudio');
    }
  };

  const saveReadings = async () => {
    if (!selected) return;
    try {
      const payload: any = {};
      if (readingsText.trim()) payload.readings = JSON.parse(readingsText);
      if (refsText.trim()) payload.referenceValues = JSON.parse(refsText);
      const res = await apiFetch<{ item: any }>(`/core-tools/msa/${selected.id}`, { method: 'PUT', json: payload });
      setSelected(res.item);
      setError('');
    } catch (e: any) {
      setError('JSON inválido: ' + (e?.message || ''));
    }
  };

  const calculate = async () => {
    if (!selected) return;
    setCalculating(true);
    setError('');
    try {
      await saveReadings();
      const res = await apiFetch<{ item: any }>(`/core-tools/msa/${selected.id}/calculate`, { method: 'POST' });
      setSelected(res.item);
      load();
    } catch (e: any) {
      setError(e?.message || 'Error calculando');
    } finally {
      setCalculating(false);
    }
  };

  const aiInterpret = async () => {
    if (!selected) return;
    setAiLoading(true);
    try {
      const res = await apiFetch<{ interpretation: string }>(`/core-tools/msa/${selected.id}/ai-interpret`, { method: 'POST' });
      setSelected({ ...selected, aiInterpretation: res.interpretation });
    } catch (e: any) {
      setError(e?.message || 'Error de IA');
    } finally {
      setAiLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este estudio?')) return;
    await apiFetch(`/core-tools/msa/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    load();
  };

  // ── Vista detalle ──────────────────────────────────────────────────────────
  if (selected) {
    const r = selected.results;
    const isGrr = selected.studyType === 'GRR_CROSS' || selected.studyType === 'GRR_NESTED';
    const isRef = ['BIAS', 'LINEARITY', 'STABILITY'].includes(selected.studyType);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={calculate}
              disabled={calculating}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              Calcular
            </button>
            {r && (
              <button
                onClick={aiInterpret}
                disabled={aiLoading}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Interpretar con IA
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{selected.code} — {selected.name}</h2>
              <p className="text-sm text-gray-500">
                {STUDY_TYPES[selected.studyType]} · {selected.equipmentName || 'Sin equipo'} · {selected.characteristic || ''}
              </p>
            </div>
            <VerdictBadge verdict={r?.verdict} />
          </div>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

        {/* Carga de datos */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm">Datos del estudio</h3>
          {isGrr && (
            <div>
              <label className="text-xs font-medium text-gray-600">
                Lecturas — JSON: [{'{'} "part": 1, "operator": "A", "trial": 1, "value": 10.25 {'}'}, ...]
              </label>
              <textarea
                value={readingsText}
                onChange={(e) => setReadingsText(e.target.value)}
                rows={6}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                placeholder='[{"part":1,"operator":"A","trial":1,"value":10.25}, ...]'
              />
            </div>
          )}
          {selected.studyType === 'ATTRIBUTE' && (
            <div>
              <label className="text-xs font-medium text-gray-600">
                Resultados — JSON: [{'{'} "part": 1, "operator": "A", "trial": 1, "result": "OK", "ref": "OK" {'}'}, ...]
              </label>
              <textarea
                value={readingsText}
                onChange={(e) => setReadingsText(e.target.value)}
                rows={6}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                placeholder='[{"part":1,"operator":"A","trial":1,"result":"OK","ref":"OK"}, ...]'
              />
            </div>
          )}
          {isRef && (
            <div>
              <label className="text-xs font-medium text-gray-600">
                Referencias — JSON: [{'{'} "ref": 10.0, "readings": [10.02, 10.01, 9.98] {'}'}, ...]
              </label>
              <textarea
                value={refsText}
                onChange={(e) => setRefsText(e.target.value)}
                rows={6}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                placeholder='[{"ref":10.0,"readings":[10.02,10.01,9.98]}, ...]'
              />
            </div>
          )}
          <button onClick={saveReadings} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Guardar datos
          </button>
        </div>

        {/* Resultados */}
        {r && !r.error && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
            <h3 className="font-semibold text-gray-800 text-sm">Resultados</h3>

            {isGrr && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { l: '%GRR', v: r.pctGRR, alert: r.pctGRR > 30 },
                    { l: '%EV (repetibilidad)', v: r.pctEV },
                    { l: '%AV (reproducibilidad)', v: r.pctAV },
                    { l: 'ndc', v: r.ndc, alert: r.ndc < 5 },
                  ].map((c) => (
                    <div key={c.l} className={`rounded-lg border px-3 py-2 ${c.alert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className={`text-xl font-bold ${c.alert ? 'text-red-700' : 'text-gray-900'}`}>{c.v}{c.l.startsWith('%') ? '%' : ''}</div>
                      <div className="text-[11px] text-gray-500">{c.l}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <PctBar label="%GRR vs variación total" pct={r.pctGRR} />
                  {r.pctTolerance != null && <PctBar label="%GRR vs tolerancia" pct={r.pctTolerance} />}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  {[['EV', r.EV], ['AV', r.AV], ['GRR', r.GRR], ['PV', r.PV], ['TV', r.TV]].map(([l, v]) => (
                    <div key={l as string} className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-1.5">
                      <div className="text-sm font-bold text-gray-800">{v}</div>
                      <div className="text-[10px] text-gray-500">{l}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600">{r.verdictNote} {r.ndcNote}</p>
              </>
            )}

            {selected.studyType === 'BIAS' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="text-xl font-bold text-gray-900">{r.avgBias}</div>
                    <div className="text-[11px] text-gray-500">Sesgo promedio</div>
                  </div>
                  {r.pctTolerance != null && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="text-xl font-bold text-gray-900">{r.pctTolerance}%</div>
                      <div className="text-[11px] text-gray-500">% de tolerancia</div>
                    </div>
                  )}
                </div>
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-gray-500 border-b"><th className="py-1">Ref</th><th>n</th><th>Media</th><th>Sesgo</th><th>σ</th></tr></thead>
                  <tbody>
                    {(r.rows || []).map((row: any, i: number) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-1">{row.ref}</td><td>{row.n}</td><td>{row.mean}</td><td>{row.bias}</td><td>{row.stddev}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-600">{r.verdictNote}</p>
              </>
            )}

            {selected.studyType === 'LINEARITY' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[['Pendiente', r.slope], ['Linealidad', r.linearity], ['R²', r.rSquared], ['% Tol.', r.pctTolerance != null ? `${r.pctTolerance}%` : '—']].map(([l, v]) => (
                    <div key={l as string} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="text-xl font-bold text-gray-900">{v}</div>
                      <div className="text-[11px] text-gray-500">{l}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600">{r.verdictNote}</p>
              </>
            )}

            {selected.studyType === 'STABILITY' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[['Media', r.mean], ['σ', r.stddev], ['Deriva', r.drift], ['Fuera ±3σ', r.outOfLimits]].map(([l, v]) => (
                    <div key={l as string} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="text-xl font-bold text-gray-900">{v}</div>
                      <div className="text-[11px] text-gray-500">{l}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600">{r.verdictNote}</p>
              </>
            )}

            {selected.studyType === 'ATTRIBUTE' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[['Repetibilidad', `${r.repeatabilityPct}%`], ['Reproducibilidad', `${r.reproducibilityPct}%`], ['Vs referencia', r.vsReference ? `${r.vsReference.pct}%` : '—']].map(([l, v]) => (
                    <div key={l as string} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="text-xl font-bold text-gray-900">{v}</div>
                      <div className="text-[11px] text-gray-500">{l}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600">{r.verdictNote}</p>
              </>
            )}
          </div>
        )}

        {selected.aiInterpretation && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <h3 className="font-semibold text-violet-900 text-sm mb-2 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Interpretación IA
            </h3>
            <p className="text-sm text-violet-900 whitespace-pre-wrap leading-relaxed">{selected.aiInterpretation}</p>
          </div>
        )}
      </div>
    );
  }

  // ── Vista lista ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Ruler className="h-5 w-5 text-blue-600" /> MSA — Estudios de Medición
          </h1>
          <p className="text-sm text-gray-500">Gage R&R, sesgo, linealidad, estabilidad y atributos (AIAG MSA-4)</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          <Plus className="h-4 w-4" /> Nuevo estudio
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
          No hay estudios MSA. Creá el primero con "Nuevo estudio".
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <button onClick={() => openDetail(it.id)} className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{it.code}</span>
                  <span className="font-medium text-gray-900 text-sm">{it.name}</span>
                  <VerdictBadge verdict={it.results?.verdict} />
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {STUDY_TYPES[it.studyType]} · {it.equipmentName || 'Sin equipo'} · {new Date(it.createdAt).toLocaleDateString('es-AR')}
                </div>
              </button>
              <button onClick={() => remove(it.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 space-y-3 shadow-xl">
            <h3 className="font-bold text-gray-900">Nuevo estudio MSA</h3>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Nombre del estudio"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.studyType}
              onChange={(e) => setForm({ ...form, studyType: e.target.value })}
            >
              {Object.entries(STUDY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Equipo de medición"
              value={form.equipmentName}
              onChange={(e) => setForm({ ...form, equipmentName: e.target.value })}
            />
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Característica medida"
              value={form.characteristic}
              onChange={(e) => setForm({ ...form, characteristic: e.target.value })}
            />
            <div className="grid grid-cols-3 gap-2">
              {[['Piezas', 'partsCount'], ['Operadores', 'operatorsCount'], ['Ensayos', 'trialsCount']].map(([l, k]) => (
                <div key={k}>
                  <label className="text-[11px] text-gray-500">{l}</label>
                  <input
                    type="number" min={1}
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    value={(form as any)[k]}
                    onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Tolerancia total (opcional, para %Tol)"
              type="number" step="any"
              value={form.tolerance}
              onChange={(e) => setForm({ ...form, tolerance: e.target.value })}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">Cancelar</button>
              <button
                onClick={create}
                disabled={!form.name.trim()}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
