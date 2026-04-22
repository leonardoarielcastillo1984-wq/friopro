'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { NonConformity, NCRSeverity } from '@/lib/types';
import {
  ArrowLeft, AlertTriangle, Edit3, Trash2, AlertCircle,
  CheckCircle2, Clock, User, Calendar, Shield, Sparkles, Loader2,
} from 'lucide-react';

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CRITICAL: { label: 'Crítica', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  MAJOR: { label: 'Mayor', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  MINOR: { label: 'Menor', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  OBSERVATION: { label: 'Observación', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  OPEN: { label: 'Abierta', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  IN_ANALYSIS: { label: 'En análisis', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  ACTION_PLANNED: { label: 'Acción planificada', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  IN_PROGRESS: { label: 'En progreso', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  VERIFICATION: { label: 'Verificación', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200' },
  CLOSED: { label: 'Cerrada', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  CANCELLED: { label: 'Cancelada', color: 'text-neutral-500', bg: 'bg-neutral-100 border-neutral-200' },
};

const STATUS_FLOW = ['OPEN', 'IN_ANALYSIS', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION', 'CLOSED'];

type NCRDetail = NonConformity & {
  rootCause?: string | null;
  correctiveAction?: string | null;
  preventiveAction?: string | null;
  verificationNotes?: string | null;
  isEffective?: boolean | null;
  verificationDate?: string | null;
  closedAt?: string | null;
  dueDate?: string | null;
  createdBy?: { id: string; email: string } | null;
};

export default function NCRDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [ncr, setNcr] = useState<NCRDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  async function runAi(field: string, prompt: string) {
    setAiLoading(field);
    try {
      const res = await apiFetch<{ response?: string; text?: string }>('/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      });
      const text = res?.response || res?.text || '';
      if (text) setEditForm(prev => ({ ...prev, [field]: text }));
    } catch (e: any) {
      alert('Error IA: ' + (e?.message || 'desconocido'));
    } finally {
      setAiLoading(null);
    }
  }

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    status: '',
    severity: '' as NCRSeverity,
    rootCause: '',
    correctiveAction: '',
    preventiveAction: '',
    verificationNotes: '',
    isEffective: null as boolean | null,
  });

  const [aiSuggestion, setAiSuggestion] = useState<{
    show: boolean;
    shouldCreateRisk: boolean;
    reasoning: string;
    suggestedProbability: number;
    suggestedImpact: number;
    similarNCRCount: number;
  } | null>(null);

  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => { loadNCR(); }, [id]);

  async function loadNCR() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ ncr: NCRDetail }>(`/ncr/${id}`);
      setNcr(res.ncr);
      setEditForm({
        status: res.ncr.status,
        severity: res.ncr.severity,
        rootCause: res.ncr.rootCause || '',
        correctiveAction: res.ncr.correctiveAction || '',
        preventiveAction: res.ncr.preventiveAction || '',
        verificationNotes: res.ncr.verificationNotes || '',
        isEffective: res.ncr.isEffective ?? null,
      });

      // Si es NCR grave, analizar con IA para sugerir riesgo
      if (res.ncr.severity === 'MAJOR' || res.ncr.severity === 'CRITICAL') {
        void analyzeWithAI(res.ncr.id);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar NCR');
      if (err?.message === 'Unauthorized') router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function analyzeWithAI(ncrId: string) {
    setAnalyzing(true);
    try {
      console.log('[AI] Analyzing NCR:', ncrId);
      const result = await apiFetch<{
        shouldCreateRisk: boolean;
        reasoning: string;
        suggestedProbability: number;
        suggestedImpact: number;
        similarNCRCount: number;
      }>(`/intelligence/ncr-suggestion/${ncrId}`);

      console.log('[AI] Result:', result);

      if (result.shouldCreateRisk) {
        setAiSuggestion({
          show: true,
          ...result,
        });
      } else {
        console.log('[AI] No risk suggested');
      }
    } catch (err) {
      // Silenciar errores de IA, no es crítico
      console.error('[AI] Analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  }

  async function createRiskFromNCR() {
    if (!aiSuggestion || !id) return;
    
    setAnalyzing(true);
    try {
      const result = await apiFetch<{
        success: boolean;
        risk?: { id: string; code: string };
        autoCreated: boolean;
      }>(`/intelligence/analyze-ncr/${id}`, {
        method: 'POST',
      });

      if (result.success && result.risk) {
        setAiSuggestion(null);
        // Redirigir al riesgo creado
        router.push(`/riesgos/${result.risk.id}`);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error al crear riesgo');
    } finally {
      setAnalyzing(false);
    }
  }

  async function dismissAISuggestion() {
    setAiSuggestion(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ ncr: NCRDetail }>(`/ncr/${id}`, {
        method: 'PATCH',
        json: editForm,
      });
      setNcr(res.ncr);
      setEditing(false);
    } catch (err: any) {
      setError(err?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Estás seguro de eliminar esta NCR?')) return;
    try {
      await apiFetch(`/ncr/${id}`, { method: 'DELETE' });
      router.push('/no-conformidades');
    } catch (err: any) {
      setError(err?.message ?? 'Error al eliminar');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (!ncr) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || 'NCR no encontrada'}</p>
        <button onClick={() => router.push('/no-conformidades')} className="mt-2 text-blue-600 text-sm hover:underline">
          ← Volver a NCRs
        </button>
      </div>
    );
  }

  const sevCfg = SEVERITY_CONFIG[ncr.severity] ?? SEVERITY_CONFIG.MAJOR;
  const stCfg = STATUS_CONFIG[ncr.status] ?? STATUS_CONFIG.OPEN;
  const currentStep = STATUS_FLOW.indexOf(ncr.status);

  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/no-conformidades')} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors">
          <ArrowLeft className="h-4 w-4" /> No Conformidades
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(!editing)} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
            <Edit3 className="h-4 w-4" /> {editing ? 'Cancelar' : 'Editar'}
          </button>
          <button onClick={handleDelete} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> Eliminar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-start gap-4">
          <div className={`rounded-lg p-3 ${ncr.severity === 'CRITICAL' ? 'bg-red-100' : ncr.severity === 'MAJOR' ? 'bg-orange-100' : 'bg-amber-100'}`}>
            <AlertTriangle className={`h-6 w-6 ${ncr.severity === 'CRITICAL' ? 'text-red-600' : ncr.severity === 'MAJOR' ? 'text-orange-600' : 'text-amber-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">{ncr.code}</span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${sevCfg.bg} ${sevCfg.color}`}>{sevCfg.label}</span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${stCfg.bg} ${stCfg.color}`}>{stCfg.label}</span>
            </div>
            <h1 className="mt-2 text-xl font-semibold text-neutral-900">{ncr.title}</h1>
            <p className="mt-1 text-sm text-neutral-600">{ncr.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-400">
              {ncr.standard && (
                <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> {ncr.standard} {ncr.clause && `§${ncr.clause}`}</span>
              )}
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(ncr.createdAt).toLocaleDateString('es-AR')}</span>
              {ncr.assignedTo && (
                <span className="flex items-center gap-1"><User className="h-3 w-3" /> {ncr.assignedTo.email}</span>
              )}
              {ncr.dueDate && (
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Vence: {new Date(ncr.dueDate).toLocaleDateString('es-AR')}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {analyzing && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
          Analizando con IA...
        </div>
      )}

      {aiSuggestion?.show && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="bg-amber-100 rounded-full p-2">
              <span className="text-lg">🤖</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900">
                IA detectó posible riesgo sistémico
              </h3>
              <p className="text-sm text-amber-800 mt-1">
                {aiSuggestion.reasoning}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-amber-700">
                <span className="bg-amber-100 px-2 py-1 rounded">
                  Probabilidad sugerida: {aiSuggestion.suggestedProbability}/5
                </span>
                <span className="bg-amber-100 px-2 py-1 rounded">
                  Impacto sugerido: {aiSuggestion.suggestedImpact}/5
                </span>
                {aiSuggestion.similarNCRCount > 0 && (
                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded">
                    {aiSuggestion.similarNCRCount} NCRs similares en este proceso
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-amber-200">
            <button
              onClick={createRiskFromNCR}
              disabled={analyzing}
              className="flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {analyzing ? 'Creando...' : 'Crear Riesgo'}
            </button>
            <button
              onClick={dismissAISuggestion}
              className="text-amber-700 text-sm px-3 py-2 hover:bg-amber-100 rounded-lg"
            >
              Ignorar
            </button>
          </div>
        </div>
      )}

      {/* Status Flow */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4">Progreso</h2>
        <div className="flex items-center gap-1">
          {STATUS_FLOW.map((step, i) => {
            const isActive = i <= currentStep;
            const isCurrent = step === ncr.status;
            const cfg = STATUS_CONFIG[step];
            return (
              <div key={step} className="flex-1">
                <div className={`h-2 rounded-full ${isActive ? 'bg-brand-500' : 'bg-neutral-200'} ${isCurrent ? 'ring-2 ring-brand-300' : ''}`} />
                <span className={`mt-1 block text-[10px] text-center ${isCurrent ? 'font-semibold text-brand-700' : 'text-neutral-400'}`}>
                  {cfg?.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit or Details */}
      {editing ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
          <h2 className="font-semibold text-neutral-900">Editar NCR</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Estado</label>
              <select
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Severidad</label>
              <select
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
                value={editForm.severity}
                onChange={(e) => setEditForm({ ...editForm, severity: e.target.value as NCRSeverity })}
              >
                {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-neutral-700">Análisis de causa raíz</label>
              <button type="button" onClick={() => runAi('rootCause',
                `Eres un auditor ISO experto en análisis de causa raíz. Para esta No Conformidad:\nTítulo: ${ncr?.title || '—'}\nDescripción: ${ncr?.description || '—'}\nSeveridad: ${ncr?.severity || '—'}\nOrigen: ${ncr?.source || '—'}\n\nRealizá un análisis de causa raíz usando el método de los 5 Porqués. Identificá la causa raíz sistémica, no solo el síntoma. Sé específico y conciso.`)}
                disabled={aiLoading === 'rootCause'}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-white border border-purple-200 text-purple-600 rounded hover:bg-purple-50 disabled:opacity-50">
                {aiLoading === 'rootCause' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Sugerir causa raíz
              </button>
            </div>
            <textarea
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-500 outline-none"
              rows={3}
              value={editForm.rootCause}
              onChange={(e) => setEditForm({ ...editForm, rootCause: e.target.value })}
              placeholder="Describí la causa raíz identificada..."
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-neutral-700">Acción correctiva</label>
              <button type="button" onClick={() => runAi('correctiveAction',
                `Eres un consultor ISO. Para esta No Conformidad:\nTítulo: ${ncr?.title || '—'}\nDescripción: ${ncr?.description || '—'}\nCausa raíz: ${editForm.rootCause || '(sin analizar aún)'}\n\nSugerí 3 acciones correctivas concretas, medibles y con responsable sugerido para eliminar la causa raíz y que no se repita. Formato numerado.`)}
                disabled={aiLoading === 'correctiveAction'}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-white border border-purple-200 text-purple-600 rounded hover:bg-purple-50 disabled:opacity-50">
                {aiLoading === 'correctiveAction' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Sugerir acción correctiva
              </button>
            </div>
            <textarea
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-500 outline-none"
              rows={3}
              value={editForm.correctiveAction}
              onChange={(e) => setEditForm({ ...editForm, correctiveAction: e.target.value })}
              placeholder="Describí las acciones correctivas planificadas..."
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-neutral-700">Acción preventiva</label>
              <button type="button" onClick={() => runAi('preventiveAction',
                `Eres un consultor ISO experto en mejora continua. Para esta No Conformidad:\nTítulo: ${ncr?.title || '—'}\nCausa raíz: ${editForm.rootCause || '—'}\nAcción correctiva: ${editForm.correctiveAction || '—'}\n\nSugerí acciones preventivas sistémicas para evitar que esta situación o una similar ocurra en el futuro. Pensá en controles, procedimientos, capacitación. Formato numerado.`)}
                disabled={aiLoading === 'preventiveAction'}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-white border border-purple-200 text-purple-600 rounded hover:bg-purple-50 disabled:opacity-50">
                {aiLoading === 'preventiveAction' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Sugerir acción preventiva
              </button>
            </div>
            <textarea
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-500 outline-none"
              rows={3}
              value={editForm.preventiveAction}
              onChange={(e) => setEditForm({ ...editForm, preventiveAction: e.target.value })}
              placeholder="Describí las acciones preventivas para evitar recurrencia..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Notas de verificación</label>
            <textarea
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-500 outline-none"
              rows={2}
              value={editForm.verificationNotes}
              onChange={(e) => setEditForm({ ...editForm, verificationNotes: e.target.value })}
              placeholder="Resultado de la verificación de eficacia..."
            />
          </div>
          {editForm.status === 'VERIFICATION' || editForm.status === 'CLOSED' ? (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">¿Fue efectiva la acción?</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="isEffective"
                    checked={editForm.isEffective === true}
                    onChange={() => setEditForm({ ...editForm, isEffective: true })}
                    className="text-brand-600"
                  />
                  <span className="text-sm">Sí, fue eficaz</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="isEffective"
                    checked={editForm.isEffective === false}
                    onChange={() => setEditForm({ ...editForm, isEffective: false })}
                    className="text-brand-600"
                  />
                  <span className="text-sm">No fue eficaz</span>
                </label>
              </div>
            </div>
          ) : null}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button onClick={() => setEditing(false)} className="text-sm text-neutral-500 hover:text-neutral-700 px-3">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="font-semibold text-neutral-900 mb-3">Análisis de causa raíz</h2>
            {ncr.rootCause ? (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{ncr.rootCause}</p>
            ) : (
              <p className="text-sm text-neutral-400 italic">Sin análisis registrado</p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="font-semibold text-neutral-900 mb-3">Acción preventiva</h2>
            {ncr.preventiveAction ? (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{ncr.preventiveAction}</p>
            ) : (
              <p className="text-sm text-neutral-400 italic">Sin acción preventiva registrada</p>
            )}
          </div>
          {(ncr.status === 'VERIFICATION' || ncr.status === 'CLOSED') && (
            <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 p-6">
              <h2 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> Verificación
              </h2>
              <div className="flex items-center gap-4 text-sm">
                {ncr.isEffective !== null && ncr.isEffective !== undefined && (
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${ncr.isEffective ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {ncr.isEffective ? 'Eficaz' : 'No eficaz'}
                  </span>
                )}
                {ncr.verificationDate && (
                  <span className="text-neutral-500">Fecha: {new Date(ncr.verificationDate).toLocaleDateString('es-AR')}</span>
                )}
              </div>
              {ncr.verificationNotes && (
                <p className="mt-2 text-sm text-neutral-700 whitespace-pre-wrap">{ncr.verificationNotes}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
