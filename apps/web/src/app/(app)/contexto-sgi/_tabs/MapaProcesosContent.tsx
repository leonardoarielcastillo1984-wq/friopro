'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Plus, Trash2, Pencil, X, ArrowRight, CheckCircle, Building2,
  Layers, Cog, Users, Target, Loader2, BarChart3, FileText, Shield,
  MapPin, Filter
} from 'lucide-react';

interface Process {
  id: string;
  layer: 'STRATEGIC' | 'OPERATIONAL' | 'SUPPORT';
  name: string;
  code?: string;
  status: 'active' | 'inactive';
  description?: string;
  owner?: string;
  inputs?: string;
  outputs?: string;
  sites: string[];
  departmentId?: string;
  indicators?: string;
  documents?: string;
  risks?: string;
  order: number;
  processIndicators?: { id: string; indicatorId: string }[];
  processDocuments?: { id: string; documentId: string }[];
  processRisks?: { id: string; riskId: string }[];
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
  STRATEGIC: { label: 'Estratégicos', icon: Target, color: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', iconColor: 'text-blue-500' },
  OPERATIONAL: { label: 'Operativos', icon: Cog, color: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', iconColor: 'text-green-500' },
  SUPPORT: { label: 'Soporte', icon: Users, color: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700', iconColor: 'text-orange-500' },
};

const TABS = [
  { key: 'info', label: 'Información', icon: Building2 },
  { key: 'indicators', label: 'Indicadores', icon: BarChart3 },
  { key: 'documents', label: 'Documentos', icon: FileText },
  { key: 'risks', label: 'Riesgos', icon: Shield },
];

const EMPTY_PROCESS: Partial<Process> = {
  layer: 'OPERATIONAL', name: '', code: '', status: 'active', description: '', owner: '',
  inputs: '', outputs: '', sites: [], departmentId: '',
  indicators: '', documents: '', risks: '',
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
  const [activeTab, setActiveTab] = useState('info');

  // Filters
  const [filterLayer, setFilterLayer] = useState<string>('');
  const [filterSite, setFilterSite] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

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
      const body = { ...drawer };
      if (editingPid) {
        await apiFetch(`/process-maps/${selected.id}/processes/${editingPid}`, { method: 'PATCH', json: body });
      } else {
        await apiFetch(`/process-maps/${selected.id}/processes`, { method: 'POST', json: body });
      }
      setDrawer(null);
      setEditingPid(null);
      setActiveTab('info');
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
    setActiveTab('info');
  }

  function openEdit(p: Process) {
    setDrawer({ ...p });
    setEditingPid(p.id);
    setDrawerMode('edit');
    setActiveTab('info');
  }

  function openView(p: Process) {
    setDrawer({ ...p });
    setEditingPid(p.id);
    setDrawerMode('view');
    setActiveTab('info');
  }

  function allSites() {
    if (!selected) return [];
    const s = new Set<string>();
    selected.processes.forEach(p => p.sites?.forEach(site => s.add(site)));
    return Array.from(s);
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

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-neutral-400" />
              <select value={filterLayer} onChange={e => setFilterLayer(e.target.value)} className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5">
                <option value="">Todas las capas</option>
                <option value="STRATEGIC">Estratégicos</option>
                <option value="OPERATIONAL">Operativos</option>
                <option value="SUPPORT">Soporte</option>
              </select>
              <select value={filterSite} onChange={e => setFilterSite(e.target.value)} className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5">
                <option value="">Todas las sedes</option>
                {allSites().map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5">
                <option value="">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
              {(filterLayer || filterSite || filterStatus) && (
                <button onClick={() => { setFilterLayer(''); setFilterSite(''); setFilterStatus(''); }} className="text-xs text-neutral-500 hover:text-neutral-700 underline">Limpiar</button>
              )}
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
                  let layerProcesses = selected.processes.filter(p => p.layer === layer);
                  if (filterLayer && filterLayer !== layer) return null;
                  if (filterSite) layerProcesses = layerProcesses.filter(p => p.sites?.includes(filterSite));
                  if (filterStatus) layerProcesses = layerProcesses.filter(p => p.status === filterStatus);
                  return (
                    <div key={layer} className={`rounded-lg border-2 p-3 ${cfg.color}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <LayerIcon className={`h-4 w-4 ${cfg.iconColor}`} />
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                          <span className="text-xs text-neutral-400 ml-1">{layerProcesses.length}</span>
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
                          <div key={p.id} className={`group relative bg-white border rounded-lg px-3 py-2 shadow-sm cursor-pointer hover:shadow-md transition-all min-w-[180px] ${p.status === 'inactive' ? 'opacity-60 border-neutral-200' : 'border-neutral-200 hover:border-brand-300'}`} onClick={() => openView(p)}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  {p.code && <span className="text-[10px] font-mono bg-neutral-100 text-neutral-600 px-1 py-0.5 rounded">{p.code}</span>}
                                  {p.status === 'inactive' && <span className="text-[10px] bg-red-50 text-red-600 px-1 py-0.5 rounded">INACTIVO</span>}
                                </div>
                                <p className="text-sm font-medium text-neutral-800 truncate">{p.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {p.owner && <p className="text-[11px] text-neutral-400 truncate">👤 {p.owner}</p>}
                                  {p.sites && p.sites.length > 0 && (
                                    <span className="flex items-center gap-0.5 text-[11px] text-neutral-500">
                                      <MapPin className="h-3 w-3" />{p.sites.length}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="hidden group-hover:flex gap-0.5">
                                <button onClick={e => { e.stopPropagation(); openEdit(p); }} className="p-1 rounded hover:bg-neutral-100"><Pencil className="h-3 w-3 text-neutral-400" /></button>
                                <button onClick={e => { e.stopPropagation(); deleteProcess(p.id); }} className="p-1 rounded hover:bg-red-50"><Trash2 className="h-3 w-3 text-red-400" /></button>
                              </div>
                            </div>
                            {/* Indicadores / docs / riesgos badges */}
                            {(p.processIndicators?.length || p.processDocuments?.length || p.processRisks?.length || p.indicators || p.documents || p.risks) && (
                              <div className="flex gap-1 mt-1.5 pt-1.5 border-t border-neutral-100">
                                {((p.processIndicators?.length || 0) > 0 || p.indicators) && <span className="flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded"><BarChart3 className="h-3 w-3" />KPI</span>}
                                {((p.processDocuments?.length || 0) > 0 || p.documents) && <span className="flex items-center gap-0.5 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded"><FileText className="h-3 w-3" />DOC</span>}
                                {((p.processRisks?.length || 0) > 0 || p.risks) && <span className="flex items-center gap-0.5 text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded"><Shield className="h-3 w-3" />R</span>}
                              </div>
                            )}
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
          <div className="relative bg-white w-full max-w-md shadow-2xl flex flex-col h-full overflow-y-auto">
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

            {/* Tabs */}
            <div className="flex border-b">
              {TABS.map(t => {
                const TabIcon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${activeTab === t.key ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'}`}
                  >
                    <TabIcon className="h-3.5 w-3.5" />{t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 px-5 py-4 space-y-4">
              {drawerMode === 'view' ? (
                activeTab === 'info' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${LAYER_CONFIG[drawer.layer as Process['layer']]?.badge}`}>
                        {drawer.layer && (() => { const L = LAYER_CONFIG[drawer.layer as Process['layer']].icon; return <L className="h-3 w-3" />; })()}
                        {LAYER_CONFIG[drawer.layer as Process['layer']]?.label}
                      </span>
                      {drawer.status === 'inactive' && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Inactivo</span>}
                    </div>
                    <h2 className="text-lg font-bold text-neutral-900">{drawer.name}</h2>
                    {drawer.code && <p className="text-xs font-mono text-neutral-500">Código: {drawer.code}</p>}
                    {drawer.owner && <p className="text-sm text-neutral-500 flex items-center gap-1"><span className="text-base">👤</span>{drawer.owner}</p>}
                    {drawer.departmentId && <p className="text-sm text-neutral-500">Departamento: {drawer.departmentId}</p>}
                    {drawer.sites && drawer.sites.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                        {drawer.sites.map((s, i) => <span key={i} className="text-xs bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">{s}</span>)}
                      </div>
                    )}
                    {drawer.description && <p className="text-sm text-neutral-600">{drawer.description}</p>}
                    {drawer.inputs && <div><p className="text-xs font-semibold text-neutral-500 mb-1">📥 Entradas</p><p className="text-sm text-neutral-700 whitespace-pre-line">{drawer.inputs}</p></div>}
                    {drawer.outputs && <div><p className="text-xs font-semibold text-neutral-500 mb-1">📤 Salidas</p><p className="text-sm text-neutral-700 whitespace-pre-line">{drawer.outputs}</p></div>}
                    {/* Legacy fields */}
                    {drawer.indicators && <div><p className="text-xs font-semibold text-neutral-500 mb-1">📊 Indicadores (legacy)</p><p className="text-sm text-neutral-700 whitespace-pre-line">{drawer.indicators}</p></div>}
                    {drawer.documents && <div><p className="text-xs font-semibold text-neutral-500 mb-1">📄 Documentos (legacy)</p><p className="text-sm text-neutral-700 whitespace-pre-line">{drawer.documents}</p></div>}
                    {drawer.risks && <div><p className="text-xs font-semibold text-neutral-500 mb-1">⚠️ Riesgos (legacy)</p><p className="text-sm text-neutral-700 whitespace-pre-line">{drawer.risks}</p></div>}
                  </>
                ) : activeTab === 'indicators' ? (
                  <>
                    <p className="text-xs text-neutral-500 mb-2">Indicadores vinculados al proceso</p>
                    {drawer.processIndicators && drawer.processIndicators.length > 0 ? (
                      <div className="space-y-2">
                        {drawer.processIndicators.map((rel, i) => (
                          <div key={rel.id} className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-blue-500" />
                              <span className="text-sm text-neutral-700">ID: {rel.indicatorId}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-neutral-400">
                        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Sin indicadores vinculados</p>
                      </div>
                    )}
                  </>
                ) : activeTab === 'documents' ? (
                  <>
                    <p className="text-xs text-neutral-500 mb-2">Documentos relacionados al proceso</p>
                    {drawer.processDocuments && drawer.processDocuments.length > 0 ? (
                      <div className="space-y-2">
                        {drawer.processDocuments.map((rel, i) => (
                          <div key={rel.id} className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-green-500" />
                              <span className="text-sm text-neutral-700">ID: {rel.documentId}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-neutral-400">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Sin documentos relacionados</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs text-neutral-500 mb-2">Riesgos asociados al proceso</p>
                    {drawer.processRisks && drawer.processRisks.length > 0 ? (
                      <div className="space-y-2">
                        {drawer.processRisks.map((rel, i) => (
                          <div key={rel.id} className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-orange-500" />
                              <span className="text-sm text-neutral-700">ID: {rel.riskId}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-neutral-400">
                        <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Sin riesgos asociados</p>
                      </div>
                    )}
                  </>
                )
              ) : (
                /* Edit mode */
                activeTab === 'info' ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Capa</label>
                      <select value={drawer.layer} onChange={e => setDrawer(p => ({ ...p, layer: e.target.value as any }))} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm">
                        <option value="STRATEGIC">Estratégico</option>
                        <option value="OPERATIONAL">Operativo</option>
                        <option value="SUPPORT">Soporte</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Código</label>
                      <input value={drawer.code ?? ''} onChange={e => setDrawer(p => ({ ...p, code: e.target.value }))} placeholder="Ej: OP-01" className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre *</label>
                      <input value={drawer.name ?? ''} onChange={e => setDrawer(p => ({ ...p, name: e.target.value }))} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Estado</label>
                      <select value={drawer.status ?? 'active'} onChange={e => setDrawer(p => ({ ...p, status: e.target.value as any }))} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm">
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Responsable / Dueño</label>
                      <input value={drawer.owner ?? ''} onChange={e => setDrawer(p => ({ ...p, owner: e.target.value }))} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Sedes (separadas por coma)</label>
                      <input value={Array.isArray(drawer.sites) ? drawer.sites.join(', ') : drawer.sites ?? ''} onChange={e => setDrawer(p => ({ ...p, sites: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} placeholder="Sede Central, Sede Norte" className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Departamento ID</label>
                      <input value={drawer.departmentId ?? ''} onChange={e => setDrawer(p => ({ ...p, departmentId: e.target.value }))} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Descripción</label>
                      <textarea value={drawer.description ?? ''} onChange={e => setDrawer(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Entradas</label>
                      <textarea value={drawer.inputs ?? ''} onChange={e => setDrawer(p => ({ ...p, inputs: e.target.value }))} rows={2} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Salidas</label>
                      <textarea value={drawer.outputs ?? ''} onChange={e => setDrawer(p => ({ ...p, outputs: e.target.value }))} rows={2} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300" />
                    </div>
                  </>
                ) : activeTab === 'indicators' ? (
                  <>
                    <p className="text-xs text-neutral-500 mb-2">Indicadores vinculados (legacy - se migrará a relaciones)</p>
                    <textarea value={drawer.indicators ?? ''} onChange={e => setDrawer(p => ({ ...p, indicators: e.target.value }))} rows={4} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  </>
                ) : activeTab === 'documents' ? (
                  <>
                    <p className="text-xs text-neutral-500 mb-2">Documentos relacionados (legacy - se migrará a relaciones)</p>
                    <textarea value={drawer.documents ?? ''} onChange={e => setDrawer(p => ({ ...p, documents: e.target.value }))} rows={4} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  </>
                ) : (
                  <>
                    <p className="text-xs text-neutral-500 mb-2">Riesgos asociados (legacy - se migrará a relaciones)</p>
                    <textarea value={drawer.risks ?? ''} onChange={e => setDrawer(p => ({ ...p, risks: e.target.value }))} rows={4} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  </>
                )
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
