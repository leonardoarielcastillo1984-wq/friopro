'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Plus, Save, CheckCircle, Clock, X } from 'lucide-react';

type Action = {
  id: string;
  description: string;
  rootCause: string | null;
  type: 'CORRECTIVE' | 'PREVENTIVE' | 'IMPROVEMENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  responsibleId: string;
  plannedDate: string;
  completedDate: string | null;
  isEffective: boolean | null;
  evidence: string | null;
  createdAt: string;
};

type Finding = {
  id: string;
  code: string;
  description: string;
  severity: string;
  status: string;
};

const ACTION_TYPES = [
  { value: 'CORRECTIVE', label: 'Correctiva' },
  { value: 'PREVENTIVE', label: 'Preventiva' },
  { value: 'IMPROVEMENT', label: 'Mejora' },
];

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'IN_PROGRESS', label: 'En Progreso', color: 'bg-blue-100 text-blue-800' },
  { value: 'COMPLETED', label: 'Completada', color: 'bg-green-100 text-green-800' },
  { value: 'CANCELLED', label: 'Cancelada', color: 'bg-gray-100 text-gray-800' },
];

export default function ActionsPage() {
  const params = useParams();
  const findingId = params.findingId as string;
  const auditId = params.id as string;

  const [finding, setFinding] = useState<Finding | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newAction, setNewAction] = useState({
    description: '',
    rootCause: '',
    type: 'CORRECTIVE',
    responsibleId: '',
    plannedDate: '',
  });

  useEffect(() => {
    if (findingId) {
      loadData();
    }
  }, [findingId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [findingRes, actionsRes] = await Promise.all([
        apiFetch(`/audit/iso-findings/${findingId}`) as Promise<{ finding: Finding }>,
        apiFetch(`/audit/iso-findings/${findingId}/actions`) as Promise<{ actions: Action[] }>,
      ]);

      if (findingRes.finding) setFinding(findingRes.finding);
      if (actionsRes.actions) setActions(actionsRes.actions);
    } catch (err) {
      console.error('Error loading actions:', err);
      setError(err instanceof Error ? err.message : 'Error loading actions');
    } finally {
      setLoading(false);
    }
  }

  async function createAction(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const responsibleId = newAction.responsibleId?.trim();
      const responsibleIdToSend = responsibleId && uuidRegex.test(responsibleId) ? responsibleId : undefined;

      const res = await apiFetch(`/audit/iso-findings/${findingId}/actions`, {
        method: 'POST',
        json: {
          description: newAction.description,
          rootCause: newAction.rootCause?.trim() ? newAction.rootCause.trim() : undefined,
          type: newAction.type,
          responsibleId: responsibleIdToSend,
          plannedDate: newAction.plannedDate ? new Date(newAction.plannedDate).toISOString() : undefined,
          status: 'PENDING',
        },
      }) as { action: Action };

      if (res.action) {
        setActions([...actions, res.action]);
        setShowCreateModal(false);
        setNewAction({
          description: '',
          rootCause: '',
          type: 'CORRECTIVE',
          responsibleId: '',
          plannedDate: '',
        });
      }
    } catch (err) {
      console.error('Error creating action:', err);
      setError(err instanceof Error ? err.message : 'Error creating action');
    } finally {
      setSaving(false);
    }
  }

  async function updateAction(actionId: string, data: Partial<Action>) {
    try {
      setError(null);
      const res = await apiFetch(`/audit/iso-actions/${actionId}`, {
        method: 'PATCH',
        json: data,
      }) as { action: Action };

      if (res.action) {
        setActions(actions.map(a => a.id === actionId ? { ...a, ...data } : a));
      }
    } catch (err) {
      console.error('Error updating action:', err);
      setError(err instanceof Error ? err.message : 'Error updating action');
    }
  }

  function getStatusLabel(status: string) {
    return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
  }

  function getStatusColor(status: string) {
    return STATUS_OPTIONS.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-800';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
          <Link 
            href={`/auditorias/${auditId}/findings`} 
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver a hallazgos
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Acciones Correctivas</h1>
          <p className="text-gray-600">Hallazgo: {finding?.code || findingId}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Acción
        </button>
      </div>

      {/* Actions List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Acciones ({actions.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-200">
          {actions.length > 0 ? (
            actions.map((action) => (
              <div key={action.id} className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(action.status)}`}>
                      {getStatusLabel(action.status)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {ACTION_TYPES.find(t => t.value === action.type)?.label}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(action.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                <p className="text-gray-900 font-medium mb-2">{action.description}</p>
                
                {action.rootCause && (
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Causa raíz:</strong> {action.rootCause}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <strong>Fecha planificada:</strong> {new Date(action.plannedDate).toLocaleDateString()}
                  </span>
                  {action.completedDate && (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      <strong>Completada:</strong> {new Date(action.completedDate).toLocaleDateString()}
                    </span>
                  )}
                  {action.isEffective !== null && (
                    <span className={`px-2 py-1 rounded text-xs ${action.isEffective ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {action.isEffective ? 'Efectiva' : 'No Efectiva'}
                    </span>
                  )}
                </div>

                {/* Status Update */}
                <div className="flex gap-2 mt-4">
                  <select
                    value={action.status}
                    onChange={(e) => updateAction(action.id, { status: e.target.value as any })}
                    className="text-sm px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  
                  {action.status === 'COMPLETED' && action.isEffective === null && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateAction(action.id, { isEffective: true })}
                        className="text-sm px-3 py-1 bg-green-100 text-green-800 rounded-lg hover:bg-green-200"
                      >
                        Marcar Efectiva
                      </button>
                      <button
                        onClick={() => updateAction(action.id, { isEffective: false })}
                        className="text-sm px-3 py-1 bg-red-100 text-red-800 rounded-lg hover:bg-red-200"
                      >
                        No Efectiva
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay acciones registradas</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-blue-600 hover:text-blue-800 text-sm mt-2"
              >
                + Crear primera acción
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear Acción */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Nueva Acción</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={createAction} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Acción</label>
                <select
                  value={newAction.type}
                  onChange={(e) => setNewAction({ ...newAction, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ACTION_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción <span className="text-red-500">*</span></label>
                <textarea
                  value={newAction.description}
                  onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                  placeholder="Describa la acción a realizar..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Causa Raíz (Análisis 5 Porqués)</label>
                <textarea
                  value={newAction.rootCause}
                  onChange={(e) => setNewAction({ ...newAction, rootCause: e.target.value })}
                  placeholder="Identifique la causa raíz del problema..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                  <input
                    type="text"
                    value={newAction.responsibleId}
                    onChange={(e) => setNewAction({ ...newAction, responsibleId: e.target.value })}
                    placeholder="UUID (opcional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Límite <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={newAction.plannedDate}
                    onChange={(e) => setNewAction({ ...newAction, plannedDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Crear Acción
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
