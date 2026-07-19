'use client';
import { useState, useEffect, useCallback } from 'react';
import { UsersRound, Plus, Edit, Trash2, AlertCircle, CheckCircle, XCircle, AlertTriangle, Clock, Copy, History, FileText, Sparkles, Download, TrendingUp, TrendingDown, Minus, Settings, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { t } from '@/lib/dictionary';
import { generatePDF, exportCSV, exportExcel, criticalityStars } from './partesReport';

type Cycle = { id: string; name: string; year: number; status: string; startDate?: string; endDate?: string; responsible?: string | null };
type Stakeholder = { id: string; name: string; type: string; category: string; contactName?: string; contactEmail?: string; notes?: string };
type Evaluation = {
  id: string; stakeholderId: string; cycleId: string;
  complianceStatus?: string | null; complianceLevel?: number | null; evaluationDate?: string | null;
  complianceEvidence?: string | null; indicatorNote?: string | null; requiresAction?: boolean;
  actionItemId?: string | null; influence?: number | null; interest?: number | null; observations?: string | null;
  needs?: string | null; expectations?: string | null; requirements?: string | null;
  reviewFrequency?: string | null; nextEvaluationDate?: string | null; followUpResponsible?: string | null;
  criticality?: number | null; previousLevel?: number | null; previousCycleName?: string | null;
  stakeholder: Stakeholder;
};

const CRIT_OPTS = [{ v: 5, l: 'Muy Alta' }, { v: 4, l: 'Alta' }, { v: 3, l: 'Media' }, { v: 2, l: 'Baja' }, { v: 1, l: 'Muy Baja' }];
// Semáforo por nivel promedio
function semaphore(n: number) {
  if (n >= 85) return { dot: 'bg-green-500', text: 'text-green-600', label: 'Óptimo' };
  if (n >= 65) return { dot: 'bg-yellow-500', text: 'text-yellow-600', label: 'Aceptable' };
  return { dot: 'bg-red-500', text: 'text-red-600', label: 'Crítico' };
}
const barColor = (n: number) => (n >= 85 ? 'bg-green-500' : n >= 65 ? 'bg-yellow-500' : 'bg-red-500');

const dateStr = (d?: string | null) => (d ? new Date(d).toISOString().split('T')[0] : '');
const daysUntil = (d?: string | null) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null);

// Clasificación matriz Poder (influencia) vs Interés. Alto = >=4.
function quadrant(inf?: number | null, int?: number | null): 'MANAGE' | 'SATISFY' | 'INFORM' | 'MONITOR' {
  const hiInf = (inf ?? 3) >= 4; const hiInt = (int ?? 3) >= 4;
  if (hiInf && hiInt) return 'MANAGE';
  if (hiInf && !hiInt) return 'SATISFY';
  if (!hiInf && hiInt) return 'INFORM';
  return 'MONITOR';
}
const QUAD = {
  MANAGE: { label: 'Gestionar de cerca', color: 'bg-red-50 border-red-200 text-red-700' },
  SATISFY: { label: 'Mantener satisfecho', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  INFORM: { label: 'Mantener informado', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  MONITOR: { label: 'Monitorear', color: 'bg-gray-50 border-gray-200 text-gray-600' },
};

export default function PartesContent() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [quadFilter, setQuadFilter] = useState<string | null>(null);
  const [stFilter, setStFilter] = useState<{ id: string; name: string } | null>(null);
  const [genAction, setGenAction] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // IA
  const [showAI, setShowAI] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  // Configuración del ciclo
  const [showCfg, setShowCfg] = useState(false);
  const [cfg, setCfg] = useState<any>(null);
  const [cfgSaving, setCfgSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editSt, setEditSt] = useState<any>(null);       // campos maestros del stakeholder
  const [editEv, setEditEv] = useState<any>(null);       // campos de la evaluación del período
  const [history, setHistory] = useState<Evaluation[]>([]);
  const [saving, setSaving] = useState(false);

  const [showNew, setShowNew] = useState(false);
  const [newSt, setNewSt] = useState<any>(null);
  const [showNc, setShowNc] = useState(false);
  const [ncForm, setNcForm] = useState<any>({ title: '', description: '', severity: 'MAJOR', dueDate: '', assignedToId: '' });
  const [ncSaving, setNcSaving] = useState(false);
  const [busyCycle, setBusyCycle] = useState(false);

  const currentCycle = cycles.find(c => c.id === cycleId);

  const loadCycles = useCallback(async () => {
    try {
      const data = await apiFetch('/evaluation-cycles') as any;
      const list: Cycle[] = data?.cycles || [];
      setCycles(list);
      if (list.length) {
        const active = list.find(c => c.status === 'ACTIVE') || list[0];
        setCycleId(prev => prev && list.some(c => c.id === prev) ? prev : active.id);
      }
    } catch (e) { console.error(e); }
  }, []);

  const loadEvals = useCallback(async (cid: string) => {
    if (!cid) { setEvals([]); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiFetch(`/evaluation-cycles/${cid}/evaluations`) as any;
      setEvals(data?.evaluations || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCycles(); }, [loadCycles]);
  useEffect(() => { if (cycleId) loadEvals(cycleId); }, [cycleId, loadEvals]);

  // Dashboard del período (cálculo cliente)
  const now = Date.now();
  const summary = {
    total: evals.length,
    complies: evals.filter(e => e.complianceStatus === 'COMPLIES').length,
    partial: evals.filter(e => e.complianceStatus === 'PARTIAL').length,
    nonCompliant: evals.filter(e => e.complianceStatus === 'NON_COMPLIANT').length,
    pending: evals.filter(e => !e.complianceStatus || e.complianceStatus === 'PENDING').length,
    openActions: evals.filter(e => e.requiresAction && !e.actionItemId).length,
    overdue: evals.filter(e => e.nextEvaluationDate && new Date(e.nextEvaluationDate).getTime() < now).length,
    avgLevel: (() => {
      const l = evals.map(e => e.complianceLevel).filter((n): n is number => typeof n === 'number');
      return l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : 0;
    })(),
    critical: evals.filter(e => (e.criticality ?? 0) >= 4).length,
    capasOpen: evals.filter(e => e.actionItemId).length,
    prevAvg: (() => {
      const l = evals.map(e => e.previousLevel).filter((n): n is number => typeof n === 'number');
      return l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : null;
    })(),
  };
  const prevCycleName = evals.find(e => e.previousCycleName)?.previousCycleName || null;
  const variation = summary.prevAvg !== null ? summary.avgLevel - summary.prevAvg : null;
  const sem = semaphore(summary.avgLevel);
  const lastReview = evals.map(e => e.evaluationDate).filter(Boolean).sort().slice(-1)[0] || null;
  const nextReview = evals.map(e => e.nextEvaluationDate).filter(Boolean).sort()[0] || currentCycle?.endDate || null;

  // Matriz poder/interés
  const matrix = { MANAGE: [] as Evaluation[], SATISFY: [] as Evaluation[], INFORM: [] as Evaluation[], MONITOR: [] as Evaluation[] };
  evals.forEach(e => matrix[quadrant(e.influence, e.interest)].push(e));

  const matchKpi = (e: Evaluation) => {
    switch (filter) {
      case 'ALL': return true;
      case 'PENDING': return !e.complianceStatus || e.complianceStatus === 'PENDING';
      case 'OPEN_ACTIONS': return !!e.requiresAction && !e.actionItemId;
      case 'OVERDUE': return !!e.nextEvaluationDate && new Date(e.nextEvaluationDate).getTime() < now;
      case 'CRITICAL': return (e.criticality ?? 0) >= 4;
      default: return e.complianceStatus === filter;
    }
  };
  const filtered = evals.filter(e =>
    matchKpi(e)
    && (!quadFilter || quadrant(e.influence, e.interest) === quadFilter)
    && (!stFilter || e.stakeholderId === stFilter.id)
  );
  const hasActiveFilter = filter !== 'ALL' || quadFilter || stFilter;
  const clearFilters = () => { setFilter('ALL'); setQuadFilter(null); setStFilter(null); };

  const statusIcon = (s?: string | null) =>
    s === 'COMPLIES' ? <CheckCircle className="w-4 h-4 text-green-500" />
    : s === 'PARTIAL' ? <AlertCircle className="w-4 h-4 text-yellow-500" />
    : s === 'NON_COMPLIANT' ? <XCircle className="w-4 h-4 text-red-500" />
    : <Clock className="w-4 h-4 text-gray-400" />;

  const nextEvalBadge = (d?: string | null) => {
    if (!d) return <span className="text-xs text-gray-400">—</span>;
    const days = daysUntil(d);
    if (days === null) return <span className="text-xs text-gray-400">—</span>;
    if (days < 0) return <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 font-medium">Vencida hace {Math.abs(days)}d</span>;
    if (days <= 30) return <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700 font-medium">Vence en {days}d</span>;
    return <span className="px-2 py-0.5 text-xs rounded bg-green-50 text-green-700">{dateStr(d)}</span>;
  };

  const trendBadge = (cur?: number | null, prev?: number | null) => {
    if (typeof cur !== 'number' || typeof prev !== 'number') return <span className="text-xs text-gray-300">—</span>;
    const diff = cur - prev;
    if (diff > 0) return <span className="inline-flex items-center gap-0.5 text-xs text-green-600 font-medium"><TrendingUp className="w-3.5 h-3.5" />+{diff}%</span>;
    if (diff < 0) return <span className="inline-flex items-center gap-0.5 text-xs text-red-600 font-medium"><TrendingDown className="w-3.5 h-3.5" />{diff}%</span>;
    return <span className="inline-flex items-center gap-0.5 text-xs text-gray-500"><Minus className="w-3.5 h-3.5" />0%</span>;
  };

  // ── Abrir modal de edición ──
  const openEdit = async (ev: Evaluation) => {
    setEditSt({ ...ev.stakeholder });
    setEditEv({
      id: ev.id, complianceStatus: ev.complianceStatus || 'PENDING', complianceLevel: ev.complianceLevel ?? 0,
      evaluationDate: dateStr(ev.evaluationDate), complianceEvidence: ev.complianceEvidence || '',
      indicatorNote: ev.indicatorNote || '', requiresAction: ev.requiresAction || false,
      influence: ev.influence ?? 3, interest: ev.interest ?? 3, criticality: ev.criticality ?? 3, observations: ev.observations || '',
      needs: ev.needs || '', expectations: ev.expectations || '', requirements: ev.requirements || '',
      reviewFrequency: ev.reviewFrequency || '', nextEvaluationDate: dateStr(ev.nextEvaluationDate),
      followUpResponsible: ev.followUpResponsible || '', actionItemId: ev.actionItemId || null,
    });
    setHistory([]);
    setShowModal(true);
    try {
      const h = await apiFetch(`/stakeholder-evaluations/by-stakeholder/${ev.stakeholderId}`) as any;
      setHistory(h?.history || []);
    } catch (e) { console.error(e); }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSt?.name?.trim()) { alert('Nombre requerido'); return; }
    if (editEv.complianceLevel < 0 || editEv.complianceLevel > 100) { alert('Nivel 0-100'); return; }
    if (editEv.requiresAction && editEv.complianceStatus === 'COMPLIES') { alert('No requiere acción si Cumple'); return; }
    setSaving(true);
    try {
      // 1) Campos maestros del stakeholder
      await apiFetch(`/stakeholders/${editSt.id}`, { method: 'PATCH', json: {
        name: editSt.name, type: editSt.type, category: editSt.category,
        contactName: editSt.contactName || null, contactEmail: editSt.contactEmail || null, notes: editSt.notes || null,
      }});
      // 2) Evaluación del período seleccionado
      await apiFetch(`/stakeholder-evaluations/${editEv.id}`, { method: 'PATCH', json: {
        complianceStatus: editEv.complianceStatus, complianceLevel: Number(editEv.complianceLevel),
        evaluationDate: editEv.evaluationDate || null, complianceEvidence: editEv.complianceEvidence || null,
        indicatorNote: editEv.indicatorNote || null, requiresAction: editEv.requiresAction,
        influence: Number(editEv.influence), interest: Number(editEv.interest), criticality: Number(editEv.criticality), observations: editEv.observations || null,
        needs: editEv.needs || null, expectations: editEv.expectations || null, requirements: editEv.requirements || null,
        reviewFrequency: editEv.reviewFrequency || null, nextEvaluationDate: editEv.nextEvaluationDate || null,
        followUpResponsible: editEv.followUpResponsible || null,
      }});
      setShowModal(false); loadEvals(cycleId);
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const del = async (ev: Evaluation) => {
    if (!confirm('¿Eliminar esta parte interesada? Se elimina de todos los períodos.')) return;
    await apiFetch(`/stakeholders/${ev.stakeholderId}`, { method: 'DELETE' });
    loadEvals(cycleId);
  };

  const generateAction = async (ev: Evaluation) => {
    setGenAction(true);
    try { await apiFetch(`/stakeholder-evaluations/${ev.id}/generate-action`, { method: 'POST', json: {} }); loadEvals(cycleId); }
    catch (e: any) { alert('Error: ' + e.message); }
    finally { setGenAction(false); }
  };

  // ── Nueva parte interesada ──
  const openNew = () => { setNewSt({ name: '', type: 'EXTERNAL', category: 'CUSTOMER', contactName: '', contactEmail: '', needs: '', expectations: '', requirements: '', notes: '', influence: 3, interest: 3 }); setShowNew(true); };
  const saveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSt?.name?.trim()) { alert('Nombre requerido'); return; }
    setSaving(true);
    try {
      await apiFetch('/stakeholders', { method: 'POST', json: {
        name: newSt.name, type: newSt.type, category: newSt.category,
        contactName: newSt.contactName || null, contactEmail: newSt.contactEmail || null, notes: newSt.notes || null,
        needs: newSt.needs || null, expectations: newSt.expectations || null, requirements: newSt.requirements || null,
        influence: Number(newSt.influence), interest: Number(newSt.interest),
        complianceStatus: 'PENDING', complianceLevel: 0, requiresAction: false,
      }});
      setShowNew(false); loadEvals(cycleId); // el GET auto-crea la evaluación del período
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  // ── Crear ciclo siguiente ──
  const createNext = async () => {
    if (!confirm('Se creará el ciclo siguiente copiando las partes interesadas y su estructura (necesidades, expectativas, requisitos, responsable). Las evaluaciones quedarán en "Pendiente". ¿Continuar?')) return;
    setBusyCycle(true);
    try {
      const res = await apiFetch('/evaluation-cycles/create-next', { method: 'POST', json: { fromCycleId: cycleId } }) as any;
      await loadCycles();
      if (res?.cycle?.id) setCycleId(res.cycle.id);
      alert(`Ciclo "${res?.cycle?.name}" creado. Se copiaron ${res?.copied ?? 0} partes interesadas.`);
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setBusyCycle(false); }
  };

  // ── Crear NC desde la evaluación ──
  const openNc = () => {
    const today = new Date().toISOString().split('T')[0];
    const due = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
    setNcForm({
      title: `NC: ${editSt?.name} — ${currentCycle?.name || ''}`,
      description: `Origen: Parte Interesada (período ${currentCycle?.name || '—'})\nNombre: ${editSt?.name}\nEstado: ${t('complianceStatus', editEv?.complianceStatus)}\nNivel: ${editEv?.complianceLevel || '—'}%\nEvidencia: ${editEv?.complianceEvidence || '—'}`,
      severity: 'MAJOR', dueDate: due, detectedAt: today, assignedToId: '',
    });
    setShowNc(true);
  };
  const saveNc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ncForm.title.trim()) { alert('Título requerido'); return; }
    setNcSaving(true);
    try {
      await apiFetch(`/stakeholder-evaluations/${editEv.id}/create-nc`, { method: 'POST', json: {
        title: ncForm.title.trim(), description: ncForm.description.trim(), severity: ncForm.severity,
        dueDate: ncForm.dueDate ? new Date(ncForm.dueDate).toISOString() : undefined,
      }});
      setShowNc(false); loadEvals(cycleId);
    } catch (err: any) { alert('Error: ' + (err.message || 'Error al crear NC')); }
    finally { setNcSaving(false); }
  };

  // ── Análisis IA del ciclo ──
  const runAI = async () => {
    if (!cycleId) return;
    setShowAI(true); setAiLoading(true); setAiText('');
    try {
      const res = await apiFetch(`/evaluation-cycles/${cycleId}/ai-analysis`, { method: 'POST', json: {} }) as any;
      setAiText(res?.analysis || 'Sin respuesta del modelo.');
    } catch (err: any) { setAiText('Error al generar el análisis: ' + (err.message || 'desconocido')); }
    finally { setAiLoading(false); }
  };

  // ── Informe PDF ──
  const doPDF = () => {
    if (!currentCycle) return;
    generatePDF({
      cycle: { name: currentCycle.name, year: currentCycle.year, status: currentCycle.status, responsible: currentCycle.responsible },
      evals, summary, matrix,
    });
  };

  // ── Configuración del ciclo ──
  const openCfg = () => {
    if (!currentCycle) return;
    setCfg({ name: currentCycle.name, status: currentCycle.status, responsible: currentCycle.responsible || '', endDate: dateStr(currentCycle.endDate) });
    setShowCfg(true);
  };
  const saveCfg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCycle) return;
    setCfgSaving(true);
    try {
      await apiFetch(`/evaluation-cycles/${currentCycle.id}`, { method: 'PATCH', json: {
        name: cfg.name, status: cfg.status, responsible: cfg.responsible || null, endDate: cfg.endDate || null,
      }});
      setShowCfg(false); await loadCycles();
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setCfgSaving(false); }
  };

  // Render simple de markdown del informe IA
  const renderAI = (txt: string) => txt.split('\n').map((line, i) => {
    if (line.startsWith('## ')) return <h3 key={i} className="text-base font-bold text-blue-700 mt-4 mb-1">{line.slice(3)}</h3>;
    if (line.startsWith('# ')) return <h2 key={i} className="text-lg font-bold mt-4 mb-1">{line.slice(2)}</h2>;
    if (/^\s*[-*]\s+/.test(line)) return <li key={i} className="ml-5 list-disc text-sm text-gray-700">{line.replace(/^\s*[-*]\s+/, '').replace(/\*\*/g, '')}</li>;
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <p key={i} className="text-sm text-gray-700">{line.replace(/\*\*/g, '')}</p>;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* FILA 1 — Toolbar */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Partes Interesadas</h1>
          <p className="text-sm text-gray-600">Stakeholders con evaluación de cumplimiento por período</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector con semáforo */}
          <div className="flex items-center gap-2 bg-white border rounded-lg pl-3 pr-1 py-1">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${sem.dot}`} title={sem.label} />
            <select value={cycleId} onChange={e => setCycleId(e.target.value)} className="text-sm font-medium bg-transparent outline-none py-1">
              {cycles.length === 0 && <option value="">Sin ciclos</option>}
              {cycles.map(c => <option key={c.id} value={c.id}>{c.name} · {t('cycleStatus', c.status)}</option>)}
            </select>
            <span className={`text-sm font-semibold ${sem.text} pr-1`}>{summary.avgLevel}%</span>
            <button onClick={openCfg} disabled={!cycleId} title="Configurar ciclo" className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-40"><Settings className="w-4 h-4 text-gray-500" /></button>
          </div>
          <button onClick={createNext} disabled={busyCycle || !cycleId} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"><Copy className="w-4 h-4" />Ciclo siguiente</button>
          <button onClick={openNew} disabled={!cycleId} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"><Plus className="w-4 h-4" />Nueva</button>
          <button onClick={doPDF} disabled={!cycleId || !evals.length} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"><FileText className="w-4 h-4" />Informe</button>
          <button onClick={runAI} disabled={!cycleId || !evals.length} className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg text-sm disabled:opacity-50"><Sparkles className="w-4 h-4" />Analizar con IA</button>
          <div className="relative">
            <button onClick={() => setExportOpen(o => !o)} disabled={!cycleId || !filtered.length} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"><Download className="w-4 h-4" />Exportar</button>
            {exportOpen && <div className="absolute right-0 mt-1 w-40 bg-white border rounded-lg shadow-lg z-30 text-sm" onMouseLeave={() => setExportOpen(false)}>
              <button onClick={() => { doPDF(); setExportOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-50">Exportar PDF</button>
              <button onClick={() => { exportExcel(filtered, currentCycle?.name || 'ciclo'); setExportOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-50">Exportar Excel</button>
              <button onClick={() => { exportCSV(filtered, currentCycle?.name || 'ciclo'); setExportOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-50">Exportar CSV</button>
            </div>}
          </div>
        </div>
      </div>

      {/* Resumen del ciclo */}
      {currentCycle && <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs bg-white border rounded-lg px-4 py-2">
        <span className="text-gray-500">Última revisión: <b className="text-gray-800">{lastReview ? new Date(lastReview).toLocaleDateString('es-AR') : '—'}</b></span>
        <span className="text-gray-500">Próxima: <b className="text-gray-800">{nextReview ? new Date(nextReview).toLocaleDateString('es-AR') : '—'}</b></span>
        <span className="text-gray-500">Estado: <b className={currentCycle.status === 'ACTIVE' ? 'text-green-600' : currentCycle.status === 'CLOSED' ? 'text-gray-600' : 'text-amber-600'}>{currentCycle.status === 'ACTIVE' ? 'Vigente' : t('cycleStatus', currentCycle.status)}</b></span>
        {currentCycle.responsible && <span className="text-gray-500">Responsable: <b className="text-gray-800">{currentCycle.responsible}</b></span>}
      </div>}

      {/* FILA 2 — Dashboard KPIs interactivos */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mt-4">
        {([
          { l: 'Total', v: summary.total, c: 'text-gray-700', f: 'ALL' },
          { l: 'Cumplen', v: summary.complies, c: 'text-green-600', f: 'COMPLIES' },
          { l: 'Parciales', v: summary.partial, c: 'text-yellow-600', f: 'PARTIAL' },
          { l: 'No cumplen', v: summary.nonCompliant, c: 'text-red-600', f: 'NON_COMPLIANT' },
          { l: 'Pendientes', v: summary.pending, c: 'text-gray-500', f: 'PENDING' },
          { l: 'Acciones abiertas', v: summary.openActions, c: 'text-orange-600', f: 'OPEN_ACTIONS' },
          { l: 'Eval. vencidas', v: summary.overdue, c: 'text-red-600', f: 'OVERDUE' },
          { l: 'Nivel prom.', v: `${summary.avgLevel}%`, c: 'text-blue-600', f: null },
        ] as const).map((m, i) => (
          <button key={i} onClick={() => m.f && setFilter(filter === m.f ? 'ALL' : m.f)} disabled={!m.f}
            className={`bg-white rounded-lg border p-3 text-center transition ${m.f ? 'hover:border-blue-400 cursor-pointer' : 'cursor-default'} ${m.f && filter === m.f ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}>
            <div className={`text-xl font-bold ${m.c}`}>{m.v}</div>
            <div className="text-[11px] text-gray-500 leading-tight mt-0.5">{m.l}</div>
          </button>
        ))}
      </div>

      {/* Indicadores inteligentes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
        <div className="bg-white rounded-lg border p-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">Nivel año anterior{prevCycleName ? ` (${prevCycleName})` : ''}</span>
          <span className="text-base font-bold text-gray-700">{summary.prevAvg !== null ? `${summary.prevAvg}%` : '—'}</span>
        </div>
        <div className="bg-white rounded-lg border p-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">Variación</span>
          <span className={`text-base font-bold inline-flex items-center gap-1 ${variation === null ? 'text-gray-400' : variation > 0 ? 'text-green-600' : variation < 0 ? 'text-red-600' : 'text-gray-500'}`}>
            {variation === null ? '—' : <>{variation > 0 ? <TrendingUp className="w-4 h-4" /> : variation < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}{variation > 0 ? '+' : ''}{variation}%</>}
          </span>
        </div>
        <button onClick={() => setFilter(filter === 'CRITICAL' ? 'ALL' : 'CRITICAL')} className={`bg-white rounded-lg border p-3 flex items-center justify-between hover:border-blue-400 ${filter === 'CRITICAL' ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}>
          <span className="text-xs text-gray-500">Partes críticas</span>
          <span className="text-base font-bold text-rose-600">{summary.critical}</span>
        </button>
        <div className="bg-white rounded-lg border p-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">CAPAs abiertas</span>
          <span className="text-base font-bold text-indigo-600">{summary.capasOpen}</span>
        </div>
      </div>

      {/* FILA 3 — Matriz Poder vs Interés con chips clicables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
        {(['MANAGE', 'SATISFY', 'INFORM', 'MONITOR'] as const).map(q => (
          <div key={q} className={`rounded-lg border p-3 ${QUAD[q].color}`}>
            <button onClick={() => setQuadFilter(quadFilter === q ? null : q)} className="w-full flex items-center justify-between mb-1.5">
              <span className={`text-xs font-semibold ${quadFilter === q ? 'underline' : ''}`}>{QUAD[q].label}</span>
              <span className="text-xs font-bold">{matrix[q].length}</span>
            </button>
            <div className="flex flex-wrap gap-1">
              {matrix[q].length === 0 && <span className="text-[11px] opacity-60">—</span>}
              {matrix[q].map(e => (
                <button key={e.id} onClick={() => setStFilter(stFilter?.id === e.stakeholderId ? null : { id: e.stakeholderId, name: e.stakeholder.name })}
                  className={`px-2 py-0.5 text-[11px] rounded-full border bg-white/70 hover:bg-white ${stFilter?.id === e.stakeholderId ? 'ring-1 ring-blue-500 font-semibold' : ''}`}>
                  {e.stakeholder.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Filtros activos */}
      <div className="bg-white rounded-xl border p-3 my-4 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Filtros:</span>
        {!hasActiveFilter && <span className="text-xs text-gray-400">ninguno (mostrando todos)</span>}
        {filter !== 'ALL' && <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200">{({ COMPLIES: 'Cumple', PARTIAL: 'Parcial', NON_COMPLIANT: 'No cumple', PENDING: 'Pendiente', OPEN_ACTIONS: 'Acciones abiertas', OVERDUE: 'Eval. vencidas', CRITICAL: 'Críticas' } as any)[filter] || filter}<button onClick={() => setFilter('ALL')}><X className="w-3 h-3" /></button></span>}
        {quadFilter && <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200">{QUAD[quadFilter as keyof typeof QUAD].label}<button onClick={() => setQuadFilter(null)}><X className="w-3 h-3" /></button></span>}
        {stFilter && <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200">{stFilter.name}<button onClick={() => setStFilter(null)}><X className="w-3 h-3" /></button></span>}
        {hasActiveFilter && <button onClick={clearFilters} className="text-xs text-gray-500 underline ml-1">Quitar todos</button>}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} de {evals.length}</span>
      </div>

      {loading ? <div className="text-center py-12 text-gray-500">Cargando...</div> :
      !cycleId ? <div className="text-center py-12 text-gray-500">No hay ciclos de evaluación. Cree el primero.</div> :
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full"><thead className="bg-gray-50 border-b"><tr>
          <th className="px-3 py-3 text-left text-xs font-semibold">Nombre</th>
          <th className="px-3 py-3 text-left text-xs font-semibold hidden lg:table-cell">Tipo</th>
          <th className="px-3 py-3 text-left text-xs font-semibold hidden lg:table-cell">Cat</th>
          <th className="px-3 py-3 text-left text-xs font-semibold">Estado</th>
          <th className="px-3 py-3 text-left text-xs font-semibold w-40">Nivel</th>
          <th className="px-3 py-3 text-left text-xs font-semibold">Tend.</th>
          <th className="px-3 py-3 text-left text-xs font-semibold">Criticidad</th>
          <th className="px-3 py-3 text-left text-xs font-semibold">Próx. eval</th>
          <th className="px-3 py-3 text-left text-xs font-semibold">Acción</th>
          <th className="px-3 py-3 text-left text-xs font-semibold">Ops</th>
        </tr></thead><tbody className="divide-y">
        {filtered.map(ev => (<tr key={ev.id} className="hover:bg-gray-50">
          <td className="px-3 py-3 text-sm font-medium">{ev.stakeholder.name}</td>
          <td className="px-3 py-3 text-sm hidden lg:table-cell">{t('stakeholderType', ev.stakeholder.type)}</td>
          <td className="px-3 py-3 text-sm hidden lg:table-cell">{t('stakeholderCategory', ev.stakeholder.category)}</td>
          <td className="px-3 py-3 text-sm"><div className="flex items-center gap-1.5">{statusIcon(ev.complianceStatus)}<span className="hidden xl:inline">{t('complianceStatus', ev.complianceStatus || 'PENDING')}</span></div></td>
          <td className="px-3 py-3 text-sm">
            {typeof ev.complianceLevel === 'number' ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-[60px]"><div className={`h-full ${barColor(ev.complianceLevel)} rounded-full transition-all`} style={{ width: `${ev.complianceLevel}%` }} /></div>
                <span className="text-xs font-medium text-gray-700 w-9 text-right">{ev.complianceLevel}%</span>
              </div>
            ) : <span className="text-gray-400">—</span>}
          </td>
          <td className="px-3 py-3">{trendBadge(ev.complianceLevel, ev.previousLevel)}</td>
          <td className="px-3 py-3 text-sm"><span className="text-amber-500 tracking-tight" title={ev.criticality ? CRIT_OPTS.find(o => o.v === ev.criticality)?.l : 'Sin definir'}>{ev.criticality ? criticalityStars(ev.criticality) : <span className="text-gray-300">☆☆☆☆☆</span>}</span></td>
          <td className="px-3 py-3 text-sm">{nextEvalBadge(ev.nextEvaluationDate)}</td>
          <td className="px-3 py-3 text-sm">
            {ev.requiresAction ? (ev.actionItemId
              ? <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded inline-flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> CAPA</span>
              : <button onClick={() => generateAction(ev)} disabled={genAction} className="px-2 py-1 text-xs bg-green-600 text-white rounded disabled:opacity-50">Generar</button>)
              : <span className="text-gray-400">—</span>}
          </td>
          <td className="px-3 py-3 text-sm"><div className="flex gap-1 items-center">
            <button onClick={() => openEdit(ev)} className="p-1 hover:bg-gray-200 rounded"><Edit className="w-4 h-4" /></button>
            <button onClick={() => del(ev)} className="p-1 hover:bg-gray-200 rounded"><Trash2 className="w-4 h-4" /></button>
          </div></td>
        </tr>))}
        {filtered.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">Sin partes interesadas para los filtros actuales.</td></tr>}
        </tbody></table>
      </div>}

      {/* Modal edición */}
      {showModal && editSt && editEv && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto flex flex-col">
          <div className="flex justify-between p-6 border-b sticky top-0 bg-white z-10">
            <div className="flex items-center gap-2"><UsersRound className="w-5 h-5 text-blue-600" /><h2 className="text-lg font-semibold">{editSt.name} · {currentCycle?.name}</h2></div>
            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><XCircle className="w-5 h-5" /></button>
          </div>
          <form onSubmit={saveEdit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="block text-sm font-medium mb-1">Nombre *</label><input value={editSt.name} onChange={e => setEditSt({ ...editSt, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required /></div>
              <div><label className="block text-sm font-medium mb-1">Tipo *</label><select value={editSt.type} onChange={e => setEditSt({ ...editSt, type: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="INTERNAL">Interna</option><option value="EXTERNAL">Externa</option></select></div>
              <div><label className="block text-sm font-medium mb-1">Categoría *</label><select value={editSt.category} onChange={e => setEditSt({ ...editSt, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="EMPLOYEE">Empleado</option><option value="CUSTOMER">Cliente</option><option value="SUPPLIER">Proveedor</option><option value="COMMUNITY">Comunidad</option><option value="REGULATOR">Regulador</option><option value="SHAREHOLDER">Accionista</option><option value="OTHER">Otro</option></select></div>
            </div>

            <div className="border-t pt-4"><h3 className="text-sm font-semibold mb-3">Necesidades / Expectativas / Requisitos <span className="text-xs font-normal text-gray-400">(de este período)</span></h3>
              <div className="space-y-3">
                <div><label className="block text-sm font-medium mb-1">Necesidades</label><textarea rows={2} value={editEv.needs} onChange={e => setEditEv({ ...editEv, needs: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-sm font-medium mb-1">Expectativas</label><textarea rows={2} value={editEv.expectations} onChange={e => setEditEv({ ...editEv, expectations: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-sm font-medium mb-1">Requisitos</label><textarea rows={2} value={editEv.requirements} onChange={e => setEditEv({ ...editEv, requirements: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              </div>
            </div>

            <div className="border-t pt-4"><h3 className="text-sm font-semibold mb-3">Evaluación de Cumplimiento — {currentCycle?.name}</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-sm font-medium mb-1">Estado</label><select value={editEv.complianceStatus} onChange={e => setEditEv({ ...editEv, complianceStatus: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="PENDING">Pendiente</option><option value="COMPLIES">Cumple</option><option value="PARTIAL">Parcial</option><option value="NON_COMPLIANT">No cumple</option></select></div>
                <div><label className="block text-sm font-medium mb-1">Nivel (%)</label><input type="number" min="0" max="100" value={editEv.complianceLevel} onChange={e => setEditEv({ ...editEv, complianceLevel: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              </div>
              <div className="mb-4"><label className="block text-sm font-medium mb-1">Fecha de evaluación</label><input type="date" value={editEv.evaluationDate} onChange={e => setEditEv({ ...editEv, evaluationDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div className="mb-4"><label className="block text-sm font-medium mb-1">Evidencia</label><textarea rows={2} value={editEv.complianceEvidence} onChange={e => setEditEv({ ...editEv, complianceEvidence: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div className="mb-4"><label className="block text-sm font-medium mb-1">Indicador asociado (referencia)</label><input value={editEv.indicatorNote} onChange={e => setEditEv({ ...editEv, indicatorNote: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div className="mb-4"><label className="block text-sm font-medium mb-1">Observaciones</label><textarea rows={2} value={editEv.observations} onChange={e => setEditEv({ ...editEv, observations: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div className="flex items-center gap-2"><input type="checkbox" id="ra" checked={editEv.requiresAction} onChange={e => setEditEv({ ...editEv, requiresAction: e.target.checked })} className="w-4 h-4" /><label htmlFor="ra" className="text-sm font-medium">¿Requiere acción CAPA?</label></div>
              <div className="mt-3"><button type="button" onClick={openNc} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700"><AlertTriangle className="w-4 h-4" />Crear No Conformidad (este período)</button></div>
            </div>

            <div className="border-t pt-4"><h3 className="text-sm font-semibold mb-3">Seguimiento</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium mb-1">Frecuencia</label><select value={editEv.reviewFrequency} onChange={e => setEditEv({ ...editEv, reviewFrequency: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="">—</option><option value="MONTHLY">Mensual</option><option value="QUARTERLY">Trimestral</option><option value="SEMIANNUAL">Semestral</option><option value="ANNUAL">Anual</option></select></div>
                <div><label className="block text-sm font-medium mb-1">Próxima evaluación</label><input type="date" value={editEv.nextEvaluationDate} onChange={e => setEditEv({ ...editEv, nextEvaluationDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-sm font-medium mb-1">Responsable seguim.</label><input value={editEv.followUpResponsible} onChange={e => setEditEv({ ...editEv, followUpResponsible: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              </div>
            </div>

            <div className="border-t pt-4 grid grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium mb-1">Influencia (1-5)</label><input type="number" min="1" max="5" value={editEv.influence} onChange={e => setEditEv({ ...editEv, influence: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">Interés (1-5)</label><input type="number" min="1" max="5" value={editEv.interest} onChange={e => setEditEv({ ...editEv, interest: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div>
                <label className="block text-sm font-medium mb-1">Criticidad</label>
                <select value={editEv.criticality} onChange={e => setEditEv({ ...editEv, criticality: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {CRIT_OPTS.map(o => <option key={o.v} value={o.v}>{criticalityStars(o.v)} {o.l}</option>)}
                </select>
              </div>
              <div className="col-span-3 text-xs text-gray-500">Clasificación: <b>{QUAD[quadrant(Number(editEv.influence), Number(editEv.interest))].label}</b> · Criticidad: <b className="text-amber-600">{criticalityStars(Number(editEv.criticality))}</b></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Contacto</label><input value={editSt.contactName || ''} onChange={e => setEditSt({ ...editSt, contactName: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">Email</label><input type="email" value={editSt.contactEmail || ''} onChange={e => setEditSt({ ...editSt, contactEmail: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            </div>
            <div><label className="block text-sm font-medium mb-1">Notas</label><textarea rows={2} value={editSt.notes || ''} onChange={e => setEditSt({ ...editSt, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>

            {/* Historial de evaluaciones */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><History className="w-4 h-4" />Historial de evaluaciones</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm"><thead className="bg-gray-50 border-b"><tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Período</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Estado</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Nivel</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Fecha</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">CAPA</th>
                </tr></thead><tbody className="divide-y">
                  {history.map(h => (<tr key={h.id} className={h.cycleId === editEv?.cycleId ? '' : ''}>
                    <td className="px-3 py-2">{(h as any).cycle?.name || '—'}</td>
                    <td className="px-3 py-2"><div className="flex items-center gap-1">{statusIcon(h.complianceStatus)}{t('complianceStatus', h.complianceStatus || 'PENDING')}</div></td>
                    <td className="px-3 py-2">{typeof h.complianceLevel === 'number' ? `${h.complianceLevel}%` : '—'}</td>
                    <td className="px-3 py-2">{dateStr(h.evaluationDate) || '—'}</td>
                    <td className="px-3 py-2">{h.actionItemId ? 'Sí' : (h.requiresAction ? 'Pend.' : '—')}</td>
                  </tr>))}
                  {history.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400 text-xs">Sin historial</td></tr>}
                </tbody></table>
              </div>
            </div>

            <div className="pt-4 border-t flex gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 text-sm">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      </div>}

      {/* Modal nueva parte */}
      {showNew && newSt && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
          <div className="flex justify-between p-6 border-b"><div className="flex items-center gap-2"><UsersRound className="w-5 h-5 text-blue-600" /><h2 className="text-lg font-semibold">Nueva parte interesada</h2></div><button onClick={() => setShowNew(false)} className="p-2 hover:bg-gray-100 rounded-lg"><XCircle className="w-5 h-5" /></button></div>
          <form onSubmit={saveNew} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="block text-sm font-medium mb-1">Nombre *</label><input value={newSt.name} onChange={e => setNewSt({ ...newSt, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required /></div>
              <div><label className="block text-sm font-medium mb-1">Tipo *</label><select value={newSt.type} onChange={e => setNewSt({ ...newSt, type: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="INTERNAL">Interna</option><option value="EXTERNAL">Externa</option></select></div>
              <div><label className="block text-sm font-medium mb-1">Categoría *</label><select value={newSt.category} onChange={e => setNewSt({ ...newSt, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="EMPLOYEE">Empleado</option><option value="CUSTOMER">Cliente</option><option value="SUPPLIER">Proveedor</option><option value="COMMUNITY">Comunidad</option><option value="REGULATOR">Regulador</option><option value="SHAREHOLDER">Accionista</option><option value="OTHER">Otro</option></select></div>
            </div>
            <div><label className="block text-sm font-medium mb-1">Necesidades</label><textarea rows={2} value={newSt.needs} onChange={e => setNewSt({ ...newSt, needs: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Expectativas</label><textarea rows={2} value={newSt.expectations} onChange={e => setNewSt({ ...newSt, expectations: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Requisitos</label><textarea rows={2} value={newSt.requirements} onChange={e => setNewSt({ ...newSt, requirements: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Influencia (1-5)</label><input type="number" min="1" max="5" value={newSt.influence} onChange={e => setNewSt({ ...newSt, influence: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">Interés (1-5)</label><input type="number" min="1" max="5" value={newSt.interest} onChange={e => setNewSt({ ...newSt, interest: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">Contacto</label><input value={newSt.contactName} onChange={e => setNewSt({ ...newSt, contactName: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">Email</label><input type="email" value={newSt.contactEmail} onChange={e => setNewSt({ ...newSt, contactEmail: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            </div>
            <div><label className="block text-sm font-medium mb-1">Notas</label><textarea rows={2} value={newSt.notes} onChange={e => setNewSt({ ...newSt, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div className="pt-4 border-t flex gap-3">
              <button type="button" onClick={() => setShowNew(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 text-sm">{saving ? 'Guardando...' : 'Crear'}</button>
            </div>
          </form>
        </div>
      </div>}

      {/* Modal NC */}
      {showNc && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
          <div className="flex justify-between p-6 border-b"><div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-600" /><h2 className="text-lg font-semibold">Crear No Conformidad</h2></div><button onClick={() => setShowNc(false)} className="p-2 hover:bg-gray-100 rounded-lg"><XCircle className="w-5 h-5" /></button></div>
          <form onSubmit={saveNc} className="p-6 space-y-4">
            <div><label className="block text-sm font-medium mb-1">Título</label><input value={ncForm.title} onChange={e => setNcForm({ ...ncForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required /></div>
            <div><label className="block text-sm font-medium mb-1">Descripción</label><textarea rows={4} value={ncForm.description} onChange={e => setNcForm({ ...ncForm, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Severidad</label><select value={ncForm.severity} onChange={e => setNcForm({ ...ncForm, severity: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="CRITICAL">Crítica</option><option value="MAJOR">Mayor</option><option value="MINOR">Menor</option><option value="OBSERVATION">Observación</option></select></div>
              <div><label className="block text-sm font-medium mb-1">Fecha límite</label><input type="date" value={ncForm.dueDate} onChange={e => setNcForm({ ...ncForm, dueDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            </div>
            <div className="pt-4 border-t flex gap-3">
              <button type="button" onClick={() => setShowNc(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button type="submit" disabled={ncSaving} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50 text-sm">{ncSaving ? 'Creando...' : 'Crear NC'}</button>
            </div>
          </form>
        </div>
      </div>}

      {/* Modal Análisis IA */}
      {showAI && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto flex flex-col">
          <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
            <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-violet-600" /><h2 className="text-lg font-semibold">Análisis IA — {currentCycle?.name}</h2></div>
            <div className="flex items-center gap-2">
              {!aiLoading && aiText && <button onClick={runAI} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Regenerar</button>}
              <button onClick={() => setShowAI(false)} className="p-2 hover:bg-gray-100 rounded-lg"><XCircle className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="p-6">
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Sparkles className="w-8 h-8 text-violet-500 animate-pulse mb-3" />
                <p className="text-sm">Analizando el ciclo con IA...</p>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none">{renderAI(aiText)}</div>
            )}
          </div>
        </div>
      </div>}

      {/* Modal Configuración del ciclo */}
      {showCfg && cfg && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col">
          <div className="flex justify-between items-center p-6 border-b">
            <div className="flex items-center gap-2"><Settings className="w-5 h-5 text-blue-600" /><h2 className="text-lg font-semibold">Configurar ciclo</h2></div>
            <button onClick={() => setShowCfg(false)} className="p-2 hover:bg-gray-100 rounded-lg"><XCircle className="w-5 h-5" /></button>
          </div>
          <form onSubmit={saveCfg} className="p-6 space-y-4">
            <div><label className="block text-sm font-medium mb-1">Nombre del ciclo</label><input value={cfg.name} onChange={e => setCfg({ ...cfg, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Estado</label><select value={cfg.status} onChange={e => setCfg({ ...cfg, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="ACTIVE">Vigente</option><option value="DRAFT">Borrador</option><option value="CLOSED">Cerrado</option></select></div>
              <div><label className="block text-sm font-medium mb-1">Fecha de cierre</label><input type="date" value={cfg.endDate} onChange={e => setCfg({ ...cfg, endDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            </div>
            <div><label className="block text-sm font-medium mb-1">Responsable del ciclo</label><input value={cfg.responsible} onChange={e => setCfg({ ...cfg, responsible: e.target.value })} placeholder="Nombre del responsable" className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div className="pt-4 border-t flex gap-3">
              <button type="button" onClick={() => setShowCfg(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button type="submit" disabled={cfgSaving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 text-sm">{cfgSaving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      </div>}
    </div>
  );
}
