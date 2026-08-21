'use client';
import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Hash, Loader2, Sparkles, X, Search, Network,
  RefreshCw, FileOutput, CheckCircle2, AlertCircle, Edit3,
} from 'lucide-react';

interface OutputDef {
  id: string;
  module: string;
  subModule?: string;
  screenName: string;
  outputKey: string;
  outputType: string;
  documentCode?: string;
  revision: number;
  status: string;
  entityRef?: string;
  document?: { id: string; title: string; documentCode?: string };
}

interface ProcessMap {
  id: string;
  name: string;
  processes: { id: string }[];
}

const MODULE_LABELS: Record<string, string> = {
  'calidad': 'Calidad',
  'rrhh': 'RRHH',
  'documents': 'Documentos',
  'normativos': 'Cumplimiento',
  'audits': 'Auditorías',
  'riesgos': 'Riesgos',
  'indicadores': 'Indicadores',
  'capacitaciones': 'Capacitaciones',
  'contexto-sgi': 'Contexto SGI',
  'project360': 'Proyectos',
  'no-conformidades': 'No Conformidades',
  'clima': 'Clima Laboral',
  'maintenance': 'Mantenimiento',
  'seh360': 'Seguridad y Salud',
};

function StatCard({ label, value, sub, accent }: { label: string; value: number; sub: string; accent?: 'green' | 'amber' | 'red' | 'neutral' }) {
  const colors = {
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    neutral: 'bg-neutral-50 border-neutral-200 text-neutral-700',
  };
  const c = colors[accent ?? 'neutral'];
  return (
    <div className={`rounded-xl border p-4 ${c}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-0.5">{label}</div>
      <div className="text-xs opacity-75 mt-0.5">{sub}</div>
    </div>
  );
}

export default function ControlDocumental() {
  const [outputs, setOutputs] = useState<OutputDef[]>([]);
  const [maps, setMaps] = useState<ProcessMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPending, setFilterPending] = useState(false);
  const [filterModule, setFilterModule] = useState('');
  const [assignModal, setAssignModal] = useState<{
    outputId?: string;
    mapId?: string;
    screenName: string;
    currentCode?: string;
  } | null>(null);
  const [newCode, setNewCode] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [hasRule, setHasRule] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [defs, rawMaps] = await Promise.all([
        apiFetch<OutputDef[]>('/doc-export/outputs').catch(() => [] as OutputDef[]),
        apiFetch<any>('/process-maps').catch(() => []),
      ]);
      setOutputs(Array.isArray(defs) ? defs : []);
      const mapsArr: ProcessMap[] = Array.isArray(rawMaps) ? rawMaps : (rawMaps?.data ?? []);
      setMaps(mapsArr);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const mapOutputs = useMemo(() => {
    return maps.map(map => {
      const key = `contexto-sgi.mapa-de-procesos.${map.id}`;
      const output = outputs.find(o => o.outputKey === key || o.entityRef === map.id) ?? null;
      return { map, output };
    });
  }, [maps, outputs]);

  const mapOutputKeys = useMemo(() => new Set([
    ...maps.map(m => `contexto-sgi.mapa-de-procesos.${m.id}`),
    ...maps.map(m => m.id),
  ]), [maps]);

  const otherOutputs = useMemo(() => {
    return outputs.filter(o =>
      !maps.some(m => o.outputKey === `contexto-sgi.mapa-de-procesos.${m.id}` || o.entityRef === m.id)
    );
  }, [outputs, maps]);

  const stats = useMemo(() => {
    const codedMaps = mapOutputs.filter(mo => mo.output?.documentCode).length;
    const codedOther = otherOutputs.filter(o => o.documentCode).length;
    return {
      totalMaps: maps.length,
      codedMaps,
      pendingMaps: maps.length - codedMaps,
      totalOther: otherOutputs.length,
      codedOther,
      pendingOther: otherOutputs.length - codedOther,
    };
  }, [mapOutputs, otherOutputs, maps]);

  const availableModules = useMemo(() => {
    const mods = new Set(otherOutputs.map(o => o.module));
    return Array.from(mods).sort();
  }, [otherOutputs]);

  async function syncAllMaps() {
    setSyncing(true);
    const unregistered = mapOutputs.filter(mo => !mo.output);
    try {
      await Promise.all(unregistered.map(mo =>
        apiFetch(`/process-maps/${mo.map.id}/document-output`, { method: 'POST' }).catch(() => {})
      ));
      await load();
      if (unregistered.length > 0) {
        setSuccess(`${unregistered.length} mapas registrados como salidas documentales`);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch {}
    setSyncing(false);
  }

  async function openAssignForMap(mo: { map: ProcessMap; output: OutputDef | null }) {
    let out = mo.output;
    if (!out) {
      try {
        await apiFetch(`/process-maps/${mo.map.id}/document-output`, { method: 'POST' });
        await load();
        out = outputs.find(o => o.outputKey === `contexto-sgi.mapa-de-procesos.${mo.map.id}` || o.entityRef === mo.map.id) ?? null;
      } catch {}
    }
    setAssignModal({
      outputId: out?.id,
      mapId: mo.map.id,
      screenName: mo.map.name,
      currentCode: out?.documentCode,
    });
    setNewCode(out?.documentCode || '');
    setHasRule(false);
    if (!out?.documentCode) {
      setSuggesting(true);
      apiFetch<{ suggestedCode: string; hasRule: boolean }>(`/process-maps/${mo.map.id}/suggest-code`)
        .then(res => { setNewCode(res.suggestedCode || ''); setHasRule(res.hasRule); })
        .catch(() => {})
        .finally(() => setSuggesting(false));
    }
  }

  function openAssignForOutput(out: OutputDef) {
    setAssignModal({ outputId: out.id, screenName: out.screenName, currentCode: out.documentCode });
    setNewCode(out.documentCode || '');
    setHasRule(false);
    if (!out.documentCode) {
      setSuggesting(true);
      apiFetch<{ suggestedCode: string; hasRule: boolean }>(`/doc-export/outputs/${out.id}/suggest-code`)
        .then(res => { setNewCode(res.suggestedCode || ''); setHasRule(res.hasRule); })
        .catch(() => {})
        .finally(() => setSuggesting(false));
    }
  }

  async function assignCode() {
    if (!assignModal || !newCode.trim()) return;
    setAssigning(true);
    try {
      if (assignModal.mapId) {
        await apiFetch(`/process-maps/${assignModal.mapId}/assign-code`, {
          method: 'POST', json: { documentCode: newCode.trim() },
        });
      } else if (assignModal.outputId) {
        await apiFetch(`/doc-export/outputs/${assignModal.outputId}/assign-code`, {
          method: 'POST', json: { documentCode: newCode.trim() },
        });
      }
      setSuccess(`Código "${newCode.trim()}" asignado`);
      setTimeout(() => setSuccess(''), 3000);
      setAssignModal(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Error al asignar código');
      setTimeout(() => setError(''), 3000);
    }
    setAssigning(false);
  }

  const filteredMaps = useMemo(() => {
    let result = mapOutputs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(mo =>
        mo.map.name.toLowerCase().includes(q) || (mo.output?.documentCode || '').toLowerCase().includes(q)
      );
    }
    if (filterPending) result = result.filter(mo => !mo.output?.documentCode);
    return result;
  }, [mapOutputs, search, filterPending]);

  const filteredOutputs = useMemo(() => {
    let result = otherOutputs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        o.screenName.toLowerCase().includes(q) ||
        (o.documentCode || '').toLowerCase().includes(q) ||
        o.module.toLowerCase().includes(q) ||
        o.outputKey.toLowerCase().includes(q)
      );
    }
    if (filterPending) result = result.filter(o => !o.documentCode);
    if (filterModule) result = result.filter(o => o.module === filterModule);
    return result;
  }, [otherOutputs, search, filterPending, filterModule]);

  if (loading) return (
    <div className="py-16 text-center text-neutral-400">
      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
      <p className="text-sm">Cargando control documental...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">{success}</div>}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
            <Hash className="h-5 w-5 text-indigo-600" /> Control Documental del Sistema
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Asignación y gestión de códigos documentales para todas las salidas del sistema ISO/IEC
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Mapas de procesos" value={stats.totalMaps} sub={`${stats.codedMaps} codificados`} accent="neutral" />
        <StatCard label="Mapas sin código" value={stats.pendingMaps} sub="pendientes de asignación" accent={stats.pendingMaps > 0 ? 'amber' : 'green'} />
        <StatCard label="Otras salidas del sistema" value={stats.totalOther} sub={`${stats.codedOther} codificadas`} accent="neutral" />
        <StatCard label="Salidas sin código" value={stats.pendingOther} sub="pendientes de asignación" accent={stats.pendingOther > 0 ? 'amber' : 'green'} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, módulo o código..."
            className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>
        <button
          onClick={() => setFilterPending(f => !f)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
            filterPending
              ? 'bg-amber-50 border-amber-300 text-amber-700 font-medium'
              : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <AlertCircle className="h-4 w-4" /> Solo pendientes
        </button>
        <select
          value={filterModule}
          onChange={e => setFilterModule(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los módulos</option>
          {availableModules.map(m => <option key={m} value={m}>{MODULE_LABELS[m] ?? m}</option>)}
        </select>
      </div>

      {/* ── Mapas de procesos ── */}
      {maps.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-700 flex items-center gap-2">
              <Network className="h-4 w-4 text-indigo-500" />
              Mapas de procesos
              <span className="text-xs font-normal text-neutral-400">({filteredMaps.length})</span>
            </h3>
            {mapOutputs.some(mo => !mo.output) && (
              <button
                onClick={syncAllMaps}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-40"
              >
                {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Registrar todos en el catálogo
              </button>
            )}
          </div>

          {filteredMaps.length === 0 ? (
            <div className="py-6 text-center text-sm text-neutral-400">No hay mapas que coincidan con el filtro</div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden divide-y divide-neutral-100">
              {filteredMaps.map(({ map, output }) => (
                <div key={map.id} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Network className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate">{map.name}</p>
                      <p className="text-xs text-neutral-400">{map.processes?.length ?? 0} procesos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {output?.documentCode ? (
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                        <Hash className="h-3 w-3" /> {output.documentCode}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400 italic">Sin código</span>
                    )}
                    <button
                      onClick={() => openAssignForMap({ map, output })}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                    >
                      <Hash className="h-3 w-3" />
                      {output?.documentCode ? 'Cambiar' : 'Asignar código'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Otras salidas del sistema ── */}
      <section className="space-y-3">
        <h3 className="font-semibold text-neutral-700 flex items-center gap-2">
          <FileOutput className="h-4 w-4 text-neutral-400" />
          Otras salidas documentales del sistema
          <span className="text-xs font-normal text-neutral-400">({filteredOutputs.length})</span>
        </h3>

        {filteredOutputs.length === 0 ? (
          <div className="py-8 text-center text-neutral-400">
            <FileOutput className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{filterPending ? 'Todas las salidas tienen código asignado ✓' : 'No hay salidas documentales registradas'}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-100">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Código</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Salida documental</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Módulo</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filteredOutputs.map(out => (
                  <tr key={out.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2.5">
                      {out.documentCode ? (
                        <code className="font-mono text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                          {out.documentCode}
                        </code>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertCircle className="h-3 w-3" /> Sin código
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-neutral-800">{out.screenName}</p>
                      <p className="text-xs text-neutral-400 font-mono">{out.outputKey}</p>
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600 text-xs">
                      {MODULE_LABELS[out.module] ?? out.module}
                      {out.subModule && <span className="text-neutral-400"> / {out.subModule}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end">
                        <button
                          onClick={() => openAssignForOutput(out)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                        >
                          <Hash className="h-3 w-3" />
                          {out.documentCode ? 'Cambiar' : 'Asignar código'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Modal asignar código ── */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                <Hash className="h-4 w-4 text-indigo-600" /> Asignar código documental
              </h3>
              <button onClick={() => setAssignModal(null)} className="p-1.5 rounded-lg hover:bg-neutral-100">
                <X className="h-4 w-4 text-neutral-400" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-xs text-neutral-500">Salida documental</p>
                <p className="text-sm font-medium text-neutral-800 mt-0.5">{assignModal.screenName}</p>
              </div>
              {assignModal.currentCode && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-amber-700">
                    <strong>Código actual:</strong> <code className="font-mono">{assignModal.currentCode}</code>
                  </p>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">Nuevo código</label>
                {suggesting ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-neutral-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Sugiriendo código...
                  </div>
                ) : (
                  <input
                    type="text"
                    value={newCode}
                    onChange={e => setNewCode(e.target.value)}
                    placeholder="Ej: SGI-MAP-001"
                    className="w-full px-3 py-2 text-sm font-mono border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    autoFocus
                  />
                )}
                {hasRule && !suggesting && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Sugerido según regla de codificación del módulo
                  </p>
                )}
                {!hasRule && !suggesting && (
                  <p className="text-xs text-neutral-400 mt-1">
                    Sin regla de codificación configurada. Ingrese el código manualmente.
                  </p>
                )}
              </div>
              <p className="text-xs text-neutral-400">
                Al confirmar, el código se guardará y estará disponible en el Maestro de Documentos para asociar cláusulas normativas.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-100">
              <button
                onClick={() => setAssignModal(null)}
                className="px-4 py-2 text-sm font-medium text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                onClick={assignCode}
                disabled={!newCode.trim() || assigning || suggesting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40"
              >
                {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />}
                {assigning ? 'Asignando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
