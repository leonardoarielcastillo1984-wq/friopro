'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Save, AlertCircle, CheckCircle, XCircle, HelpCircle, Sparkles, Loader2, Plus, X, Trash2, ListChecks, Pencil } from 'lucide-react';

type ChecklistItem = {
  id: string;
  clause: string;
  requirement: string;
  whatToCheck: string;
  response: 'COMPLIES' | 'DOES_NOT_COMPLY' | 'NOT_APPLICABLE' | null;
  comment: string | null;
  evidence: string | null;
  order: number;
  aiSuggestion: string | null;
  customFields: Record<string, any> | null;
};

type Audit = {
  id: string;
  code: string;
  title: string;
  status: string;
  isoStandard: string[];
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
  const [aiLoading, setAiLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [availableClauses, setAvailableClauses] = useState<any[]>([]);
  const [selectedClauses, setSelectedClauses] = useState<Set<string>>(new Set());
  const [loadingClauses, setLoadingClauses] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ clause: string; requirement: string; whatToCheck: string; expectedEvidence: string }>({ clause: '', requirement: '', whatToCheck: '', expectedEvidence: '' });
  const [newItem, setNewItem] = useState({ clause: '', requirement: '', whatToCheck: '' });
  const [suggestedClauses, setSuggestedClauses] = useState<any[]>([]);
  const [searchingClause, setSearchingClause] = useState(false);

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

  async function loadAvailableClauses() {
    try {
      setLoadingClauses(true);
      const res = await apiFetch(`/audit/audits/${auditId}/normative-clauses`) as any;
      if (res.clauses) {
        setAvailableClauses(res.clauses);
        setSelectedClauses(new Set());
      }
    } catch (err) {
      setError('Error al cargar cláusulas de normas');
    } finally {
      setLoadingClauses(false);
    }
  }

  async function generateAiChecklist(filterMode: 'relevant' | 'all' | 'manual', selectedClauseNumbers?: string[]) {
    setShowFilterModal(false);
    setShowManualModal(false);
    try {
      setAiLoading(true);
      setError(null);
      // Intentar primero con normativas, si falla usar endpoint genérico
      try {
        const res = await apiFetch(`/audit/audits/${auditId}/generate-checklist-from-normative`, {
          method: 'POST',
          json: selectedClauseNumbers ? { filterMode, selectedClauses: selectedClauseNumbers } : { filterMode },
        }) as any;
        if (res.message) {
          await loadChecklist();
          return;
        }
      } catch (e: any) {
        // Si falla por no tener normativas, usar endpoint genérico
        const eMsg = e?.message || e?.error || '';
        if (eMsg.includes('normativas') || eMsg.includes('ISO') || eMsg.includes('normas')) {
          const res2 = await apiFetch(`/audit/audits/${auditId}/generate-checklist`, { method: 'POST' }) as any;
          if (res2.items) {
            await loadChecklist();
            return;
          }
        }
        throw e;
      }
    } catch (err: any) {
      setError(err?.message || err?.error || 'Error al generar checklist con IA');
    } finally {
      setAiLoading(false);
    }
  }

  async function searchClauses(clauseNumber: string) {
    if (!clauseNumber || !audit?.isoStandard?.[0]) {
      setSuggestedClauses([]);
      return;
    }

    try {
      setSearchingClause(true);
      const res = await apiFetch(`/audit/normative-clauses?clauseNumber=${clauseNumber}&standardCode=${audit.isoStandard[0]}`) as any;
      setSuggestedClauses(res.clauses || []);
    } catch (err) {
      setSuggestedClauses([]);
    } finally {
      setSearchingClause(false);
    }
  }

  function selectClause(clause: any) {
    setNewItem({ 
      ...newItem, 
      clause: clause.clauseNumber, 
      requirement: clause.title,
      whatToCheck: clause.content?.substring(0, 200) || ''
    });
    setSuggestedClauses([]);
  }

  async function addManualItem() {
    if (!newItem.clause.trim() || !newItem.requirement.trim()) {
      setError('Cláusula y requisito son obligatorios');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/audit/audits/${auditId}/checklist`, { 
        method: 'POST',
        body: JSON.stringify(newItem)
      });
      setNewItem({ clause: '', requirement: '', whatToCheck: '' });
      setShowAddModal(false);
      await loadChecklist();
    } catch (err: any) {
      setError(err?.error || 'Error al agregar item');
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm('¿Está seguro de eliminar este item del checklist?')) return;
    
    try {
      setSaving(true);
      await apiFetch(`/audit/checklist/${itemId}`, { method: 'DELETE' });
      await loadChecklist();
    } catch (err: any) {
      setError(err?.error || 'Error al eliminar item');
    } finally {
      setSaving(false);
    }
  }

  async function deleteAllItems() {
    if (items.length === 0) return;
    if (!confirm(`¿Está seguro de eliminar TODOS los ${items.length} items del checklist? Esta acción no se puede deshacer.`)) return;

    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/audit/audits/${auditId}/checklist`, { method: 'DELETE' });
      setItems([]);
      setProgress({ answered: 0, total: 0 });
    } catch (err: any) {
      setError(err?.error || 'Error al eliminar el checklist');
    } finally {
      setSaving(false);
    }
  }

  function startEditItem(item: ChecklistItem) {
    setEditingItemId(item.id);
    setEditDraft({
      clause: item.clause,
      requirement: item.requirement,
      whatToCheck: item.whatToCheck,
      expectedEvidence: item.customFields?.expectedEvidence || '',
    });
  }

  function cancelEditItem() {
    setEditingItemId(null);
    setEditDraft({ clause: '', requirement: '', whatToCheck: '', expectedEvidence: '' });
  }

  async function saveEditItem(itemId: string) {
    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/audit/checklist/${itemId}`, {
        method: 'PATCH',
        json: {
          clause: editDraft.clause,
          requirement: editDraft.requirement,
          whatToCheck: editDraft.whatToCheck,
          customFields: { ...items.find(i => i.id === itemId)?.customFields, expectedEvidence: editDraft.expectedEvidence },
        },
      });
      setEditingItemId(null);
      setEditDraft({ clause: '', requirement: '', whatToCheck: '', expectedEvidence: '' });
      await loadChecklist();
    } catch (err: any) {
      setError(err?.error || 'Error al guardar cambios');
    } finally {
      setSaving(false);
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
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 text-sm"
            >
              <Plus className="w-4 h-4" />
              Agregar item manual
            </button>
            <button
              onClick={() => setShowFilterModal(true)}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors border border-purple-200 text-sm"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiLoading ? 'Generando...' : 'Regenerar desde normas'}
            </button>
            {items.length > 0 && (
              <button
                onClick={deleteAllItems}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border border-red-200 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar todos
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <div className="flex-1">
                  {editingItemId === item.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-gray-500 w-20">Cláusula:</label>
                        <input
                          type="text"
                          value={editDraft.clause}
                          onChange={(e) => setEditDraft({ ...editDraft, clause: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">Requisito:</label>
                        <input
                          type="text"
                          value={editDraft.requirement}
                          onChange={(e) => setEditDraft({ ...editDraft, requirement: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">Verificar:</label>
                        <textarea
                          value={editDraft.whatToCheck}
                          onChange={(e) => setEditDraft({ ...editDraft, whatToCheck: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">Evidencia esperada:</label>
                        <input
                          type="text"
                          value={editDraft.expectedEvidence}
                          onChange={(e) => setEditDraft({ ...editDraft, expectedEvidence: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Ej: Mapa de procesos, Perfil de puesto..."
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {item.clause}
                        </span>
                      </div>
                      <p className="text-gray-900 font-medium mb-2">{item.requirement}</p>
                      <p className="text-sm text-gray-500 mb-2">
                        <span className="font-medium">Verificar:</span> {item.whatToCheck}
                      </p>
                      {item.customFields?.expectedEvidence && (
                        <div className="mt-1 mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-amber-900">
                            <span className="font-medium">Evidencia esperada:</span> {item.customFields.expectedEvidence}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                {editingItemId === item.id ? (
                  <>
                    <button
                      onClick={() => saveEditItem(item.id)}
                      disabled={saving}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Guardar cambios"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEditItem}
                      className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEditItem(item)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar item"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* AI Suggestion */}
            {item.aiSuggestion && (
              <div className="mt-2 mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-medium text-purple-700">IA: Por qué esta cláusula es relevante</span>
                </div>
                <p className="text-sm text-purple-900">{item.aiSuggestion}</p>
              </div>
            )}

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

      {/* Modal para agregar item manual */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Agregar Item Manual</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cláusula / Capítulo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newItem.clause}
                  onChange={(e) => {
                    setNewItem({ ...newItem, clause: e.target.value });
                    searchClauses(e.target.value);
                  }}
                  placeholder="Ej: 4.1, 5.2, Capítulo 3..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {suggestedClauses.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {suggestedClauses.map((clause) => (
                      <button
                        key={clause.id}
                        onClick={() => selectClause(clause)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-sm text-gray-900">{clause.clauseNumber}</div>
                        <div className="text-xs text-gray-600 truncate">{clause.title}</div>
                      </button>
                    ))}
                  </div>
                )}
                {searchingClause && (
                  <div className="absolute right-3 top-9">
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requisito / Título <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newItem.requirement}
                  onChange={(e) => setNewItem({ ...newItem, requirement: e.target.value })}
                  placeholder="Título del requisito a verificar"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Qué verificar (opcional)
                </label>
                <textarea
                  value={newItem.whatToCheck}
                  onChange={(e) => setNewItem({ ...newItem, whatToCheck: e.target.value })}
                  placeholder="Descripción detallada de qué verificar en la auditoría"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={addManualItem}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Agregando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Agregar al Checklist
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Selección de modo de generación */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Generar Checklist desde Normas</h3>
              <button onClick={() => setShowFilterModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Seleccioná cómo querés generar el checklist para <strong>{audit?.title || 'esta auditoría'}</strong>:
            </p>
            <div className="space-y-3">
              <button
                onClick={() => generateAiChecklist('relevant')}
                className="w-full text-left p-4 border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-gray-900">Cláusulas relevantes al proceso</div>
                    <div className="text-sm text-gray-500 mt-1">
                      La IA analiza el proceso/área auditada y selecciona solo las cláusulas relacionadas (ej: si es &quot;Compras&quot;, trae proveedores, selección, verificación).
                    </div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => generateAiChecklist('all')}
                className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-gray-900">Todas las cláusulas de la norma</div>
                    <div className="text-sm text-gray-500 mt-1">
                      Trae todas las cláusulas de la norma seleccionada sin filtrar. Útil para auditorías completas del sistema.
                    </div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => { setShowFilterModal(false); setShowManualModal(true); loadAvailableClauses(); }}
                className="w-full text-left p-4 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <ListChecks className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-gray-900">Selección manual de cláusulas</div>
                    <div className="text-sm text-gray-500 mt-1">
                      Elegí manualmente qué cláusulas incluir del listado de normas (ISO 9001, IATF 16949, etc.). La IA generará la evidencia esperada para cada una.
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Selección manual de cláusulas */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Selección manual de cláusulas</h3>
              <button onClick={() => setShowManualModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {loadingClauses ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-500">Cargando cláusulas...</span>
              </div>
            ) : availableClauses.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                No hay cláusulas disponibles. Asegurate de que las normas estén cargadas y procesadas.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 gap-2">
                  <p className="text-sm text-gray-600">
                    Seleccioná las cláusulas a incluir en el checklist:
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedClauses(new Set(availableClauses.map(c => c.clauseNumber)))}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Tildar todas
                    </button>
                    <button
                      onClick={() => setSelectedClauses(new Set())}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Destildar todas
                    </button>
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 border border-gray-200 rounded-lg">
                  {Object.entries(
                    availableClauses.reduce<Record<string, any[]>>((acc, c) => {
                      const key = c.standardCode || c.normativeCode || 'Norma';
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(c);
                      return acc;
                    }, {})
                  ).map(([standardCode, clauses]) => (
                    <div key={standardCode} className="mb-2">
                      <div className="sticky top-0 bg-gray-50 px-3 py-2 border-b border-gray-200 font-medium text-sm text-gray-700 z-10">
                        {standardCode} ({clauses.filter(c => selectedClauses.has(c.clauseNumber)).length}/{clauses.length})
                      </div>
                      {clauses.map((clause) => (
                        <label
                          key={clause.id || clause.clauseNumber}
                          className="flex items-start gap-3 px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100"
                        >
                          <input
                            type="checkbox"
                            checked={selectedClauses.has(clause.clauseNumber)}
                            onChange={() => {
                              const next = new Set(selectedClauses);
                              if (next.has(clause.clauseNumber)) {
                                next.delete(clause.clauseNumber);
                              } else {
                                next.add(clause.clauseNumber);
                              }
                              setSelectedClauses(next);
                            }}
                            className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                                {clause.clauseNumber}
                              </span>
                              <span className="text-sm text-gray-900 truncate">{clause.title}</span>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-gray-600">
                    {selectedClauses.size} cláusula(s) seleccionada(s)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowManualModal(false)}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => generateAiChecklist('manual', Array.from(selectedClauses))}
                      disabled={selectedClauses.size === 0 || aiLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {aiLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {aiLoading ? 'Generando...' : `Generar checklist (${selectedClauses.size})`}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
