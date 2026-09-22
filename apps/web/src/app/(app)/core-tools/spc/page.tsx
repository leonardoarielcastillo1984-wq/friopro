'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  TrendingUp, Plus, ArrowLeft, Calculator, Sparkles, Trash2, Loader2,
  AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react';

const CHART_TYPES: Record<string, string> = {
  XBAR_R: 'X̄-R (subgrupos)', XBAR_S: 'X̄-S (subgrupos)', I_MR: 'I-MR (individuales)',
  P: 'p (proporción defectuosos)', NP: 'np (nº defectuosos)', C: 'c (defectos)', U: 'u (defectos/unidad)',
};

function ControlChart({ points, limits, alarms, spreadPoints }: {
  points: number[]; limits: any; alarms: any[]; spreadPoints?: number[];
}) {
  if (!points?.length || !limits) return null;
  const W = 720, H = 260, PAD = 44;
  const alarmIdx = new Set((alarms || []).map((a: any) => a.index));

  const allY = [...points, limits.ucl ?? -Infinity, limits.lcl ?? Infinity, limits.cl];
  const perUcl = (limits.perPoint || []).map((p: any) => p.ucl);
  const perLcl = (limits.perPoint || []).map((p: any) => p.lcl);
  const ymin = Math.min(...allY, ...perLcl.filter((v: number) => v != null));
  const ymax = Math.max(...allY, ...perUcl.filter((v: number) => v != null));
  const span = ymax - ymin || 1;
  const y = (v: number) => PAD + (1 - (v - ymin) / span) * (H - 2 * PAD);
  const x = (i: number) => PAD + (i / Math.max(1, points.length - 1)) * (W - 2 * PAD);

  const line = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const limitLine = (v: number | null, color: string, dash = '6 4') =>
    v != null ? (
      <line x1={PAD} x2={W - PAD} y1={y(v)} y2={y(v)} stroke={color} strokeWidth="1.5" strokeDasharray={dash} />
    ) : null;

  // Zonas A/B/C (±1σ, ±2σ, ±3σ desde CL) — solo si hay UCL/LCL fijos
  const sigma3 = limits.ucl != null && limits.cl != null ? (limits.ucl - limits.cl) / 3 : 0;
  const zones = sigma3 > 0 ? [
    { y1: limits.cl + 2 * sigma3, y2: limits.cl + 3 * sigma3, c: '#fee2e2' },
    { y1: limits.cl + sigma3, y2: limits.cl + 2 * sigma3, c: '#fef3c7' },
    { y1: limits.cl - sigma3, y2: limits.cl + sigma3, c: '#dcfce7' },
    { y1: limits.cl - 2 * sigma3, y2: limits.cl - sigma3, c: '#fef3c7' },
    { y1: limits.cl - 3 * sigma3, y2: limits.cl - 2 * sigma3, c: '#fee2e2' },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]">
          <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} fill="#fafafa" stroke="#e5e7eb" />
          {zones.map((z, i) => (
            <rect key={i} x={PAD} y={y(z.y2)} width={W - 2 * PAD} height={y(z.y1) - y(z.y2)} fill={z.c} fillOpacity={0.35} />
          ))}
          {limitLine(limits.ucl, '#ef4444')}
          {limitLine(limits.cl, '#3b82f6', '0')}
          {limitLine(limits.lcl, '#ef4444')}
          {sigma3 > 0 && (
            <>
              <line x1={PAD} x2={W - PAD} y1={y(limits.cl + sigma3)} y2={y(limits.cl + sigma3)} stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="2 3" />
              <line x1={PAD} x2={W - PAD} y1={y(limits.cl - sigma3)} y2={y(limits.cl - sigma3)} stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="2 3" />
              <line x1={PAD} x2={W - PAD} y1={y(limits.cl + 2 * sigma3)} y2={y(limits.cl + 2 * sigma3)} stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="2 3" />
              <line x1={PAD} x2={W - PAD} y1={y(limits.cl - 2 * sigma3)} y2={y(limits.cl - 2 * sigma3)} stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="2 3" />
            </>
          )}
          {/* límites variables (p/u) */}
          {limits.perPoint && (
            <>
              <path d={line(limits.perPoint.map((p: any) => p.ucl))} fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 3" />
              <path d={line(limits.perPoint.map((p: any) => p.lcl))} fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 3" />
            </>
          )}
          <path d={line(points)} fill="none" stroke="#0f172a" strokeWidth="1.8" />
          {points.map((v, i) => (
            <circle
              key={i} cx={x(i)} cy={y(v)} r={alarmIdx.has(i) ? 5 : 3.5}
              fill={alarmIdx.has(i) ? '#ef4444' : '#0f172a'}
              stroke={alarmIdx.has(i) ? '#fecaca' : 'none'} strokeWidth="2"
            />
          ))}
          {/* etiquetas */}
          <text x={W - PAD + 4} y={y(limits.ucl ?? limits.cl) + 4} fontSize="10" fill="#ef4444">UCL {limits.ucl ?? ''}</text>
          <text x={W - PAD + 4} y={y(limits.cl) + 4} fontSize="10" fill="#3b82f6">CL {limits.cl}</text>
          <text x={W - PAD + 4} y={y(limits.lcl ?? limits.cl) + 4} fontSize="10" fill="#ef4444">LCL {limits.lcl ?? ''}</text>
        </svg>
      </div>

      {spreadPoints && spreadPoints.length > 0 && limits.clS != null && (
        <div className="overflow-x-auto">
          <p className="text-[11px] font-medium text-gray-500 mb-1">Carta {limits.spreadLabel || 'R'} (dispersión)</p>
          <svg viewBox={`0 0 ${W} 140`} className="w-full min-w-[560px]">
            {(() => {
              const smax = Math.max(...spreadPoints, limits.uclS || 0) || 1;
              const sy = (v: number) => 20 + (1 - v / (smax * 1.1)) * 100;
              const sx = (i: number) => PAD + (i / Math.max(1, spreadPoints.length - 1)) * (W - 2 * PAD);
              return (
                <>
                  <rect x={PAD} y={20} width={W - 2 * PAD} height={100} fill="#fafafa" stroke="#e5e7eb" />
                  <line x1={PAD} x2={W - PAD} y1={sy(limits.uclS)} y2={sy(limits.uclS)} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="6 4" />
                  <line x1={PAD} x2={W - PAD} y1={sy(limits.clS)} y2={sy(limits.clS)} stroke="#3b82f6" strokeWidth="1.5" />
                  {limits.lclS > 0 && <line x1={PAD} x2={W - PAD} y1={sy(limits.lclS)} y2={sy(limits.lclS)} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="6 4" />}
                  <path d={spreadPoints.map((v, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ')} fill="none" stroke="#0f172a" strokeWidth="1.5" />
                  {spreadPoints.map((v, i) => <circle key={i} cx={sx(i)} cy={sy(v)} r={3} fill="#0f172a" />)}
                </>
              );
            })()}
          </svg>
        </div>
      )}
    </div>
  );
}

// ── Histograma con curva normal y límites de especificación ──────────────────
function Histogram({ values, usl, lsl, target }: { values: number[]; usl?: number | null; lsl?: number | null; target?: number | null }) {
  if (!values.length) return null;
  const BINS = 15;
  const vmin = Math.min(...values), vmax = Math.max(...values);
  const lo = lsl != null ? Math.min(vmin, lsl) : vmin;
  const hi = usl != null ? Math.max(vmax, usl) : vmax;
  const span = hi - lo || 1;
  const lo2 = lo - span * 0.08, hi2 = hi + span * 0.08;
  const binW = (hi2 - lo2) / BINS;
  const bins = Array.from({ length: BINS }, (_, i) => ({
    x0: lo2 + i * binW, x1: lo2 + (i + 1) * binW, n: 0,
  }));
  for (const v of values) {
    const i = Math.min(BINS - 1, Math.max(0, Math.floor((v - lo2) / binW)));
    bins[i].n++;
  }
  const maxN = Math.max(...bins.map((b) => b.n)) || 1;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, values.length - 1));

  const W = 720, H = 200, PAD = 40;
  const sx = (v: number) => PAD + ((v - lo2) / (hi2 - lo2)) * (W - 2 * PAD);
  const sy = (n: number) => H - PAD - (n / maxN) * (H - 2 * PAD);
  // curva normal escalada a frecuencia
  const normY = (x: number) => sd > 0 ? (values.length * binW / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-((x - mean) ** 2) / (2 * sd * sd)) : 0;
  const curve = Array.from({ length: 60 }, (_, i) => {
    const xv = lo2 + (i / 59) * (hi2 - lo2);
    return `${i === 0 ? 'M' : 'L'}${sx(xv).toFixed(1)},${sy(normY(xv)).toFixed(1)}`;
  }).join(' ');

  const specLine = (v: number | null | undefined, color: string, label: string) =>
    v != null && v >= lo2 && v <= hi2 ? (
      <g key={label}>
        <line x1={sx(v)} x2={sx(v)} y1={PAD} y2={H - PAD} stroke={color} strokeWidth="2" strokeDasharray="5 3" />
        <text x={sx(v)} y={PAD - 4} fontSize="10" textAnchor="middle" fill={color} fontWeight="bold">{label}</text>
      </g>
    ) : null;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]">
        <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} fill="#fafafa" stroke="#e5e7eb" />
        {bins.map((b, i) => {
          const out = (lsl != null && b.x1 <= lsl) || (usl != null && b.x0 >= usl);
          return (
            <rect key={i} x={sx(b.x0)} y={sy(b.n)} width={Math.max(1, sx(b.x1) - sx(b.x0) - 1)} height={H - PAD - sy(b.n)}
              fill={out ? '#fca5a5' : '#93c5fd'} stroke="#fff" strokeWidth="0.5" />
          );
        })}
        {sd > 0 && <path d={curve} fill="none" stroke="#0f172a" strokeWidth="1.8" />}
        {specLine(lsl, '#ef4444', 'LSL')}
        {specLine(usl, '#ef4444', 'USL')}
        {specLine(target, '#8b5cf6', 'Target')}
        {specLine(mean, '#3b82f6', 'X̄')}
      </svg>
      <p className="text-[10px] text-gray-400 text-center">Histograma + curva normal — barras rojas = fuera de especificación</p>
    </div>
  );
}

// Parsea texto pegado (CSV/TSV/una columna) a subgrupos según tipo de carta
function parsePasted(text: string, chartType: string, subgroupSize: number): any {
  const rows = text.trim().split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (['XBAR_R', 'XBAR_S'].includes(chartType)) {
    // cada línea = un subgrupo con valores separados por coma/tab/; o una sola columna que se agrupa de a subgroupSize
    const parsed = rows.map((l) => l.split(/[,;\t]/).map((v) => Number(v.trim())).filter((v) => !isNaN(v)));
    if (parsed.every((r) => r.length === 1)) {
      const flat = parsed.map((r) => r[0]);
      const groups: number[][] = [];
      for (let i = 0; i + subgroupSize <= flat.length; i += subgroupSize) groups.push(flat.slice(i, i + subgroupSize));
      return groups;
    }
    return parsed.filter((r) => r.length > 0);
  }
  if (chartType === 'I_MR') {
    return rows.map((l) => Number(l.split(/[,;\t]/)[0])).filter((v) => !isNaN(v));
  }
  // atributos: dos columnas n,defectuosos|defectos
  return rows.map((l) => {
    const c = l.split(/[,;\t]/).map((v) => Number(v.trim()));
    return ['P', 'NP'].includes(chartType) ? { n: c[0] || 0, defectives: c[1] || 0 } : { n: c[0] || 1, defects: c[1] || 0 };
  });
}

export default function SpcPage() {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [calcData, setCalcData] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [dataText, setDataText] = useState('');

  const [form, setForm] = useState({
    name: '', process: '', characteristic: '', unit: '', chartType: 'XBAR_R',
    subgroupSize: 5, usl: '', lsl: '', target: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ items: any[] }>('/core-tools/spc');
      setItems(res.items || []);
    } catch (e: any) { setError(e?.message || 'Error'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openDetail = async (id: string) => {
    const res = await apiFetch<{ item: any }>(`/core-tools/spc/${id}`);
    setSelected(res.item);
    setCalcData(null);
    setDataText(res.item.subgroups ? JSON.stringify(res.item.subgroups, null, 2) : '');
  };

  const create = async () => {
    try {
      await apiFetch('/core-tools/spc', {
        method: 'POST',
        json: {
          ...form,
          usl: form.usl ? Number(form.usl) : null,
          lsl: form.lsl ? Number(form.lsl) : null,
          target: form.target ? Number(form.target) : null,
          process: form.process || null, unit: form.unit || null,
        },
      });
      setShowCreate(false);
      setForm({ name: '', process: '', characteristic: '', unit: '', chartType: 'XBAR_R', subgroupSize: 5, usl: '', lsl: '', target: '' });
      load();
    } catch (e: any) { setError(e?.message || 'Error creando'); }
  };

  const saveData = async () => {
    if (!selected) return;
    try {
      let subgroups: any = null;
      const t = dataText.trim();
      if (t) {
        try { subgroups = JSON.parse(t); }
        catch { subgroups = parsePasted(t, selected.chartType, selected.subgroupSize); }
      }
      const res = await apiFetch<{ item: any }>(`/core-tools/spc/${selected.id}`, { method: 'PUT', json: { subgroups } });
      setSelected(res.item);
      setError('');
    } catch (e: any) { setError('Datos inválidos: ' + (e?.message || '')); }
  };

  const calculate = async () => {
    if (!selected) return;
    setCalculating(true); setError('');
    try {
      await saveData();
      const res = await apiFetch<{ item: any; points: number[]; spreadPoints?: number[] }>(
        `/core-tools/spc/${selected.id}/calculate`, { method: 'POST' });
      setSelected(res.item);
      setCalcData({ points: res.points, spreadPoints: res.spreadPoints });
      load();
    } catch (e: any) { setError(e?.message || 'Error calculando'); } finally { setCalculating(false); }
  };

  const aiInterpret = async () => {
    if (!selected) return;
    setAiLoading(true);
    try {
      const res = await apiFetch<{ interpretation: string }>(`/core-tools/spc/${selected.id}/ai-interpret`, { method: 'POST' });
      setSelected({ ...selected, aiInterpretation: res.interpretation });
    } catch (e: any) { setError(e?.message || 'Error de IA'); } finally { setAiLoading(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar esta carta?')) return;
    await apiFetch(`/core-tools/spc/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    load();
  };

  if (selected) {
    const cap = selected.capability;
    const alarms: any[] = selected.alarms || [];
    const points = calcData?.points || (selected.subgroups ? undefined : undefined);
    // reconstruir puntos desde subgroups si no hay calcData fresco
    const sg = selected.subgroups;
    const derivedPoints = points || (Array.isArray(sg)
      ? sg.map((g: any) => Array.isArray(g) ? g.reduce((s: number, v: number) => s + Number(v), 0) / g.length : (typeof g === 'number' ? g : (g.defectives ?? g.defects ?? 0) / (g.n || 1)))
      : []);
    const derivedSpread = calcData?.spreadPoints || (Array.isArray(sg) && Array.isArray(sg[0])
      ? sg.map((g: any) => Math.max(...g.map(Number)) - Math.min(...g.map(Number)))
      : undefined);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <div className="flex items-center gap-2">
            <button onClick={calculate} disabled={calculating}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
              {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />} Calcular
            </button>
            {selected.limits && (
              <button onClick={aiInterpret} disabled={aiLoading}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Interpretar con IA
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-bold text-gray-900">{selected.code} — {selected.name}</h2>
          <p className="text-sm text-gray-500">
            {CHART_TYPES[selected.chartType]} · {selected.characteristic} {selected.unit ? `(${selected.unit})` : ''} · {selected.process || ''}
          </p>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm">Datos</h3>
          <p className="text-[11px] text-gray-500">
            {['XBAR_R', 'XBAR_S'].includes(selected.chartType) && 'Subgrupos: [[v1,v2,...], [v1,v2,...], ...]'}
            {selected.chartType === 'I_MR' && 'Valores individuales: [v1, v2, v3, ...]'}
            {['P', 'NP'].includes(selected.chartType) && 'Subgrupos: [{"n": 50, "defectives": 3}, ...]'}
            {['C', 'U'].includes(selected.chartType) && 'Subgrupos: [{"n": 1, "defects": 4}, ...]'}
          </p>
          <textarea
            value={dataText} onChange={(e) => setDataText(e.target.value)} rows={6}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
            placeholder='Pegá los datos en JSON'
          />
          <button onClick={saveData} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Guardar datos
          </button>
        </div>

        {selected.limits && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
            <h3 className="font-semibold text-gray-800 text-sm">Carta de control</h3>
            <ControlChart points={derivedPoints} limits={selected.limits} alarms={alarms} spreadPoints={derivedSpread} />

            {cap && (
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                {[['Cp', cap.cp], ['Cpk', cap.cpk], ['Pp', cap.pp], ['Ppk', cap.ppk], ['PPM est.', cap.ppm], ['σ within', cap.sigmaWithin]].map(([l, v]) => (
                  <div key={l as string} className={`rounded-lg border px-3 py-2 text-center ${
                    l === 'Cpk' && v != null ? (v >= 1.33 ? 'border-emerald-200 bg-emerald-50' : v >= 1.0 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50') : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="text-lg font-bold text-gray-900">{v ?? '—'}</div>
                    <div className="text-[10px] text-gray-500">{l}</div>
                  </div>
                ))}
              </div>
            )}
            {cap?.verdict && (
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                ['EXCELENTE', 'CAPAZ'].includes(cap.verdict) ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : cap.verdict === 'MARGINAL' ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-red-100 text-red-800 border-red-300'
              }`}>
                {cap.verdict === 'NO CAPAZ' ? <XCircle className="h-3.5 w-3.5" /> : cap.verdict === 'MARGINAL' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                Proceso {cap.verdict}
              </span>
            )}

            {/* Histograma con specs — solo cartas de variables */}
            {['XBAR_R', 'XBAR_S', 'I_MR'].includes(selected.chartType) && Array.isArray(sg) && (
              <div className="pt-3 border-t border-gray-100">
                <h4 className="text-xs font-bold text-gray-600 mb-2">Distribución del proceso</h4>
                <Histogram
                  values={Array.isArray(sg[0]) ? sg.flat().map(Number) : sg.map(Number)}
                  usl={selected.usl} lsl={selected.lsl} target={selected.target}
                />
              </div>
            )}

            {alarms.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <h4 className="text-xs font-bold text-red-800 mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Alarmas Western Electric ({alarms.length})
                </h4>
                <ul className="space-y-0.5">
                  {alarms.slice(0, 10).map((a: any, i: number) => (
                    <li key={i} className="text-xs text-red-700">Punto {a.index + 1} — {a.rule}: {a.description}</li>
                  ))}
                  {alarms.length > 10 && <li className="text-xs text-red-500">…y {alarms.length - 10} más</li>}
                </ul>
              </div>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" /> SPC — Cartas de Control
          </h1>
          <p className="text-sm text-gray-500">Control estadístico de procesos con capabilidad y reglas Western Electric</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">
          <Plus className="h-4 w-4" /> Nueva carta
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
          No hay cartas SPC. Creá la primera con "Nueva carta".
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <button onClick={() => openDetail(it.id)} className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{it.code}</span>
                  <span className="font-medium text-gray-900 text-sm">{it.name}</span>
                  {it.capability?.cpk != null && (
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                      it.capability.cpk >= 1.33 ? 'bg-emerald-100 text-emerald-700' : it.capability.cpk >= 1.0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>Cpk {it.capability.cpk}</span>
                  )}
                  {(it.alarms || []).length > 0 && (
                    <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-red-100 text-red-700">
                      {it.alarms.length} alarma{it.alarms.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {CHART_TYPES[it.chartType]} · {it.characteristic} · {new Date(it.createdAt).toLocaleDateString('es-AR')}
                </div>
              </button>
              <button onClick={() => remove(it.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 space-y-3 shadow-xl">
            <h3 className="font-bold text-gray-900">Nueva carta SPC</h3>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Nombre"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.chartType} onChange={(e) => setForm({ ...form, chartType: e.target.value })}>
              {Object.entries(CHART_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Característica controlada"
              value={form.characteristic} onChange={(e) => setForm({ ...form, characteristic: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Proceso"
                value={form.process} onChange={(e) => setForm({ ...form, process: e.target.value })} />
              <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Unidad (mm, kg…)"
                value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[['LSL', 'lsl'], ['USL', 'usl'], ['Target', 'target']].map(([l, k]) => (
                <div key={k}>
                  <label className="text-[11px] text-gray-500">{l}</label>
                  <input type="number" step="any" className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">Cancelar</button>
              <button onClick={create} disabled={!form.name.trim() || !form.characteristic.trim()}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
