'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Plus, Trash2, Pencil, X, ArrowRight, ArrowDown, CheckCircle, Building2,
  Layers, Cog, Users, Target, Loader2, BarChart3, FileText, Shield,
  MapPin, Filter, MoreVertical, Eye, Factory, Package, Truck, Wrench,
  ClipboardCheck, ShoppingCart, GraduationCap, AlertTriangle, Repeat
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

function getProcessIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('compra') || n.includes('adquis')) return ShoppingCart;
  if (n.includes('venta') || n.includes('comercial') || n.includes('direcci')) return Target;
  if (n.includes('calidad') || n.includes('control')) return ClipboardCheck;
  if (n.includes('manten') || n.includes('equipo')) return Wrench;
  if (n.includes('despach') || n.includes('envío') || n.includes('logíst')) return Truck;
  if (n.includes('almac') || n.includes('invent') || n.includes('stock')) return Package;
  if (n.includes('desarroll') || n.includes('proyect') || n.includes('ingenier')) return GraduationCap;
  if (n.includes('producci') || n.includes('fabric')) return Factory;
  return Cog;
}

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
      const body: any = { ...drawer };
      // Strip UI-only / relation fields not accepted by Prisma create
      delete body.id;
      delete body.processIndicators;
      delete body.processDocuments;
      delete body.processRisks;
      // Convert empty strings to undefined for optional nullable fields
      if (body.departmentId === '' || body.departmentId === null) body.departmentId = undefined;
      if (body.code === '') body.code = undefined;
      if (body.description === '') body.description = undefined;
      if (body.owner === '') body.owner = undefined;
      if (body.inputs === '') body.inputs = undefined;
      if (body.outputs === '') body.outputs = undefined;
      if (body.indicators === '') body.indicators = undefined;
      if (body.documents === '') body.documents = undefined;
      if (body.risks === '') body.risks = undefined;
      if (editingPid) {
        await apiFetch(`/process-maps/${selected.id}/processes/${editingPid}`, { method: 'PATCH', json: body });
      } else {
        await apiFetch(`/process-maps/${selected.id}/processes`, { method: 'POST', json: body });
      }
      setDrawer(null);
      setEditingPid(null);
      setActiveTab('info');
      await load();
    } catch (e: any) { setError('Error guardando proceso: ' + (e?.message || '')); console.error(e); }
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
            {/* Header del mapa */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">{selected.name}</h3>
                  <span className="text-xs text-neutral-400">{selected.processes.length} procesos</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50">
                  <Eye className="h-3.5 w-3.5" /> Ver como diagrama
                </button>
                <button onClick={() => openNewProcess('OPERATIONAL')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                  <Plus className="h-3.5 w-3.5" /> Nuevo proceso
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-neutral-400" />
              <select value={filterLayer} onChange={e => setFilterLayer(e.target.value)} className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white">
                <option value="">Todas las capas</option>
                <option value="STRATEGIC">Estratégicos</option>
                <option value="OPERATIONAL">Operativos</option>
                <option value="SUPPORT">Soporte</option>
              </select>
              <select value={filterSite} onChange={e => setFilterSite(e.target.value)} className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white">
                <option value="">Todas las sedes</option>
                {allSites().map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white">
                <option value="">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
              {(filterLayer || filterSite || filterStatus) && (
                <button onClick={() => { setFilterLayer(''); setFilterSite(''); setFilterStatus(''); }} className="text-xs text-neutral-500 hover:text-neutral-700 underline">Limpiar</button>
              )}
            </div>

            {/* Layout: entrada → capas → salida */}
            <div className="flex gap-4 items-stretch">
              {/* Entrada */}
              <div className="flex flex-col items-center justify-center w-28 flex-shrink-0">
                <div className="bg-white border border-neutral-200 rounded-xl px-3 py-5 text-center h-full flex flex-col items-center justify-center shadow-sm w-full">
                  <CheckCircle className="h-5 w-5 text-neutral-400 mb-2" />
                  <p className="text-xs font-medium text-neutral-600 leading-tight">{selected.inputLabel || 'Requisitos del cliente / PI'}</p>
                  <div className="mt-2 text-[10px] text-neutral-400 text-left space-y-0.5">
                    <p>• Necesidades</p>
                    <p>• Expectativas</p>
                    <p>• Requisitos legales y normativas</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center flex-shrink-0">
                <ArrowRight className="h-5 w-5 text-neutral-300" />
              </div>

              {/* Las 3 capas */}
              <div className="flex-1 space-y-2">
                {(['STRATEGIC', 'OPERATIONAL', 'SUPPORT'] as const).map((layer, layerIdx) => {
                  const cfg = LAYER_CONFIG[layer];
                  const LayerIcon = cfg.icon;
                  let layerProcesses = selected.processes.filter(p => p.layer === layer);
                  if (filterLayer && filterLayer !== layer) return null;
                  if (filterSite) layerProcesses = layerProcesses.filter(p => p.sites?.includes(filterSite));
                  if (filterStatus) layerProcesses = layerProcesses.filter(p => p.status === filterStatus);
                  return (
                    <div key={layer}>
                      {/* Arrow between layers */}
                      {layerIdx > 0 && (
                        <div className="flex justify-center py-1">
                          <ArrowDown className="h-4 w-4 text-neutral-300" />
                        </div>
                      )}
                      <div className={`rounded-xl border-2 p-3 ${cfg.color}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <LayerIcon className={`h-4 w-4 ${cfg.iconColor}`} />
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                            <span className="text-xs text-neutral-400">{layerProcesses.length} {layerProcesses.length === 1 ? 'proceso' : 'procesos'}</span>
                          </div>
                          <button onClick={() => openNewProcess(layer)} className="p-1 rounded hover:bg-white/60 transition-colors text-neutral-400 hover:text-neutral-700">
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {layerProcesses.length === 0 && (
                            <p className="text-xs text-neutral-400 italic py-1 col-span-full">Sin procesos aún</p>
                          )}
                          {layerProcesses.map(p => {
                            const ProcessIcon = getProcessIcon(p.name);
                            return (
                              <div key={p.id} className={`group relative bg-white border rounded-xl px-4 py-3 shadow-sm cursor-pointer hover:shadow-md transition-all ${p.status === 'inactive' ? 'opacity-60 border-neutral-200' : 'border-neutral-200 hover:border-brand-300'}`} onClick={() => openView(p)}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className={`p-1.5 rounded-lg ${cfg.color.replace('border-', 'bg-').replace('bg-', 'bg-opacity-20 ')}`}>
                                      <ProcessIcon className={`h-4 w-4 ${cfg.iconColor}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-neutral-800 truncate">{p.name}</p>
                                      {p.sites && p.sites.length > 0 && (
                                        <p className="text-[11px] text-neutral-400 truncate">{p.sites[0]}{p.sites.length > 1 ? ` +${p.sites.length - 1}` : ''}</p>
                                      )}
                                    </div>
                                  </div>
                                  <button onClick={e => { e.stopPropagation(); }} className="p-1 rounded hover:bg-neutral-100 text-neutral-300 hover:text-neutral-500">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                {/* KPI y estado */}
                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                  {p.indicators && (
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                                      <BarChart3 className="h-3 w-3" />
                                      {p.indicators.split(',')[0].trim().substring(0, 20)}
                                    </span>
                                  )}
                                  {p.processIndicators && p.processIndicators.length > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                      <BarChart3 className="h-3 w-3" />KPI: {p.processIndicators.length}
                                    </span>
                                  )}
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                    {p.status === 'active' ? 'Activo' : 'Inactivo'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Salida */}
              <div className="flex flex-col items-center justify-center flex-shrink-0">
                <ArrowRight className="h-5 w-5 text-neutral-300" />
              </div>
              <div className="flex flex-col items-center justify-center w-28 flex-shrink-0">
                <div className="bg-white border border-neutral-200 rounded-xl px-3 py-5 text-center h-full flex flex-col items-center justify-center shadow-sm w-full">
                  <CheckCircle className="h-5 w-5 text-neutral-400 mb-2" />
                  <p className="text-xs font-medium text-neutral-600 leading-tight">{selected.outputLabel || 'Satisfacción del cliente / PI'}</p>
                  <div className="mt-2 text-[10px] text-neutral-400 text-left space-y-0.5">
                    <p>• Productos conformes</p>
                    <p>• Entrega a tiempo</p>
                    <p>• Mejora continua</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Mejora continua - feedback loop */}
            <div className="flex items-center justify-center py-2">
              <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-full px-4 py-2">
                <Repeat className="h-3.5 w-3.5" />
                <span className="font-medium">Mejora continua</span>
                <ArrowRight className="h-3 w-3 rotate-180" />
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

            {/* Tabs con conteos */}
            <div className="flex border-b">
              {TABS.map(t => {
                const TabIcon = t.icon;
                const count = t.key === 'indicators'
                  ? (drawer.processIndicators?.length || 0) + (drawer.indicators ? drawer.indicators.split(',').filter(Boolean).length : 0)
                  : t.key === 'documents'
                    ? (drawer.processDocuments?.length || 0) + (drawer.documents ? drawer.documents.split(',').filter(Boolean).length : 0)
                    : t.key === 'risks'
                      ? (drawer.processRisks?.length || 0) + (drawer.risks ? drawer.risks.split(',').filter(Boolean).length : 0)
                      : 0;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${activeTab === t.key ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'}`}
                  >
                    <TabIcon className="h-3.5 w-3.5" />
                    {t.label}{count > 0 && <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1 py-0 rounded-full ml-0.5">{count}</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 px-5 py-4 space-y-4">
              {drawerMode === 'view' ? (
                activeTab === 'info' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${LAYER_CONFIG[drawer.layer as Process['layer']]?.badge}`}>
                        {drawer.layer && (() => { const L = LAYER_CONFIG[drawer.layer as Process['layer']].icon; return <L className="h-3 w-3" />; })()}
                        {LAYER_CONFIG[drawer.layer as Process['layer']]?.label}
                      </span>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${drawer.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {drawer.status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-neutral-900">{drawer.name}</h2>

                    {/* Info rows */}
                    <div className="space-y-3">
                      {drawer.code && (
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-neutral-400 w-28 flex-shrink-0 pt-0.5">Código</span>
                          <span className="text-sm font-mono text-neutral-700">{drawer.code}</span>
                        </div>
                      )}
                      {drawer.owner && (
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-neutral-400 w-28 flex-shrink-0 pt-0.5">Responsable / Dueño</span>
                          <span className="text-sm text-neutral-700">{drawer.owner}</span>
                        </div>
                      )}
                      {drawer.sites && drawer.sites.length > 0 && (
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-neutral-400 w-28 flex-shrink-0 pt-0.5">Sede(s)</span>
                          <div className="flex flex-wrap gap-1">
                            {drawer.sites.map((s, i) => <span key={i} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded">{s}</span>)}
                          </div>
                        </div>
                      )}
                      {drawer.description && (
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-neutral-400 w-28 flex-shrink-0 pt-0.5">Descripción</span>
                          <span className="text-sm text-neutral-700">{drawer.description}</span>
                        </div>
                      )}
                      {drawer.inputs && (
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-neutral-400 w-28 flex-shrink-0 pt-0.5">Entradas</span>
                          <div className="text-sm text-neutral-700 whitespace-pre-line">{drawer.inputs}</div>
                        </div>
                      )}
                      {drawer.outputs && (
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-neutral-400 w-28 flex-shrink-0 pt-0.5">Salidas</span>
                          <div className="text-sm text-neutral-700 whitespace-pre-line">{drawer.outputs}</div>
                        </div>
                      )}
                    </div>

                    {/* Legacy fields */}
                    {drawer.indicators && (
                      <div className="pt-3 border-t border-neutral-100">
                        <p className="text-xs font-semibold text-neutral-500 mb-1.5">Indicadores vinculados</p>
                        <div className="space-y-1.5">
                          {drawer.indicators.split(',').map((ind, i) => ind.trim() && (
                            <div key={i} className="flex items-center gap-2 text-sm text-neutral-700">
                              <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
                              <span>{ind.trim()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {drawer.documents && (
                      <div className="pt-3 border-t border-neutral-100">
                        <p className="text-xs font-semibold text-neutral-500 mb-1.5">Documentos relacionados</p>
                        <div className="space-y-1.5">
                          {drawer.documents.split(',').map((doc, i) => doc.trim() && (
                            <div key={i} className="flex items-center gap-2 text-sm text-neutral-700">
                              <FileText className="h-3.5 w-3.5 text-green-500" />
                              <span>{doc.trim()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {drawer.risks && (
                      <div className="pt-3 border-t border-neutral-100">
                        <p className="text-xs font-semibold text-neutral-500 mb-1.5">Riesgos asociados</p>
                        <div className="space-y-1.5">
                          {drawer.risks.split(',').map((risk, i) => risk.trim() && (
                            <div key={i} className="flex items-center gap-2 text-sm text-neutral-700">
                              <Shield className="h-3.5 w-3.5 text-orange-500" />
                              <span>{risk.trim()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Auditorías / Hallazgos */}
                    <div className="pt-3 border-t border-neutral-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-red-500">Auditorías / Hallazgos</p>
                        <button className="text-[10px] text-brand-600 hover:underline">Ver todos</button>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-neutral-600">
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                        <span>0 hallazgos abiertos</span>
                      </div>
                    </div>
                  </>
                ) : activeTab === 'indicators' ? (
                  <>
                    <p className="text-xs text-neutral-500 mb-3">Indicadores vinculados al proceso</p>
                    {drawer.processIndicators && drawer.processIndicators.length > 0 ? (
                      <div className="space-y-2">
                        {drawer.processIndicators.map((rel) => (
                          <div key={rel.id} className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-blue-500" />
                              <span className="text-sm text-neutral-700">ID: {rel.indicatorId}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : drawer.indicators ? (
                      <div className="space-y-2">
                        {drawer.indicators.split(',').map((ind, i) => ind.trim() && (
                          <div key={i} className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-blue-500" />
                              <span className="text-sm text-neutral-700">{ind.trim()}</span>
                            </div>
                            <span className="text-[10px] bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded">Mensual</span>
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
                    <p className="text-xs text-neutral-500 mb-3">Documentos relacionados al proceso</p>
                    {drawer.processDocuments && drawer.processDocuments.length > 0 ? (
                      <div className="space-y-2">
                        {drawer.processDocuments.map((rel) => (
                          <div key={rel.id} className="flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-2.5">
                            <FileText className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-neutral-700">ID: {rel.documentId}</span>
                          </div>
                        ))}
                      </div>
                    ) : drawer.documents ? (
                      <div className="space-y-2">
                        {drawer.documents.split(',').map((doc, i) => doc.trim() && (
                          <div key={i} className="flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-2.5">
                            <FileText className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-neutral-700">{doc.trim()}</span>
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
                    <p className="text-xs text-neutral-500 mb-3">Riesgos asociados al proceso</p>
                    {drawer.processRisks && drawer.processRisks.length > 0 ? (
                      <div className="space-y-2">
                        {drawer.processRisks.map((rel) => (
                          <div key={rel.id} className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-orange-500" />
                              <span className="text-sm text-neutral-700">ID: {rel.riskId}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : drawer.risks ? (
                      <div className="space-y-2">
                        {drawer.risks.split(',').map((risk, i) => risk.trim() && (
                          <div key={i} className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-orange-500" />
                              <span className="text-sm text-neutral-700">{risk.trim()}</span>
                            </div>
                            <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">Medio</span>
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
