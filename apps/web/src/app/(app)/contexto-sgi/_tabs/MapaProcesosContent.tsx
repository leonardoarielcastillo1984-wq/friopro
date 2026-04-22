'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Plus, Trash2, Pencil, X, ChevronRight, ArrowRight,
  Layers, Cog, Users, Target, Loader2, AlertCircle,
} from 'lucide-react';

interface Process {
  id: string;
  layer: 'STRATEGIC' | 'OPERATIONAL' | 'SUPPORT';
  name: string;
  description?: string;
  owner?: string;
  inputs?: string;
  outputs?: string;
  indicators?: string;
  documents?: string;
  risks?: string;
  order: number;
}

interface ProcessMap {
  id: string;
  name: string;
  description?: string;
  scope?: string;
  inputLabel?: string;
  outputLabel?: string;
  processes: Process[];
}

const LAYER_CONFIG = {
  STRATEGIC: { label: 'Procesos Estratégicos', icon: Target, color: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', iconColor: 'text-blue-500' },
  OPERATIONAL: { label: 'Procesos Operativos', icon: Cog, color: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', iconColor: 'text-green-500' },
  SUPPORT: { label: 'Procesos de Soporte', icon: Users, color: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700', iconColor: 'text-orange-500' },
};

const EMPTY_PROCESS: Omit<Process, 'id' | 'order'> = {
  layer: 'OPERATIONAL', name: '', description: '', owner: '',
  inputs: '', outputs: '', indicators: '', documents: '', risks: '',
};

export default function MapaProcesosContent() {
  const [maps, setMaps] = useState<ProcessMap[]>([]);
  const [selected, setSelected] = useState<ProcessMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Map form
  const [showMapForm, setShowMapForm] = useState(false);
  const [mapForm, setMapForm] = useState({ name: '', description: '', scope: '', inputLabel: 'Requisitos del cliente / PI', outputLabel: 'Satisfacción del cliente / PI' });
  const [editingMapId, setEditingMapId] = useState<string | null>(null);

  // Process drawer
  const [drawer, setDrawer] = useState<Partial<Process> | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit'>('view');
  const [editingPid, setEditingPid] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const raw = await apiFetch<ProcessMap[] | { data: ProcessMap[] }>('/process-maps');
      const data: ProcessMap[] = Array.isArray(raw) ? raw : (raw as any).data ?? [];
      setMaps(data);
      if (selected) {
        const updated = data.find(m => m.id === selected.id);
        setSelected(updated ?? data[0] ?? null);
      } else {
        setSelected(data[0] ?? null);
      }
    } catch { setError('Error cargando mapas'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function saveMap() {
    setSaving(true);
    try {
      if (editingMapId) {
        await apiFetch(`/process-maps/${editingMapId}`, { method: 'PUT', json: mapForm });
      } else {
        await apiFetch('/process-maps', { method: 'POST', json: mapForm });
      }
      setShowMapForm(false);
      setEditingMapId(null);
      setMapForm({ name: '', description: '', scope: '', inputLabel: 'Requisitos del cliente / PI', outputLabel: 'Satisfacción del cliente / PI' });
      await load();
    } catch { setError('Error guardando mapa'); }
    finally { setSaving(false); }
  }

  async function deleteMap(id: string) {
    if (!confirm('¿Eliminar este mapa de procesos?')) return;
    await apiFetch(`/process-maps/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    await load();
  }

  async function saveProcess() {
    if (!selected || !drawer?.name) return;
    setSaving(true);
    try {
      if (editingPid) {
        await apiFetch(`/process-maps/${selected.id}/processes/${editingPid}`, { method: 'PUT', json: drawer });
      } else {
        await apiFetch(`/process-maps/${selected.id}/processes`, { method: 'POST', json: drawer });
      }
      setDrawer(null);
      setEditingPid(null);
      await load();
    } catch { setError('Error guardando proceso'); }
    finally { setSaving(false); }
  }

  async function deleteProcess(pid: string) {
    if (!selected || !confirm('¿Eliminar este proceso?')) return;
    await apiFetch(`/process-maps/${selected.id}/processes/${pid}`, { method: 'DELETE' });
    await load();
  }

  function openNewProcess(layer: Process['layer']) {
    setDrawer({ ...EMPTY_PROCESS, layer });
    setEditingPid(null);
    setDrawerMode('edit');
  }

  function openEdit(p: Process) {
    setDrawer({ ...p });
    setEditingPid(p.id);
    setDrawerMode('edit');
  }

  function openView(p: Process) {
    setDrawer({ ...p });
    setEditingPid(p.id);
    setDrawerMode('view');
  }

  if (loading) return <div className="flex items-center gap-2 py-10 text-neutral-400"><Loader2 className="h-5 w-5 animate-spin" />Cargando mapas...</div>;

  return (
    <div className="flex gap-6 min-h-[500px]">
      {/* Sidebar: lista de mapas */}
      <div className="w-56 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Mapas</span>
          <button onClick={() => { setShowMapForm(true); setEditingMapId(null); setMapForm({ name: '', description: '', scope: '', inputLabel: 'Requisitos del cliente / PI', outputLabel: 'Satisfacción del cliente / PI' }); }} className="p-1 rounded hover:bg-neutral-100">
            <Plus className="h-4 w-4 text-neutral-500" />
          </button>
        </div>

        {maps.length === 0 && (
          <button onClick={() => setShowMapForm(true)} className="w-full text-left px-3 py-3 rounded-lg border-2 border-dashed border-neutral-200 text-sm text-neutral-400 hover:border-brand-300 hover:text-brand-600 transition-colors">
            + Crear primer mapa
          </button>
        )}

        {maps.map(m => (
          <div key={m.id} onClick={() => setSelected(m)} className={`group relative px-3 py-2.5 rounded-lg cursor-pointer border transition-all ${selected?.id === m.id ? 'bg-brand-50 border-brand-200 text-brand-700' : 'border-transparent hover:bg-neutral-50 text-neutral-700'}`}>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium truncate">{m.name}</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 truncate pl-6">{m.processes.length} procesos</p>
            <div className="absolute right-1 top-1 hidden group-hover:flex gap-0.5">
              <button onClick={e => { e.stopPropagation(); setEditingMapId(m.id); setMapForm({ name: m.name, description: m.description ?? '', scope: m.scope ?? '', inputLabel: m.inputLabel ?? 'Requisitos del cliente / PI', outputLabel: m.outputLabel ?? 'Satisfacción del cliente / PI' }); setShowMapForm(true); }} className="p-1 rounded hover:bg-white"><Pencil className="h-3 w-3 text-neutral-400" /></button>
              <button onClick={e => { e.stopPropagation(); deleteMap(m.id); }} className="p-1 rounded hover:bg-white"><Trash2 className="h-3 w-3 text-red-400" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Main: mapa visual */}
      <div className="flex-1">
        {!selected ? (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
            <Layers className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">Seleccioná o creá un mapa de procesos</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">{selected.name}</h3>
                {selected.description && <p className="text-sm text-neutral-500">{selected.description}</p>}
              </div>
            </div>

            {/* Layout: entrada → capas → salida */}
            <div className="flex gap-3 items-stretch">
              {/* Entrada */}
              <div className="flex flex-col items-center justify-center w-24 flex-shrink-0">
                <div className="bg-neutral-100 border border-neutral-200 rounded-lg px-3 py-4 text-center h-full flex items-center justify-center">
                  <p className="text-xs font-medium text-neutral-500 leading-tight">{selected.inputLabel}</p>
                </div>
              </div>
              <div className="flex items-center flex-shrink-0"><ArrowRight className="h-5 w-5 text-neutral-300" /></div>

              {/* Las 3 capas */}
              <div className="flex-1 space-y-3">
                {(['STRATEGIC', 'OPERATIONAL', 'SUPPORT'] as const).map(layer => {
                  const cfg = LAYER_CONFIG[layer];
                  const LayerIcon = cfg.icon;
                  const layerProcesses = selected.processes.filter(p => p.layer === layer);
                  return (
                    <div key={layer} className={`rounded-lg border-2 p-3 ${cfg.color}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <LayerIcon className={`h-4 w-4 ${cfg.iconColor}`} />
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                        </div>
                        <button onClick={() => openNewProcess(layer)} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 px-2 py-1 rounded hover:bg-white/60 transition-colors">
                          <Plus className="h-3 w-3" /> Agregar
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {layerProcesses.length === 0 && (
                          <p className="text-xs text-neutral-400 italic py-1">Sin procesos aún</p>
                        )}
                        {layerProcesses.map(p => (
                          <div key={p.id} className="group relative bg-white border border-neutral-200 rounded-lg px-3 py-2 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-300 transition-all" onClick={() => openView(p)}>
                            <p className="text-sm font-medium text-neutral-800">{p.name}</p>
                            {p.owner && <p className="text-xs text-neutral-400">{p.owner}</p>}
                            <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex gap-0.5 bg-white rounded shadow-sm border border-neutral-100 p-0.5">
                              <button onClick={e => { e.stopPropagation(); openEdit(p); }} className="p-0.5 rounded hover:bg-neutral-50"><Pencil className="h-3 w-3 text-neutral-400" /></button>
                              <button onClick={e => { e.stopPropagation(); deleteProcess(p.id); }} className="p-0.5 rounded hover:bg-neutral-50"><Trash2 className="h-3 w-3 text-red-400" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Salida */}
              <div className="flex items-center flex-shrink-0"><ArrowRight className="h-5 w-5 text-neutral-300" /></div>
              <div className="flex flex-col items-center justify-center w-24 flex-shrink-0">
                <div className="bg-neutral-100 border border-neutral-200 rounded-lg px-3 py-4 text-center h-full flex items-center justify-center">
                  <p className="text-xs font-medium text-neutral-500 leading-tight">{selected.outputLabel}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: crear/editar mapa */}
      {showMapForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">{editingMapId ? 'Editar mapa' : 'Nuevo mapa de procesos'}</h3>
              <button onClick={() => setShowMapForm(false)}><X className="h-5 w-5 text-neutral-400" /></button>
            </div>
            {[
              { key: 'name', label: 'Nombre *', ph: 'Ej: Gestión Comercial' },
              { key: 'description', label: 'Descripción', ph: '' },
              { key: 'scope', label: 'Alcance', ph: 'Ej: Todos los departamentos comerciales' },
              { key: 'inputLabel', label: 'Etiqueta entrada', ph: '' },
              { key: 'outputLabel', label: 'Etiqueta salida', ph: '' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-neutral-600 mb-1">{f.label}</label>
                <input value={(mapForm as any)[f.key]} onChange={e => setMapForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
            ))}
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowMapForm(false)} className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 rounded-lg border border-neutral-200">Cancelar</button>
              <button onClick={saveMap} disabled={!mapForm.name || saving} className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer: detalle/edición de proceso */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawer(null)} />
          <div className="relative bg-white w-full max-w-sm shadow-2xl flex flex-col h-full overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-neutral-900">{drawerMode === 'edit' ? (editingPid ? 'Editar proceso' : 'Nuevo proceso') : 'Detalle del proceso'}</h3>
              <div className="flex items-center gap-2">
                {drawerMode === 'view' && editingPid && (
                  <button onClick={() => setDrawerMode('edit')} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 px-2 py-1 rounded border border-brand-200 hover:bg-brand-50">
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                )}
                <button onClick={() => setDrawer(null)}><X className="h-5 w-5 text-neutral-400" /></button>
              </div>
            </div>

            <div className="flex-1 px-5 py-4 space-y-4">
              {drawerMode === 'view' ? (
                <>
                  <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${LAYER_CONFIG[drawer.layer as Process['layer']]?.badge}`}>
                    {drawer.layer && (() => { const L = LAYER_CONFIG[drawer.layer as Process['layer']].icon; return <L className="h-3 w-3" />; })()}
                    {LAYER_CONFIG[drawer.layer as Process['layer']]?.label}
                  </div>
                  <h2 className="text-lg font-bold text-neutral-900">{drawer.name}</h2>
                  {drawer.owner && <p className="text-sm text-neutral-500">👤 {drawer.owner}</p>}
                  {drawer.description && <p className="text-sm text-neutral-600">{drawer.description}</p>}
                  {[
                    { k: 'inputs', label: '📥 Entradas' },
                    { k: 'outputs', label: '📤 Salidas' },
                    { k: 'indicators', label: '📊 Indicadores' },
                    { k: 'documents', label: '📄 Documentos' },
                    { k: 'risks', label: '⚠️ Riesgos' },
                  ].map(({ k, label }) => (drawer as any)[k] ? (
                    <div key={k}>
                      <p className="text-xs font-semibold text-neutral-500 mb-1">{label}</p>
                      <p className="text-sm text-neutral-700 whitespace-pre-line">{(drawer as any)[k]}</p>
                    </div>
                  ) : null)}
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Capa</label>
                    <select value={drawer.layer} onChange={e => setDrawer(p => ({ ...p, layer: e.target.value as any }))} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm">
                      <option value="STRATEGIC">Estratégico</option>
                      <option value="OPERATIONAL">Operativo</option>
                      <option value="SUPPORT">Soporte</option>
                    </select>
                  </div>
                  {[
                    { k: 'name', label: 'Nombre *', rows: 1 },
                    { k: 'owner', label: 'Responsable / Dueño', rows: 1 },
                    { k: 'description', label: 'Descripción', rows: 2 },
                    { k: 'inputs', label: 'Entradas', rows: 2 },
                    { k: 'outputs', label: 'Salidas', rows: 2 },
                    { k: 'indicators', label: 'Indicadores vinculados', rows: 2 },
                    { k: 'documents', label: 'Documentos relacionados', rows: 2 },
                    { k: 'risks', label: 'Riesgos asociados', rows: 2 },
                  ].map(({ k, label, rows }) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
                      {rows > 1 ? (
                        <textarea value={(drawer as any)[k] ?? ''} onChange={e => setDrawer(p => ({ ...p, [k]: e.target.value }))} rows={rows} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300" />
                      ) : (
                        <input value={(drawer as any)[k] ?? ''} onChange={e => setDrawer(p => ({ ...p, [k]: e.target.value }))} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>

            {drawerMode === 'edit' && (
              <div className="px-5 py-4 border-t flex gap-2 justify-end">
                <button onClick={() => setDrawer(null)} className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 rounded-lg border border-neutral-200">Cancelar</button>
                <button onClick={saveProcess} disabled={!drawer.name || saving} className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
