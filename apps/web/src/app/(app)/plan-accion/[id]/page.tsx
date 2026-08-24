'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  ChevronLeft, Save, CheckCircle, AlertTriangle, Sparkles,
  Loader2, FileText, Shield, Search, Wrench, Repeat, BarChart3, Lock,
  TrendingUp, ClipboardList,
} from 'lucide-react';

const ORIGIN_LABELS: Record<string, string> = {
  MANUAL: 'Manual', AUDIT: 'Auditoría', NCR: 'No Conformidad',
  INCIDENT: 'Incidente', COMPLAINT: 'Reclamo', INSPECTION: 'Inspección',
  INDICATOR: 'Indicador', MANAGEMENT_REVIEW: 'Revisión Dirección',
  RISK: 'Riesgo', OTHER: 'Otro',
};
const TYPE_LABELS: Record<string, string> = {
  IMMEDIATE_CORRECTION: 'Corrección Inmediata', CORRECTIVE: 'Correctiva',
  PREVENTIVE: 'Preventiva', IMPROVEMENT: 'Mejora', RISK_TREATMENT: 'Tratamiento Riesgo',
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', PENDING_CODE: 'Pend. Código', PENDING_APPROVAL: 'Pend. Aprobación',
  OPEN: 'Abierto', IN_EXECUTION: 'En Ejecución', PENDING_EVIDENCE: 'Pend. Evidencia',
  PENDING_EFFECTIVENESS: 'Pend. Eficacia', EFFECTIVE: 'Eficaz', NOT_EFFECTIVE: 'No Eficaz',
  OVERDUE: 'Vencido', CLOSED: 'Cerrado', CANCELLED: 'Cancelado',
};
const ANALYSIS_LABELS: Record<string, string> = {
  FIVE_WHYS: '5 Porqués', ISHIKAWA: 'Ishikawa', FAULT_TREE: 'Árbol de Falla',
  EIGHT_D: '8D', OTHER: 'Otro',
};
const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica',
};
const EFF_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', EFFECTIVE: 'Eficaz', NOT_EFFECTIVE: 'No Eficaz',
};

const TABS = [
  { key: 'ident',       label: '1. Identificación',   icon: FileText },
  { key: 'containment', label: '2. Contención',        icon: Shield },
  { key: 'root',        label: '3. Causa Raíz',        icon: Search },
  { key: 'corrective',  label: '4. Acción Planificada',icon: Wrench },
  { key: 'preventive',  label: '5. Recurrencia',       icon: Repeat },
  { key: 'risk',        label: '6. Riesgo',            icon: TrendingUp },
  { key: 'effectiveness',label: '7. Eficacia',          icon: BarChart3 },
  { key: 'closure',     label: '8. Cierre',            icon: Lock },
];

type Plan = Record<string, any>;

export default function PlanDeAccionDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('ident');
  const [form, setForm] = useState<Partial<Plan>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<{ id: string; code: string; name: string }[]>([]);

  useEffect(() => { load(); loadIndicators(); }, [id]);
  useEffect(() => { if (plan) setForm({ ...plan }); }, [plan]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(null), 3000); return () => clearTimeout(t); } }, [success]);

  async function load() {
    try {
      setLoading(true);
      const res = await apiFetch<{ plan: Plan }>(`/action-plans/${id}`);
      setPlan(res.plan);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  async function loadIndicators() {
    try {
      const res = await apiFetch<{ indicators: { id: string; code: string; name: string }[] }>('/indicadores/simple');
      setIndicators(res?.indicators || []);
    } catch {}
  }

  async function saveSection(fields: string[]) {
    setSaving(true);
    setError(null);
    try {
      const body: any = {};
      fields.forEach(k => {
        let v = (form as any)[k];
        if (v === '' || v === undefined) v = null;
        if (/Date$|At$/.test(k) && v) v = new Date(v).toISOString();
        body[k] = v;
      });
      const res = await apiFetch<{ plan: Plan }>(`/action-plans/${id}`, { method: 'PATCH', json: body });
      setPlan(res.plan);
      setSuccess('Guardado');
    } catch (e: any) {
      setError(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function runAi(prompt: string, targetKey: string) {
    setAiLoading(targetKey);
    try {
      const res = await apiFetch<{ response?: string; text?: string }>('/ai/chat', {
        method: 'POST',
        json: { message: prompt },
      });
      const text = res?.response || res?.text || '';
      if (text) setForm(prev => ({ ...prev, [targetKey]: text }));
    } catch (e: any) {
      alert('Error IA: ' + (e?.message || 'desconocido'));
    } finally {
      setAiLoading(null);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
  if (!plan) return (
    <div className="flex items-center justify-center h-screen text-gray-500">Plan no encontrado</div>
  );

  const pct = plan.progressPercent ?? 0;
  const progressColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : pct >= 20 ? 'bg-orange-500' : 'bg-red-500';

  const SectionCard = ({ title, children, fields, aiButton }: any) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          {aiButton && (
            <button onClick={() => runAi(aiButton.prompt, aiButton.key)} disabled={aiLoading === aiButton.key}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50">
              {aiLoading === aiButton.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {aiButton.label}
            </button>
          )}
          <button onClick={() => saveSection(fields)} disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Guardar
          </button>
        </div>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  );

  const Field = ({ label, k, type = 'text', options, placeholder, rows, disabled }: any) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {type === 'textarea' ? (
        <textarea value={(form as any)[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
          rows={rows || 3} placeholder={placeholder} disabled={disabled} />
      ) : type === 'select' ? (
        <select value={(form as any)[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" disabled={disabled}>
          <option value="">Seleccionar...</option>
          {options?.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'number' ? (
        <input type="number" value={(form as any)[k] ?? ''} onChange={e => setForm({ ...form, [k]: e.target.value ? Number(e.target.value) : null })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder={placeholder} disabled={disabled} />
      ) : type === 'date' ? (
        <input type="date" value={((form as any)[k] || '').slice(0, 10)} onChange={e => setForm({ ...form, [k]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" disabled={disabled} />
      ) : (
        <input type="text" value={(form as any)[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder={placeholder} disabled={disabled} />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <button onClick={() => router.push('/plan-accion')} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-2">
            <ChevronLeft className="w-4 h-4" /> Volver a Planes de Acción
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2 py-0.5 text-xs font-mono font-medium bg-gray-100 text-gray-700 rounded">
                  {plan.code || 'Sin código'}
                </span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                  plan.status === 'CLOSED' ? 'bg-green-100 text-green-700' :
                  plan.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                  plan.status === 'OPEN' || plan.status === 'IN_EXECUTION' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>{STATUS_LABELS[plan.status] ?? plan.status}</span>
                {plan.priority && (
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    plan.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                    plan.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                    plan.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{PRIORITY_LABELS[plan.priority]}</span>
                )}
                <span className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded">
                  {TYPE_LABELS[plan.type] ?? plan.type}
                </span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                {plan.findingDescription || 'Sin descripción'}
              </h1>
              {plan.ncr && (
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                  <ClipboardList className="w-3.5 h-3.5" />
                  NCR vinculada: <span className="font-mono">{plan.ncr.code}</span> — {plan.ncr.title}
                </p>
              )}
            </div>
          </div>
          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Avance del plan</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full ${progressColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}>
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {success}</div>}

        {/* TAB 1: Identificación */}
        {activeTab === 'ident' && (
          <SectionCard title="1. Identificación del Problema" fields={['origin','type','severity','priority','site','area','process','findingDescription','requirement','detectedBy','observations']}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Origen" k="origin" type="select" options={Object.entries(ORIGIN_LABELS).map(([v,l]) => ({value:v,label:l}))} />
              <Field label="Tipo" k="type" type="select" options={Object.entries(TYPE_LABELS).map(([v,l]) => ({value:v,label:l}))} />
              <Field label="Prioridad" k="priority" type="select" options={[
                {value:'LOW',label:'Baja'},{value:'MEDIUM',label:'Media'},{value:'HIGH',label:'Alta'},{value:'CRITICAL',label:'Crítica'},
              ]} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Sede" k="site" />
              <Field label="Área" k="area" />
              <Field label="Proceso" k="process" />
            </div>
            <Field label="Descripción del hallazgo" k="findingDescription" type="textarea" rows={3} placeholder="Descripción del problema o hallazgo..." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Requisito afectado" k="requirement" />
              <Field label="Detectado por" k="detectedBy" placeholder="Quién o qué detectó el problema" />
            </div>
            <Field label="Observaciones generales" k="observations" type="textarea" rows={2} />
          </SectionCard>
        )}

        {/* TAB 2: Contención */}
        {activeTab === 'containment' && (
          <SectionCard title="2. Corrección / Contención Inmediata" fields={['immediateCorrection']}
            aiButton={{ key: 'immediateCorrection', label: 'Sugerir contención',
              prompt: `Eres un experto ISO 9001. Para el siguiente problema: "${plan.findingDescription}". Sugerí acciones de contención inmediatas para limitar el impacto. Respondé en español, conciso, 2-3 párrafos.` }}>
            <Field label="Corrección / acciones de contención inmediata" k="immediateCorrection" type="textarea" rows={5}
              placeholder="Describa las acciones inmediatas para contener el problema antes de eliminar la causa raíz..." />
            <p className="text-xs text-gray-400">La contención limita el impacto mientras se analiza la causa raíz.</p>
          </SectionCard>
        )}

        {/* TAB 3: Causa Raíz */}
        {activeTab === 'root' && (
          <SectionCard title="3. Análisis de Causa Raíz" fields={['analysisMethod','rootCauseAnalysis','validatedRootCause']}
            aiButton={{ key: 'rootCauseAnalysis', label: 'Sugerir causa raíz',
              prompt: `Eres un experto en análisis de causa raíz (ISO 9001). Problema: "${plan.findingDescription}". Descripción: "${plan.observations || ''}". Identificá la causa raíz más probable usando lógica sistémica. Respondé en español, conciso, 2-3 párrafos.` }}>
            <Field label="Método de análisis" k="analysisMethod" type="select" options={Object.entries(ANALYSIS_LABELS).map(([v,l]) => ({value:v,label:l}))} />
            <Field label="Análisis de causa raíz" k="rootCauseAnalysis" type="textarea" rows={4} placeholder="Describa el análisis completo..." />
            <Field label="Causa raíz validada" k="validatedRootCause" type="textarea" rows={3} placeholder="Causa raíz identificada y validada..." />
          </SectionCard>
        )}

        {/* TAB 4: Acción Planificada */}
        {activeTab === 'corrective' && (
          <SectionCard title="4. Acción Planificada" fields={['plannedAction','expectedResult','requiredResources','executorNameText','plannedStartDate','plannedEndDate','progressPercent','status']}
            aiButton={{ key: 'plannedAction', label: 'Sugerir acción',
              prompt: `Eres un consultor ISO 9001. Problema: "${plan.findingDescription}". Causa raíz: "${form.validatedRootCause || form.rootCauseAnalysis || 'Por definir'}". Proponé una acción correctiva específica, medible y realista. Respondé en español, 1-2 párrafos.` }}>
            <Field label="Acción planificada" k="plannedAction" type="textarea" rows={4} placeholder="Describa la acción para eliminar la causa raíz..." />
            <Field label="Resultado esperado" k="expectedResult" type="textarea" rows={2} placeholder="¿Qué resultado se espera al ejecutar esta acción?" />
            <Field label="Recursos necesarios" k="requiredResources" type="textarea" rows={2} placeholder="Recursos humanos, materiales, presupuesto..." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Responsable" k="executorNameText" placeholder="Nombre del responsable" />
              <Field label="Fecha inicio planeada" k="plannedStartDate" type="date" />
              <Field label="Fecha cierre planeada" k="plannedEndDate" type="date" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Avance %" k="progressPercent" type="number" placeholder="0 - 100" />
              <Field label="Estado" k="status" type="select" options={Object.entries(STATUS_LABELS).map(([v,l]) => ({value:v,label:l}))} />
            </div>
          </SectionCard>
        )}

        {/* TAB 5: Recurrencia */}
        {activeTab === 'preventive' && (
          <SectionCard title="5. Acción para Evitar Recurrencia" fields={['preventiveAction','processChanges','documentationChanges']}
            aiButton={{ key: 'preventiveAction', label: 'Sugerir acción',
              prompt: `Eres un consultor ISO 9001. Para evitar que este problema vuelva a ocurrir: "${plan.findingDescription}". Causa raíz: "${form.validatedRootCause || form.rootCauseAnalysis || 'Por definir'}". Proponé cambios sistémicos, en procesos o documentación. Respondé en español, 1-2 párrafos.` }}>
            <Field label="Acción preventiva / sistémica" k="preventiveAction" type="textarea" rows={4} placeholder="Describa la acción para evitar que el problema se repita..." />
            <Field label="Cambios en procesos" k="processChanges" type="textarea" placeholder="Procesos modificados o nuevos..." />
            <Field label="Cambios en documentación" k="documentationChanges" type="textarea" placeholder="Procedimientos, instructivos, registros actualizados..." />
          </SectionCard>
        )}

        {/* TAB 6: Riesgo */}
        {activeTab === 'risk' && (
          <SectionCard title="6. Evaluación de Riesgo (Prob × Impacto)" fields={['initialProbability','initialImpact','initialRiskLevel','residualProbability','residualImpact','residualRiskLevel','riskReduction']}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Riesgo Inicial</h4>
                <Field label="Probabilidad (1-5)" k="initialProbability" type="number" placeholder="1 = Muy baja, 5 = Muy alta" />
                <Field label="Impacto (1-5)" k="initialImpact" type="number" placeholder="1 = Mínimo, 5 = Catastrófico" />
                <Field label="Nivel de riesgo inicial" k="initialRiskLevel" type="select" options={[
                  {value:'LOW',label:'Bajo'},{value:'MEDIUM',label:'Medio'},{value:'HIGH',label:'Alto'},{value:'CRITICAL',label:'Crítico'},
                ]} />
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Riesgo Residual</h4>
                <Field label="Probabilidad residual (1-5)" k="residualProbability" type="number" />
                <Field label="Impacto residual (1-5)" k="residualImpact" type="number" />
                <Field label="Nivel de riesgo residual" k="residualRiskLevel" type="select" options={[
                  {value:'LOW',label:'Bajo'},{value:'MEDIUM',label:'Medio'},{value:'HIGH',label:'Alto'},{value:'CRITICAL',label:'Crítico'},
                ]} />
              </div>
            </div>
            <Field label="% Reducción de riesgo" k="riskReduction" type="number" placeholder="Porcentaje de reducción logrado" />
          </SectionCard>
        )}

        {/* TAB 7: Eficacia */}
        {activeTab === 'effectiveness' && (
          <SectionCard title="7. Evaluación de Eficacia" fields={['effectivenessMethod','effectiveness','effectivenessCheckDate','effectivenessResult']}
            aiButton={{ key: 'effectivenessMethod', label: 'Sugerir indicador',
              prompt: `Eres un consultor ISO 9001. Para verificar la eficacia de esta acción: "${plan.findingDescription}". Causa raíz: "${plan.validatedRootCause || plan.rootCauseAnalysis || 'Por definir'}". Sugerí UN indicador clave (KPI) objetivo. Incluí: nombre, fórmula, frecuencia y valor objetivo. Respondé en español, conciso.` }}>
            <Field label="Método de verificación" k="effectivenessMethod" type="textarea" placeholder="¿Cómo se verificará que la acción fue efectiva?" rows={3} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {indicators.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indicador relacionado</label>
                  <select value={(form as any).relatedIndicatorId || ''}
                    onChange={e => setForm({ ...form, relatedIndicatorId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">Seleccionar indicador...</option>
                    {indicators.map(ind => <option key={ind.id} value={ind.id}>{ind.code} — {ind.name}</option>)}
                  </select>
                </div>
              )}
              <Field label="Resultado" k="effectiveness" type="select" options={[
                {value:'PENDING',label:'Pendiente'},{value:'EFFECTIVE',label:'Eficaz'},{value:'NOT_EFFECTIVE',label:'No Eficaz'},
              ]} />
            </div>
            <Field label="Resultado detallado" k="effectivenessResult" type="textarea" rows={2} placeholder="Descripción del resultado de la verificación..." />
            <Field label="Fecha de evaluación" k="effectivenessCheckDate" type="date" />
            {form.effectiveness === 'NOT_EFFECTIVE' && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div><strong>Acción no eficaz.</strong><br/>Se recomienda reabrir el plan o generar una nueva No Conformidad.</div>
              </div>
            )}
          </SectionCard>
        )}

        {/* TAB 8: Cierre */}
        {activeTab === 'closure' && (
          <SectionCard title="8. Cierre del Plan" fields={['actualEndDate','closedAt','cancellationReason','status']}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Fecha fin real" k="actualEndDate" type="date" />
              <Field label="Fecha de cierre" k="closedAt" type="date" />
            </div>
            <Field label="Motivo de cancelación (si aplica)" k="cancellationReason" type="textarea" rows={2} />
            <Field label="Estado" k="status" type="select" options={Object.entries(STATUS_LABELS).map(([v,l]) => ({value:v,label:l}))} />

            {/* Validaciones */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold text-gray-900">Validaciones para cierre</h4>
              <div className="space-y-1.5">
                {[
                  { check: !!(form.rootCauseAnalysis || form.validatedRootCause), label: 'Causa raíz definida' },
                  { check: !!form.plannedAction, label: 'Acción planificada definida' },
                  { check: form.progressPercent >= 100, label: 'Avance al 100%' },
                  { check: form.effectiveness !== 'PENDING' && !!form.effectiveness, label: 'Evaluación de eficacia realizada' },
                ].map(({ check, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm">
                    {check
                      ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      : <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                    <span className={check ? 'text-green-700' : 'text-red-700'}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
