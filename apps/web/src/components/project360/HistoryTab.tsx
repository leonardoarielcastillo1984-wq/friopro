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

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/project360/projects/${projectId}/history`) as any;
      setHistory(res.history || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

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
                    <p className="text-sm text-gray-800">{entry.details}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-gray-600">{entry.userName}</span>
                      <span className="text-xs text-gray-400">• {new Date(entry.createdAt).toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
