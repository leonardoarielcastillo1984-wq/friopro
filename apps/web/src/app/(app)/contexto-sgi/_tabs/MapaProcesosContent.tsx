'use client';
import { useEffect, useState } from 'react';
import { EmployeeCombobox } from '@/components/ui/EmployeeCombobox';
import { apiFetch } from '@/lib/api';
import MapaGeneralModal from './MapaGeneralModal';
import ProcessTemplateWizard from './ProcessTemplateWizard';
import ProcessAIWizard from './ProcessAIWizard';
import {
  Plus, Trash2, Pencil, X, ArrowRight, ArrowDown, CheckCircle, Building2,
  Layers, Cog, Users, Target, Loader2, BarChart3, FileText, Shield,
  MapPin, Filter, MoreVertical, Eye, Factory, Package, Truck, Wrench,
  ClipboardCheck, ShoppingCart, GraduationCap, AlertTriangle, Repeat, BrainCircuit,
  ChevronRight, ArrowLeft, Network, LayoutGrid, ListTree, Table2, Workflow,
  LogIn, LogOut, UserCircle2, Info, GripVertical, ClipboardList, ArrowLeftRight,
  Send, Inbox, Download, Upload, FileJson, FileDown
} from 'lucide-react';

interface Process {
  id: string;
  parentId?: string | null; // null = Macroproceso (Nivel 1); con valor = Subproceso (Nivel 2)
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
  // Enfoque por procesos (Jul 2026)
  objective?: string;
  observations?: string;
  clientsInternal?: string[];
  suppliersInternal?: string[];
  receivesFrom?: string[];
  deliversTo?: string[];
  activities?: { name: string; description?: string; responsible?: string }[];
  // UI-only: IDs seleccionados para sincronizar relaciones al guardar
  indicatorIds?: string[];
  documentIds?: string[];
  riskIds?: string[];
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

// Sección del panel dinámico del proceso (ítem 6): título con icono + lista de viñetas.
function PanelSection({ icon: Icon, color, title, items, emptyText }: { icon: any; color: string; title: string; items: string[]; emptyText?: string }) {
  return (
    <div>
      <p className={`text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5 ${color}`}>
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      {items.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {items.map((it, i) => (
            <li key={i} className="text-xs text-neutral-600 flex gap-1.5"><span className="text-neutral-300">•</span><span className="min-w-0">{it}</span></li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-xs text-neutral-400 italic">{emptyText || 'Sin datos'}</p>
      )}
    </div>
  );
}

// Lista editable de textos (Entradas / Salidas): agregar y quitar múltiples registros.
// Mantiene estado interno (seed inicial desde `items`) para que las filas vacías no se
// pierdan al serializar/deserializar el string del padre. Remonta por `key` al cambiar de subproceso.
function EditableList({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [rows, setRows] = useState<string[]>(items ?? []);
  const update = (n: string[]) => { setRows(n); onChange(n); };
  return (
    <div className="space-y-1.5">
      {rows.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={it}
            onChange={e => { const n = [...rows]; n[i] = e.target.value; update(n); }}
            placeholder={placeholder}
            className="flex-1 border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <button type="button" onClick={() => update(rows.filter((_, j) => j !== i))} className="p-1.5 text-neutral-400 hover:text-red-500"><X className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => update([...rows, ''])} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
        <Plus className="h-3.5 w-3.5" /> Agregar
      </button>
    </div>
  );
}

// Multi-select con buscador y chips de seleccionados.
function MultiSelectChips({ options, selectedIds, onChange, emptyText }: { options: { id: string; label: string }[]; selectedIds: string[]; onChange: (ids: string[]) => void; emptyText?: string }) {
  const [q, setQ] = useState('');
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  const filtered = options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedIds.map(id => { const o = options.find(x => x.id === id); return (
            <span key={id} className="inline-flex items-center gap-1 text-[11px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">
              {o?.label ?? id}
              <button type="button" onClick={() => toggle(id)}><X className="h-3 w-3" /></button>
            </span>
          ); })}
        </div>
      )}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar..." className="w-full border border-neutral-200 rounded-lg px-3 py-1.5 text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-brand-300" />
      <div className="max-h-40 overflow-y-auto border border-neutral-100 rounded-lg divide-y divide-neutral-50">
        {filtered.length === 0 && <p className="text-xs text-neutral-400 italic px-3 py-2">{emptyText || 'Sin opciones'}</p>}
        {filtered.map(o => (
          <label key={o.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-neutral-50">
            <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={() => toggle(o.id)} className="rounded border-neutral-300" />
            <span className="min-w-0 truncate">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// Editor de actividades: nombre, descripción y responsable por fila.
function ActivitiesEditor({ activities, onChange }: { activities: { name: string; description?: string; responsible?: string }[]; onChange: (a: { name: string; description?: string; responsible?: string }[]) => void }) {
  const update = (i: number, patch: any) => onChange(activities.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <div className="space-y-2">
      {activities.map((a, i) => (
        <div key={i} className="border border-neutral-200 rounded-lg p-3 space-y-2 bg-neutral-50">
          <div className="flex items-center gap-2">
            <input value={a.name} onChange={e => update(i, { name: e.target.value })} placeholder="Nombre de la actividad" className="flex-1 border border-neutral-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
            <button type="button" onClick={() => onChange(activities.filter((_, j) => j !== i))} className="p-1.5 text-neutral-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
          </div>
          <textarea value={a.description ?? ''} onChange={e => update(i, { description: e.target.value })} rows={2} placeholder="Descripción" className="w-full border border-neutral-200 rounded-lg px-3 py-1.5 text-sm bg-white resize-none" />
          <input value={a.responsible ?? ''} onChange={e => update(i, { responsible: e.target.value })} placeholder="Responsable" className="w-full border border-neutral-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...activities, { name: '', description: '', responsible: '' }])} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
        <Plus className="h-3.5 w-3.5" /> Agregar actividad
      </button>
    </div>
  );
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
  objective: '', observations: '',
  clientsInternal: [], suppliersInternal: [], receivesFrom: [], deliversTo: [],
  activities: [], indicatorIds: [], documentIds: [], riskIds: [],
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

  // Process menu (for delete/edit actions)
  const [openMenuPid, setOpenMenuPid] = useState<string | null>(null);

  // Drag & drop: arrastrar un mapa del sidebar hacia una capa
  const [draggingMapId, setDraggingMapId] = useState<string | null>(null);
  const [dragOverLayer, setDragOverLayer] = useState<Process['layer'] | null>(null);

  // Diagram view modal
  const [showDiagram, setShowDiagram] = useState(false);

  // General (company-wide) macro process map
  const [showGeneral, setShowGeneral] = useState(false);

  // Navegación de 2 niveles: null = Mapa de Macroprocesos; con id = Desglose (subprocesos) de ese macroproceso
  const [viewMacroId, setViewMacroId] = useState<string | null>(null);
  // Vista del desglose (ítem 8): cómo se representan los subprocesos (misma data, distinta visualización)
  const [breakdownView, setBreakdownView] = useState<'cards' | 'tree' | 'sipoc' | 'flow'>('cards');

  // Wizard: crear desde plantilla (norma → industria → procesos → resumen)
  const [showWizard, setShowWizard] = useState(false);

  // Wizard: implementación inteligente con IA
  const [showAIWizard, setShowAIWizard] = useState(false);

  // Import / Export de plantillas .sgi360.json
  const [showImport, setShowImport] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importTemplate, setImportTemplate] = useState<any>(null);
  const [importAnalysis, setImportAnalysis] = useState<{ map: { name: string; description: string }; summary: Record<string, number>; warnings: string[] } | null>(null);
  const [importMode, setImportMode] = useState<'new' | 'merge' | 'replace'>('new');
  const [importDuplicatePolicy, setImportDuplicatePolicy] = useState<'skip' | 'update' | 'duplicate'>('skip');
  const [importTargetMapId, setImportTargetMapId] = useState<string>('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Descargar plantilla base
  const [showBaseTemplates, setShowBaseTemplates] = useState(false);
  const [baseTemplates, setBaseTemplates] = useState<{ key: string; name: string; description: string; category: string; processCount: number }[]>([]);

  // Employees lookup for showing names instead of IDs
  const [employees, setEmployees] = useState<{ id: string; firstName: string; lastName: string; email: string }[]>([]);

  // Opciones para los multi-selects del subproceso (documentos / riesgos / indicadores)
  const [docOptions, setDocOptions] = useState<{ id: string; label: string }[]>([]);
  const [riskOptions, setRiskOptions] = useState<{ id: string; label: string }[]>([]);
  const [indicatorOptions, setIndicatorOptions] = useState<{ id: string; label: string }[]>([]);

  // Drag & drop para reordenar subprocesos dentro del desglose
  const [subDragId, setSubDragId] = useState<string | null>(null);
  const [subDragOverId, setSubDragOverId] = useState<string | null>(null);

  async function loadEmployees() {
    try {
      console.log('Loading employees...');
      const response = await apiFetch<any>('/hr/employees');
      console.log('Raw response:', response);
      // Handle multiple response formats: array, { employees: array }, { data: array }
      let data: any[] = [];
      if (Array.isArray(response)) {
        data = response;
      } else if (response?.employees && Array.isArray(response.employees)) {
        data = response.employees;
      } else if (response?.data && Array.isArray(response.data)) {
        data = response.data;
      }
      console.log('Employees parsed:', data?.length || 0, data);
      setEmployees(data);
    } catch (e: any) {
      console.error('Error loading employees:', e?.message || e);
    }
  }

  async function loadRelations() {
    const norm = (raw: any): any[] => Array.isArray(raw)
      ? raw
      : (raw?.data ?? raw?.items ?? raw?.documents ?? raw?.risks ?? raw?.indicators ?? raw?.indicadores ?? []);
    try {
      const [docs, risks, inds] = await Promise.all([
        apiFetch<any>('/documents').catch(() => []),
        apiFetch<any>('/risks').catch(() => []),
        apiFetch<any>('/indicators').catch(() => []),
      ]);
      setDocOptions(norm(docs).map((d: any) => ({ id: d.id, label: d.title || d.name || d.code || d.id })));
      setRiskOptions(norm(risks).map((r: any) => ({ id: r.id, label: r.title || r.name || r.code || r.id })));
      setIndicatorOptions(norm(inds).map((i: any) => ({ id: i.id, label: i.name || i.title || i.code || i.id })));
    } catch { /* opcional: los multi-selects quedan vacíos */ }
  }

  function getEmployeeName(id?: string) {
    if (!id) return '-';
    const emp = employees.find(e => e.id === id);
    if (!emp) return id.length > 8 ? id.substring(0, 8) + '...' : id;
    return `${emp.firstName} ${emp.lastName}`.trim() || emp.email || id;
  }

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

  // ── Import / Export de plantillas .sgi360.json ───────────────────
  function downloadJson(filename: string, data: any) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function exportMap() {
    if (!selected) return;
    try {
      const data = await apiFetch<any>(`/process-maps/${selected.id}/export`);
      const safe = (selected.name || 'mapa').replace(/[^a-zA-Z0-9-_]+/g, '_');
      downloadJson(`${safe}.sgi360.json`, data);
    } catch { setError('No se pudo exportar el mapa'); }
  }

  async function openBaseTemplates() {
    setShowBaseTemplates(true);
    if (baseTemplates.length === 0) {
      try { const r = await apiFetch<any>('/process-maps/base-templates'); setBaseTemplates(r.templates ?? []); } catch { /* vacío */ }
    }
  }

  async function downloadBaseTemplate(key: string) {
    try {
      const data = await apiFetch<any>(`/process-maps/base-templates/${key}`);
      downloadJson(`${key}.sgi360.json`, data);
    } catch { setError('No se pudo descargar la plantilla base'); }
  }

  function openImport() {
    setShowImport(true);
    setImportFileName(''); setImportTemplate(null); setImportAnalysis(null);
    setImportMode('new'); setImportDuplicatePolicy('skip');
    setImportTargetMapId(selected?.id ?? ''); setImportError('');
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name); setImportError(''); setImportAnalysis(null); setImportTemplate(null); setAnalyzing(true);
    try {
      const text = await file.text();
      let json: any;
      try { json = JSON.parse(text); } catch { throw new Error('El archivo no es un JSON válido.'); }
      const res = await apiFetch<any>('/process-maps/import/analyze', { method: 'POST', json: { template: json } });
      setImportTemplate(json);
      setImportAnalysis(res);
    } catch (err: any) {
      setImportError(err?.message || 'El archivo no es una plantilla .sgi360.json válida.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function doImport() {
    if (!importTemplate) return;
    if ((importMode === 'merge' || importMode === 'replace') && !importTargetMapId) { setImportError('Seleccioná el mapa destino.'); return; }
    setImporting(true); setImportError('');
    try {
      const res = await apiFetch<any>('/process-maps/import', {
        method: 'POST',
        json: { template: importTemplate, mode: importMode, targetMapId: importTargetMapId || undefined, duplicatePolicy: importDuplicatePolicy },
      });
      setShowImport(false);
      // Recargar y seleccionar el mapa importado.
      const raw = await apiFetch<ProcessMap[] | { data: ProcessMap[] }>('/process-maps');
      const data: ProcessMap[] = Array.isArray(raw) ? raw : (raw as any).data ?? [];
      setMaps(data);
      setViewMacroId(null);
      setSelected(data.find(m => m.id === res?.mapId) ?? data[0] ?? null);
    } catch (err: any) {
      setImportError(err?.message || 'Error al importar la plantilla.');
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => { load(); loadEmployees(); loadRelations(); }, []);

  // Close menu when clicking outside
  useEffect(() => {
    if (!openMenuPid) return;
    const handleClick = () => setOpenMenuPid(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [openMenuPid]);

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
      // Strip relation objects (se sincronizan vía *Ids) y campos no aceptados
      delete body.id;
      delete body.processIndicators;
      delete body.processDocuments;
      delete body.processRisks;
      delete body.createdAt;
      delete body.updatedAt;
      delete body.deletedAt;
      delete body.tenantId;
      delete body.processMapId;
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
      if (body.objective === '') body.objective = undefined;
      if (body.observations === '') body.observations = undefined;
      // Actividades: descartar filas sin nombre
      if (Array.isArray(body.activities)) body.activities = body.activities.filter((a: any) => a?.name && a.name.trim());
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
    // En modo desglose (viewMacroId != null) el nuevo proceso es un SUBPROCESO del macroproceso actual.
    setDrawer({ ...EMPTY_PROCESS, layer, parentId: viewMacroId ?? null });
    setEditingPid(null);
    setDrawerMode('edit');
    setActiveTab('info');
  }

  // Click en una tarjeta: en nivel macro navega al desglose; en desglose abre el detalle del subproceso.
  function handleCardClick(p: Process) {
    if (!viewMacroId) {
      setViewMacroId(p.id);
      setFilterLayer(''); setFilterSite(''); setFilterStatus('');
    } else {
      openView(p);
    }
  }

  // Soltar un mapa del sidebar dentro de una capa → crea un proceso en el mapa
  // seleccionado, en esa capa, con el nombre del mapa arrastrado (composición de mapas).
  async function handleDropMap(mapId: string, layer: Process['layer']) {
    setDragOverLayer(null);
    setDraggingMapId(null);
    // La composición de mapas solo aplica al nivel de macroprocesos (no dentro de un desglose).
    if (viewMacroId) return;
    if (!mapId || !selected) return;
    if (mapId === selected.id) {
      setError('No podés agregar el mismo mapa dentro de sí mismo');
      setTimeout(() => setError(''), 3000);
      return;
    }
    const sourceMap = maps.find(m => m.id === mapId);
    if (!sourceMap) return;
    // Evitar duplicar el mismo mapa en la misma capa
    const already = selected.processes.some(
      p => p.layer === layer && p.name.trim().toLowerCase() === sourceMap.name.trim().toLowerCase(),
    );
    if (already) {
      setError(`"${sourceMap.name}" ya está en esta capa`);
      setTimeout(() => setError(''), 3000);
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/process-maps/${selected.id}/processes`, {
        method: 'POST',
        json: {
          layer,
          name: sourceMap.name,
          status: 'active',
          description: sourceMap.description || `Mapa de procesos vinculado: ${sourceMap.name}`,
          sites: [],
        },
      });
      await load();
    } catch (e: any) {
      setError('Error agregando el mapa como proceso: ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  }

  // Prepara el formulario a partir de un proceso: asegura arrays y mapea relaciones a *Ids.
  function hydrateProcessForm(p: Process): Partial<Process> {
    return {
      ...p,
      clientsInternal: p.clientsInternal ?? [],
      suppliersInternal: p.suppliersInternal ?? [],
      receivesFrom: p.receivesFrom ?? [],
      deliversTo: p.deliversTo ?? [],
      activities: p.activities ?? [],
      indicatorIds: (p.processIndicators ?? []).map(r => r.indicatorId),
      documentIds: (p.processDocuments ?? []).map(r => r.documentId),
      riskIds: (p.processRisks ?? []).map(r => r.riskId),
    };
  }

  function openEdit(p: Process) {
    setDrawer(hydrateProcessForm(p));
    setEditingPid(p.id);
    setDrawerMode('edit');
    setActiveTab('info');
  }

  function openView(p: Process) {
    setDrawer(hydrateProcessForm(p));
    setEditingPid(p.id);
    setDrawerMode('view');
    setActiveTab('info');
  }

  // ── Reordenamiento de subprocesos (drag & drop) ────────────────
  async function reorderSubprocesses(orderedIds: string[]) {
    if (!selected) return;
    setSelected(prev => prev ? {
      ...prev,
      processes: prev.processes.map(p => {
        const idx = orderedIds.indexOf(p.id);
        return idx >= 0 ? { ...p, order: idx } : p;
      }),
    } : prev);
    try {
      await apiFetch(`/process-maps/${selected.id}/processes/reorder`, { method: 'PUT', json: { ids: orderedIds } });
    } catch { setError('Error reordenando subprocesos'); await load(); }
  }

  function handleSubDrop(targetId: string) {
    const dragId = subDragId;
    setSubDragId(null);
    setSubDragOverId(null);
    if (!dragId || dragId === targetId || !selected || !viewMacroId) return;
    const list = selected.processes
      .filter(p => p.parentId === viewMacroId)
      .sort((a, b) => a.order - b.order);
    const from = list.findIndex(p => p.id === dragId);
    const to = list.findIndex(p => p.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    reorderSubprocesses(list.map(p => p.id));
  }

  function allSites() {
    if (!selected) return [];
    const s = new Set<string>();
    selected.processes.forEach(p => p.sites?.forEach(site => s.add(site)));
    return Array.from(s);
  }

  if (loading) return <div className="flex items-center gap-2 py-10 text-neutral-400"><Loader2 className="h-5 w-5 animate-spin" />Cargando mapas...</div>;

  // Macroproceso actualmente en desglose (derivado del mapa seleccionado para evitar datos stale tras recargar).
  const viewMacro = viewMacroId ? (selected?.processes.find(p => p.id === viewMacroId) ?? null) : null;
  // Procesos a mostrar: en nivel macro solo los top-level (sin parentId); en desglose, los hijos del macroproceso.
  const displayProcesses = selected
    ? (viewMacro
        ? selected.processes.filter(p => p.parentId === viewMacro.id)
        : selected.processes.filter(p => !p.parentId))
    : [];
  const subCount = (macroId: string) => selected?.processes.filter(p => p.parentId === macroId).length ?? 0;

  // Helpers de conteo (relaciones reales + campos legacy separados por coma) y parseo a viñetas.
  const splitCount = (s?: string) => (s ? s.split(',').filter(x => x.trim()).length : 0);
  const docCount = (p: Process) => (p.processDocuments?.length ?? 0) + splitCount(p.documents);
  const riskCount = (p: Process) => (p.processRisks?.length ?? 0) + splitCount(p.risks);
  const kpiCount = (p: Process) => (p.processIndicators?.length ?? 0) + splitCount(p.indicators);
  const actCount = (p: Process) => p.activities?.length ?? 0;
  const mainIndicator = (p: Process) => (p.indicators || '').split(',').map(x => x.trim()).filter(Boolean)[0] ?? null;
  const toBullets = (s?: string) => (s || '').split(/[\n,;]+/).map(x => x.trim()).filter(Boolean);
  const processName = (id: string) => selected?.processes.find(p => p.id === id)?.name ?? id;
  const docLabel = (id: string) => docOptions.find(o => o.id === id)?.label ?? id;
  const riskLabel = (id: string) => riskOptions.find(o => o.id === id)?.label ?? id;
  const indicatorLabel = (id: string) => indicatorOptions.find(o => o.id === id)?.label ?? id;
  // Subprocesos visibles según filtros activos (para las vistas jerárquica / SIPOC / flujo).
  const filteredProcesses = displayProcesses.filter(p =>
    (!filterLayer || p.layer === filterLayer) &&
    (!filterSite || p.sites?.includes(filterSite)) &&
    (!filterStatus || p.status === filterStatus),
  );
  // Subprocesos del desglose ordenados por 'order' (secuencia del flujo).
  const orderedSubprocesses = [...filteredProcesses].sort((a, b) => a.order - b.order);
  // Opciones para multi-selects de procesos: clientes/proveedores internos (todos los procesos del mapa)
  // y otros subprocesos del mismo macroproceso (interacciones recibe/entrega).
  const processOptions = selected ? selected.processes.filter(p => p.id !== editingPid).map(p => ({ id: p.id, label: p.name })) : [];
  const siblingOptions = (viewMacro && selected) ? selected.processes.filter(p => p.parentId === viewMacro.id && p.id !== editingPid).map(p => ({ id: p.id, label: p.name })) : [];

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
        {maps.length > 0 && (
          <p className="text-[11px] text-neutral-400 leading-tight mb-2 flex items-center gap-1">
            <ArrowRight className="h-3 w-3 flex-shrink-0" />
            Arrastrá un mapa a una capa para agregarlo como proceso
          </p>
        )}

        {maps.length === 0 && (
          <button onClick={() => setShowMapForm(true)} className="w-full text-left px-3 py-3 rounded-lg border-2 border-dashed border-neutral-200 text-sm text-neutral-400 hover:border-brand-300 hover:text-brand-600 transition-colors">
            + Crear primer mapa
          </button>
        )}

        {maps.map(m => (
          <div
            key={m.id}
            draggable
            onDragStart={e => { setDraggingMapId(m.id); e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', m.id); }}
            onDragEnd={() => { setDraggingMapId(null); setDragOverLayer(null); }}
            onClick={() => { setSelected(m); setViewMacroId(null); }}
            title="Arrastrá este mapa dentro de una capa (Estratégicos / Operativos / Soporte)"
            className={`group relative px-3 py-2.5 rounded-lg cursor-grab active:cursor-grabbing border transition-all ${draggingMapId === m.id ? 'opacity-50 ring-2 ring-brand-300' : ''} ${selected?.id === m.id ? 'bg-brand-50 border-brand-200 text-brand-700' : 'border-transparent hover:bg-neutral-50 text-neutral-700'}`}>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium truncate">{m.name}</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 truncate pl-6">{m.processes.filter(p => !p.parentId).length} macroprocesos</p>
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
            {/* Breadcrumb de navegación (2 niveles: Mapa General → Mapa → Desglose) */}
            <nav className="flex items-center gap-1.5 text-xs text-neutral-500 flex-wrap">
              <button onClick={() => setShowGeneral(true)} className="hover:text-brand-600 font-medium">Mapa General</button>
              <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
              <button onClick={() => setViewMacroId(null)} className={`hover:text-brand-600 ${!viewMacro ? 'font-semibold text-neutral-700' : 'font-medium'}`}>{selected.name}</button>
              {viewMacro && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
                  <span className="font-semibold text-neutral-700">{viewMacro.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
                  <span className="text-neutral-400">Desglose del proceso</span>
                </>
              )}
            </nav>

            {/* Header del mapa */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {viewMacro && (
                  <button onClick={() => setViewMacroId(null)} title="Volver al mapa de procesos" className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50">
                    <ArrowLeft className="h-4 w-4 text-neutral-500" />
                  </button>
                )}
                <div>
                  {viewMacro ? (
                    <>
                      <h3 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                        <Network className="h-4 w-4 text-brand-500" /> Desglose del proceso — {viewMacro.name}
                      </h3>
                      <span className="text-xs text-neutral-400">{displayProcesses.length} {displayProcesses.length === 1 ? 'subproceso' : 'subprocesos'}</span>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-semibold text-neutral-900">{selected.name}</h3>
                      <span className="text-xs text-neutral-400">{displayProcesses.length} {displayProcesses.length === 1 ? 'macroproceso' : 'macroprocesos'}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!viewMacro && (
                  <>
                    <button onClick={() => setShowGeneral(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100">
                      <Layers className="h-3.5 w-3.5" /> Mapa General
                    </button>
                    <button onClick={() => setShowDiagram(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50">
                      <Eye className="h-3.5 w-3.5" /> Ver como diagrama
                    </button>
                    <button onClick={exportMap} disabled={!selected} title="Exportar este mapa como plantilla .sgi360.json" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40">
                      <Download className="h-3.5 w-3.5" /> Exportar
                    </button>
                    <button onClick={openImport} title="Importar una plantilla .sgi360.json" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50">
                      <Upload className="h-3.5 w-3.5" /> Importar
                    </button>
                    <button onClick={openBaseTemplates} title="Descargar una plantilla base predefinida" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50">
                      <FileDown className="h-3.5 w-3.5" /> Plantilla base
                    </button>
                    <button onClick={() => setShowWizard(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-brand-600 to-indigo-600 rounded-lg hover:from-brand-700 hover:to-indigo-700">
                      <Layers className="h-3.5 w-3.5" /> Crear desde plantilla
                    </button>
                    <button onClick={() => setShowAIWizard(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:from-purple-700 hover:to-indigo-700">
                      <BrainCircuit className="h-3.5 w-3.5" /> Implementación con IA
                    </button>
                  </>
                )}
                <button onClick={() => openNewProcess('OPERATIONAL')} title={viewMacro ? 'Cree un nuevo subproceso perteneciente a este Macroproceso.' : 'Cree un nuevo macroproceso de la organización.'} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                  <Plus className="h-3.5 w-3.5" /> {viewMacro ? 'Nuevo subproceso' : 'Nuevo proceso'}
                </button>
              </div>
            </div>

            {/* Ítem 4 + 5 + 8: contexto, resumen y selector de vista (solo en desglose) */}
            {viewMacro && (
              <div className="space-y-3">
                <p className="text-sm text-neutral-500 flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 text-brand-400 flex-shrink-0" />
                  <span>Los subprocesos representan las actividades principales que componen este macroproceso. Desde aquí podés documentar cómo funciona el proceso y su interacción con el resto del Sistema de Gestión.</span>
                </p>

                {/* Tarjeta resumen del macroproceso */}
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${LAYER_CONFIG[viewMacro.layer].badge}`}>
                        {(() => { const L = LAYER_CONFIG[viewMacro.layer].icon; return <L className="h-3 w-3" />; })()}
                        {LAYER_CONFIG[viewMacro.layer].label}
                      </span>
                      <h4 className="text-base font-semibold text-neutral-900 mt-1">Macroproceso: {viewMacro.name}</h4>
                    </div>
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${viewMacro.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                      {viewMacro.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-neutral-400 font-medium flex items-center gap-1"><UserCircle2 className="h-3.5 w-3.5" /> Responsable</p>
                      <p className="text-sm text-neutral-700 mt-0.5">{getEmployeeName(viewMacro.owner) || 'Sin asignar'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-neutral-400 font-medium flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Objetivo</p>
                      <p className="text-sm text-neutral-700 mt-0.5">{viewMacro.description || 'Sin objetivo definido'}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[11px] uppercase tracking-wide text-neutral-400 font-medium flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" /> Indicador principal</p>
                      <p className="text-sm text-neutral-700 mt-0.5">{mainIndicator(viewMacro) || 'Sin indicador principal'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                    {[
                      { label: 'Subprocesos', value: subCount(viewMacro.id), icon: Network, color: 'text-brand-600 bg-brand-50' },
                      { label: 'Documentos', value: docCount(viewMacro), icon: FileText, color: 'text-green-600 bg-green-50' },
                      { label: 'Riesgos', value: riskCount(viewMacro), icon: Shield, color: 'text-orange-600 bg-orange-50' },
                      { label: 'KPIs', value: kpiCount(viewMacro), icon: BarChart3, color: 'text-blue-600 bg-blue-50' },
                    ].map(m => { const MI = m.icon; return (
                      <div key={m.label} className={`rounded-xl p-3 flex items-center gap-2.5 ${m.color}`}>
                        <MI className="h-5 w-5 flex-shrink-0" />
                        <div className="leading-tight">
                          <p className="text-lg font-bold">{m.value}</p>
                          <p className="text-[11px] font-medium opacity-80">{m.label}</p>
                        </div>
                      </div>
                    ); })}
                  </div>
                </div>

                {/* Selector de vista del desglose */}
                <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
                  {([
                    { key: 'cards', label: 'Tarjetas', icon: LayoutGrid },
                    { key: 'tree', label: 'Jerárquica', icon: ListTree },
                    { key: 'sipoc', label: 'SIPOC', icon: Table2 },
                    { key: 'flow', label: 'Flujo', icon: Workflow },
                  ] as const).map(v => { const VI = v.icon; return (
                    <button key={v.key} onClick={() => setBreakdownView(v.key)}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${breakdownView === v.key ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
                      <VI className="h-3.5 w-3.5" /> {v.label}
                    </button>
                  ); })}
                </div>
              </div>
            )}

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
              {viewMacro ? (
                /* Ítem 6: panel dinámico con el resumen del proceso */
                <div className="w-64 flex-shrink-0">
                  <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm space-y-4">
                    <PanelSection icon={LogIn} color="text-blue-600" title="Entradas"
                      items={toBullets(viewMacro.inputs).length ? toBullets(viewMacro.inputs) : ['Necesidades del cliente', 'Requisitos legales', 'Solicitudes internas']} />
                    <div className="border-t border-neutral-100" />
                    <PanelSection icon={LogOut} color="text-green-600" title="Salidas"
                      items={toBullets(viewMacro.outputs).length ? toBullets(viewMacro.outputs) : ['Productos/servicios conformes', 'Indicadores', 'Registros']} />
                    <div className="border-t border-neutral-100" />
                    <PanelSection icon={Users} color="text-purple-600" title="Clientes internos" items={[]} emptyText="Sin definir aún" />
                    <div className="border-t border-neutral-100" />
                    <PanelSection icon={Truck} color="text-orange-600" title="Proveedores internos" items={[]} emptyText="Sin definir aún" />
                  </div>
                </div>
              ) : (
                <>
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
                </>
              )}

              {/* Nivel macro: las 3 capas. Desglose: contenedor único "Subprocesos" (secuencia) o vista alternativa. */}
              <div className="flex-1 space-y-2">
                {!viewMacro ? (['STRATEGIC', 'OPERATIONAL', 'SUPPORT'] as const).map((layer, layerIdx) => {
                  const cfg = LAYER_CONFIG[layer];
                  const LayerIcon = cfg.icon;
                  let layerProcesses = displayProcesses.filter(p => p.layer === layer);
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
                      <div
                        onDragOver={e => { if (draggingMapId) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOverLayer(layer); } }}
                        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverLayer(null); }}
                        onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || draggingMapId || ''; handleDropMap(id, layer); }}
                        className={`rounded-xl border-2 p-3 transition-all ${cfg.color} ${dragOverLayer === layer ? 'ring-2 ring-offset-2 ring-brand-400 border-dashed scale-[1.01]' : ''}`}>
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
                            <p className="text-xs text-neutral-400 italic py-1 col-span-full">{viewMacro ? 'Sin subprocesos aún' : 'Sin procesos aún'}</p>
                          )}
                          {layerProcesses.map(p => {
                            const ProcessIcon = getProcessIcon(p.name);
                            return (
                              <div key={p.id} title={viewMacro ? 'Ver detalle del subproceso' : 'Ver desglose (subprocesos) de este macroproceso'} className={`group relative bg-white border rounded-xl px-4 py-3 shadow-sm cursor-pointer hover:shadow-md transition-all ${p.status === 'inactive' ? 'opacity-60 border-neutral-200' : 'border-neutral-200 hover:border-brand-300'}`} onClick={() => handleCardClick(p)}>
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
                                  <div className="relative">
                                    <button 
                                      onClick={e => { e.stopPropagation(); setOpenMenuPid(openMenuPid === p.id ? null : p.id); }} 
                                      className="p-1 rounded hover:bg-neutral-100 text-neutral-300 hover:text-neutral-500"
                                    >
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </button>
                                    {openMenuPid === p.id && (
                                      <div className="absolute right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-20 min-w-[120px] py-1">
                                        <button 
                                          onClick={e => { e.stopPropagation(); setOpenMenuPid(null); openEdit(p); }} 
                                          className="w-full text-left px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                                        >
                                          <Pencil className="h-3 w-3" /> Editar
                                        </button>
                                        <button 
                                          onClick={e => { e.stopPropagation(); setOpenMenuPid(null); deleteProcess(p.id); }} 
                                          className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                          <Trash2 className="h-3 w-3" /> Eliminar
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {/* Indicador principal + estado */}
                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                  {mainIndicator(p) && (
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                                      <BarChart3 className="h-3 w-3" />
                                      {mainIndicator(p)!.substring(0, 20)}
                                    </span>
                                  )}
                                  {viewMacro && kpiCount(p) > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                      <BarChart3 className="h-3 w-3" />KPI: {kpiCount(p)}
                                    </span>
                                  )}
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                    {p.status === 'active' ? 'Activo' : 'Inactivo'}
                                  </span>
                                </div>
                                {/* Ítem 7 + 9: resumen de conteos + acceso claro a subprocesos (solo macroprocesos) */}
                                {!viewMacro && (
                                  <>
                                    <div className="grid grid-cols-4 gap-1 mt-2.5 text-center">
                                      {[
                                        { label: 'Subproc.', value: subCount(p.id), cls: 'text-brand-700 bg-brand-50' },
                                        { label: 'Docs', value: docCount(p), cls: 'text-green-700 bg-green-50' },
                                        { label: 'Riesgos', value: riskCount(p), cls: 'text-orange-700 bg-orange-50' },
                                        { label: 'KPIs', value: kpiCount(p), cls: 'text-blue-700 bg-blue-50' },
                                      ].map(s => (
                                        <div key={s.label} className={`rounded-lg py-1 ${s.cls}`}>
                                          <p className="text-sm font-bold leading-none">{s.value}</p>
                                          <p className="text-[9px] font-medium opacity-80 mt-0.5">{s.label}</p>
                                        </div>
                                      ))}
                                    </div>
                                    <button
                                      onClick={e => { e.stopPropagation(); handleCardClick(p); }}
                                      className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-100 rounded-lg py-2 transition-colors"
                                    >
                                      Ver subprocesos ({subCount(p.id)}) <ArrowRight className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }) : breakdownView === 'cards' ? (
                  /* Contenedor único: Subprocesos en secuencia (flujo) con drag & drop */
                  <div className="rounded-xl border-2 border-neutral-200 bg-neutral-50/60 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Workflow className="h-4 w-4 text-brand-500" />
                      <span className="text-sm font-semibold text-neutral-700">Subprocesos</span>
                      <span className="text-xs text-neutral-400">{orderedSubprocesses.length}</span>
                      {orderedSubprocesses.length > 1 && (
                        <span className="ml-auto text-[11px] text-neutral-400 flex items-center gap-1"><GripVertical className="h-3.5 w-3.5" /> Arrastrá para reordenar</span>
                      )}
                    </div>
                    {orderedSubprocesses.length === 0 ? (
                      <div className="text-center py-8 text-neutral-400">
                        <Workflow className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Aún no hay subprocesos. Usá &quot;Nuevo subproceso&quot; para agregar el primero.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        {orderedSubprocesses.map((p, i) => { const PI = getProcessIcon(p.name); return (
                          <div key={p.id} className="w-full max-w-xl">
                            <div
                              draggable
                              onDragStart={() => setSubDragId(p.id)}
                              onDragOver={e => { e.preventDefault(); setSubDragOverId(p.id); }}
                              onDragLeave={() => setSubDragOverId(prev => (prev === p.id ? null : prev))}
                              onDrop={() => handleSubDrop(p.id)}
                              onDragEnd={() => { setSubDragId(null); setSubDragOverId(null); }}
                              className={`bg-white border rounded-xl p-3 shadow-sm transition-all ${subDragOverId === p.id ? 'border-brand-400 ring-2 ring-brand-200' : 'border-neutral-200'} ${subDragId === p.id ? 'opacity-50' : ''}`}
                            >
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-neutral-300 cursor-grab flex-shrink-0" />
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-brand-50 text-brand-600 text-[11px] font-bold flex-shrink-0">{i + 1}</span>
                                <div className="p-1.5 rounded-lg bg-neutral-100 flex-shrink-0"><PI className="h-4 w-4 text-neutral-500" /></div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-neutral-800 truncate">{p.name}</p>
                                  <p className="text-[11px] text-neutral-400 truncate">{getEmployeeName(p.owner)}</p>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>{p.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-2 pl-8 flex-wrap">
                                <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1"><FileText className="h-3 w-3" />{docCount(p)}</span>
                                <span className="text-[10px] text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full flex items-center gap-1"><Shield className="h-3 w-3" />{riskCount(p)}</span>
                                <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1"><BarChart3 className="h-3 w-3" />{kpiCount(p)}</span>
                                <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full flex items-center gap-1"><ClipboardList className="h-3 w-3" />{actCount(p)}</span>
                                <button onClick={() => openView(p)} className="ml-auto flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                                  <Eye className="h-3.5 w-3.5" /> Ver detalle
                                </button>
                              </div>
                            </div>
                            {i < orderedSubprocesses.length - 1 && (
                              <div className="flex justify-center py-1"><ArrowDown className="h-4 w-4 text-neutral-300" /></div>
                            )}
                          </div>
                        ); })}
                      </div>
                    )}
                  </div>
                ) : breakdownView === 'tree' ? (
                  /* Vista Jerárquica: lista secuencial (sin clasificación por capas) */
                  <div className="rounded-xl border border-neutral-200 p-2">
                    {orderedSubprocesses.length === 0 && <p className="text-sm text-neutral-400 italic py-6 text-center">Sin subprocesos para mostrar</p>}
                    <ul className="border-l-2 border-neutral-200 ml-2 pl-3 space-y-1">
                      {orderedSubprocesses.map((p, i) => { const PI = getProcessIcon(p.name); return (
                        <li key={p.id} onClick={() => openView(p)} className="group flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-neutral-50 cursor-pointer">
                          <span className="flex items-center justify-center h-5 w-5 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold flex-shrink-0">{i + 1}</span>
                          <PI className="h-4 w-4 text-neutral-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-neutral-800 flex-1 min-w-0 truncate">{p.name}</span>
                          <span className="text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full hidden sm:inline">Docs {docCount(p)}</span>
                          <span className="text-[10px] text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-full hidden sm:inline">Riesgos {riskCount(p)}</span>
                          <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full hidden sm:inline">KPI {kpiCount(p)}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>{p.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                          <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-neutral-500" />
                        </li>
                      ); })}
                    </ul>
                  </div>
                ) : breakdownView === 'sipoc' ? (
                  /* Vista SIPOC */
                  <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50 text-neutral-500">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold">Proveedores</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">Entradas</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">Subproceso</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">Salidas</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">Clientes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {filteredProcesses.length === 0 && (
                          <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400 italic">Sin subprocesos para mostrar</td></tr>
                        )}
                        {orderedSubprocesses.map(p => (
                          <tr key={p.id} onClick={() => openView(p)} className="hover:bg-neutral-50 cursor-pointer align-top">
                            <td className="px-3 py-2 text-xs text-neutral-600">{p.suppliersInternal?.length ? <ul className="space-y-0.5">{p.suppliersInternal.map((id, i) => <li key={i}>• {processName(id)}</li>)}</ul> : <span className="text-neutral-400 italic">—</span>}</td>
                            <td className="px-3 py-2 text-xs text-neutral-600">{toBullets(p.inputs).length ? <ul className="space-y-0.5">{toBullets(p.inputs).map((x, i) => <li key={i}>• {x}</li>)}</ul> : <span className="text-neutral-400 italic">—</span>}</td>
                            <td className="px-3 py-2"><span className="text-sm font-medium text-neutral-800">{p.name}</span></td>
                            <td className="px-3 py-2 text-xs text-neutral-600">{toBullets(p.outputs).length ? <ul className="space-y-0.5">{toBullets(p.outputs).map((x, i) => <li key={i}>• {x}</li>)}</ul> : <span className="text-neutral-400 italic">—</span>}</td>
                            <td className="px-3 py-2 text-xs text-neutral-600">{p.clientsInternal?.length ? <ul className="space-y-0.5">{p.clientsInternal.map((id, i) => <li key={i}>• {processName(id)}</li>)}</ul> : <span className="text-neutral-400 italic">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Vista Flujo: diagrama automático a partir del orden y las interacciones (recibe/entrega). */
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5">
                    {orderedSubprocesses.length === 0 ? (
                      <p className="text-sm text-neutral-400 italic text-center py-4">Sin subprocesos para mostrar</p>
                    ) : (
                      <div className="flex flex-wrap items-stretch gap-2">
                        {orderedSubprocesses.map((p, i, arr) => { const PI = getProcessIcon(p.name); return (
                          <div key={p.id} className="flex items-center gap-2">
                            <div onClick={() => openView(p)} className="bg-white border border-neutral-200 rounded-xl px-3 py-2.5 shadow-sm cursor-pointer hover:border-brand-300 hover:shadow-md transition-all min-w-[150px] max-w-[190px]">
                              <div className="flex items-center gap-1.5"><span className="flex items-center justify-center h-5 w-5 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold flex-shrink-0">{i + 1}</span><PI className="h-4 w-4 text-neutral-500 flex-shrink-0" /><span className="text-xs font-semibold text-neutral-800 truncate">{p.name}</span></div>
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>{p.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                              </div>
                              {(p.receivesFrom?.length || p.deliversTo?.length) ? (
                                <div className="mt-1.5 space-y-0.5">
                                  {p.receivesFrom?.length ? <p className="text-[9px] text-neutral-500 flex items-start gap-1"><Inbox className="h-2.5 w-2.5 mt-0.5 flex-shrink-0" /><span className="min-w-0">{p.receivesFrom.map(processName).join(', ')}</span></p> : null}
                                  {p.deliversTo?.length ? <p className="text-[9px] text-neutral-500 flex items-start gap-1"><Send className="h-2.5 w-2.5 mt-0.5 flex-shrink-0" /><span className="min-w-0">{p.deliversTo.map(processName).join(', ')}</span></p> : null}
                                </div>
                              ) : null}
                            </div>
                            {i < arr.length - 1 && <ArrowRight className="h-5 w-5 text-neutral-300 flex-shrink-0 self-center" />}
                          </div>
                        ); })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Salida (solo en el mapa de macroprocesos) */}
              {!viewMacro && (
                <>
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
                </>
              )}
            </div>

            {/* Mejora continua - feedback loop (solo en el mapa de macroprocesos) */}
            {!viewMacro && (
              <div className="flex items-center justify-center py-2">
                <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-full px-4 py-2">
                  <Repeat className="h-3.5 w-3.5" />
                  <span className="font-medium">Mejora continua</span>
                  <ArrowRight className="h-3 w-3 rotate-180" />
                </div>
              </div>
            )}
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

            {/* Tabs con conteos (solo en modo vista; en edición se muestra el formulario completo) */}
            {drawerMode === 'view' && (
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
            )}

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

                    {drawer.objective && (
                      <div className="rounded-lg bg-brand-50/60 border border-brand-100 px-3 py-2">
                        <p className="text-[11px] font-semibold text-brand-600 uppercase tracking-wide flex items-center gap-1 mb-0.5"><Target className="h-3 w-3" /> Objetivo</p>
                        <p className="text-sm text-neutral-700">{drawer.objective}</p>
                      </div>
                    )}

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
                          <span className="text-sm text-neutral-700">{getEmployeeName(drawer.owner)}</span>
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

                    {/* Clientes / Proveedores internos */}
                    {(drawer.clientsInternal?.length || drawer.suppliersInternal?.length) ? (
                      <div className="pt-3 border-t border-neutral-100 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-purple-600 mb-1.5 flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Clientes internos</p>
                          {drawer.clientsInternal?.length
                            ? <ul className="space-y-0.5 text-sm text-neutral-700">{drawer.clientsInternal.map((id, i) => <li key={i}>• {processName(id)}</li>)}</ul>
                            : <span className="text-xs text-neutral-400 italic">—</span>}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-orange-600 mb-1.5 flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Proveedores internos</p>
                          {drawer.suppliersInternal?.length
                            ? <ul className="space-y-0.5 text-sm text-neutral-700">{drawer.suppliersInternal.map((id, i) => <li key={i}>• {processName(id)}</li>)}</ul>
                            : <span className="text-xs text-neutral-400 italic">—</span>}
                        </div>
                      </div>
                    ) : null}

                    {/* Interacciones: recibe / entrega */}
                    {(drawer.receivesFrom?.length || drawer.deliversTo?.length) ? (
                      <div className="pt-3 border-t border-neutral-100 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-neutral-600 mb-1.5 flex items-center gap-1"><Inbox className="h-3.5 w-3.5" /> Recibe información de</p>
                          {drawer.receivesFrom?.length
                            ? <ul className="space-y-0.5 text-sm text-neutral-700">{drawer.receivesFrom.map((id, i) => <li key={i}>• {processName(id)}</li>)}</ul>
                            : <span className="text-xs text-neutral-400 italic">—</span>}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-neutral-600 mb-1.5 flex items-center gap-1"><Send className="h-3.5 w-3.5" /> Entrega información a</p>
                          {drawer.deliversTo?.length
                            ? <ul className="space-y-0.5 text-sm text-neutral-700">{drawer.deliversTo.map((id, i) => <li key={i}>• {processName(id)}</li>)}</ul>
                            : <span className="text-xs text-neutral-400 italic">—</span>}
                        </div>
                      </div>
                    ) : null}

                    {/* Actividades */}
                    {drawer.activities && drawer.activities.length > 0 && (
                      <div className="pt-3 border-t border-neutral-100">
                        <p className="text-xs font-semibold text-neutral-500 mb-1.5 flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" /> Actividades</p>
                        <div className="space-y-1.5">
                          {drawer.activities.map((a, i) => (
                            <div key={i} className="rounded-lg bg-neutral-50 px-3 py-2">
                              <p className="text-sm font-medium text-neutral-800">{a.name}</p>
                              {a.description && <p className="text-xs text-neutral-500 mt-0.5">{a.description}</p>}
                              {a.responsible && <p className="text-[11px] text-neutral-400 mt-0.5">Responsable: {getEmployeeName(a.responsible)}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Relaciones reales (indicadores / documentos / riesgos asociados) */}
                    {drawer.processIndicators && drawer.processIndicators.length > 0 && (
                      <div className="pt-3 border-t border-neutral-100">
                        <p className="text-xs font-semibold text-neutral-500 mb-1.5">Indicadores asociados</p>
                        <div className="space-y-1.5">
                          {drawer.processIndicators.map(rel => (
                            <div key={rel.id} className="flex items-center gap-2 text-sm text-neutral-700"><BarChart3 className="h-3.5 w-3.5 text-blue-500" /><span>{indicatorLabel(rel.indicatorId)}</span></div>
                          ))}
                        </div>
                      </div>
                    )}
                    {drawer.processDocuments && drawer.processDocuments.length > 0 && (
                      <div className="pt-3 border-t border-neutral-100">
                        <p className="text-xs font-semibold text-neutral-500 mb-1.5">Documentos asociados</p>
                        <div className="space-y-1.5">
                          {drawer.processDocuments.map(rel => (
                            <div key={rel.id} className="flex items-center gap-2 text-sm text-neutral-700"><FileText className="h-3.5 w-3.5 text-green-500" /><span>{docLabel(rel.documentId)}</span></div>
                          ))}
                        </div>
                      </div>
                    )}
                    {drawer.processRisks && drawer.processRisks.length > 0 && (
                      <div className="pt-3 border-t border-neutral-100">
                        <p className="text-xs font-semibold text-neutral-500 mb-1.5">Riesgos asociados</p>
                        <div className="space-y-1.5">
                          {drawer.processRisks.map(rel => (
                            <div key={rel.id} className="flex items-center gap-2 text-sm text-neutral-700"><Shield className="h-3.5 w-3.5 text-orange-500" /><span>{riskLabel(rel.riskId)}</span></div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Observaciones */}
                    {drawer.observations && (
                      <div className="pt-3 border-t border-neutral-100">
                        <p className="text-xs font-semibold text-neutral-500 mb-1.5 flex items-center gap-1"><Info className="h-3.5 w-3.5" /> Observaciones</p>
                        <p className="text-sm text-neutral-700 whitespace-pre-line">{drawer.observations}</p>
                      </div>
                    )}

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
                              <span className="text-sm text-neutral-700">{indicatorLabel(rel.indicatorId)}</span>
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
                            <span className="text-sm text-neutral-700">{docLabel(rel.documentId)}</span>
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
                              <span className="text-sm text-neutral-700">{riskLabel(rel.riskId)}</span>
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
                /* Edit mode: formulario completo del subproceso */
                <>
                  {/* ── Información General ── */}
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Información General</p>
                  {!drawer.parentId && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Capa</label>
                      <select value={drawer.layer} onChange={e => setDrawer(p => ({ ...p, layer: e.target.value as any }))} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm">
                        <option value="STRATEGIC">Estratégico</option>
                        <option value="OPERATIONAL">Operativo</option>
                        <option value="SUPPORT">Soporte</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre *</label>
                    <input value={drawer.name ?? ''} onChange={e => setDrawer(p => ({ ...p, name: e.target.value }))} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Código (opcional)</label>
                    <input value={drawer.code ?? ''} onChange={e => setDrawer(p => ({ ...p, code: e.target.value }))} placeholder="Ej: OP-01" className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Objetivo</label>
                    <textarea value={drawer.objective ?? ''} onChange={e => setDrawer(p => ({ ...p, objective: e.target.value }))} rows={2} placeholder="¿Para qué existe este proceso?" className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Descripción</label>
                    <textarea value={drawer.description ?? ''} onChange={e => setDrawer(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Responsable</label>
                    <EmployeeCombobox value={drawer.owner ?? ''} onChange={id => setDrawer(p => ({ ...p, owner: id }))} placeholder="Buscar responsable..." allowFreeText />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Estado</label>
                    <select value={drawer.status ?? 'active'} onChange={e => setDrawer(p => ({ ...p, status: e.target.value as any }))} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm">
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </div>

                  {/* ── Entradas / Salidas ── */}
                  <div className="pt-3 border-t border-neutral-100">
                    <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><LogIn className="h-3.5 w-3.5" /> Entradas</label>
                    <EditableList key={`inputs-${editingPid ?? 'new'}`} items={drawer.inputs ? drawer.inputs.split('\n') : []} onChange={v => setDrawer(p => ({ ...p, inputs: v.join('\n') }))} placeholder="Ej: Indicadores, Reclamos, Auditorías" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-green-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><LogOut className="h-3.5 w-3.5" /> Salidas</label>
                    <EditableList key={`outputs-${editingPid ?? 'new'}`} items={drawer.outputs ? drawer.outputs.split('\n') : []} onChange={v => setDrawer(p => ({ ...p, outputs: v.join('\n') }))} placeholder="Ej: Informe, Acción correctiva" />
                  </div>

                  {/* ── Clientes / Proveedores internos ── */}
                  <div className="pt-3 border-t border-neutral-100">
                    <label className="block text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Clientes internos</label>
                    <MultiSelectChips options={processOptions} selectedIds={drawer.clientsInternal ?? []} onChange={ids => setDrawer(p => ({ ...p, clientsInternal: ids }))} emptyText="No hay otros procesos" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Proveedores internos</label>
                    <MultiSelectChips options={processOptions} selectedIds={drawer.suppliersInternal ?? []} onChange={ids => setDrawer(p => ({ ...p, suppliersInternal: ids }))} emptyText="No hay otros procesos" />
                  </div>

                  {/* ── Documentos / Riesgos / Indicadores ── */}
                  <div className="pt-3 border-t border-neutral-100">
                    <label className="block text-xs font-semibold text-green-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Documentos asociados</label>
                    <MultiSelectChips options={docOptions} selectedIds={drawer.documentIds ?? []} onChange={ids => setDrawer(p => ({ ...p, documentIds: ids }))} emptyText="Sin documentos disponibles" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Riesgos asociados</label>
                    <MultiSelectChips options={riskOptions} selectedIds={drawer.riskIds ?? []} onChange={ids => setDrawer(p => ({ ...p, riskIds: ids }))} emptyText="Sin riesgos disponibles" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Indicadores asociados</label>
                    <MultiSelectChips options={indicatorOptions} selectedIds={drawer.indicatorIds ?? []} onChange={ids => setDrawer(p => ({ ...p, indicatorIds: ids }))} emptyText="Sin indicadores disponibles" />
                  </div>

                  {/* ── Actividades ── */}
                  <div className="pt-3 border-t border-neutral-100">
                    <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Actividades</label>
                    <ActivitiesEditor activities={drawer.activities ?? []} onChange={a => setDrawer(p => ({ ...p, activities: a }))} />
                  </div>

                  {/* ── Interacciones ── */}
                  <div className="pt-3 border-t border-neutral-100">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><ArrowLeftRight className="h-3.5 w-3.5" /> Interacciones</p>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1 flex items-center gap-1"><Inbox className="h-3 w-3" /> Recibe información de</label>
                    <MultiSelectChips options={siblingOptions} selectedIds={drawer.receivesFrom ?? []} onChange={ids => setDrawer(p => ({ ...p, receivesFrom: ids }))} emptyText="No hay otros subprocesos" />
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1 mt-2 flex items-center gap-1"><Send className="h-3 w-3" /> Entrega información a</label>
                    <MultiSelectChips options={siblingOptions} selectedIds={drawer.deliversTo ?? []} onChange={ids => setDrawer(p => ({ ...p, deliversTo: ids }))} emptyText="No hay otros subprocesos" />
                  </div>

                  {/* ── Observaciones ── */}
                  <div className="pt-3 border-t border-neutral-100">
                    <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Observaciones</label>
                    <textarea value={drawer.observations ?? ''} onChange={e => setDrawer(p => ({ ...p, observations: e.target.value }))} rows={3} placeholder="Notas adicionales..." className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  </div>
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

      {/* Modal: Vista de Diagrama de Procesos */}
      {showDiagram && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto m-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="font-semibold text-neutral-900">{selected.name}</h3>
                <p className="text-xs text-neutral-500">Diagrama de flujo de procesos — ISO 9001</p>
              </div>
              <button onClick={() => setShowDiagram(false)} className="p-2 rounded-lg hover:bg-neutral-100">
                <X className="h-5 w-5 text-neutral-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Diagrama de tortuga simplificado */}
              <div className="grid grid-cols-3 gap-4">
                {/* Entradas */}
                <div className="col-span-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-blue-700 uppercase mb-2">ENTRADAS (INPUTS)</p>
                  <p className="text-sm text-blue-900">{selected.inputLabel || 'Requisitos del cliente / Partes Interesadas'}</p>
                </div>
                
                {/* Proveedores - Proceso - Clientes */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-green-700 uppercase mb-2">PROVEEDORES</p>
                  <ul className="text-sm text-green-900 space-y-1">
                    <li>• Proveedores externos</li>
                    <li>• Áreas internas</li>
                    <li>• Partes interesadas</li>
                  </ul>
                </div>
                
                <div className="bg-brand-50 border-2 border-brand-300 rounded-lg p-4">
                  <p className="text-xs font-semibold text-brand-700 uppercase mb-2 text-center">PROCESO</p>
                  <div className="space-y-2">
                    {selected.processes.filter(p => !p.parentId).map((p, i) => (
                      <div key={p.id} className="bg-white rounded-lg p-2 border border-brand-200 text-center">
                        <p className="text-sm font-medium text-brand-900">{p.code || `P${i+1}`}</p>
                        <p className="text-xs text-brand-700 truncate">{p.name}</p>
                      </div>
                    ))}
                    {selected.processes.filter(p => !p.parentId).length === 0 && (
                      <p className="text-xs text-brand-400 text-center italic">Sin procesos definidos</p>
                    )}
                  </div>
                </div>
                
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-purple-700 uppercase mb-2">CLIENTES</p>
                  <ul className="text-sm text-purple-900 space-y-1">
                    <li>• Clientes externos</li>
                    <li>• Usuarios internos</li>
                    <li>• Reguladores</li>
                  </ul>
                </div>
                
                {/* Salidas */}
                <div className="col-span-3 bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-orange-700 uppercase mb-2">SALIDAS (OUTPUTS)</p>
                  <p className="text-sm text-orange-900">{selected.outputLabel || 'Satisfacción del cliente / Productos/Servicios conformes'}</p>
                </div>
              </div>
              
              {/* Tabla de procesos detallada */}
              <div>
                <h4 className="text-sm font-semibold text-neutral-900 mb-3">Detalle de Procesos</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Código</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Nombre</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Capa</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Responsable</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {selected.processes.filter(p => !p.parentId).map(p => (
                        <tr key={p.id} className="hover:bg-neutral-50">
                          <td className="px-3 py-2 font-mono text-xs">{p.code || '-'}</td>
                          <td className="px-3 py-2 font-medium">{p.name}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${LAYER_CONFIG[p.layer].badge}`}>
                              {LAYER_CONFIG[p.layer].label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-neutral-600">{getEmployeeName(p.owner)}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                              {p.status === 'active' ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Métricas */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-neutral-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-neutral-900">{selected.processes.filter(p => !p.parentId).length}</p>
                  <p className="text-xs text-neutral-500">Total Procesos</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{selected.processes.filter(p => !p.parentId && p.layer === 'STRATEGIC').length}</p>
                  <p className="text-xs text-blue-600">Estratégicos</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{selected.processes.filter(p => !p.parentId && p.layer === 'OPERATIONAL').length}</p>
                  <p className="text-xs text-green-600">Operativos</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-700">{selected.processes.filter(p => !p.parentId && p.layer === 'SUPPORT').length}</p>
                  <p className="text-xs text-orange-600">Soporte</p>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t flex justify-end">
              <button onClick={() => setShowDiagram(false)} className="px-4 py-2 text-sm bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mapa General (toda la empresa) */}
      {showGeneral && (
        <MapaGeneralModal maps={maps} onClose={() => setShowGeneral(false)} />
      )}

      {/* Wizard: Crear desde plantilla */}
      <ProcessTemplateWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onImported={load}
        existingMaps={maps.map(m => ({ id: m.id, name: m.name }))}
        preselectedMapId={selected?.id ?? null}
      />

      {/* Wizard: Implementación Inteligente con IA */}
      <ProcessAIWizard
        isOpen={showAIWizard}
        onClose={() => setShowAIWizard(false)}
        onImported={load}
      />

      {/* Modal: Importar plantilla .sgi360.json */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2"><Upload className="h-4 w-4 text-brand-600" /> Importar plantilla</h3>
              <button onClick={() => setShowImport(false)}><X className="h-5 w-5 text-neutral-400" /></button>
            </div>
            <div className="px-5 py-4 overflow-y-auto space-y-4">
              <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-neutral-200 rounded-lg cursor-pointer hover:border-brand-300">
                <FileJson className="h-5 w-5 text-brand-500" />
                <span className="text-sm text-neutral-600">{importFileName || 'Seleccioná un archivo .sgi360.json'}</span>
                <input type="file" accept=".json,application/json" onChange={onImportFile} className="hidden" />
              </label>

              {analyzing && <div className="flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Analizando archivo...</div>}
              {importError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{importError}</div>}

              {importAnalysis && (
                <>
                  <div className="rounded-lg border border-neutral-200 p-3">
                    <p className="text-sm font-semibold text-neutral-900">{importAnalysis.map.name}</p>
                    {importAnalysis.map.description && <p className="text-xs text-neutral-500 mt-0.5">{importAnalysis.map.description}</p>}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {[
                        ['Macroprocesos', importAnalysis.summary.macroprocesos],
                        ['Subprocesos', importAnalysis.summary.subprocesos],
                        ['Actividades', importAnalysis.summary.actividades],
                        ['Documentos', importAnalysis.summary.documentos],
                        ['Riesgos', importAnalysis.summary.riesgos],
                        ['Indicadores', importAnalysis.summary.indicadores],
                      ].map(([label, val]) => (
                        <div key={label as string} className="bg-neutral-50 rounded-lg px-2 py-2 text-center">
                          <p className="text-lg font-bold text-neutral-900">{val as number}</p>
                          <p className="text-[11px] text-neutral-500">{label as string}</p>
                        </div>
                      ))}
                    </div>
                    {importAnalysis.warnings?.length > 0 && (
                      <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-0.5">
                        {importAnalysis.warnings.map((w, i) => <p key={i} className="flex items-start gap-1"><AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" /> {w}</p>)}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Modo de importación</p>
                    <div className="space-y-1.5">
                      {([
                        ['new', 'Crear nuevo mapa', 'Crea un mapa nuevo con toda la estructura importada.'],
                        ['merge', 'Fusionar con mapa actual', 'Agrega los procesos al mapa seleccionado.'],
                        ['replace', 'Reemplazar mapa actual', 'Elimina los procesos del mapa seleccionado y los reemplaza.'],
                      ] as const).map(([val, title, desc]) => (
                        <label key={val} className={`flex items-start gap-2 px-3 py-2 rounded-lg border cursor-pointer ${importMode === val ? 'border-brand-400 bg-brand-50' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                          <input type="radio" name="importMode" checked={importMode === val} onChange={() => setImportMode(val)} className="mt-0.5" />
                          <span>
                            <span className="text-sm font-medium text-neutral-800 block">{title}</span>
                            <span className="text-xs text-neutral-500">{desc}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {(importMode === 'merge' || importMode === 'replace') && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Mapa destino</label>
                      <select value={importTargetMapId} onChange={e => setImportTargetMapId(e.target.value)} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">Seleccioná un mapa...</option>
                        {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  )}

                  {importMode === 'merge' && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Si hay procesos duplicados</label>
                      <select value={importDuplicatePolicy} onChange={e => setImportDuplicatePolicy(e.target.value as any)} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm">
                        <option value="skip">Omitir (mantener el existente)</option>
                        <option value="update">Actualizar el existente</option>
                        <option value="duplicate">Duplicar con nuevo nombre</option>
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-100">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm font-medium text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50" disabled={importing}>Cancelar</button>
              <button onClick={doImport} disabled={!importAnalysis || importing} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-40">
                {importing ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</> : <>Importar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Descargar plantilla base */}
      {showBaseTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2"><FileDown className="h-4 w-4 text-brand-600" /> Plantillas base</h3>
              <button onClick={() => setShowBaseTemplates(false)}><X className="h-5 w-5 text-neutral-400" /></button>
            </div>
            <div className="px-5 py-4 overflow-y-auto space-y-2">
              <p className="text-xs text-neutral-500 mb-2">Descargá una plantilla predefinida en formato .sgi360.json y luego importala.</p>
              {baseTemplates.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-neutral-500 py-6 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>
              ) : baseTemplates.map(t => (
                <div key={t.key} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 hover:bg-neutral-50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-800">{t.name}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${t.category === 'NORMA' ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'}`}>{t.category}</span>
                    </div>
                    <p className="text-xs text-neutral-500 truncate">{t.description} · {t.processCount} procesos</p>
                  </div>
                  <button onClick={() => downloadBaseTemplate(t.key)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 flex-shrink-0">
                    <Download className="h-3.5 w-3.5" /> Descargar
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-100">
              <button onClick={() => { setShowBaseTemplates(false); openImport(); }} className="px-4 py-2 text-sm font-medium text-brand-700 border border-brand-200 bg-brand-50 rounded-lg hover:bg-brand-100">Ir a importar</button>
              <button onClick={() => setShowBaseTemplates(false)} className="px-4 py-2 text-sm font-medium text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
