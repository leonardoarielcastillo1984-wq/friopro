'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Clock, ArrowLeft, ArrowRight, Plus, Trash2, Edit3 } from 'lucide-react';

interface Props {
  projectId: string;
}

export default function HistoryTab({ projectId }: Props) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/project360-v1/projects/${projectId}/history`) as any;
      setHistory(res.history || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const saveEdit = async (id: string) => {
    if (!editText.trim() || saving) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/project360-v1/history/${id}`, {
        method: 'PATCH',
        json: { details: editText.trim() },
      }) as any;
      setHistory(prev => prev.map(h => h.id === id ? { ...h, details: res.entry?.details ?? editText.trim() } : h));
      setEditingId(null);
    } catch (e) {
      console.error(e);
      alert('Error al editar el registro');
    } finally { setSaving(false); }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('¿Eliminar este registro del historial?')) return;
    try {
      await apiFetch(`/project360-v1/history/${id}`, { method: 'DELETE' });
      setHistory(prev => prev.filter(h => h.id !== id));
    } catch (e) {
      console.error(e);
      alert('Error al eliminar el registro');
    }
  };

  const getActionIcon = (action: string) => {
    const m: Record<string, any> = {
      CREATE: Plus,
      UPDATE: Edit3,
      DELETE: Trash2,
      STATUS_CHANGE: ArrowRight,
    };
    return m[action] || Clock;
  };

  const getActionColor = (action: string) => {
    const m: Record<string, string> = {
      CREATE: 'bg-green-500',
      UPDATE: 'bg-blue-500',
      DELETE: 'bg-red-500',
      STATUS_CHANGE: 'bg-yellow-500',
    };
    return m[action] || 'bg-gray-500';
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando historial...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Clock className="w-5 h-5 text-gray-600" /> Historial de Cambios</h2>
          <p className="text-sm text-gray-500">Registro completo de actividad del proyecto</p>
        </div>
        <span className="text-xs text-gray-500">{history.length} registros</span>
      </div>

      {history.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Sin registros de actividad</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="divide-y">
            {history.map((entry) => {
              const Icon = getActionIcon(entry.action);
              return (
                <div key={entry.id} className="flex items-start gap-3 p-4 hover:bg-gray-50">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getActionColor(entry.action)}`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingId === entry.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          rows={2}
                          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(entry.id)}
                            disabled={saving || !editText.trim()}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-800">{entry.details}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-medium text-gray-600">{entry.userName || '—'}</span>
                          <span className="text-xs text-gray-400">• {new Date(entry.createdAt).toLocaleString('es-AR')}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {editingId !== entry.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingId(entry.id); setEditText(entry.details || ''); }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Editar registro"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
