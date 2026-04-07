'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Save, AlertCircle, CheckCircle, XCircle, HelpCircle } from 'lucide-react';

type ChecklistItem = {
  id: string;
  clause: string;
  requirement: string;
  whatToCheck: string;
  response: 'COMPLIES' | 'DOES_NOT_COMPLY' | 'NOT_APPLICABLE' | null;
  comment: string | null;
  evidence: string | null;
  order: number;
};

type Audit = {
  id: string;
  code: string;
  title: string;
  status: string;
};

const RESPONSE_OPTIONS = [
  { value: 'COMPLIES', label: 'Cumple', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  { value: 'DOES_NOT_COMPLY', label: 'No Cumple', color: 'bg-red-100 text-red-800', icon: XCircle },
  { value: 'NOT_APPLICABLE', label: 'No Aplica', color: 'bg-gray-100 text-gray-800', icon: HelpCircle },
];

export default function ChecklistPage() {
  const params = useParams();
  const router = useRouter();
  const auditId = params.id as string;

  const [audit, setAudit] = useState<Audit | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ answered: 0, total: 0 });

  useEffect(() => {
    if (auditId) {
      loadChecklist();
    }
  }, [auditId]);

  async function loadChecklist() {
    try {
      setLoading(true);
      setError(null);
      const [auditRes, itemsRes] = await Promise.all([
        apiFetch(`/audit/audits/${auditId}`) as Promise<{ audit: Audit }>,
        apiFetch(`/audit/audits/${auditId}/checklist`) as Promise<{ items: ChecklistItem[] }>,
      ]);

      if (auditRes.audit) setAudit(auditRes.audit);
      if (itemsRes.items) {
        setItems(itemsRes.items);
        updateProgress(itemsRes.items);
      }
    } catch (err) {
      setError('Error al cargar el checklist');
    } finally {
      setLoading(false);
    }
  }

  function updateProgress(itemsList: ChecklistItem[]) {
    const answered = itemsList.filter(i => i.response !== null).length;
    setProgress({ answered, total: itemsList.length });
  }

  async function updateItem(itemId: string, data: Partial<ChecklistItem>) {
    const prevItems = items;
    try {
      setSaving(true);
      setError(null);

      const optimisticItems = items.map(i => (i.id === itemId ? { ...i, ...data } : i));
      setItems(optimisticItems);
      updateProgress(optimisticItems);

      const res = await apiFetch(`/audit/checklist/${itemId}`, {
        method: 'PATCH',
        json: data,
      }) as { item: ChecklistItem };

      if (res.item) {
        const mergedItems = optimisticItems.map(i => (i.id === itemId ? { ...i, ...res.item } : i));
        setItems(mergedItems);
        updateProgress(mergedItems);
      }
    } catch (err) {
      console.error('Error updating item:', err);
      setItems(prevItems);
      updateProgress(prevItems);
      setError(err instanceof Error ? err.message : 'Error al actualizar el item');
    } finally {
      setSaving(false);
    }
  }

  function getProgressPercentage() {
    if (progress.total === 0) return 0;
    return Math.round((progress.answered / progress.total) * 100);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="space-y-6">
        <Link href="/auditorias" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800">
          <ChevronLeft className="w-4 h-4" />
          Volver
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || 'Auditoría no encontrada'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/auditorias/${auditId}`} className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-2">
            <ChevronLeft className="w-4 h-4" />
            Volver a la auditoría
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Checklist - {audit.code}</h1>
          <p className="text-gray-600">{audit.title}</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500 mb-1">Progreso del checklist</div>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700">
              {progress.answered}/{progress.total} ({getProgressPercentage()}%)
            </span>
          </div>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                {index + 1}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {item.clause}
                  </span>
                </div>
                <p className="text-gray-900 font-medium mb-2">{item.requirement}</p>
                <p className="text-sm text-gray-500 mb-4">
                  <span className="font-medium">Verificar:</span> {item.whatToCheck}
                </p>

                {/* Response Buttons */}
                <div className="flex gap-2 mb-4">
                  {RESPONSE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => updateItem(item.id, { response: option.value as any })}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                          item.response === option.value
                            ? option.color + ' border-transparent'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {/* Comment & Evidence */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                    <textarea
                      value={item.comment || ''}
                      onChange={(e) => {
                        const next = items.map(i => (i.id === item.id ? { ...i, comment: e.target.value } : i));
                        setItems(next);
                      }}
                      onBlur={(e) => updateItem(item.id, { comment: e.target.value })}
                      placeholder="Ingrese observaciones..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Evidencia</label>
                    <input
                      type="text"
                      value={item.evidence || ''}
                      onChange={(e) => {
                        const next = items.map(i => (i.id === item.id ? { ...i, evidence: e.target.value } : i));
                        setItems(next);
                      }}
                      onBlur={(e) => updateItem(item.id, { evidence: e.target.value })}
                      placeholder="URL o referencia de evidencia..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No hay items en el checklist</p>
            <p className="text-sm text-gray-400 mt-1">
              Aplica un template ISO desde la página de detalle de la auditoría
            </p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <button
          onClick={() => router.push(`/auditorias/${auditId}`)}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={() => router.push(`/auditorias/${auditId}`)}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Finalizar Checklist
            </>
          )}
        </button>
      </div>
    </div>
  );
}
