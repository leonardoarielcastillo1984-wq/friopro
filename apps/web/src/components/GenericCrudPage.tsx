'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'checkbox';

export interface AiFieldDef {
  targetKey: string;
  buttonLabel?: string;
  buildPrompt: (form: Record<string, any>) => string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  fullWidth?: boolean;
  placeholder?: string;
  hideInList?: boolean;
  hideInForm?: boolean;
}

export interface ColumnDef {
  key: string;
  label: string;
  render?: (item: any) => React.ReactNode;
}

interface Props {
  title: string;
  subtitle?: string;
  endpoint: string;
  icon: any;
  fields: FieldDef[];
  columns: ColumnDef[];
  defaultValues?: Record<string, any>;
  aiFields?: AiFieldDef[];
}

export default function GenericCrudPage({
  title,
  subtitle,
  endpoint,
  icon: Icon,
  fields,
  columns,
  defaultValues = {},
  aiFields = [],
}: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  async function runAi(aiField: AiFieldDef) {
    setAiLoading(aiField.targetKey);
    try {
      const prompt = aiField.buildPrompt(form);
      const res = await apiFetch<{ response?: string; text?: string }>('/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      });
      const text = res?.response || res?.text || '';
      if (text) setForm(prev => ({ ...prev, [aiField.targetKey]: text }));
    } catch (e: any) {
      alert('Error IA: ' + (e?.message || 'desconocido'));
    } finally {
      setAiLoading(null);
    }
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{ items: any[] }>(endpoint);
      setItems(res?.items || []);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [endpoint]);

  function openCreate() {
    setEditing(null);
    setForm({ ...defaultValues });
    setShowForm(true);
  }

  function openEdit(item: any) {
    setEditing(item);
    const init: Record<string, any> = {};
    for (const f of fields) {
      let v = item[f.key];
      if (v && f.type === 'date' && typeof v === 'string') v = v.slice(0, 10);
      if (v && f.type === 'datetime' && typeof v === 'string') v = v.slice(0, 16);
      init[f.key] = v ?? '';
    }
    setForm(init);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: any = {};
      for (const f of fields) {
        let v = form[f.key];
        if (v === '' || v === undefined) v = null;
        if (f.type === 'number' && v !== null) v = Number(v);
        if (f.type === 'checkbox') v = Boolean(v);
        if (f.type === 'date' && v) v = new Date(v).toISOString();
        if (f.type === 'datetime' && v) v = new Date(v).toISOString();
        body[f.key] = v;
      }
      if (editing) {
        await apiFetch(`${endpoint}/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
      }
      setShowForm(false);
      await load();
    } catch (err: any) {
      alert(err?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: any) {
    if (!confirm(`¿Eliminar "${item.name || item.title || item.code || item.id}"?`)) return;
    try {
      await apiFetch(`${endpoint}/${item.id}`, { method: 'DELETE' });
      await load();
    } catch (err: any) {
      alert(err?.message || 'Error al eliminar');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <Icon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{title}</h1>
              {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Recargar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              <Plus className="h-4 w-4" /> Nuevo
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              Sin registros. Creá el primero con el botón <strong>Nuevo</strong>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    {columns.map((c) => (
                      <th key={c.key} className="px-4 py-3 font-medium">{c.label}</th>
                    ))}
                    <th className="px-4 py-3 font-medium w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-t border-gray-100 hover:bg-gray-50">
                      {columns.map((c) => (
                        <td key={c.key} className="px-4 py-3 text-gray-800">
                          {c.render ? c.render(it) : (it[c.key] ?? '—')}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(it)}
                            className="p-1.5 text-gray-600 hover:bg-gray-200 rounded"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(it)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl max-w-2xl w-full my-8 shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Editar' : 'Nuevo'} {title.toLowerCase()}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1 text-gray-500 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
              {fields.filter(f => !f.hideInForm).map((f) => (
                <div key={f.key} className={f.fullWidth || f.type === 'textarea' ? 'md:col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  {f.type === 'textarea' ? (
                    <div className="relative">
                      {aiFields?.filter(a => a.targetKey === f.key).map(aiField => (
                        <button
                          key={aiField.targetKey}
                          type="button"
                          onClick={() => runAi(aiField)}
                          disabled={aiLoading === f.key}
                          className="absolute top-1 right-1 z-10 flex items-center gap-1 px-2 py-0.5 text-xs bg-white border border-purple-200 text-purple-600 rounded hover:bg-purple-50 disabled:opacity-50"
                        >
                          {aiLoading === f.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          {aiField.buttonLabel || 'IA'}
                        </button>
                      ))}
                      <textarea
                        value={form[f.key] ?? ''}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        rows={3}
                        placeholder={f.placeholder}
                        required={f.required}
                      />
                    </div>
                  ) : f.type === 'select' ? (
                    <select
                      value={form[f.key] ?? ''}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      required={f.required}
                    >
                      <option value="">Seleccionar...</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === 'checkbox' ? (
                    <label className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        checked={!!form[f.key]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-gray-700">{f.placeholder || f.label}</span>
                    </label>
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : 'text'}
                      value={form[f.key] ?? ''}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder={f.placeholder}
                      required={f.required}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm"
              >
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
