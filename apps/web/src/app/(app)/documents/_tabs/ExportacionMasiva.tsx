'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Package, Plus, Save, X, Search, Filter, Download,
  CheckCircle, Clock, FileStack, Archive, BookOpen,
  Loader2,
} from 'lucide-react';

interface BulkExport {
  id: string;
  name: string;
  type: string;
  description?: string;
  modules: string[];
  statuses: string[];
  dateFrom?: string;
  dateTo?: string;
  includeAnnexes: boolean;
  includeEvidence: boolean;
  includeObsolete: boolean;
  includeIndex: boolean;
  includeSeparators: boolean;
  outputMode: string;
  fileName?: string;
  fileSize: number;
  pageCount: number;
  status: string;
  userName?: string;
  createdAt: string;
  completedAt?: string;
}

const BULK_TYPES: Record<string, { label: string; icon: any; desc: string }> = {
  LIBRO_SGI: { label: 'Libro SGI', icon: BookOpen, desc: 'Compilación completa del Sistema de Gestión Integrado' },
  RESPALDO: { label: 'Respaldo Documental', icon: Archive, desc: 'Backup de documentos por módulo y período' },
  AUDIT_PACK: { label: 'Pack de Auditoría', icon: FileStack, desc: 'Documentos para auditoría externa' },
  CUSTOM: { label: 'Personalizado', icon: Package, desc: 'Selección personalizada de documentos' },
};

const MODULES = [
  'calidad', 'rrhh', 'documents', 'normativos', 'audits', 'riesgos',
  'indicadores', 'capacitaciones', 'gestion-cambios', 'project360',
  'contexto-sgi', 'no-conformidades', 'clima', 'maintenance',
];

const STATUSES = ['EFFECTIVE', 'DRAFT', 'REVIEW', 'PENDING_APPROVAL', 'OBSOLETE'];

export default function ExportacionMasiva() {
  const [items, setItems] = useState<BulkExport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const [form, setForm] = useState({
    name: '',
    type: 'LIBRO_SGI',
    description: '',
    modules: [] as string[],
    statuses: [] as string[],
    dateFrom: '',
    dateTo: '',
    includeAnnexes: false,
    includeEvidence: false,
    includeObsolete: false,
    includeIndex: true,
    includeSeparators: false,
    outputMode: 'SINGLE_PDF',
  });

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));
      if (filterType) params.set('type', filterType);
      const data = await apiFetch<{ data: BulkExport[]; total: number }>(`/doc-export/bulk-exports?${params}`);
      setItems(data.data);
      setTotal(data.total);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [page, filterType]);

  async function create() {
    if (!form.name) return;
    try {
      await apiFetch('/doc-export/bulk-exports', {
        method: 'POST',
        json: {
          ...form,
          dateFrom: form.dateFrom || null,
          dateTo: form.dateTo || null,
        },
      });
      setSuccess('Exportación masiva creada. Se procesará en segundo plano.');
      setShowCreate(false);
      setForm({ name: '', type: 'LIBRO_SGI', description: '', modules: [], statuses: [], dateFrom: '', dateTo: '', includeAnnexes: false, includeEvidence: false, includeObsolete: false, includeIndex: true, includeSeparators: false, outputMode: 'SINGLE_PDF' });
      load();
    } catch (e: any) { setError(e.message); }
  }

  function toggleModule(m: string) {
    setForm(f => ({ ...f, modules: f.modules.includes(m) ? f.modules.filter(x => x !== m) : [...f.modules, m] }));
  }
  function toggleStatus(s: string) {
    setForm(f => ({ ...f, statuses: f.statuses.includes(s) ? f.statuses.filter(x => x !== s) : [...f.statuses, s] }));
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  if (loading) return <div className="p-8 text-center text-neutral-400">Cargando...</div>;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">{success}</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-800">Exportación Masiva y Libro SGI</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Nueva Exportación
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-4 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Ej: Libro SGI 2026" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
                {Object.entries(BULK_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-600 mb-1">Descripción</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Fecha desde</label>
              <input type="date" value={form.dateFrom} onChange={e => setForm({ ...form, dateFrom: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Fecha hasta</label>
              <input type="date" value={form.dateTo} onChange={e => setForm({ ...form, dateTo: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Módulos a incluir</label>
            <div className="flex flex-wrap gap-2">
              {MODULES.map(m => (
                <button
                  key={m}
                  onClick={() => toggleModule(m)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium ${form.modules.includes(m) ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-600'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Estados a incluir</label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium ${form.statuses.includes(s) ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-600'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {[
              { key: 'includeAnnexes', label: 'Incluir anexos' },
              { key: 'includeEvidence', label: 'Incluir evidencias' },
              { key: 'includeObsolete', label: 'Incluir obsoletos' },
              { key: 'includeIndex', label: 'Generar índice' },
              { key: 'includeSeparators', label: 'Separadores entre docs' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.checked } as any)} className="rounded border-neutral-300" />
                {label}
              </label>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Modo de salida</label>
            <select value={form.outputMode} onChange={e => setForm({ ...form, outputMode: e.target.value })} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
              <option value="SINGLE_PDF">PDF único</option>
              <option value="ZIP_PDF">ZIP con PDFs individuales</option>
              <option value="ZIP_ORIGINAL">ZIP con archivos originales</option>
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">Cancelar</button>
            <button onClick={create} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
              <Save className="h-4 w-4" /> Crear
            </button>
          </div>
        </div>
      )}

      <select
        value={filterType}
        onChange={e => { setFilterType(e.target.value); setPage(0); }}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm w-fit"
      >
        <option value="">Todos los tipos</option>
        {Object.entries(BULK_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>

      <div className="grid gap-3">
        {items.map(item => {
          const typeInfo = BULK_TYPES[item.type] || { label: item.type, icon: Package, desc: '' };
          const Icon = typeInfo.icon;
          return (
            <div key={item.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-brand-50 p-2">
                    <Icon className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-neutral-800">{item.name}</h3>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      {typeInfo.label} · {new Date(item.createdAt).toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.status === 'COMPLETED' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
                      <CheckCircle className="h-3 w-3" /> Completado
                    </span>
                  ) : item.status === 'PENDING' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                      <Clock className="h-3 w-3" /> Pendiente
                    </span>
                  ) : item.status === 'PROCESSING' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      <Loader2 className="h-3 w-3 animate-spin" /> Procesando
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">{item.status}</span>
                  )}
                </div>
              </div>

              {item.description && <p className="mt-2 text-xs text-neutral-500">{item.description}</p>}

              <div className="mt-2 flex flex-wrap gap-1">
                {item.modules.map(m => (
                  <span key={m} className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">{m}</span>
                ))}
              </div>

              {item.status === 'COMPLETED' && item.fileName && (
                <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                  <Download className="h-3 w-3" />
                  <span className="font-mono">{item.fileName}</span>
                  <span>· {formatSize(item.fileSize)}</span>
                  <span>· {item.pageCount} págs</span>
                </div>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="py-12 text-center text-neutral-400">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No hay exportaciones masivas registradas.</p>
          </div>
        )}
      </div>

      {total > limit && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40">Anterior</button>
          <span className="text-sm text-neutral-500">Página {page + 1} de {Math.ceil(total / limit)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= total} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </div>
  );
}
