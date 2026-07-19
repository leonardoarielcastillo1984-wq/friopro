'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Plus, Edit3, Trash2, Save, X, Search, FileOutput,
  Hash, Filter, Download, Eye, AlertCircle,
} from 'lucide-react';

interface OutputDef {
  id: string;
  module: string;
  subModule?: string;
  screenName: string;
  outputKey: string;
  outputType: string;
  description?: string;
  documentCode?: string;
  revision: number;
  status: string;
  active: boolean;
  allowExport: boolean;
  includeQR: boolean;
  includeSignatures: boolean;
  template?: { id: string; name: string };
  document?: { id: string; title: string; documentCode?: string };
  exportCount: number;
  lastExportAt?: string;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pendiente', color: 'text-neutral-600', bg: 'bg-neutral-100' },
  DRAFT: { label: 'Borrador', color: 'text-amber-700', bg: 'bg-amber-50' },
  REVIEW: { label: 'En Revisión', color: 'text-blue-700', bg: 'bg-blue-50' },
  PENDING_APPROVAL: { label: 'Pend. Aprob.', color: 'text-purple-700', bg: 'bg-purple-50' },
  EFFECTIVE: { label: 'Vigente', color: 'text-green-700', bg: 'bg-green-50' },
  OBSOLETE: { label: 'Obsoleto', color: 'text-red-700', bg: 'bg-red-50' },
  SUSPENDED: { label: 'Suspendido', color: 'text-orange-700', bg: 'bg-orange-50' },
  ARCHIVED: { label: 'Archivado', color: 'text-neutral-500', bg: 'bg-neutral-100' },
};

const OUTPUT_TYPES: Record<string, string> = {
  LIST: 'Listado',
  RECORD: 'Ficha/Registro',
  DASHBOARD: 'Dashboard',
  MATRIX: 'Matriz',
  MAP: 'Mapa',
  REPORT: 'Reporte',
  FORM: 'Formulario',
};

const MODULES = [
  'calidad', 'rrhh', 'documents', 'normativos', 'audits', 'riesgos',
  'indicadores', 'capacitaciones', 'gestion-cambios', 'project360',
  'contexto-sgi', 'no-conformidades', 'clima', 'maintenance', 'seh360',
];

const EMPTY_DEF: Partial<OutputDef> = {
  module: '',
  subModule: '',
  screenName: '',
  outputKey: '',
  outputType: 'LIST',
  description: '',
  status: 'PENDING',
  allowExport: true,
  includeQR: true,
  includeSignatures: true,
};

export default function CatalogoSalidas() {
  const [defs, setDefs] = useState<OutputDef[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<OutputDef> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [assignCodeModal, setAssignCodeModal] = useState<OutputDef | null>(null);
  const [newCode, setNewCode] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [data, tmpl] = await Promise.all([
        apiFetch<OutputDef[]>('/doc-export/outputs'),
        apiFetch<Template[]>('/doc-export/templates').catch(() => []),
      ]);
      setDefs(data);
      setTemplates(tmpl);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing) return;
    setError(null);
    try {
      if (isNew) {
        await apiFetch('/doc-export/outputs', { method: 'POST', json: editing });
        setSuccess('Salida registrada');
      } else {
        await apiFetch(`/doc-export/outputs/${editing.id}`, { method: 'PUT', json: editing });
        setSuccess('Salida actualizada');
      }
      setEditing(null);
      setIsNew(false);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar esta definición de salida?')) return;
    try {
      await apiFetch(`/doc-export/outputs/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function assignCode() {
    if (!assignCodeModal || !newCode) return;
    try {
      await apiFetch(`/doc-export/outputs/${assignCodeModal.id}/assign-code`, {
        method: 'POST', json: { documentCode: newCode },
      });
      setSuccess('Código asignado');
      setAssignCodeModal(null);
      setNewCode('');
      load();
    } catch (e: any) { setError(e.message); }
  }

  const filtered = useMemo(() => {
    return defs.filter(d => {
      if (search) {
        const q = search.toLowerCase();
        if (!d.screenName.toLowerCase().includes(q) && !d.outputKey.toLowerCase().includes(q) && !(d.documentCode || '').toLowerCase().includes(q)) return false;
      }
      if (filterModule && d.module !== filterModule) return false;
      if (filterStatus && d.status !== filterStatus) return false;
      return true;
    });
  }, [defs, search, filterModule, filterStatus]);

  if (loading) return <div className="p-8 text-center text-neutral-400">Cargando catálogo...</div>;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">{success}</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-800">Catálogo de Salidas Documentales del Sistema</h2>
        <button
          onClick={() => { setEditing({ ...EMPTY_DEF }); setIsNew(true); }}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Nueva Salida
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, clave o código..."
            className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filterModule}
          onChange={e => setFilterModule(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los módulos</option>
          {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Código</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Salida</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Módulo</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Tipo</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Plantilla</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Estado</th>
              <th className="px-3 py-2 text-center font-medium text-neutral-600">Export.</th>
              <th className="px-3 py-2 text-right font-medium text-neutral-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map(d => {
              const st = STATUS_CONFIG[d.status] || { label: d.status, color: '', bg: '' };
              return (
                <tr key={d.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2">
                    {d.documentCode ? (
                      <code className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{d.documentCode}</code>
                    ) : (
                      <button
                        onClick={() => { setAssignCodeModal(d); setNewCode(''); }}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        Asignar código
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-neutral-800">{d.screenName}</div>
                    <div className="text-xs text-neutral-400 font-mono">{d.outputKey}</div>
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{d.module}{d.subModule ? ` / ${d.subModule}` : ''}</td>
                  <td className="px-3 py-2 text-neutral-600">{OUTPUT_TYPES[d.outputType] || d.outputType}</td>
                  <td className="px-3 py-2 text-neutral-600">{d.template?.name || <span className="text-neutral-300 italic">—</span>}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${st.bg} ${st.color}`}>{st.label}</span>
                  </td>
                  <td className="px-3 py-2 text-center text-neutral-500 text-xs">{d.exportCount}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditing(d); setIsNew(false); }} className="text-neutral-400 hover:text-brand-600">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(d.id)} className="text-neutral-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-neutral-400">
            <FileOutput className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No hay salidas documentales registradas.</p>
          </div>
        )}
      </div>

      {/* Modal editar/crear */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-800">{isNew ? 'Nueva Salida Documental' : 'Editar Salida'}</h3>
              <button onClick={() => { setEditing(null); setIsNew(false); }} className="text-neutral-400 hover:text-neutral-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Módulo *</label>
                <select
                  value={editing.module || ''}
                  onChange={e => setEditing({ ...editing, module: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Submódulo</label>
                <input
                  value={editing.subModule || ''}
                  onChange={e => setEditing({ ...editing, subModule: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="ej: capacitaciones"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre de la Pantalla *</label>
                <input
                  value={editing.screenName || ''}
                  onChange={e => setEditing({ ...editing, screenName: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="ej: Listado de Capacitaciones"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Clave Técnica *</label>
                <input
                  value={editing.outputKey || ''}
                  onChange={e => setEditing({ ...editing, outputKey: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono"
                  placeholder="ej: rrhh.capacitaciones.list"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo de Salida</label>
                <select
                  value={editing.outputType || 'LIST'}
                  onChange={e => setEditing({ ...editing, outputType: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  {Object.entries(OUTPUT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Plantilla</label>
                <select
                  value={(editing as any).templateId || ''}
                  onChange={e => setEditing({ ...editing, templateId: e.target.value || undefined } as any)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="">Sin plantilla (default)</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Estado</label>
                <select
                  value={editing.status || 'PENDING'}
                  onChange={e => setEditing({ ...editing, status: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Nivel Confidencialidad</label>
                <select
                  value={(editing as any).confidentialLevel || ''}
                  onChange={e => setEditing({ ...editing, confidentialLevel: e.target.value || undefined } as any)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  <option value="PUBLIC">Público</option>
                  <option value="INTERNAL">Interno</option>
                  <option value="CONFIDENTIAL">Confidencial</option>
                  <option value="RESTRICTED">Restringido</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-neutral-600 mb-1">Descripción</label>
                <textarea
                  value={editing.description || ''}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              {[
                { key: 'allowExport', label: 'Permitir exportación' },
                { key: 'includeQR', label: 'Incluir QR' },
                { key: 'includeSignatures', label: 'Incluir firmas' },
                { key: 'active', label: 'Activa' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={(editing as any)[key] ?? true}
                    onChange={e => setEditing({ ...editing, [key]: e.target.checked } as any)}
                    className="rounded border-neutral-300"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setEditing(null); setIsNew(false); }} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
                Cancelar
              </button>
              <button onClick={save} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                <Save className="h-4 w-4" /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignar código */}
      {assignCodeModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-800">Asignar Código Documental</h3>
              <button onClick={() => setAssignCodeModal(null)} className="text-neutral-400 hover:text-neutral-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-neutral-600">
              Asigná un código único a <strong>{assignCodeModal.screenName}</strong> ({assignCodeModal.outputKey})
            </p>
            <input
              value={newCode}
              onChange={e => setNewCode(e.target.value)}
              placeholder="Ej: DAD-SGI-RRHH-LST-001"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setAssignCodeModal(null)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
                Cancelar
              </button>
              <button onClick={assignCode} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
