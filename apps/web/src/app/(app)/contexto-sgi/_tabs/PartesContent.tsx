'use client';
import { useState, useEffect, useCallback } from 'react';
import { UsersRound, Plus, Edit, Trash2, AlertCircle, CheckCircle, XCircle, AlertTriangle, Clock, Copy, History } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { t } from '@/lib/dictionary';

type Cycle = { id: string; name: string; year: number; status: string; startDate?: string; endDate?: string };
type Stakeholder = { id: string; name: string; type: string; category: string; contactName?: string; contactEmail?: string; notes?: string };
type Evaluation = {
  id: string; stakeholderId: string; cycleId: string;
  complianceStatus?: string | null; complianceLevel?: number | null; evaluationDate?: string | null;
  complianceEvidence?: string | null; indicatorNote?: string | null; requiresAction?: boolean;
  actionItemId?: string | null; influence?: number | null; interest?: number | null; observations?: string | null;
  needs?: string | null; expectations?: string | null; requirements?: string | null;
  reviewFrequency?: string | null; nextEvaluationDate?: string | null; followUpResponsible?: string | null;
  stakeholder: Stakeholder;
};

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
  const [genAction, setGenAction] = useState(false);

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
  };

  // Matriz poder/interés
  const matrix = { MANAGE: [] as Evaluation[], SATISFY: [] as Evaluation[], INFORM: [] as Evaluation[], MONITOR: [] as Evaluation[] };
  evals.forEach(e => matrix[quadrant(e.influence, e.interest)].push(e));

  const filtered = filter === 'ALL' ? evals
    : filter === 'PENDING' ? evals.filter(e => !e.complianceStatus || e.complianceStatus === 'PENDING')
    : evals.filter(e => e.complianceStatus === filter);

  const statusIcon = (s?: string | null) =>
    s === 'COMPLIES' ? <CheckCircle className="w-4 h-4 text-green-500" />
    : s === 'PARTIAL' ? <AlertCircle className="w-4 h-4 text-yellow-500" />
    : s === 'NON_COMPLIANT' ? <XCircle className="w-4 h-4 text-red-500" />
    : <Clock className="w-4 h-4 text-gray-400" />;

  const nextEvalBadge = (d?: string | null) => {
    if (!d) return <span className="text-xs text-gray-400">—</span>;
    const days = daysUntil(d);
    if (days === null) return <span className="text-xs text-gray-400">—</span>;
    if (days < 0) return <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 font-medium">Vencida</span>;
    if (days <= 30) return <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700 font-medium">En {days}d</span>;
    return <span className="text-xs text-gray-500">{dateStr(d)}</span>;
  };

  // ── Abrir modal de edición ──
  const openEdit = async (ev: Evaluation) => {
    setEditSt({ ...ev.stakeholder });
    setEditEv({
      id: ev.id, complianceStatus: ev.complianceStatus || 'PENDING', complianceLevel: ev.complianceLevel ?? 0,
      evaluationDate: dateStr(ev.evaluationDate), complianceEvidence: ev.complianceEvidence || '',
      indicatorNote: ev.indicatorNote || '', requiresAction: ev.requiresAction || false,
      influence: ev.influence ?? 3, interest: ev.interest ?? 3, observations: ev.observations || '',
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
        influence: Number(editEv.influence), interest: Number(editEv.interest), observations: editEv.observations || null,
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Partes Interesadas</h1>
          <p className="text-sm text-gray-600">Stakeholders con evaluación de cumplimiento por período</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Período:</span>
            <select value={cycleId} onChange={e => setCycleId(e.target.value)} className="px-3 py-2 border rounded-lg text-sm font-medium">
              {cycles.length === 0 && <option value="">Sin ciclos</option>}
              {cycles.map(c => <option key={c.id} value={c.id}>{c.name} · {t('cycleStatus', c.status)}</option>)}
            </select>
          </div>
          <button onClick={createNext} disabled={busyCycle || !cycleId} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"><Copy className="w-4 h-4" />Crear ciclo siguiente</button>
          <button onClick={openNew} disabled={!cycleId} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"><Plus className="w-4 h-4" />Nueva</button>
        </div>
      </div>

      {/* Dashboard del período */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mt-4">
        {[
          { l: 'Total', v: summary.total, c: 'text-gray-700' },
          { l: 'Cumplen', v: summary.complies, c: 'text-green-600' },
          { l: 'Parciales', v: summary.partial, c: 'text-yellow-600' },
          { l: 'No cumplen', v: summary.nonCompliant, c: 'text-red-600' },
          { l: 'Pendientes', v: summary.pending, c: 'text-gray-500' },
          { l: 'Acciones abiertas', v: summary.openActions, c: 'text-orange-600' },
          { l: 'Eval. vencidas', v: summary.overdue, c: 'text-red-600' },
          { l: 'Nivel prom.', v: `${summary.avgLevel}%`, c: 'text-blue-600' },
        ].map((m, i) => (
          <div key={i} className="bg-white rounded-lg border p-3 text-center">
            <div className={`text-xl font-bold ${m.c}`}>{m.v}</div>
            <div className="text-[11px] text-gray-500 leading-tight mt-0.5">{m.l}</div>
          </div>
        ))}
      </div>

      {/* Matriz Poder vs Interés */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        {(['MANAGE', 'SATISFY', 'INFORM', 'MONITOR'] as const).map(q => (
          <div key={q} className={`rounded-lg border p-3 ${QUAD[q].color}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">{QUAD[q].label}</span>
              <span className="text-xs font-bold">{matrix[q].length}</span>
            </div>
            <div className="text-[11px] mt-1 line-clamp-2 opacity-80">{matrix[q].map(e => e.stakeholder.name).join(', ') || '—'}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border p-3 my-4 flex items-center gap-2">
        <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="ALL">Todos</option>
          <option value="COMPLIES">Cumple</option>
          <option value="PARTIAL">Parcial</option>
          <option value="NON_COMPLIANT">No cumple</option>
          <option value="PENDING">Pendiente</option>
        </select>
        {currentCycle && <span className="text-xs text-gray-400">{currentCycle.name} — {t('cycleStatus', currentCycle.status)}</span>}
      </div>

      {loading ? <div className="text-center py-12 text-gray-500">Cargando...</div> :
      !cycleId ? <div className="text-center py-12 text-gray-500">No hay ciclos de evaluación. Cree el primero.</div> :
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full"><thead className="bg-gray-50 border-b"><tr>
          <th className="px-4 py-3 text-left text-xs font-semibold">Nombre</th>
          <th className="px-4 py-3 text-left text-xs font-semibold">Tipo</th>
          <th className="px-4 py-3 text-left text-xs font-semibold">Cat</th>
          <th className="px-4 py-3 text-left text-xs font-semibold">Estado</th>
          <th className="px-4 py-3 text-left text-xs font-semibold">Nivel</th>
          <th className="px-4 py-3 text-left text-xs font-semibold">Próx. eval</th>
          <th className="px-4 py-3 text-left text-xs font-semibold">Acción?</th>
          <th className="px-4 py-3 text-left text-xs font-semibold">Ops</th>
        </tr></thead><tbody className="divide-y">
        {filtered.map(ev => (<tr key={ev.id} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-sm font-medium">{ev.stakeholder.name}</td>
          <td className="px-4 py-3 text-sm">{t('stakeholderType', ev.stakeholder.type)}</td>
          <td className="px-4 py-3 text-sm">{t('stakeholderCategory', ev.stakeholder.category)}</td>
          <td className="px-4 py-3 text-sm"><div className="flex items-center gap-2">{statusIcon(ev.complianceStatus)}{t('complianceStatus', ev.complianceStatus || 'PENDING')}</div></td>
          <td className="px-4 py-3 text-sm">{typeof ev.complianceLevel === 'number' ? `${ev.complianceLevel}%` : '—'}</td>
          <td className="px-4 py-3 text-sm">{nextEvalBadge(ev.nextEvaluationDate)}</td>
          <td className="px-4 py-3 text-sm">{ev.requiresAction ? 'Sí' : 'No'}</td>
          <td className="px-4 py-3 text-sm"><div className="flex gap-2 items-center">
            {ev.requiresAction && (ev.actionItemId
              ? <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> Acción</span>
              : <button onClick={() => generateAction(ev)} disabled={genAction} className="px-2 py-1 text-xs bg-green-600 text-white rounded disabled:opacity-50">Generar Acción</button>)}
            <button onClick={() => openEdit(ev)} className="p-1 hover:bg-gray-200 rounded"><Edit className="w-4 h-4" /></button>
            <button onClick={() => del(ev)} className="p-1 hover:bg-gray-200 rounded"><Trash2 className="w-4 h-4" /></button>
          </div></td>
        </tr>))}
        {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">Sin partes interesadas en este período.</td></tr>}
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

            <div className="border-t pt-4 grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Influencia (1-5)</label><input type="number" min="1" max="5" value={editEv.influence} onChange={e => setEditEv({ ...editEv, influence: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">Interés (1-5)</label><input type="number" min="1" max="5" value={editEv.interest} onChange={e => setEditEv({ ...editEv, interest: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div className="col-span-2 text-xs text-gray-500">Clasificación: <b>{QUAD[quadrant(Number(editEv.influence), Number(editEv.interest))].label}</b></div>
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
    </div>
  );
}
