'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft, Play, CheckCircle, XCircle, MinusCircle,
  AlertTriangle, Users, Calendar, Plus, Trash2,
  ArrowRight, Loader2, ShieldAlert, Sparkles, Bot,
  MessageSquare, FileText,
} from 'lucide-react';

type ChecklistItem = {
  id: string; clause: string; requirement: string;
  whatToCheck: string | null; order: number;
  response: 'COMPLIES' | 'DOES_NOT_COMPLY' | 'NOT_APPLICABLE' | null;
  comment: string | null; evidence: string | null;
};
type Finding = {
  id: string; code: string; type: string; severity: string;
  status: string; description: string; evidence: string | null;
  clause: string | null; ncrId: string | null; detectedAt: string;
};
type TeamMember = {
  id: string; userId: string; role: string;
  auditor: { name: string; email: string } | null;
};
type ScheduleItem = {
  id: string; phase: string; plannedDate: string | null;
  actualDate: string | null; duration: number | null;
  location: string | null; notes: string | null;
};
type Audit = {
  id: string; code: string; title: string; status: string;
  area: string; process: string | null;
};
type Employee = { id: string; firstName: string; lastName: string; email: string };
type AuditorRec = { id: string; name: string; email: string };

const STATUS_LABELS: Record<string, string> = {
  DRAFT:'Borrador', PLANNED:'Planificada', SCHEDULED:'Programada',
  IN_PROGRESS:'En ejecución', PENDING_REPORT:'Pendiente informe',
  COMPLETED:'Finalizada', CLOSED:'Cerrada',
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT:'bg-gray-100 text-gray-800', PLANNED:'bg-blue-100 text-blue-800',
  SCHEDULED:'bg-purple-100 text-purple-800', IN_PROGRESS:'bg-yellow-100 text-yellow-800',
  PENDING_REPORT:'bg-orange-100 text-orange-800', COMPLETED:'bg-green-100 text-green-800',
  CLOSED:'bg-gray-100 text-gray-800',
};
const FINDING_TYPE_LABELS: Record<string, string> = {
  NON_CONFORMITY:'No conformidad', OBSERVATION:'Observación',
  OPPORTUNITY:'Oportunidad', POSITIVE_PRACTICE:'Buena práctica',
};
const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL:'Crítica', MAJOR:'Mayor', MINOR:'Menor',
  OBSERVATION:'Observación', OPPORTUNITY:'Oportunidad',
};
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL:'bg-red-100 text-red-800', MAJOR:'bg-orange-100 text-orange-800',
  MINOR:'bg-yellow-100 text-yellow-800', OBSERVATION:'bg-blue-100 text-blue-800',
  OPPORTUNITY:'bg-green-100 text-green-800',
};
const TEAM_ROLE_LABELS: Record<string, string> = {
  LEADER:'Líder', AUDITOR:'Auditor', OBSERVER:'Observador',
};

export default function AuditExecutePage() {
  const params = useParams();
  const auditId = params.id as string;
  const [audit, setAudit] = useState<Audit | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [auditors, setAuditors] = useState<AuditorRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'checklist'|'findings'|'team'|'schedule'>('checklist');
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const [showFindingModal, setShowFindingModal] = useState(false);
  const [findingForm, setFindingForm] = useState({ code:'', type:'NON_CONFORMITY', severity:'MINOR', description:'', evidence:'', clause:'' });
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamForm, setTeamForm] = useState({ userId:'', auditorId:'', role:'AUDITOR' });
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ id:'', phase:'', plannedDate:'', actualDate:'', duration:'', location:'', notes:'' });

  // AI states
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<any>(null);
  const [showAiDraftModal, setShowAiDraftModal] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{role:string; content:string}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [classificationResult, setClassificationResult] = useState<any>(null);
  const [showClassificationModal, setShowClassificationModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const [fullRes, empRes, audRes] = await Promise.all([
        apiFetch(`/audit/audits/${auditId}/full`) as Promise<any>,
        apiFetch('/hr/employees') as Promise<any>,
        apiFetch('/audit/auditors') as Promise<any>,
      ]);
      if (fullRes.audit) {
        setAudit(fullRes.audit);
        setChecklist(fullRes.audit.checklist || []);
        setFindings(fullRes.audit.findings || []);
        setTeam(fullRes.audit.team || []);
        setSchedule(fullRes.audit.schedule || []);
      }
      if (empRes.employees) setEmployees(empRes.employees);
      if (audRes.auditors) setAuditors(audRes.auditors);
    } catch (err) { setError('Error al cargar la auditoría'); }
    finally { setLoading(false); }
  }, [auditId]);

  useEffect(() => { if (auditId) loadData(); }, [auditId, loadData]);

  async function updateItem(itemId: string, response: ChecklistItem['response'], comment?: string, evidence?: string) {
    try {
      setSaving(true);
      const res = (await apiFetch(`/audit/checklist/${itemId}`, { method:'PATCH', json:{ response, comment, evidence } })) as any;
      if (res.item) {
        setChecklist(prev => prev.map(i => i.id === itemId ? res.item : i));
        const fRes = (await apiFetch(`/audit/audits/${auditId}/findings`)) as any;
        if (fRes.findings) setFindings(fRes.findings);
      }
    } catch (err) { setError('Error al guardar respuesta'); }
    finally { setSaving(false); }
  }

  async function transitionStatus(targetStatus: string) {
    try {
      setTransitioning(true);
      const res = (await apiFetch(`/audit/audits/${auditId}/execute`, { method:'POST', json:{ status: targetStatus } })) as any;
      if (res.audit) setAudit(res.audit);
    } catch (err: any) { setError(err?.message || 'Error al cambiar estado'); }
    finally { setTransitioning(false); }
  }

  async function addFinding(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      const res = (await apiFetch(`/audit/audits/${auditId}/findings`, {
        method:'POST', json:{
          code: findingForm.code || `H-${findings.length + 1}`,
          type: findingForm.type, severity: findingForm.severity,
          description: findingForm.description,
          evidence: findingForm.evidence || null,
          clause: findingForm.clause || null,
        },
      })) as any;
      if (res.finding) {
        setFindings(prev => [res.finding, ...prev]);
        setShowFindingModal(false);
        setFindingForm({ code:'', type:'NON_CONFORMITY', severity:'MINOR', description:'', evidence:'', clause:'' });
      }
    } catch (err) { setError('Error al crear hallazgo'); }
    finally { setSaving(false); }
  }

  async function createNcrFromFinding(findingId: string) {
    try {
      setSaving(true);
      const res = (await apiFetch(`/audit/iso-findings/${findingId}/create-ncr`, { method:'POST', json:{} })) as any;
      if (res.ncr) setFindings(prev => prev.map(f => f.id === findingId ? { ...f, ncrId: res.ncr.id } : f));
    } catch (err: any) { setError(err?.message || 'Error al crear NC'); }
    finally { setSaving(false); }
  }

  async function addTeamMember(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      const res = (await apiFetch(`/audit/audits/${auditId}/team`, {
        method:'POST', json:{ userId: teamForm.userId, auditorId: teamForm.auditorId || null, role: teamForm.role },
      })) as any;
      if (res.member) { setTeam(prev => [...prev, res.member]); setShowTeamModal(false); setTeamForm({ userId:'', auditorId:'', role:'AUDITOR' }); }
    } catch (err) { setError('Error al agregar miembro'); }
    finally { setSaving(false); }
  }

  async function removeTeamMember(userId: string) {
    if (!confirm('Eliminar este miembro del equipo?')) return;
    try {
      await apiFetch(`/audit/audits/${auditId}/team/${userId}`, { method:'DELETE' });
      setTeam(prev => prev.filter(m => m.userId !== userId));
    } catch (err) { setError('Error al eliminar miembro'); }
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      const res = (await apiFetch(`/audit/audits/${auditId}/schedule`, {
        method:'POST', json:{
          id: scheduleForm.id || undefined, phase: scheduleForm.phase,
          plannedDate: scheduleForm.plannedDate || null,
          actualDate: scheduleForm.actualDate || null,
          duration: scheduleForm.duration ? parseInt(scheduleForm.duration) : null,
          location: scheduleForm.location || null, notes: scheduleForm.notes || null,
        },
      })) as any;
      if (res.item) {
        setSchedule(prev => {
          const ex = prev.find(s => s.id === res.item.id);
          if (ex) return prev.map(s => s.id === res.item.id ? res.item : s);
          return [...prev, res.item];
        });
        setShowScheduleModal(false);
        setScheduleForm({ id:'', phase:'', plannedDate:'', actualDate:'', duration:'', location:'', notes:'' });
      }
    } catch (err) { setError('Error al guardar fase'); }
    finally { setSaving(false); }
  }

  async function deleteSchedule(id: string) {
    if (!confirm('Eliminar esta fase del cronograma?')) return;
    try {
      await apiFetch(`/audit/audits/${auditId}/schedule/${id}`, { method:'DELETE' });
      setSchedule(prev => prev.filter(s => s.id !== id));
    } catch (err) { setError('Error al eliminar fase'); }
  }

  // AI Handlers
  async function generateAiChecklist() {
    try {
      setAiLoading(true); setError(null);
      const res = (await apiFetch(`/audit/audits/${auditId}/generate-checklist`, { method:'POST' })) as any;
      if (res.items) {
        setChecklist(res.items);
        setError(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al generar checklist con IA');
    } finally { setAiLoading(false); }
  }

  async function classifyFindingWithAi(findingId: string) {
    try {
      setAiLoading(true); setError(null);
      const res = (await apiFetch(`/audit/iso-findings/${findingId}/classify`, { method:'POST' })) as any;
      if (res.classification) {
        setClassificationResult(res);
        setShowClassificationModal(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al clasificar con IA');
    } finally { setAiLoading(false); }
  }

  async function generateAiReport() {
    try {
      setAiLoading(true); setError(null);
      const res = (await apiFetch(`/audit/audits/${auditId}/report/ai-draft`, { method:'POST' })) as any;
      if (res.draft) {
        setAiDraft(res.draft);
        setShowAiDraftModal(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al generar informe con IA');
    } finally { setAiLoading(false); }
  }

  async function sendChatMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role:'user', content: userMsg }]);
    setChatInput('');
    try {
      setAiLoading(true);
      const res = (await apiFetch(`/audit/audits/${auditId}/chat`, {
        method:'POST', json:{ message: userMsg, history: chatMessages },
      })) as any;
      if (res.reply) {
        setChatMessages(prev => [...prev, { role:'assistant', content: res.reply }]);
      }
    } catch (err: any) {
      setError(err?.message || 'Error en chat de IA');
    } finally { setAiLoading(false); }
  }

  const answered = checklist.filter(i => i.response != null).length;
  const compliant = checklist.filter(i => i.response === 'COMPLIES').length;
  const nonCompliant = checklist.filter(i => i.response === 'DOES_NOT_COMPLY').length;
  const na = checklist.filter(i => i.response === 'NOT_APPLICABLE').length;
  const progress = checklist.length > 0 ? Math.round((answered / checklist.length) * 100) : 0;

  const canStart = ['PLANNED','SCHEDULED'].includes(audit?.status || '');
  const canComplete = audit?.status === 'IN_PROGRESS';
  const canClose = audit?.status === 'COMPLETED';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="space-y-6">
        <Link href="/auditorias" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800">
          <ChevronLeft className="w-4 h-4" /> Volver al listado
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error || 'Auditoría no encontrada'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <Link href={`/auditorias/${auditId}`} className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-2">
            <ChevronLeft className="w-4 h-4" /> Volver a detalle
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">Ejecutar: {audit.code}</h1>
            <span className={`px-3 py-1 rounded-full text-sm ${STATUS_COLORS[audit.status]}`}>{STATUS_LABELS[audit.status]}</span>
          </div>
          <p className="text-gray-600">{audit.title}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowAiChat(true)} disabled={aiLoading}
            className="inline-flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 border border-purple-200 text-sm">
            <Bot className="w-4 h-4" /> Chat IA
          </button>
          {canComplete && (
            <button onClick={generateAiReport} disabled={aiLoading}
              className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 border border-indigo-200 text-sm">
              <Sparkles className="w-4 h-4" /> Informe IA
            </button>
          )}
          {canStart && (
            <button onClick={() => transitionStatus('IN_PROGRESS')} disabled={transitioning}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
              <Play className="w-4 h-4" /> {transitioning ? 'Iniciando...' : 'Iniciar auditoría'}
            </button>
          )}
          {canComplete && (
            <button onClick={() => transitionStatus('PENDING_REPORT')} disabled={transitioning}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              <CheckCircle className="w-4 h-4" /> {transitioning ? 'Finalizando...' : 'Finalizar ejecución'}
            </button>
          )}
          {canClose && (
            <button onClick={() => transitionStatus('CLOSED')} disabled={transitioning}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50">
              <ArrowRight className="w-4 h-4" /> {transitioning ? 'Cerrando...' : 'Cerrar auditoría'}
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progreso del checklist</span>
          <span className="text-sm text-gray-500">{answered} / {checklist.length} ítems ({progress}%)</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex gap-4 mt-3 text-sm">
          <span className="text-green-600">Conforme: {compliant}</span>
          <span className="text-red-600">No conforme: {nonCompliant}</span>
          <span className="text-gray-500">N/A: {na}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {[
            { key:'checklist' as const, label:'Checklist', icon:CheckCircle },
            { key:'findings' as const, label:`Hallazgos (${findings.length})`, icon:AlertTriangle },
            { key:'team' as const, label:'Equipo', icon:Users },
            { key:'schedule' as const, label:'Cronograma', icon:Calendar },
          ].map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[300px]">
        {/* CHECKLIST */}
        {tab === 'checklist' && (
          <div className="divide-y divide-gray-100">
            {checklist.length === 0 && (
              <div className="p-8 text-center space-y-4">
                <p className="text-gray-500">No hay ítems de checklist definidos.</p>
                <button onClick={generateAiChecklist} disabled={aiLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors border border-purple-200 text-sm">
                  <Sparkles className="w-4 h-4" /> {aiLoading ? 'Generando...' : 'Generar checklist con IA'}
                </button>
              </div>
            )}
            {checklist.length > 0 && (
              <div className="p-4 flex items-center justify-between bg-gray-50">
                <span className="text-sm font-medium text-gray-700">Checklist ({checklist.length} ítems)</span>
                <button onClick={generateAiChecklist} disabled={aiLoading}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors border border-purple-200 text-sm">
                  <Sparkles className="w-4 h-4" /> {aiLoading ? 'Generando...' : 'Regenerar con IA'}
                </button>
              </div>
            )}
            {checklist.map(item => (
              <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">{item.order + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 bg-blue-50 text-blue-700 rounded">{item.clause}</span>
                      <span className="text-sm font-medium text-gray-900">{item.requirement}</span>
                    </div>
                    {item.whatToCheck && <p className="text-sm text-gray-500 mb-3">{item.whatToCheck}</p>}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(['COMPLIES','DOES_NOT_COMPLY','NOT_APPLICABLE'] as const).map(resp => {
                        const labels: Record<string,string> = { COMPLIES:'Conforme', DOES_NOT_COMPLY:'No conforme', NOT_APPLICABLE:'N/A' };
                        const active = item.response === resp;
                        const color = active
                          ? (resp==='COMPLIES'?'bg-green-100 text-green-800 border-green-300'
                            : resp==='DOES_NOT_COMPLY'?'bg-red-100 text-red-800 border-red-300'
                            : 'bg-gray-100 text-gray-800 border-gray-300')
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50';
                        return (
                          <button key={resp} disabled={saving}
                            onClick={() => updateItem(item.id, resp, item.comment || undefined, item.evidence || undefined)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${color}`}>
                            {resp==='COMPLIES' ? <CheckCircle className="w-4 h-4"/>
                              : resp==='DOES_NOT_COMPLY' ? <XCircle className="w-4 h-4"/>
                              : <MinusCircle className="w-4 h-4"/>}
                            {labels[resp]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input type="text" placeholder="Comentario..."
                        defaultValue={item.comment || ''}
                        onBlur={e => { if (e.target.value !== (item.comment||'')) updateItem(item.id, item.response, e.target.value || undefined, item.evidence || undefined); }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      <input type="text" placeholder="Evidencia (URL o descripción)..."
                        defaultValue={item.evidence || ''}
                        onBlur={e => { if (e.target.value !== (item.evidence||'')) updateItem(item.id, item.response, item.comment || undefined, e.target.value || undefined); }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FINDINGS */}
        {tab === 'findings' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Hallazgos registrados</h3>
              <button onClick={() => setShowFindingModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                <Plus className="w-4 h-4" /> Agregar hallazgo
              </button>
            </div>
            {findings.length === 0 && <div className="text-center text-gray-500 py-8">No hay hallazgos registrados.</div>}
            <div className="space-y-3">
              {findings.map(f => (
                <div key={f.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{f.code}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${SEVERITY_COLORS[f.severity]||'bg-gray-100 text-gray-800'}`}>{SEVERITY_LABELS[f.severity]||f.severity}</span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">{FINDING_TYPE_LABELS[f.type]||f.type}</span>
                      </div>
                      <p className="text-sm text-gray-800 mb-2">{f.description}</p>
                      {f.clause && <p className="text-xs text-gray-500 mb-1">Cláusula: {f.clause}</p>}
                      {f.evidence && <p className="text-xs text-gray-500 mb-1">Evidencia: {f.evidence}</p>}
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => classifyFindingWithAi(f.id)} disabled={aiLoading}
                          className="inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded hover:bg-purple-100">
                          <Sparkles className="w-3 h-3" /> Clasificar IA
                        </button>
                        {f.ncrId ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                            <CheckCircle className="w-3 h-3" /> NC vinculada
                          </span>
                        ) : f.type === 'NON_CONFORMITY' ? (
                          <button onClick={() => createNcrFromFinding(f.id)} disabled={saving}
                            className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100">
                            <ShieldAlert className="w-3 h-3" /> Crear NC
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TEAM */}
        {tab === 'team' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Equipo de auditoría</h3>
              <button onClick={() => setShowTeamModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                <Plus className="w-4 h-4" /> Agregar miembro
              </button>
            </div>
            {team.length === 0 && <div className="text-center text-gray-500 py-8">No hay miembros en el equipo.</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {team.map(m => (
                <div key={m.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{m.auditor?.name || 'Usuario'}</span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{TEAM_ROLE_LABELS[m.role]||m.role}</span>
                    </div>
                    <p className="text-sm text-gray-500">{m.auditor?.email || ''}</p>
                  </div>
                  <button onClick={() => removeTeamMember(m.userId)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SCHEDULE */}
        {tab === 'schedule' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Cronograma de fases</h3>
              <button onClick={() => { setScheduleForm({ id:'', phase:'', plannedDate:'', actualDate:'', duration:'', location:'', notes:'' }); setShowScheduleModal(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                <Plus className="w-4 h-4" /> Agregar fase
              </button>
            </div>
            {schedule.length === 0 && <div className="text-center text-gray-500 py-8">No hay fases definidas.</div>}
            <div className="space-y-3">
              {schedule.map(s => (
                <div key={s.id} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900">{s.phase}</h4>
                      {s.plannedDate && <span className="text-sm text-gray-500">{new Date(s.plannedDate).toLocaleDateString('es-ES')}</span>}
                      {s.duration && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">{s.duration} min</span>}
                    </div>
                    {s.location && <p className="text-sm text-gray-500 mb-1">Lugar: {s.location}</p>}
                    {s.notes && <p className="text-sm text-gray-600">{s.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => {
                      setScheduleForm({ id:s.id, phase:s.phase, plannedDate:s.plannedDate?.slice(0,10)||'', actualDate:s.actualDate?.slice(0,10)||'', duration:s.duration?.toString()||'', location:s.location||'', notes:s.notes||'' });
                      setShowScheduleModal(true);
                    }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm">Editar</button>
                    <button onClick={() => deleteSchedule(s.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Finding Modal */}
      {showFindingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Nuevo hallazgo</h3>
              <button onClick={() => setShowFindingModal(false)} className="p-1 hover:bg-gray-100 rounded text-gray-500">×</button>
            </div>
            <form onSubmit={addFinding} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                  <input type="text" value={findingForm.code} onChange={e => setFindingForm({...findingForm, code:e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="H-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cláusula</label>
                  <input type="text" value={findingForm.clause} onChange={e => setFindingForm({...findingForm, clause:e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="8.5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={findingForm.type} onChange={e => setFindingForm({...findingForm, type:e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {Object.entries(FINDING_TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severidad</label>
                  <select value={findingForm.severity} onChange={e => setFindingForm({...findingForm, severity:e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {Object.entries(SEVERITY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción <span className="text-red-500">*</span></label>
                <textarea value={findingForm.description} onChange={e => setFindingForm({...findingForm, description:e.target.value})}
                  required rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Evidencia</label>
                <input type="text" value={findingForm.evidence} onChange={e => setFindingForm({...findingForm, evidence:e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="URL o descripción" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowFindingModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar hallazgo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 my-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Agregar miembro al equipo</h3>
              <button onClick={() => setShowTeamModal(false)} className="p-1 hover:bg-gray-100 rounded text-gray-500">×</button>
            </div>
            <form onSubmit={addTeamMember} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuario (ID) <span className="text-red-500">*</span></label>
                <select value={teamForm.userId} onChange={e => { setTeamForm({...teamForm, userId:e.target.value}); const a = auditors.find(aud => aud.id === e.target.value); if (a) setTeamForm({...teamForm, userId:e.target.value, auditorId:a.id}); }}
                  required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">Seleccionar usuario...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auditor vinculado</label>
                <select value={teamForm.auditorId} onChange={e => setTeamForm({...teamForm, auditorId:e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">Sin vincular</option>
                  {auditors.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select value={teamForm.role} onChange={e => setTeamForm({...teamForm, role:e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {Object.entries(TEAM_ROLE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowTeamModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 my-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{scheduleForm.id ? 'Editar fase' : 'Nueva fase'}</h3>
              <button onClick={() => setShowScheduleModal(false)} className="p-1 hover:bg-gray-100 rounded text-gray-500">×</button>
            </div>
            <form onSubmit={saveSchedule} className="p-6 space-y-4">
              <input type="hidden" value={scheduleForm.id} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fase <span className="text-red-500">*</span></label>
                <input type="text" value={scheduleForm.phase} onChange={e => setScheduleForm({...scheduleForm, phase:e.target.value})}
                  required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Ej: Apertura, Documental, Cierre" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha planificada</label>
                  <input type="date" value={scheduleForm.plannedDate} onChange={e => setScheduleForm({...scheduleForm, plannedDate:e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha real</label>
                  <input type="date" value={scheduleForm.actualDate} onChange={e => setScheduleForm({...scheduleForm, actualDate:e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duración (minutos)</label>
                <input type="number" value={scheduleForm.duration} onChange={e => setScheduleForm({...scheduleForm, duration:e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="60" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lugar</label>
                <input type="text" value={scheduleForm.location} onChange={e => setScheduleForm({...scheduleForm, location:e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Sala de reuniones" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea value={scheduleForm.notes} onChange={e => setScheduleForm({...scheduleForm, notes:e.target.value})}
                  rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowScheduleModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar fase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Draft Report Modal */}
      {showAiDraftModal && aiDraft && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 my-8 max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" /> Borrador de Informe IA
              </h3>
              <button onClick={() => setShowAiDraftModal(false)} className="p-1 hover:bg-gray-100 rounded text-gray-500">×</button>
            </div>
            <div className="p-6 space-y-4">
              {aiDraft.overallScore !== null && (
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-3xl font-bold text-indigo-600">{aiDraft.overallScore}%</div>
                  <div className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100">{aiDraft.complianceLevel || 'N/A'}</div>
                </div>
              )}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Resumen Ejecutivo</h4>
                <p className="text-sm text-gray-700 whitespace-pre-line">{aiDraft.executiveSummary}</p>
              </div>
              {aiDraft.strengths?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Fortalezas</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {aiDraft.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {aiDraft.weaknesses?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Debilidades</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {aiDraft.weaknesses.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {aiDraft.recommendations?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Recomendaciones</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {aiDraft.recommendations.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {aiDraft.conclusion && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Conclusión</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{aiDraft.conclusion}</p>
                </div>
              )}
              <div className="pt-4 text-xs text-gray-400">Generado por IA: {new Date(aiDraft.generatedAt).toLocaleString('es-ES')}</div>
            </div>
          </div>
        </div>
      )}

      {/* AI Classification Modal */}
      {showClassificationModal && classificationResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" /> Clasificación IA
              </h3>
              <button onClick={() => setShowClassificationModal(false)} className="p-1 hover:bg-gray-100 rounded text-gray-500">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">Tipo sugerido</div>
                  <div className="font-medium">{FINDING_TYPE_LABELS[classificationResult.classification?.type] || classificationResult.classification?.type}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">Severidad sugerida</div>
                  <div className="font-medium">{SEVERITY_LABELS[classificationResult.classification?.severity] || classificationResult.classification?.severity}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Justificación</div>
                <p className="text-sm text-gray-700">{classificationResult.classification?.rationale || 'Sin justificación'}</p>
              </div>
              {classificationResult.classification?.suggestedActions?.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Acciones sugeridas</div>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {classificationResult.classification.suggestedActions.map((a: string, i: number) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
              {classificationResult.classification?.riskIfNotAddressed && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Riesgo si no se atiende</div>
                  <p className="text-sm text-gray-700">{classificationResult.classification.riskIfNotAddressed}</p>
                </div>
              )}
              {classificationResult.classification?.recommendedDeadlineDays && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Plazo sugerido</div>
                  <p className="text-sm text-gray-700">{classificationResult.classification.recommendedDeadlineDays} días</p>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <button onClick={() => setShowClassificationModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Panel */}
      {showAiChat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 h-[70vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-600" /> Asistente IA de Auditoría
              </h3>
              <button onClick={() => setShowAiChat(false)} className="p-1 hover:bg-gray-100 rounded text-gray-500">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <Bot className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Pregúntame sobre la norma ISO, clasificación de hallazgos, o cualquier duda de la auditoría.</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    <div className="whitespace-pre-line">{msg.content}</div>
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-2 rounded-lg text-sm text-gray-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Pensando...
                  </div>
                </div>
              )}
            </div>
            <form onSubmit={sendChatMessage} className="p-4 border-t border-gray-200 flex gap-2">
              <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                placeholder="Escribe tu pregunta sobre la auditoría..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
              <button type="submit" disabled={aiLoading || !chatInput.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm disabled:opacity-50">
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
