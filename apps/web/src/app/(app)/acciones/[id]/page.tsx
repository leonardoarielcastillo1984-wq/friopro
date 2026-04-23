'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  ChevronLeft, Save, CheckCircle, AlertTriangle, Sparkles,
  Loader2, FileText, Shield, Search, Wrench, Repeat, BarChart3, Lock
} from 'lucide-react';

const sourceTypeMap: Record<string, string> = {
  MANUAL: 'Manual', AUDIT: 'Auditoría', NCR: 'No Conformidad',
  INDICATOR: 'Indicador', REVIEW: 'Revisión Dirección', RISK: 'Riesgo',
  FODA: 'FODA', DAFO: 'DAFO', STAKEHOLDER: 'Parte Interesada',
};
const typeMap: Record<string, string> = {
  CORRECTIVE: 'Correctiva', PREVENTIVE: 'Preventiva', IMPROVEMENT: 'Mejora',
};
const statusMap: Record<string, string> = {
  OPEN: 'Abierta', IN_PROGRESS: 'En progreso', VERIFICATION: 'Verificación',
  CLOSED: 'Cerrada', CANCELLED: 'Cancelada',
};
const priorityMap: Record<string, string> = {
  LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica',
};
const originMap: Record<string, string> = {
  AUDIT: 'Auditoría', CLIENT: 'Cliente', PROCESS: 'Proceso',
  STAKEHOLDER: 'Parte Interesada', MANUAL: 'Manual',
};

function sourceTypeLabel(v?: string) { return sourceTypeMap[v || ''] || v || '—'; }
function typeLabel(v?: string) { return typeMap[v || ''] || v || '—'; }
function statusLabel(v?: string) { return statusMap[v || ''] || v || '—'; }
function priorityLabel(v?: string) { return priorityMap[v || ''] || v || '—'; }
function originLabel(v?: string) { return originMap[v || ''] || v || '—'; }

type ActionItem = {
  id: string;
  code: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  sourceType: string;
  progress: number;
  openDate?: string;
  dueDate?: string;
  closedAt?: string;
  assignedToId?: string;
  origin?: string;
  affectedArea?: string;
  detectedBy?: string;
  containmentActions?: string;
  containmentResponsibleId?: string;
  containmentImplementedAt?: string;
  containmentResult?: string;
  rootCauseMethod?: string;
  rootCause?: string;
  rootCauseEvidence?: string;
  correctiveAction?: string;
  correctiveResponsibleId?: string;
  correctiveDueDate?: string;
  correctiveResources?: string;
  preventiveAction?: string;
  processChanges?: string;
  documentationChanges?: string;
  verificationMethod?: string;
  relatedIndicatorId?: string;
  effectivenessResult?: string;
  effectivenessEvaluatedAt?: string;
  approvedById?: string;
  closureComments?: string;
};

const TABS = [
  { key: 'ident', label: '1. Identificación', icon: FileText },
  { key: 'contain', label: '2. Contención', icon: Shield },
  { key: 'root', label: '3. Causa Raíz', icon: Search },
  { key: 'corrective', label: '4. Correctiva', icon: Wrench },
  { key: 'preventive', label: '5. Recurrencia', icon: Repeat },
  { key: 'effectiveness', label: '6. Eficacia', icon: BarChart3 },
  { key: 'closure', label: '7. Cierre', icon: Lock },
];

export default function ActionDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [item, setItem] = useState<ActionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('ident');
  const [form, setForm] = useState<Partial<ActionItem>>({});
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<{ id: string; code: string; name: string }[]>([]);

  useEffect(() => { load(); loadIndicators(); }, [id]);
  useEffect(() => { if (item) setForm({ ...item }); }, [item]);

  async function load() {
    try {
      setLoading(true);
      const res = await apiFetch<{ item: ActionItem }>(`/actions/${id}`);
      setItem(res.item);
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
      await apiFetch(`/actions/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      await load();
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
        body: JSON.stringify({ message: prompt }),
      });
      const text = res?.response || res?.text || '';
      if (text) setForm(prev => ({ ...prev, [targetKey]: text }));
    } catch (e: any) {
      alert('Error IA: ' + (e?.message || 'desconocido'));
    } finally {
      setAiLoading(null);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!item) return <div className="flex items-center justify-center h-screen text-gray-500">Acción no encontrada</div>;

  const pct = item.progress ?? 0;
  let progressColor = 'bg-red-500';
  if (pct >= 80) progressColor = 'bg-green-500';
  else if (pct >= 50) progressColor = 'bg-yellow-500';
  else if (pct >= 20) progressColor = 'bg-orange-500';

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

  const Field = ({ label, k, type = 'text', options, placeholder, rows }: any) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {type === 'textarea' ? (
        <textarea value={(form as any)[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          rows={rows || 3} placeholder={placeholder} />
      ) : type === 'select' ? (
        <select value={(form as any)[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">Seleccionar...</option>
          {options?.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'date' ? (
        <input type="date" value={((form as any)[k] || '').slice(0, 10)} onChange={e => setForm({ ...form, [k]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      ) : (
        <input type="text" value={(form as any)[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder={placeholder} />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <button onClick={() => router.push('/acciones')} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-2">
            <ChevronLeft className="w-4 h-4" /> Volver al listado
          </button>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">{item.code}</span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                  item.status === 'CLOSED' ? 'bg-green-100 text-green-700' :
                  item.status === 'OPEN' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>{statusLabel(item.status)}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">{item.title}</h1>
              <p className="text-sm text-gray-500 mt-1">{item.description}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Progreso CAPA</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full ${progressColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
            {pct < 100 && item.status === 'CLOSED' && (
              <div className="flex items-center gap-1 mt-1 text-xs text-orange-600">
                <AlertTriangle className="w-3 h-3" /> La acción está cerrada pero el progreso no es 100%
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
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

        {/* TAB: Identificación */}
        {activeTab === 'ident' && (
          <SectionCard title="1. Identificación del Problema" fields={['origin','affectedArea','detectedBy']}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Origen" k="origin" type="select" options={[
                { value: 'AUDIT', label: 'Auditoría' }, { value: 'CLIENT', label: 'Cliente' },
                { value: 'PROCESS', label: 'Proceso' }, { value: 'STAKEHOLDER', label: 'Parte Interesada' },
                { value: 'MANUAL', label: 'Manual' },
              ]} />
              <Field label="Área Afectada" k="affectedArea" />
              <Field label="Detectado por" k="detectedBy" />
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              <strong>Datos base:</strong> Tipo: {typeLabel(item.type)}, Prioridad: {priorityLabel(item.priority)}, Origen sistema: {sourceTypeLabel(item.sourceType)}
            </div>
          </SectionCard>
        )}

        {/* TAB: Contención */}
        {activeTab === 'contain' && (
          <SectionCard title="2. Contención" fields={['containmentActions','containmentResponsibleId','containmentImplementedAt','containmentResult']}>
            <Field label="Acciones de contención" k="containmentActions" type="textarea" placeholder="Describa las acciones inmediatas para contener el problema..." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Responsable (UUID)" k="containmentResponsibleId" />
              <Field label="Fecha implementación" k="containmentImplementedAt" type="date" />
            </div>
            <Field label="Resultado de contención" k="containmentResult" type="textarea" placeholder="¿Fueron efectivas las acciones de contención?" />
          </SectionCard>
        )}

        {/* TAB: Causa Raíz */}
        {activeTab === 'root' && (
          <SectionCard title="3. Análisis de Causa Raíz" fields={['rootCauseMethod','rootCause','rootCauseEvidence']}
            aiButton={{ key: 'rootCause', label: 'Sugerir causa raíz',
              prompt: `Eres un experto en análisis de causa raíz (ISO 9001). Problema: "${item.title}". Detalle: "${item.description}". Identificá la causa raíz más probable. Respondé en español, conciso, 2-3 párrafos.` }}>
            <Field label="Método de análisis" k="rootCauseMethod" type="select" options={[
              { value: 'FIVE_WHY', label: '5 Porqués' }, { value: 'ISHIKAWA', label: 'Ishikawa' }, { value: 'OTHER', label: 'Otro' },
            ]} />
            <Field label="Causa raíz identificada" k="rootCause" type="textarea" rows={4} placeholder="Describa la causa raíz del problema..." />
            <Field label="Evidencia del análisis" k="rootCauseEvidence" type="textarea" placeholder="Datos, gráficos, observaciones que respaldan el análisis..." />
          </SectionCard>
        )}

        {/* TAB: Acción Correctiva */}
        {activeTab === 'corrective' && (
          <SectionCard title="4. Acción Correctiva" fields={['correctiveAction','correctiveResponsibleId','correctiveDueDate','correctiveResources']}
            aiButton={{ key: 'correctiveAction', label: 'Sugerir acción',
              prompt: `Eres un consultor ISO 9001. No conformidad: "${item.title}". Causa raíz: "${form.rootCause || 'Por definir'}". Proponé una acción correctiva específica, medible y realista. Respondé en español, 1-2 párrafos.` }}>
            <Field label="Acción correctiva" k="correctiveAction" type="textarea" rows={4} placeholder="Describa la acción para eliminar la causa raíz..." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Responsable (UUID)" k="correctiveResponsibleId" />
              <Field label="Fecha objetivo" k="correctiveDueDate" type="date" />
              <Field label="Recursos necesarios" k="correctiveResources" />
            </div>
          </SectionCard>
        )}

        {/* TAB: Evitar Recurrencia */}
        {activeTab === 'preventive' && (
          <SectionCard title="5. Acción para Evitar Recurrencia" fields={['preventiveAction','processChanges','documentationChanges']}
            aiButton={{ key: 'preventiveAction', label: 'Sugerir acción',
              prompt: `Eres un consultor ISO 9001. Para evitar que esta no conformidad vuelva a ocurrir: "${item.title}". Causa raíz: "${form.rootCause || 'Por definir'}". Proponé cambios sistémicos, en procesos o documentación. Respondé en español, 1-2 párrafos.` }}>
            <Field label="Acción preventiva / sistémica" k="preventiveAction" type="textarea" rows={4} placeholder="Describa la acción para evitar que el problema se repita..." />
            <Field label="Cambios en procesos" k="processChanges" type="textarea" placeholder="Procesos modificados o nuevos..." />
            <Field label="Cambios en documentación" k="documentationChanges" type="textarea" placeholder="Procedimientos, instructivos, registros actualizados..." />
          </SectionCard>
        )}

        {/* TAB: Eficacia */}
        {activeTab === 'effectiveness' && (
          <SectionCard title="6. Evaluación de Eficacia" fields={['verificationMethod','relatedIndicatorId','effectivenessResult','effectivenessEvaluatedAt']}
            aiButton={{ key: 'verificationMethod', label: 'Sugerir indicador',
              prompt: `Eres un consultor ISO 9001. Para verificar la eficacia de esta acción CAPA: "${item.title}". Descripción: "${item.description}". Causa raíz: "${form.rootCause || 'Por definir'}".\n\nSugerí UN indicador clave (KPI) que permita medir objetivamente si la acción fue efectiva. Incluí:\n1. Nombre del indicador\n2. Fórmula o método de medición\n3. Frecuencia sugerida\n4. Valor objetivo\n\nRespondé en español, conciso.` }}>
            <Field label="Método de verificación" k="verificationMethod" type="textarea" placeholder="¿Cómo se verificará que la acción fue efectiva?" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Indicador relacionado</label>
                <select
                  value={(form as any).relatedIndicatorId || ''}
                  onChange={e => setForm({ ...form, relatedIndicatorId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Seleccionar indicador...</option>
                  {indicators.map(ind => (
                    <option key={ind.id} value={ind.id}>{ind.code} — {ind.name}</option>
                  ))}
                </select>
                {indicators.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No hay indicadores disponibles. Creá uno primero.</p>
                )}
              </div>
              <Field label="Resultado" k="effectivenessResult" type="select" options={[
                { value: 'EFFECTIVE', label: 'Eficaz' }, { value: 'NOT_EFFECTIVE', label: 'No Eficaz' },
              ]} />
            </div>
            <Field label="Fecha de evaluación" k="effectivenessEvaluatedAt" type="date" />
            {form.effectivenessResult === 'NOT_EFFECTIVE' && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <div>
                  <strong>Acción no eficaz detectada.</strong><br/>
                  Se recomienda reabrir la acción o generar una nueva NC.
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* TAB: Cierre */}
        {activeTab === 'closure' && (
          <SectionCard title="7. Cierre" fields={['closedAt','approvedById','closureComments']}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Fecha de cierre" k="closedAt" type="date" />
              <Field label="Aprobado por (UUID)" k="approvedById" />
            </div>
            <Field label="Comentarios de cierre" k="closureComments" type="textarea" placeholder="Observaciones finales, lecciones aprendidas..." />

            {/* Validation summary */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Validaciones para cierre</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  {form.rootCause ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                  <span className={form.rootCause ? 'text-green-700' : 'text-red-700'}>Causa raíz definida</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {form.correctiveAction ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                  <span className={form.correctiveAction ? 'text-green-700' : 'text-red-700'}>Acción correctiva definida</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {form.effectivenessResult ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                  <span className={form.effectivenessResult ? 'text-green-700' : 'text-red-700'}>Evaluación de eficacia realizada</span>
                </div>
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
