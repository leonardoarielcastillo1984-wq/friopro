'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { Risk } from '@/lib/types';
import {
  ArrowLeft, Shield, Edit3, Trash2, AlertCircle, AlertTriangle,
  Target, TrendingDown, Calendar, User,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  IDENTIFIED: { label: 'Identificado', color: 'text-neutral-700', bg: 'bg-neutral-100 border-neutral-200' },
  ASSESSED: { label: 'Evaluado', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  MITIGATING: { label: 'Mitigando', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  MONITORED: { label: 'Monitoreado', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  CLOSED: { label: 'Cerrado', color: 'text-neutral-500', bg: 'bg-neutral-100 border-neutral-200' },
};

const PROB_LABELS = ['', 'Raro', 'Improbable', 'Posible', 'Probable', 'Casi seguro'];
const IMPACT_LABELS = ['', 'Insignificante', 'Menor', 'Moderado', 'Mayor', 'Catastrófico'];

function getRiskColor(level: number): string {
  if (level >= 20) return 'bg-red-600 text-white';
  if (level >= 12) return 'bg-orange-500 text-white';
  if (level >= 5) return 'bg-amber-400 text-neutral-900';
  return 'bg-green-400 text-neutral-900';
}

function getRiskLabel(level: number): string {
  if (level >= 20) return 'Crítico';
  if (level >= 12) return 'Alto';
  if (level >= 5) return 'Medio';
  return 'Bajo';
}

type RiskDetail = Risk & {
  treatmentPlan?: string | null;
  controls?: string | null;
  residualProb?: number | null;
  residualImpact?: number | null;
  owner?: { id: string; email: string } | null;
  createdBy?: { id: string; email: string } | null;
};

export default function RiskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [risk, setRisk] = useState<RiskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const CATEGORIES = ['Operacional', 'Legal', 'Ambiental', 'Seguridad Vial', 'Calidad', 'Financiero', 'Tecnológico', 'Otro'];

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: 'Operacional',
    standard: '',
    status: '',
    probability: 3,
    impact: 3,
    treatmentPlan: '',
    controls: '',
    residualProb: 1,
    residualImpact: 1,
  });

  useEffect(() => { loadRisk(); }, [id]);

  async function loadRisk() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ risk: RiskDetail }>(`/risks/${id}`);
      setRisk(res.risk);
      setEditForm({
        title: res.risk.title,
        description: res.risk.description,
        category: res.risk.category,
        standard: res.risk.standard || '',
        status: res.risk.status,
        probability: res.risk.probability,
        impact: res.risk.impact,
        treatmentPlan: res.risk.treatmentPlan || '',
        controls: res.risk.controls || '',
        residualProb: res.risk.residualProb || 1,
        residualImpact: res.risk.residualImpact || 1,
      });
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar riesgo');
      if (err?.message === 'Unauthorized') router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ risk: RiskDetail }>(`/risks/${id}`, {
        method: 'PATCH',
        json: editForm,
      });
      setRisk(res.risk);
      setEditing(false);
    } catch (err: any) {
      setError(err?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Estás seguro de eliminar este riesgo?')) return;
    try {
      await apiFetch(`/risks/${id}`, { method: 'DELETE' });
      router.push('/riesgos');
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

  if (!risk) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || 'Riesgo no encontrado'}</p>
        <button onClick={() => router.push('/riesgos')} className="mt-2 text-blue-600 text-sm hover:underline">
          ← Volver a riesgos
        </button>
      </div>
    );
  }

  const stCfg = STATUS_CONFIG[risk.status] ?? STATUS_CONFIG.IDENTIFIED;

  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/riesgos')} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Riesgos
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
          <div className={`rounded-lg p-3 ${getRiskColor(risk.riskLevel)}`}>
            <span className="text-lg font-bold">{risk.riskLevel}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">{risk.code}</span>
              <span className={`rounded-lg px-2.5 py-0.5 text-xs font-bold ${getRiskColor(risk.riskLevel)}`}>{getRiskLabel(risk.riskLevel)}</span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${stCfg.bg} ${stCfg.color}`}>{stCfg.label}</span>
              <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">{risk.category}</span>
            </div>
            <h1 className="mt-2 text-xl font-semibold text-neutral-900">{risk.title}</h1>
            <p className="mt-1 text-sm text-neutral-600">{risk.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-400">
              {risk.standard && <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> {risk.standard}</span>}
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(risk.createdAt).toLocaleDateString('es-AR')}</span>
              {risk.owner && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {risk.owner.email}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Risk Assessment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inherent Risk */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h2 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" /> Riesgo Inherente
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">Probabilidad</span>
              <span className="font-medium text-sm">{risk.probability} — {PROB_LABELS[risk.probability]}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">Impacto</span>
              <span className="font-medium text-sm">{risk.impact} — {IMPACT_LABELS[risk.impact]}</span>
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="text-sm font-medium text-neutral-700">Nivel</span>
              <span className={`rounded-lg px-3 py-1 text-sm font-bold ${getRiskColor(risk.riskLevel)}`}>
                {risk.riskLevel} — {getRiskLabel(risk.riskLevel)}
              </span>
            </div>
          </div>
        </div>

        {/* Residual Risk */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h2 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-green-500" /> Riesgo Residual
          </h2>
          {risk.residualLevel ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-600">Probabilidad</span>
                <span className="font-medium text-sm">{risk.residualProb ?? '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-600">Impacto</span>
                <span className="font-medium text-sm">{risk.residualImpact ?? '-'}</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-sm font-medium text-neutral-700">Nivel</span>
                <span className={`rounded-lg px-3 py-1 text-sm font-bold ${getRiskColor(risk.residualLevel)}`}>
                  {risk.residualLevel} — {getRiskLabel(risk.residualLevel)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-400 italic">Sin evaluación residual — completá el plan de tratamiento</p>
          )}
        </div>
      </div>

      {/* Edit or Details */}
      {editing ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
          <h2 className="font-semibold text-neutral-900">Editar Riesgo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Título</label>
              <input
                type="text"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-500 outline-none"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Descripción</label>
              <textarea
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-500 outline-none"
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Categoría</label>
              <select
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Estado</label>
              <select className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Norma relacionada</label>
              <input
                type="text"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-500 outline-none"
                value={editForm.standard}
                onChange={(e) => setEditForm({ ...editForm, standard: e.target.value })}
                placeholder="Ej: ISO 39001, ISO 9001"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Probabilidad</label>
                <input type="number" min={1} max={5} className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" value={editForm.probability} onChange={(e) => setEditForm({ ...editForm, probability: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Impacto</label>
                <input type="number" min={1} max={5} className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" value={editForm.impact} onChange={(e) => setEditForm({ ...editForm, impact: Number(e.target.value) })} />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Plan de tratamiento</label>
            <textarea className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-500 outline-none" rows={3} value={editForm.treatmentPlan} onChange={(e) => setEditForm({ ...editForm, treatmentPlan: e.target.value })} placeholder="Acciones para mitigar el riesgo..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Controles existentes</label>
            <textarea className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-500 outline-none" rows={2} value={editForm.controls} onChange={(e) => setEditForm({ ...editForm, controls: e.target.value })} placeholder="Controles implementados..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Prob. residual</label>
              <input type="number" min={1} max={5} className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" value={editForm.residualProb} onChange={(e) => setEditForm({ ...editForm, residualProb: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Impacto residual</label>
              <input type="number" min={1} max={5} className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" value={editForm.residualImpact} onChange={(e) => setEditForm({ ...editForm, residualImpact: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button onClick={() => setEditing(false)} className="text-sm text-neutral-500 hover:text-neutral-700 px-3">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-brand-500" /> Plan de tratamiento
            </h2>
            {risk.treatmentPlan ? (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{risk.treatmentPlan}</p>
            ) : (
              <p className="text-sm text-neutral-400 italic">Sin plan de tratamiento registrado</p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-500" /> Controles existentes
            </h2>
            {risk.controls ? (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{risk.controls}</p>
            ) : (
              <p className="text-sm text-neutral-400 italic">Sin controles registrados</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
