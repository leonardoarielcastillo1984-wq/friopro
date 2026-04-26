'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  HardHat, AlertTriangle, ShieldAlert, CheckCircle2, Clock,
  ChevronLeft, Plus, X, Loader2, Search, BrainCircuit, FileWarning,
  TrendingDown, ShieldCheck, AlertOctagon, Wrench, Eye, Ban
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// Types
interface RiskAction {
  id: string;
  description: string;
  responsibleId: string | null;
  dueDate: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  effectiveness: 'EFFECTIVE' | 'NOT_EFFECTIVE' | 'PENDING';
  evidence: string | null;
  createdAt: string;
}

interface RiskReview {
  id: string;
  reviewDate: string;
  result: string;
  comments: string | null;
  reviewedById: string | null;
}

interface Hazard {
  id: string;
  code: string;
  area: string;
  activity: string;
  hazard: string;
  risk: string;
  probability: number;
  severity: number;
  exposure: number;
  riskLevel: number;
  riskCategory: string;
  elimination: string | null;
  substitution: string | null;
  engineering: string | null;
  administrative: string | null;
  ppe: string | null;
  residualRiskLevel: number | null;
  residualRiskCategory: string | null;
  responsibleId: string | null;
  reviewDate: string | null;
  status: 'OPEN' | 'IN_TREATMENT' | 'CONTROLLED' | 'CLOSED';
  reviewFrequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  eliminationImplemented: boolean | null;
  substitutionImplemented: boolean | null;
  engineeringImplemented: boolean | null;
  administrativeImplemented: boolean | null;
  ppeImplemented: boolean | null;
  eliminationEffective: boolean | null;
  substitutionEffective: boolean | null;
  engineeringEffective: boolean | null;
  administrativeEffective: boolean | null;
  ppeEffective: boolean | null;
  eliminationObservation: string | null;
  substitutionObservation: string | null;
  engineeringObservation: string | null;
  administrativeObservation: string | null;
  ppeObservation: string | null;
  actions: RiskAction[];
  reviews: RiskReview[];
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Abierto', IN_TREATMENT: 'En tratamiento', CONTROLLED: 'Controlado', CLOSED: 'Cerrado',
};
const STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700 border-red-200',
  IN_TREATMENT: 'bg-amber-100 text-amber-700 border-amber-200',
  CONTROLLED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-700 border-slate-200',
};
const CATEGORY_LABEL: Record<string, string> = {
  TOLERABLE: 'Tolerable', MODERATE: 'Moderado', SUBSTANTIAL: 'Sustancial', INTOLERABLE: 'Intolerable',
};
const CAT_BG: Record<string, string> = {
  TOLERABLE: 'bg-green-50 text-green-700 border-green-200',
  MODERATE: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  SUBSTANTIAL: 'bg-orange-50 text-orange-700 border-orange-200',
  INTOLERABLE: 'bg-red-50 text-red-700 border-red-200',
};

function formatDate(d?: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('es-AR');
}

function calcRiskLevel(p: number, s: number, e: number) {
  return p * s * e;
}
function getRiskCategory(level: number) {
  if (level <= 4) return 'TOLERABLE';
  if (level <= 9) return 'MODERATE';
  if (level <= 15) return 'SUBSTANTIAL';
  return 'INTOLERABLE';
}

export default function IPERCPage() {
  const [items, setItems] = useState<Hazard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Hazard | null>(null);
  const [alerts, setAlerts] = useState<{ hazardId: string; flags: string[] }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string>('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; firstName: string; lastName: string; email: string }[]>([]);

  const [form, setForm] = useState<Partial<Hazard>>({
    probability: 3, severity: 3, exposure: 1, riskLevel: 9, riskCategory: 'MODERATE',
    status: 'OPEN', reviewFrequency: 'ANNUAL',
    eliminationImplemented: false, substitutionImplemented: false,
    engineeringImplemented: false, administrativeImplemented: false, ppeImplemented: false,
  });

  const [actionForm, setActionForm] = useState<Partial<RiskAction>>({ status: 'PENDING', effectiveness: 'PENDING' });
  const [reviewForm, setReviewForm] = useState<Partial<RiskReview>>({ result: 'CONTROLLED' });

  useEffect(() => {
    loadItems();
    loadAlerts();
    loadEmployees();
  }, []);

  async function loadItems() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (catFilter) params.set('riskCategory', catFilter);
      const data = await apiFetch<{ items: Hazard[] }>(`/hazards?${params.toString()}`);
      setItems(data?.items ?? []);
    } finally { setLoading(false); }
  }
  async function loadAlerts() {
    try {
      const data = await apiFetch<{ alerts: { hazardId: string; flags: string[] }[] }>(`/hazards/alerts/summary`);
      setAlerts(data?.alerts ?? []);
    } catch {}
  }
  async function loadEmployees() {
    try {
      const data = await apiFetch<{ employees: any[] }>(`/hr/employees`);
      setEmployees(data?.employees ?? []);
    } catch {}
  }
  useEffect(() => { loadItems(); }, [statusFilter, catFilter]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter(i =>
      i.code.toLowerCase().includes(s) ||
      i.area.toLowerCase().includes(s) ||
      i.activity.toLowerCase().includes(s) ||
      i.hazard.toLowerCase().includes(s)
    );
  }, [items, search]);

  const alertMap = useMemo(() => {
    const m = new Map<string, string[]>();
    alerts.forEach(a => m.set(a.hazardId, a.flags));
    return m;
  }, [alerts]);

  function getFlags(h: Hazard) {
    const flags: string[] = [];
    if ((h.riskLevel >= 12 || h.riskCategory === 'INTOLERABLE' || h.riskCategory === 'SUBSTANTIAL') && (!h.actions || h.actions.length === 0)) flags.push('high-no-actions');
    const overdue = h.actions?.filter(a => a.dueDate && new Date(a.dueDate) < new Date() && a.status !== 'COMPLETED');
    if (overdue && overdue.length > 0) flags.push('overdue-action');
    if (!h.reviews || h.reviews.length === 0) flags.push('no-review');
    const controls = [h.eliminationImplemented, h.substitutionImplemented, h.engineeringImplemented, h.administrativeImplemented, h.ppeImplemented];
    if (controls.some(c => c === false)) flags.push('control-not-implemented');
    const effs = [h.eliminationEffective, h.substitutionEffective, h.engineeringEffective, h.administrativeEffective, h.ppeEffective];
    if (effs.some(e => e === false)) flags.push('control-not-effective');
    if (h.reviewDate && new Date(h.reviewDate) < new Date()) flags.push('review-overdue');
    return flags;
  }

  function openCreate() {
    setForm({
      probability: 3, severity: 3, exposure: 1, riskLevel: 9, riskCategory: 'MODERATE',
      status: 'OPEN', reviewFrequency: 'ANNUAL',
      eliminationImplemented: false, substitutionImplemented: false,
      engineeringImplemented: false, administrativeImplemented: false, ppeImplemented: false,
    });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(item: Hazard) {
    setForm({ ...item });
    setEditingId(item.id);
    setShowForm(true);
  }

  function openDetail(item: Hazard) {
    setDetail(item);
    setShowForm(false);
  }

  function updateForm(key: keyof Hazard, value: any) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if ((key === 'probability' || key === 'severity' || key === 'exposure') &&
          (next.probability !== undefined && next.severity !== undefined)) {
        const rl = calcRiskLevel(Number(next.probability || 1), Number(next.severity || 1), Number(next.exposure || 1));
        next.riskLevel = rl;
        next.riskCategory = getRiskCategory(rl);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = { ...form };
      if (editingId) {
        await apiFetch(`/hazards/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/hazards', { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowForm(false);
      setEditingId(null);
      await loadItems();
      await loadAlerts();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este peligro?')) return;
    await apiFetch(`/hazards/${id}`, { method: 'DELETE' });
    await loadItems();
    await loadAlerts();
  }

  async function handleAiAnalyze(item: Hazard) {
    setAiLoading(true);
    setAiResult('');
    setShowAiModal(true);
    try {
      const res = await apiFetch<{ analysis: string }>(`/hazards/${item.id}/ai-analyze`, { method: 'POST' });
      setAiResult(res?.analysis || 'Sin respuesta');
    } catch (e: any) {
      setAiResult(`Error: ${e?.message || 'IA no disponible'}`);
    } finally { setAiLoading(false); }
  }

  async function handleAutoNc(item: Hazard) {
    try {
      const res = await apiFetch<{ created: boolean; reason?: string; ncr?: any }>(`/hazards/${item.id}/auto-nc`, { method: 'POST' });
      if (res?.created) {
        alert(`NC creada: ${res.ncr?.code || res.ncr?.id}`);
        openDetail({ ...item, nonConformities: [...(item as any).nonConformities || [], res.ncr] } as Hazard);
      } else {
        alert(`No se creó NC: ${res?.reason || ''}`);
      }
    } catch (e: any) {
      alert('Error al crear NC: ' + (e?.message || ''));
    }
  }

  async function saveAction() {
    if (!detail) return;
    if (!actionForm.description) { alert('Descripción requerida'); return; }
    await apiFetch(`/hazards/${detail.id}/actions`, { method: 'POST', body: JSON.stringify(actionForm) });
    setActionForm({ status: 'PENDING', effectiveness: 'PENDING' });
    const updated = await apiFetch<{ item: Hazard }>(`/hazards/${detail.id}`);
    if (updated?.item) { setDetail(updated.item); await loadItems(); await loadAlerts(); }
  }

  async function saveReview() {
    if (!detail) return;
    if (!reviewForm.result) { alert('Resultado requerido'); return; }
    await apiFetch(`/hazards/${detail.id}/reviews`, { method: 'POST', body: JSON.stringify(reviewForm) });
    setReviewForm({ result: 'CONTROLLED' });
    const updated = await apiFetch<{ item: Hazard }>(`/hazards/${detail.id}`);
    if (updated?.item) { setDetail(updated.item); await loadItems(); await loadAlerts(); }
  }

  // Renders
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded-lg"><HardHat className="w-6 h-6 text-amber-600" /></div>
          <div>
            <h1 className="text-xl font-semibold text-neutral-800">IPERC — Peligros SST</h1>
            <p className="text-sm text-neutral-500">Identificación, evaluación y gestión de riesgos (ISO 45001)</p>
          </div>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nuevo riesgo
        </button>
      </div>

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Alertas activas: {alerts.length} riesgo(s) requieren atención</p>
            <p className="text-red-600/80">Revisa controles no implementados, acciones vencidas o revisiones pendientes.</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-neutral-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border rounded-lg px-3 py-2">
          <option value="">Todos los estados</option>
          <option value="OPEN">Abierto</option>
          <option value="IN_TREATMENT">En tratamiento</option>
          <option value="CONTROLLED">Controlado</option>
          <option value="CLOSED">Cerrado</option>
        </select>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="text-sm border rounded-lg px-3 py-2">
          <option value="">Todas las categorías</option>
          <option value="TOLERABLE">Tolerable</option>
          <option value="MODERATE">Moderado</option>
          <option value="SUBSTANTIAL">Sustancial</option>
          <option value="INTOLERABLE">Intolerable</option>
        </select>
      </div>

      {/* List or Detail */}
      {detail ? (
        <DetailView
          item={detail}
          alerts={alertMap.get(detail.id) || []}
          onBack={() => setDetail(null)}
          onEdit={() => openEdit(detail)}
          onAi={() => handleAiAnalyze(detail)}
          onAutoNc={() => handleAutoNc(detail)}
          onOpenActions={() => { setShowActionsModal(true); setShowReviewsModal(false); }}
          onOpenReviews={() => { setShowReviewsModal(true); setShowActionsModal(false); }}
          employees={employees}
        />
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-neutral-500"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">Sin registros</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Código</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Área / Actividad</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Peligro</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Estado</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Categoría</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Nivel</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const flags = getFlags(item);
                  return (
                    <tr key={item.id} className="border-b hover:bg-neutral-50 cursor-pointer" onClick={() => openDetail(item)}>
                      <td className="px-4 py-3 font-mono text-neutral-600">{item.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-800">{item.area}</div>
                        <div className="text-neutral-500 text-xs">{item.activity}</div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700 max-w-[200px] truncate" title={item.hazard}>{item.hazard}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${STATUS_COLOR[item.status] || 'bg-slate-100 text-slate-700'}`}>
                          {item.status === 'OPEN' && <AlertOctagon className="w-3 h-3" />}
                          {item.status === 'CONTROLLED' && <CheckCircle2 className="w-3 h-3" />}
                          {item.status === 'IN_TREATMENT' && <Clock className="w-3 h-3" />}
                          {item.status === 'CLOSED' && <Ban className="w-3 h-3" />}
                          {STATUS_LABEL[item.status] || item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${CAT_BG[item.riskCategory] || 'bg-slate-50'}`}>
                          {CATEGORY_LABEL[item.riskCategory] || item.riskCategory}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-neutral-700">{item.riskLevel}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={e => { e.stopPropagation(); openDetail(item); }} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-600" title="Ver"><Eye className="w-4 h-4" /></button>
                          <button onClick={e => { e.stopPropagation(); openEdit(item); }} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="Editar"><Wrench className="w-4 h-4" /></button>
                          <button onClick={e => { e.stopPropagation(); handleDelete(item.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Eliminar"><X className="w-4 h-4" /></button>
                          {flags.length > 0 && <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold" title={flags.join(', ')}>{flags.length}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <FormModal
          form={form}
          editing={!!editingId}
          onChange={updateForm}
          onClose={() => { setShowForm(false); setEditingId(null); }}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* Actions Modal */}
      {showActionsModal && detail && (
        <ActionsModal
          item={detail}
          actionForm={actionForm}
          onChange={(k, v) => setActionForm(p => ({ ...p, [k]: v }))}
          onSave={saveAction}
          onClose={() => setShowActionsModal(false)}
          employees={employees}
        />
      )}

      {/* Reviews Modal */}
      {showReviewsModal && detail && (
        <ReviewsModal
          item={detail}
          reviewForm={reviewForm}
          onChange={(k, v) => setReviewForm(p => ({ ...p, [k]: v }))}
          onSave={saveReview}
          onClose={() => setShowReviewsModal(false)}
        />
      )}

      {/* AI Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-violet-600" /> Análisis IA</h3>
              <button onClick={() => setShowAiModal(false)} className="p-1 hover:bg-neutral-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            {aiLoading ? (
              <div className="py-8 text-center text-neutral-500"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Analizando riesgo...</div>
            ) : (
              <div className="text-sm whitespace-pre-wrap text-neutral-700">{aiResult}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailView({ item, alerts, onBack, onEdit, onAi, onAutoNc, onOpenActions, onOpenReviews, employees }: {
  item: Hazard; alerts: string[]; onBack: () => void; onEdit: () => void; onAi: () => void; onAutoNc: () => void;
  onOpenActions: () => void; onOpenReviews: () => void; employees: any[];
}) {
  const riskReduction = item.residualRiskLevel != null && item.riskLevel > 0
    ? Math.max(0, Math.round(((item.riskLevel - item.residualRiskLevel) / item.riskLevel) * 100))
    : 0;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900">
        <ChevronLeft className="w-4 h-4" /> Volver al listado
      </button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded-lg"><HardHat className="w-5 h-5 text-amber-600" /></div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-800">{item.code}</h2>
            <p className="text-sm text-neutral-500">{item.area} — {item.activity}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onAi} className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-neutral-50 text-violet-700 border-violet-200">
            <BrainCircuit className="w-4 h-4" /> Analizar con IA
          </button>
          <button onClick={onAutoNc} className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-red-50 text-red-700 border-red-200">
            <FileWarning className="w-4 h-4" /> Crear NC
          </button>
          <button onClick={onEdit} className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Wrench className="w-4 h-4" /> Editar
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm space-y-1">
          <div className="font-medium flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Alertas</div>
          <ul className="list-disc list-inside">
            {alerts.includes('high-no-actions') && <li>Riesgo alto sin acciones asociadas</li>}
            {alerts.includes('overdue-action') && <li>Acción(es) vencida(s)</li>}
            {alerts.includes('no-review') && <li>Sin revisiones registradas</li>}
            {alerts.includes('control-not-implemented') && <li>Controles no implementados</li>}
            {alerts.includes('control-not-effective') && <li>Controles no eficaces</li>}
            {alerts.includes('review-overdue') && <li>Revisión vencida</li>}
          </ul>
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4 space-y-2">
          <div className="text-xs text-neutral-500 uppercase tracking-wider font-medium">Nivel de riesgo</div>
          <div className="flex items-center gap-3">
            <div className={`text-2xl font-bold px-3 py-1 rounded-lg border ${CAT_BG[item.riskCategory] || 'bg-slate-50'}`}>{item.riskLevel}</div>
            <div className="text-sm text-neutral-600">{CATEGORY_LABEL[item.riskCategory] || item.riskCategory}</div>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 space-y-2">
          <div className="text-xs text-neutral-500 uppercase tracking-wider font-medium">Estado</div>
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm border ${STATUS_COLOR[item.status] || 'bg-slate-50'}`}>
            {STATUS_LABEL[item.status] || item.status}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 space-y-2">
          <div className="text-xs text-neutral-500 uppercase tracking-wider font-medium">Próxima revisión</div>
          <div className="text-sm text-neutral-700">{formatDate(item.reviewDate)}</div>
        </div>
      </div>

      {/* Risk reduction */}
      {item.residualRiskLevel != null && (
        <div className="bg-white border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-500 uppercase tracking-wider font-medium">Reducción del riesgo</div>
            <div className="text-sm font-medium text-emerald-700 flex items-center gap-1"><TrendingDown className="w-4 h-4" /> {riskReduction}%</div>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-3">
            <div className="bg-emerald-500 h-3 rounded-full" style={{ width: `${Math.min(100, riskReduction)}%` }} />
          </div>
          <div className="flex justify-between text-xs text-neutral-500">
            <span>Inicial: {item.riskLevel}</span>
            <span>Residual: {item.residualRiskLevel}</span>
          </div>
        </div>
      )}

      {/* Identification */}
      <div className="bg-white border rounded-lg p-5 space-y-4">
        <h3 className="font-semibold text-neutral-800">Identificación del peligro y riesgo</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><div className="text-xs text-neutral-500 mb-1">Peligro identificado</div><div className="text-neutral-800">{item.hazard}</div></div>
          <div><div className="text-xs text-neutral-500 mb-1">Riesgo asociado</div><div className="text-neutral-800">{item.risk}</div></div>
          <div><div className="text-xs text-neutral-500 mb-1">Probabilidad</div><div className="text-neutral-800">{item.probability}</div></div>
          <div><div className="text-xs text-neutral-500 mb-1">Severidad</div><div className="text-neutral-800">{item.severity}</div></div>
          <div><div className="text-xs text-neutral-500 mb-1">Exposición</div><div className="text-neutral-800">{item.exposure}</div></div>
          <div><div className="text-xs text-neutral-500 mb-1">Frecuencia de revisión</div><div className="text-neutral-800">{item.reviewFrequency === 'MONTHLY' ? 'Mensual' : item.reviewFrequency === 'QUARTERLY' ? 'Trimestral' : 'Anual'}</div></div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border rounded-lg p-5 space-y-4">
        <h3 className="font-semibold text-neutral-800">Controles jerarquía ISO 45001</h3>
        {[
          { key: 'elimination', label: 'Eliminación' },
          { key: 'substitution', label: 'Sustitución' },
          { key: 'engineering', label: 'Ingeniería' },
          { key: 'administrative', label: 'Administrativo' },
          { key: 'ppe', label: 'EPP' },
        ].map(ctrl => {
          const desc = (item as any)[ctrl.key] as string | null;
          const impl = (item as any)[`${ctrl.key}Implemented`] as boolean | null;
          const eff = (item as any)[`${ctrl.key}Effective`] as boolean | null;
          const obs = (item as any)[`${ctrl.key}Observation`] as string | null;
          return (
            <div key={ctrl.key} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm text-neutral-800">{ctrl.label}</div>
                <div className="flex items-center gap-2 text-xs">
                  {impl === true && <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Implementado</span>}
                  {impl === false && <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">No implementado</span>}
                  {eff === true && <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Eficaz</span>}
                  {eff === false && <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">No eficaz</span>}
                </div>
              </div>
              <div className="text-sm text-neutral-600">{desc || <span className="text-neutral-400 italic">Sin descripción</span>}</div>
              {obs && <div className="text-xs text-neutral-500">Obs: {obs}</div>}
            </div>
          );
        })}
      </div>

      {/* Gestion del riesgo */}
      <div className="bg-white border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-800">Gestión del riesgo</h3>
          <div className="flex gap-2">
            <button onClick={onOpenActions} className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-blue-50 text-blue-700 border-blue-200">
              <Wrench className="w-4 h-4" /> Gestionar acciones
            </button>
            <button onClick={onOpenReviews} className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-neutral-50 text-neutral-700">
              <ShieldCheck className="w-4 h-4" /> Revisión
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div><div className="text-xs text-neutral-500 mb-1">Responsable</div><div className="text-neutral-800">{item.responsibleId ? (employees.find(e => e.id === item.responsibleId)?.firstName + ' ' + employees.find(e => e.id === item.responsibleId)?.lastName) || '—' : '—'}</div></div>
          <div><div className="text-xs text-neutral-500 mb-1">Acciones activas</div><div className="text-neutral-800">{item.actions?.length || 0}</div></div>
          <div><div className="text-xs text-neutral-500 mb-1">Última revisión</div><div className="text-neutral-800">{formatDate(item.reviews?.[0]?.reviewDate)}</div></div>
        </div>
      </div>
    </div>
  );
}

function FormModal({ form, editing, onChange, onClose, onSave, saving }: {
  form: Partial<Hazard>; editing: boolean; onChange: (k: keyof Hazard, v: any) => void;
  onClose: () => void; onSave: () => void; saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-800">{editing ? 'Editar riesgo' : 'Nuevo riesgo'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Área / Puesto <span className="text-red-500">*</span></label>
              <input value={form.area || ''} onChange={e => onChange('area', e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Actividad / Tarea <span className="text-red-500">*</span></label>
              <input value={form.activity || ''} onChange={e => onChange('activity', e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Peligro identificado <span className="text-red-500">*</span></label>
              <textarea value={form.hazard || ''} onChange={e => onChange('hazard', e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Riesgo asociado <span className="text-red-500">*</span></label>
              <textarea value={form.risk || ''} onChange={e => onChange('risk', e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Probabilidad (1-5)</label>
              <input type="number" min={1} max={5} value={form.probability ?? 3} onChange={e => onChange('probability', Number(e.target.value))} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Severidad (1-5)</label>
              <input type="number" min={1} max={5} value={form.severity ?? 3} onChange={e => onChange('severity', Number(e.target.value))} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Exposición (1-5)</label>
              <input type="number" min={1} max={5} value={form.exposure ?? 1} onChange={e => onChange('exposure', Number(e.target.value))} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nivel de riesgo</label>
                <input readOnly value={form.riskLevel ?? ''} className="w-full px-3 py-2 text-sm border rounded-lg bg-neutral-50" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Categoría</label>
                <input readOnly value={CATEGORY_LABEL[form.riskCategory || ''] || form.riskCategory || ''} className="w-full px-3 py-2 text-sm border rounded-lg bg-neutral-50" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Estado</label>
              <select value={form.status || 'OPEN'} onChange={e => onChange('status', e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="OPEN">Abierto</option>
                <option value="IN_TREATMENT">En tratamiento</option>
                <option value="CONTROLLED">Controlado</option>
                <option value="CLOSED">Cerrado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Frecuencia de revisión</label>
              <select value={form.reviewFrequency || 'ANNUAL'} onChange={e => onChange('reviewFrequency', e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="MONTHLY">Mensual</option>
                <option value="QUARTERLY">Trimestral</option>
                <option value="ANNUAL">Anual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Próxima revisión</label>
              <input type="date" value={form.reviewDate ? new Date(form.reviewDate).toISOString().split('T')[0] : ''} onChange={e => onChange('reviewDate', e.target.value || null)} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-3">
            <h4 className="font-medium text-neutral-800">Controles</h4>
            {[
              { key: 'elimination', label: 'Eliminación' },
              { key: 'substitution', label: 'Sustitución' },
              { key: 'engineering', label: 'Ingeniería' },
              { key: 'administrative', label: 'Administrativo' },
              { key: 'ppe', label: 'EPP' },
            ].map(ctrl => (
              <div key={ctrl.key} className="border rounded-lg p-3 space-y-2">
                <label className="block text-sm font-medium text-neutral-700">{ctrl.label}</label>
                <textarea value={(form as any)[ctrl.key] || ''} onChange={e => onChange(ctrl.key as any, e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder={`Descripción del control de ${ctrl.label.toLowerCase()}`} />
                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!(form as any)[`${ctrl.key}Implemented`]} onChange={e => onChange(`${ctrl.key}Implemented` as any, e.target.checked)} />
                    Implementado
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!(form as any)[`${ctrl.key}Effective`]} onChange={e => onChange(`${ctrl.key}Effective` as any, e.target.checked)} />
                    Eficaz
                  </label>
                </div>
                <input value={(form as any)[`${ctrl.key}Observation`] || ''} onChange={e => onChange(`${ctrl.key}Observation` as any, e.target.value)} placeholder="Observación" className="w-full px-3 py-2 text-sm border rounded-lg" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Riesgo residual (nivel)</label>
              <input type="number" value={form.residualRiskLevel ?? ''} onChange={e => onChange('residualRiskLevel', e.target.value ? Number(e.target.value) : null)} className="w-full px-3 py-2 text-sm border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Riesgo residual (categoría)</label>
              <select value={form.residualRiskCategory || ''} onChange={e => onChange('residualRiskCategory', e.target.value || null)} className="w-full px-3 py-2 text-sm border rounded-lg">
                <option value="">—</option>
                <option value="TOLERABLE">Tolerable</option>
                <option value="MODERATE">Moderado</option>
                <option value="SUBSTANTIAL">Sustancial</option>
                <option value="INTOLERABLE">Intolerable</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-neutral-50">Cancelar</button>
          <button onClick={onSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionsModal({ item, actionForm, onChange, onSave, onClose, employees }: {
  item: Hazard; actionForm: Partial<RiskAction>; onChange: (k: string, v: any) => void; onSave: () => void; onClose: () => void; employees: any[];
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Acciones de mejora</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <label className="block font-medium text-neutral-700 mb-1">Descripción</label>
            <textarea value={actionForm.description || ''} onChange={e => onChange('description', e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-700 mb-1">Responsable</label>
              <select value={actionForm.responsibleId || ''} onChange={e => onChange('responsibleId', e.target.value || null)} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Sin asignar</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium text-neutral-700 mb-1">Vencimiento</label>
              <input type="date" value={actionForm.dueDate ? new Date(actionForm.dueDate).toISOString().split('T')[0] : ''} onChange={e => onChange('dueDate', e.target.value || null)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-700 mb-1">Estado</label>
              <select value={actionForm.status || 'PENDING'} onChange={e => onChange('status', e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option value="PENDING">Pendiente</option>
                <option value="IN_PROGRESS">En proceso</option>
                <option value="COMPLETED">Finalizada</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-neutral-700 mb-1">Eficacia</label>
              <select value={actionForm.effectiveness || 'PENDING'} onChange={e => onChange('effectiveness', e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option value="PENDING">Pendiente</option>
                <option value="EFFECTIVE">Eficaz</option>
                <option value="NOT_EFFECTIVE">No eficaz</option>
              </select>
            </div>
          </div>
          <button onClick={onSave} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Guardar acción</button>
        </div>
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Acciones registradas</h4>
          {item.actions?.length === 0 && <div className="text-neutral-500 text-sm">Sin acciones</div>}
          {item.actions?.map(a => (
            <div key={a.id} className="border rounded-lg p-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{a.description}</span>
                <span className={`text-xs px-2 py-0.5 rounded border ${a.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : a.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {a.status === 'PENDING' ? 'Pendiente' : a.status === 'IN_PROGRESS' ? 'En proceso' : 'Finalizada'}
                </span>
              </div>
              <div className="text-xs text-neutral-500 flex gap-3">
                <span>Vence: {formatDate(a.dueDate)}</span>
                <span>Eficacia: {a.effectiveness === 'EFFECTIVE' ? 'Eficaz' : a.effectiveness === 'NOT_EFFECTIVE' ? 'No eficaz' : 'Pendiente'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewsModal({ item, reviewForm, onChange, onSave, onClose }: {
  item: Hazard; reviewForm: Partial<RiskReview>; onChange: (k: string, v: any) => void; onSave: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Historial de revisiones</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-700 mb-1">Fecha</label>
              <input type="date" value={reviewForm.reviewDate ? new Date(reviewForm.reviewDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} onChange={e => onChange('reviewDate', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block font-medium text-neutral-700 mb-1">Resultado</label>
              <select value={reviewForm.result || 'CONTROLLED'} onChange={e => onChange('result', e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option value="CONTROLLED">Controlado</option>
                <option value="NOT_CONTROLLED">No controlado</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-medium text-neutral-700 mb-1">Comentarios</label>
            <textarea value={reviewForm.comments || ''} onChange={e => onChange('comments', e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <button onClick={onSave} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Registrar revisión</button>
        </div>
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Revisiones anteriores</h4>
          {item.reviews?.length === 0 && <div className="text-neutral-500 text-sm">Sin revisiones</div>}
          {item.reviews?.map(r => (
            <div key={r.id} className="border rounded-lg p-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{formatDate(r.reviewDate)}</span>
                <span className={`text-xs px-2 py-0.5 rounded border ${r.result === 'CONTROLLED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {r.result === 'CONTROLLED' ? 'Controlado' : 'No controlado'}
                </span>
              </div>
              {r.comments && <div className="text-xs text-neutral-500">{r.comments}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
