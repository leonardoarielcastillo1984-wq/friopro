'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Ruler, Plus, ArrowLeft, Calculator, Sparkles, Trash2, Loader2,
  CheckCircle, AlertTriangle, XCircle, Grid3X3, FileJson, BarChart3,
} from 'lucide-react';

const STUDY_TYPES: Record<string, string> = {
  GRR_CROSS: 'Gage R&R Cruzado',
  GRR_NESTED: 'Gage R&R Anidado (destructivo)',
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

const OP_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

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

// ── Gráfico: lecturas por pieza, coloreadas por operador ─────────────────────
function ReadingsByPartChart({ readings }: { readings: any[] }) {
  const parts = [...new Set(readings.map((r) => String(r.part)))].sort((a, b) => Number(a) - Number(b));
  const ops = [...new Set(readings.map((r) => String(r.operator)))];
  const vals = readings.map((r) => Number(r.value));
  if (!vals.length) return null;
  const ymin = Math.min(...vals), ymax = Math.max(...vals);
  const span = ymax - ymin || 1;
  const W = 720, H = 200, PAD = 40;
  const y = (v: number) => PAD + (1 - (v - ymin) / span) * (H - 2 * PAD);
  const groupW = (W - 2 * PAD) / parts.length;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]">
        <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} fill="#fafafa" stroke="#e5e7eb" />
        {parts.map((pt, pi) => {
          const cx = PAD + groupW * pi + groupW / 2;
          const cellVals = ops.map((op) =>
            readings.filter((r) => String(r.part) === pt && String(r.operator) === op).map((r) => Number(r.value)));
          const allCell = cellVals.flat();
          const pMean = allCell.length ? allCell.reduce((s, v) => s + v, 0) / allCell.length : 0;
          return (
            <g key={pt}>
              {cellVals.map((vs, oi) =>
                vs.map((v, vi) => (
                  <circle
                    key={`${oi}-${vi}`}
                    cx={cx + (oi - (ops.length - 1) / 2) * 14 + (vi - (vs.length - 1) / 2) * 4}
                    cy={y(v)} r={3.5} fill={OP_COLORS[oi % OP_COLORS.length]} fillOpacity={0.8}
                  />
                ))
              )}
              <line x1={cx - groupW * 0.3} x2={cx + groupW * 0.3} y1={y(pMean)} y2={y(pMean)} stroke="#0f172a" strokeWidth="2" />
              <text x={cx} y={H - PAD + 14} fontSize="10" textAnchor="middle" fill="#6b7280">P{pt}</text>
            </g>
          );
        })}
        {ops.map((op, i) => (
          <g key={op} transform={`translate(${PAD + i * 70},12)`}>
            <circle r={4} fill={OP_COLORS[i % OP_COLORS.length]} />
            <text x={8} y={4} fontSize="10" fill="#374151">Op {op}</text>
          </g>
        ))}
      </svg>
      <p className="text-[10px] text-gray-400 text-center">Lecturas por pieza (— media de pieza)</p>
    </div>
  );
}

// ── Gráfico: medias por operador ─────────────────────────────────────────────
function ByOperatorChart({ readings }: { readings: any[] }) {
  const parts = [...new Set(readings.map((r) => String(r.part)))].sort((a, b) => Number(a) - Number(b));
  const ops = [...new Set(readings.map((r) => String(r.operator)))];
  const vals = readings.map((r) => Number(r.value));
  if (!vals.length) return null;
  const ymin = Math.min(...vals), ymax = Math.max(...vals);
  const span = ymax - ymin || 1;
  const W = 720, H = 180, PAD = 40;
  const y = (v: number) => PAD + (1 - (v - ymin) / span) * (H - 2 * PAD);
  const x = (i: number) => PAD + (i / Math.max(1, parts.length - 1)) * (W - 2 * PAD);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]">
        <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} fill="#fafafa" stroke="#e5e7eb" />
        {ops.map((op, oi) => {
          const means = parts.map((pt) => {
            const vs = readings.filter((r) => String(r.part) === pt && String(r.operator) === op).map((r) => Number(r.value));
            return vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null;
          });
          const pts = means.map((m, i) => (m == null ? null : `${x(i).toFixed(1)},${y(m).toFixed(1)}`)).filter(Boolean);
          return (
            <g key={op}>
              <polyline points={pts.join(' ')} fill="none" stroke={OP_COLORS[oi % OP_COLORS.length]} strokeWidth="1.8" />
              {means.map((m, i) => m != null && (
                <circle key={i} cx={x(i)} cy={y(m)} r={3.5} fill={OP_COLORS[oi % OP_COLORS.length]} />
              ))}
            </g>
          );
        })}
        {parts.map((pt, i) => (
          <text key={pt} x={x(i)} y={H - PAD + 14} fontSize="10" textAnchor="middle" fill="#6b7280">P{pt}</text>
        ))}
        {ops.map((op, i) => (
          <g key={op} transform={`translate(${PAD + i * 70},12)`}>
            <circle r={4} fill={OP_COLORS[i % OP_COLORS.length]} />
            <text x={8} y={4} fontSize="10" fill="#374151">Op {op}</text>
          </g>
        ))}
      </svg>
      <p className="text-[10px] text-gray-400 text-center">Media por pieza y operador — líneas paralelas = buena reproducibilidad</p>
    </div>
  );
}

// ── Componentes de varianza (barra apilada por % contribución) ───────────────
function VarianceComponents({ r }: { r: any }) {
  if (!r?.TV) return null;
  const tot = r.TV ** 2 || 1;
  const segs = [
    { l: 'GRR', v: (r.GRR ** 2 / tot) * 100, c: '#ef4444' },
    { l: 'PV', v: (r.PV ** 2 / tot) * 100, c: '#3b82f6' },
  ];
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="font-medium text-gray-600">% Contribución (varianza)</span>
      </div>
      <div className="h-4 rounded-full bg-gray-200 overflow-hidden flex">
        {segs.map((s) => (
          <div key={s.l} className="h-full" style={{ width: `${s.v}%`, backgroundColor: s.c }} title={`${s.l}: ${s.v.toFixed(1)}%`} />
        ))}
      </div>
      <div className="flex gap-4 mt-1">
        {segs.map((s) => (
          <span key={s.l} className="flex items-center gap-1 text-[11px] text-gray-600">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.c }} />
            {s.l} {s.v.toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Grilla de carga de lecturas ──────────────────────────────────────────────
function ReadingsGrid({ readings, onChange, partsCount, operatorsCount, trialsCount, attribute }: {
  readings: any[]; onChange: (r: any[]) => void;
  partsCount: number; operatorsCount: number; trialsCount: number; attribute?: boolean;
}) {
  const ops = useMemo(() => Array.from({ length: operatorsCount }, (_, i) => String.fromCharCode(65 + i)), [operatorsCount]);
  const get = (part: number, op: string, trial: number) =>
    readings.find((r) => Number(r.part) === part && String(r.operator) === op && Number(r.trial) === trial);
  const set = (part: number, op: string, trial: number, value: string) => {
    const rest = readings.filter((r) => !(Number(r.part) === part && String(r.operator) === op && Number(r.trial) === trial));
    if (value === '') { onChange(rest); return; }
    onChange([...rest, { part, operator: op, trial, [attribute ? 'result' : 'value']: attribute ? value : Number(value) }]);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="text-xs">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="px-2 py-1.5 text-left text-gray-500 sticky left-0 bg-gray-50">Pieza</th>
            {ops.map((op) => (
              <th key={op} colSpan={trialsCount} className="px-2 py-1.5 text-center font-bold" style={{ color: OP_COLORS[ops.indexOf(op) % OP_COLORS.length] }}>
                Op {op}
              </th>
            ))}
          </tr>
          <tr className="bg-gray-50 border-b">
            <th className="px-2 py-1 sticky left-0 bg-gray-50"></th>
            {ops.flatMap((op) => Array.from({ length: trialsCount }, (_, t) => (
              <th key={`${op}-${t}`} className="px-1 py-1 text-center text-[10px] text-gray-400 w-14">E{t + 1}</th>
            )))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: partsCount }, (_, p) => p + 1).map((part) => (
            <tr key={part} className="border-b border-gray-100">
              <td className="px-2 py-1 font-bold text-gray-700 sticky left-0 bg-white">{part}</td>
              {ops.flatMap((op) => Array.from({ length: trialsCount }, (_, t) => t + 1).map((trial) => {
                const cell = get(part, op, trial);
                const v = cell ? (attribute ? cell.result : cell.value) : '';
                return (
                  <td key={`${op}-${trial}`} className="px-0.5 py-0.5">
                    {attribute ? (
                      <select
                        className="w-14 rounded border border-gray-200 px-1 py-1 text-xs text-center"
                        value={v ?? ''}
                        onChange={(e) => set(part, op, trial, e.target.value)}
                      >
                        <option value="">—</option><option value="OK">OK</option><option value="NOK">NOK</option>
                      </select>
                    ) : (
                      <input
                        type="number" step="any"
                        className="w-14 rounded border border-gray-200 px-1 py-1 text-xs text-center focus:border-amber-400 focus:outline-none"
                        value={v ?? ''}
                        onChange={(e) => set(part, op, trial, e.target.value)}
                      />
                    )}
                  </td>
                );
              }))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MsaPage() {
  const [items, setItems] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [entryMode, setEntryMode] = useState<'grid' | 'json'>('grid');
  const [method, setMethod] = useState<'ar' | 'anova'>('ar');

  const [form, setForm] = useState({
    name: '', studyType: 'GRR_CROSS', equipmentId: '', equipmentName: '', characteristic: '',
    partsCount: 10, operatorsCount: 3, trialsCount: 3, tolerance: '',
  });
  const [readings, setReadings] = useState<any[]>([]);
  const [readingsText, setReadingsText] = useState('');
  const [refsText, setRefsText] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [msa, eq] = await Promise.all([
        apiFetch<{ items: any[] }>('/core-tools/msa'),
        apiFetch<{ items: any[] }>('/equipment').catch(() => ({ items: [] })),
      ]);
      setItems(msa.items || []);
      setEquipment(eq.items || []);
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
    setReadings(Array.isArray(res.item.readings) ? res.item.readings : []);
    setReadingsText(res.item.readings ? JSON.stringify(res.item.readings, null, 2) : '');
    setRefsText(res.item.referenceValues ? JSON.stringify(res.item.referenceValues, null, 2) : '');
    setMethod('ar');
  };

  const create = async () => {
    try {
      const eq = equipment.find((e) => e.id === form.equipmentId);
      await apiFetch('/core-tools/msa', {
        method: 'POST',
        json: {
          ...form,
          equipmentId: form.equipmentId || null,
          equipmentName: eq?.name || form.equipmentName || null,
          tolerance: form.tolerance ? Number(form.tolerance) : null,
          characteristic: form.characteristic || null,
        },
      });
      setShowCreate(false);
      setForm({ name: '', studyType: 'GRR_CROSS', equipmentId: '', equipmentName: '', characteristic: '', partsCount: 10, operatorsCount: 3, trialsCount: 3, tolerance: '' });
      load();
    } catch (e: any) {
      setError(e?.message || 'Error creando estudio');
    }
  };

  const saveReadings = async () => {
    if (!selected) return;
    try {
      const payload: any = {};
      if (entryMode === 'json' && readingsText.trim()) payload.readings = JSON.parse(readingsText);
      else if (readings.length) payload.readings = readings;
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
    const r0 = selected.results;
    const isGrr = selected.studyType === 'GRR_CROSS' || selected.studyType === 'GRR_NESTED';
    const isRef = ['BIAS', 'LINEARITY', 'STABILITY'].includes(selected.studyType);
    const isAttr = selected.studyType === 'ATTRIBUTE';
    const r = method === 'anova' && r0?.anova ? r0.anova : r0;
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
            {r0 && (
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
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm">Datos del estudio</h3>
            {(isGrr || isAttr) && (
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setEntryMode('grid')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium ${entryMode === 'grid' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <Grid3X3 className="h-3 w-3" /> Grilla
                </button>
                <button
                  onClick={() => setEntryMode('json')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium ${entryMode === 'json' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <FileJson className="h-3 w-3" /> JSON
                </button>
              </div>
            )}
          </div>

          {(isGrr || isAttr) && entryMode === 'grid' && (
            <>
              <ReadingsGrid
                readings={readings}
                onChange={setReadings}
                partsCount={selected.partsCount}
                operatorsCount={selected.operatorsCount}
                trialsCount={selected.trialsCount}
                attribute={isAttr}
              />
              <p className="text-[11px] text-gray-400">{readings.length} lecturas cargadas de {selected.partsCount * selected.operatorsCount * selected.trialsCount} esperadas</p>
            </>
          )}
          {(isGrr || isAttr) && entryMode === 'json' && (
            <textarea
              value={readingsText}
              onChange={(e) => setReadingsText(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
              placeholder={isAttr ? '[{"part":1,"operator":"A","trial":1,"result":"OK","ref":"OK"}, ...]' : '[{"part":1,"operator":"A","trial":1,"value":10.25}, ...]'}
            />
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
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gray-400" /> Resultados — {r.method}
              </h3>
              {selected.studyType === 'GRR_CROSS' && r0?.anova && (
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  <button onClick={() => setMethod('ar')}
                    className={`px-2.5 py-1 text-[11px] font-medium ${method === 'ar' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    Promedio y Rango
                  </button>
                  <button onClick={() => setMethod('anova')}
                    className={`px-2.5 py-1 text-[11px] font-medium ${method === 'anova' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    ANOVA
                  </button>
                </div>
              )}
            </div>

            {isGrr && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { l: '%GRR', v: r.pctGRR, alert: r.pctGRR > 30 },
                    { l: '%EV (repetibilidad)', v: r.pctEV },
                    { l: '%AV (reproducibilidad)', v: r.pctAV },
                    { l: 'ndc', v: r.ndc ?? '—', alert: r.ndc != null && r.ndc < 5 },
                  ].map((c) => (
                    <div key={c.l} className={`rounded-lg border px-3 py-2 ${c.alert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className={`text-xl font-bold ${c.alert ? 'text-red-700' : 'text-gray-900'}`}>{c.v}{c.l.startsWith('%') && c.v != null ? '%' : ''}</div>
                      <div className="text-[11px] text-gray-500">{c.l}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <PctBar label="%GRR vs variación total" pct={r.pctGRR} />
                  {r.pctTolerance != null && <PctBar label="%GRR vs tolerancia" pct={r.pctTolerance} />}
                  <VarianceComponents r={r} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  {[['EV', r.EV], ['AV', r.AV], ['GRR', r.GRR], ['PV', r.PV], ['TV', r.TV]].map(([l, v]) => (
                    <div key={l as string} className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-1.5">
                      <div className="text-sm font-bold text-gray-800">{v ?? '—'}</div>
                      <div className="text-[10px] text-gray-500">{l}</div>
                    </div>
                  ))}
                </div>

                {method === 'anova' && r.anova && (
                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-left text-gray-500 border-b">
                          <th className="px-3 py-1.5">Fuente</th><th className="px-3 py-1.5">SS</th><th className="px-3 py-1.5">MS</th><th className="px-3 py-1.5">Componente var.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['Pieza', r.anova.ssPart, r.anova.msPart, r.anova.varPart],
                          ['Operador', r.anova.ssOperator, r.anova.msOperator, r.anova.varOperator],
                          ['Pieza × Operador', r.anova.ssInteraction, r.anova.msInteraction, r.anova.varInteraction],
                          ['Repetibilidad (error)', r.anova.ssError, r.anova.msError, r.anova.varError],
                        ].map(([l, ss, ms, v]) => (
                          <tr key={l as string} className="border-b border-gray-100">
                            <td className="px-3 py-1.5 font-medium">{l}</td>
                            <td className="px-3 py-1.5">{ss}</td>
                            <td className="px-3 py-1.5">{ms}</td>
                            <td className="px-3 py-1.5">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {readings.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <ReadingsByPartChart readings={readings} />
                    <ByOperatorChart readings={readings} />
                  </div>
                )}

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
                {r.points?.length > 0 && (() => {
                  const pts = r.points;
                  const xs = pts.map((p: any) => p.ref), ys = pts.map((p: any) => p.bias);
                  const x0 = Math.min(...xs), x1 = Math.max(...xs);
                  const y0 = Math.min(...ys, 0), y1 = Math.max(...ys, 0);
                  const W = 720, H = 180, PAD = 40;
                  const sx = (v: number) => PAD + ((v - x0) / (x1 - x0 || 1)) * (W - 2 * PAD);
                  const sy = (v: number) => PAD + (1 - (v - y0) / (y1 - y0 || 1)) * (H - 2 * PAD);
                  return (
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]">
                      <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} fill="#fafafa" stroke="#e5e7eb" />
                      <line x1={PAD} x2={W - PAD} y1={sy(0)} y2={sy(0)} stroke="#9ca3af" strokeDasharray="4 3" />
                      <line x1={sx(x0)} x2={sx(x1)} y1={sy(r.slope * x0 + r.intercept)} y2={sy(r.slope * x1 + r.intercept)} stroke="#f59e0b" strokeWidth="2" />
                      {pts.map((p: any, i: number) => <circle key={i} cx={sx(p.ref)} cy={sy(p.bias)} r={4} fill="#3b82f6" />)}
                      {pts.map((p: any, i: number) => <text key={i} x={sx(p.ref)} y={H - PAD + 14} fontSize="10" textAnchor="middle" fill="#6b7280">{p.ref}</text>)}
                    </svg>
                  );
                })()}
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

            {isAttr && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[['Repetibilidad', `${r.repeatabilityPct}%`], ['Reproducibilidad', `${r.reproducibilityPct}%`], ['Vs referencia', r.vsReference ? `${r.vsReference.pct}%` : '—']].map(([l, v]) => (
                    <div key={l as string} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="text-xl font-bold text-gray-900">{v}</div>
                      <div className="text-[11px] text-gray-500">{l}</div>
                    </div>
                  ))}
                </div>
                {r.perOperator && (
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-gray-500 border-b"><th className="py-1">Operador</th><th>Consistentes</th><th>%</th></tr></thead>
                    <tbody>
                      {r.perOperator.map((o: any) => (
                        <tr key={o.operator} className="border-b border-gray-100">
                          <td className="py-1 font-medium">Op {o.operator}</td><td>{o.consistent}/{o.total}</td><td>{o.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
          <p className="text-sm text-gray-500">Gage R&R (Promedio&Rango + ANOVA), sesgo, linealidad, estabilidad y atributos</p>
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
          <div className="w-full max-w-md rounded-xl bg-white p-5 space-y-3 shadow-xl max-h-[90vh] overflow-y-auto">
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
            <div>
              <label className="text-[11px] text-gray-500">Equipo de medición (del módulo Infraestructura)</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.equipmentId}
                onChange={(e) => setForm({ ...form, equipmentId: e.target.value })}
              >
                <option value="">— Seleccionar o escribir abajo —</option>
                {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.code ? `${eq.code} — ` : ''}{eq.name}</option>)}
              </select>
            </div>
            {!form.equipmentId && (
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="O escribí el nombre del equipo"
                value={form.equipmentName}
                onChange={(e) => setForm({ ...form, equipmentName: e.target.value })}
              />
            )}
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
                    type="number" min={1} max={k === 'operatorsCount' ? 6 : 50}
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
