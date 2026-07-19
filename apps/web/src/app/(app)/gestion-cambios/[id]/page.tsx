'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  ArrowLeft, Loader2, CheckCircle, Shield, Leaf, Cog, Cpu, Scale, Activity,
  Save, Sparkles, FileText, ClipboardList, AlertTriangle, FolderKanban,
  Camera, BadgeCheck, History, Info, Lightbulb,
} from 'lucide-react';

// ── Catálogos ─────────────────────────────────────────────
const DIMENSIONES = [
  { key: 'CALIDAD', label: 'Calidad / SGC', icon: CheckCircle },
  { key: 'SST', label: 'SST', icon: Shield },
  { key: 'AMBIENTAL', label: 'Ambiental', icon: Leaf },
  { key: 'OPERATIVO', label: 'Operativo', icon: Cog },
  { key: 'TECNOLOGICO', label: 'Tecnológico', icon: Cpu },
  { key: 'LEGAL', label: 'Legal / Regulatorio', icon: Scale },
  { key: 'CONTINUIDAD', label: 'Continuidad Operativa', icon: Activity },
] as const;

const DIMENSION_TO_COLUMN: Record<string, string> = {
  CALIDAD: 'impactoCalidad', SST: 'impactoSST', AMBIENTAL: 'impactoAmbiental',
  OPERATIVO: 'impactoOperativo', TECNOLOGICO: 'impactoTecnologico',
  LEGAL: 'impactoLegal', CONTINUIDAD: 'impactoContinuidad',
};

const IMPACTOS = ['BAJO', 'MEDIO', 'ALTO'];
const IMPACTO_COLORS: Record<string, string> = { BAJO: 'text-green-600', MEDIO: 'text-yellow-600', ALTO: 'text-red-600' };
const NIVEL_GLOBAL_COLORS: Record<string, string> = {
  BAJO: 'bg-green-100 text-green-700', MEDIO: 'bg-yellow-100 text-yellow-700',
  ALTO: 'bg-orange-100 text-orange-700', CRITICO: 'bg-red-100 text-red-700',
};
const STATUS_LABELS: Record<string, string> = {
  SOLICITADO: 'Solicitado', EN_REVISION: 'En Revisión', APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado', IMPLEMENTADO: 'Implementado',
  EN_VERIFICACION: 'En Verificación', VERIFICADO: 'Verificado', CERRADO: 'Cerrado',
};
const STATUS_COLORS: Record<string, string> = {
  SOLICITADO: 'bg-blue-100 text-blue-700', EN_REVISION: 'bg-yellow-100 text-yellow-700',
  APROBADO: 'bg-green-100 text-green-700', RECHAZADO: 'bg-red-100 text-red-700',
  IMPLEMENTADO: 'bg-purple-100 text-purple-700', EN_VERIFICACION: 'bg-orange-100 text-orange-700',
  VERIFICADO: 'bg-teal-100 text-teal-700', CERRADO: 'bg-gray-100 text-gray-600',
};
const TIPO_LABELS: Record<string, string> = {
  PROCESO: 'Proceso', ORGANIZACIONAL: 'Organizacional', PRODUCTO_SERVICIO: 'Producto/Servicio',
  INFRAESTRUCTURA: 'Infraestructura', PROVEEDOR: 'Proveedor', NORMATIVO: 'Normativo', OTRO: 'Otro',
};
const ORIGEN_LABELS: Record<string, string> = {
  AUDITORIA: 'Auditoría', NO_CONFORMIDAD: 'No Conformidad', MEJORA: 'Mejora Continua',
  CLIENTE: 'Cliente', LEGAL: 'Requisito Legal', INTERNO: 'Interno', OTRO: 'Otro',
};

// Etapas del workflow visual (RECHAZADO se muestra aparte)
const WORKFLOW = [
  { key: 'SOLICITADO', label: 'Solicitud' },
  { key: 'EN_REVISION', label: 'Evaluación' },
  { key: 'APROBADO', label: 'Aprobación' },
  { key: 'IMPLEMENTADO', label: 'Implementación' },
  { key: 'EN_VERIFICACION', label: 'Verificación' },
  { key: 'CERRADO', label: 'Cierre' },
];
// VERIFICADO (legacy) se mapea visualmente a la etapa de verificación
const STATUS_STAGE_INDEX: Record<string, number> = {
  SOLICITADO: 0, EN_REVISION: 1, APROBADO: 2, IMPLEMENTADO: 3,
  EN_VERIFICACION: 4, VERIFICADO: 4, CERRADO: 5, RECHAZADO: 1,
};

const TABS = [
  { key: 'resumen', label: 'Resumen', icon: Info },
  { key: 'evaluacion', label: 'Evaluación de Impacto', icon: Activity },
  { key: 'planificacion', label: 'Planificación', icon: ClipboardList },
  { key: 'riesgos', label: 'Riesgos', icon: AlertTriangle },
  { key: 'documentos', label: 'Documentos', icon: FileText },
  { key: 'proyecto', label: 'Proyecto', icon: FolderKanban },
  { key: 'evidencias', label: 'Evidencias', icon: Camera },
  { key: 'verificacion', label: 'Verificación de Eficacia', icon: BadgeCheck },
  { key: 'historial', label: 'Historial', icon: History },
];

type EvalRow = {
  dimension: string; nivel: string; justificacion?: string | null;
  responsableId?: string | null; fechaEvaluacion?: string | null; evidencia?: string | null;
};

export default function FichaCambioPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [cambio, setCambio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('resumen');
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [recs, setRecs] = useState<string[]>([]);

  // Estado editable de evaluación multidimensional
  const [evals, setEvals] = useState<Record<string, EvalRow>>({});
  const [savingEval, setSavingEval] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<{ cambio: any }>(`/gestion-cambios/${id}`);
      const c = r?.cambio;
      setCambio(c);
      // Inicializar el editor de evaluación desde detalle o desde columnas resumen
      const map: Record<string, EvalRow> = {};
      for (const d of DIMENSIONES) {
        const detail = (c?.evaluaciones || []).find((e: any) => e.dimension === d.key);
        const summary = c?.[DIMENSION_TO_COLUMN[d.key]];
        map[d.key] = {
          dimension: d.key,
          nivel: detail?.nivel || summary || 'BAJO',
          justificacion: detail?.justificacion || '',
          responsableId: detail?.responsableId || '',
          fechaEvaluacion: detail?.fechaEvaluacion ? String(detail.fechaEvaluacion).slice(0, 10) : '',
          evidencia: detail?.evidencia || '',
        };
      }
      setEvals(map);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    load();
    apiFetch<{ employees: any[] }>('/hr/employees')
      .then(r => setMembers((r?.employees || []).map((e: any) => ({
        id: e.id || '',
        name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || `ID: ${e.id}`,
      }))))
      .catch(() => {});
    apiFetch<{ recomendaciones: string[] }>(`/gestion-cambios/${id}/recommendations`)
      .then(r => setRecs(r?.recomendaciones || []))
      .catch(() => {});
  }, [id, load]);

  const memberName = (mid?: string | null) => members.find(m => m.id === mid)?.name || (mid ? mid : '—');

  const saveEvaluaciones = async () => {
    setSavingEval(true);
    try {
      const payload = {
        evaluaciones: DIMENSIONES.map(d => {
          const e = evals[d.key];
          return {
            dimension: d.key,
            nivel: e.nivel,
            justificacion: e.justificacion || null,
            responsableId: e.responsableId || null,
            fechaEvaluacion: e.fechaEvaluacion ? `${e.fechaEvaluacion}T00:00:00Z` : null,
            evidencia: e.evidencia || null,
          };
        }),
      };
      await apiFetch(`/gestion-cambios/${id}/evaluaciones`, { method: 'PUT', json: payload });
      await load();
      const r = await apiFetch<{ recomendaciones: string[] }>(`/gestion-cambios/${id}/recommendations`);
      setRecs(r?.recomendaciones || []);
    } catch (e: any) {
      alert('Error al guardar la evaluación: ' + e.message);
    } finally { setSavingEval(false); }
  };

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /> Cargando ficha...</div>;
  }
  if (!cambio) {
    return (
      <div className="p-6">
        <button onClick={() => router.push('/gestion-cambios')} className="flex items-center gap-2 text-sm text-blue-600 hover:underline mb-4"><ArrowLeft className="w-4 h-4" /> Volver</button>
        <p className="text-gray-500">No se encontró el cambio.</p>
      </div>
    );
  }

  const stageIdx = STATUS_STAGE_INDEX[cambio.status] ?? 0;
  const isRechazado = cambio.status === 'RECHAZADO';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.push('/gestion-cambios')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-3">
          <ArrowLeft className="w-4 h-4" /> Volver a Gestión de Cambios
        </button>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm text-blue-600 font-semibold">{cambio.code}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[cambio.status] || 'bg-gray-100 text-gray-600'}`}>{STATUS_LABELS[cambio.status] || cambio.status}</span>
              {cambio.nivelGlobal && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${NIVEL_GLOBAL_COLORS[cambio.nivelGlobal] || 'bg-gray-100 text-gray-600'}`}>NIVEL: {cambio.nivelGlobal}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">{cambio.titulo}</h1>
            <p className="text-sm text-gray-500 mt-1">ISO 9001:2015 — Cláusula 6.3 · Planificación y control de cambios</p>
          </div>
        </div>
      </div>

      {/* Workflow visual */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 overflow-x-auto">
        <div className="flex items-center min-w-max">
          {WORKFLOW.map((st, i) => {
            const done = !isRechazado && i < stageIdx;
            const current = !isRechazado && i === stageIdx;
            return (
              <div key={st.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${
                    current ? 'bg-blue-600 border-blue-600 text-white'
                    : done ? 'bg-green-500 border-green-500 text-white'
                    : 'bg-white border-gray-300 text-gray-400'
                  }`}>{done ? <CheckCircle className="w-4 h-4" /> : i + 1}</div>
                  <span className={`mt-1.5 text-xs whitespace-nowrap ${current ? 'text-blue-700 font-semibold' : 'text-gray-500'}`}>{st.label}</span>
                </div>
                {i < WORKFLOW.length - 1 && <div className={`w-12 h-0.5 mx-1 ${done ? 'bg-green-500' : 'bg-gray-200'}`} />}
              </div>
            );
          })}
        </div>
        {isRechazado && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="w-4 h-4" /> Este cambio fue <strong>rechazado</strong>{cambio.motivoRechazo ? `: ${cambio.motivoRechazo}` : ''}.</div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-1 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'resumen' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Descripción</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{cambio.descripcion}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <Field label="Tipo" value={TIPO_LABELS[cambio.tipo] || cambio.tipo} />
              <Field label="Origen" value={ORIGEN_LABELS[cambio.origen] || cambio.origen} />
              <Field label="Nivel global" value={cambio.nivelGlobal || '—'} />
              <Field label="Responsable" value={memberName(cambio.responsableId)} />
              <Field label="Aprobador" value={memberName(cambio.aprobadorId)} />
              <Field label="Fecha solicitud" value={fmt(cambio.fechaSolicitud)} />
              <Field label="Fecha prevista" value={fmt(cambio.fechaPrevista)} />
              <Field label="Fecha aprobación" value={fmt(cambio.fechaAprobacion)} />
              <Field label="Fecha cierre" value={fmt(cambio.fechaCierre)} />
              <Field label="Requiere capacitación" value={cambio.capacitacionRequerida ? 'Sí' : 'No'} />
              <Field label="Requiere comunicación" value={cambio.requiereComunicacion ? 'Sí' : 'No'} />
            </div>
            {cambio.recursosNecesarios && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Recursos necesarios</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{cambio.recursosNecesarios}</p>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <RecommendationsPanel nivelGlobal={cambio.nivelGlobal} recs={recs} />
          </div>
        </div>
      )}

      {tab === 'evaluacion' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Evaluación multidimensional del impacto. El <strong>nivel global</strong> se calcula automáticamente a partir de estas dimensiones. Cada dimensión puede tener su propio responsable.</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {DIMENSIONES.map(d => {
              const Icon = d.icon;
              const e = evals[d.key];
              if (!e) return null;
              return (
                <div key={d.key} className="border-b border-gray-100 last:border-0 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-4 h-4 ${IMPACTO_COLORS[e.nivel] || 'text-gray-500'}`} />
                    <span className="font-medium text-gray-800 text-sm">{d.label}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nivel de impacto</label>
                      <select value={e.nivel} onChange={ev => setEvals(p => ({ ...p, [d.key]: { ...p[d.key], nivel: ev.target.value } }))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {IMPACTOS.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Responsable</label>
                      <select value={e.responsableId || ''} onChange={ev => setEvals(p => ({ ...p, [d.key]: { ...p[d.key], responsableId: ev.target.value } }))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">—</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Fecha de evaluación</label>
                      <input type="date" value={e.fechaEvaluacion || ''} onChange={ev => setEvals(p => ({ ...p, [d.key]: { ...p[d.key], fechaEvaluacion: ev.target.value } }))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Evidencia / referencia</label>
                      <input value={e.evidencia || ''} onChange={ev => setEvals(p => ({ ...p, [d.key]: { ...p[d.key], evidencia: ev.target.value } }))}
                        placeholder="Opcional" className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-xs text-gray-500 mb-1">Justificación del impacto</label>
                      <textarea rows={2} value={e.justificacion || ''} onChange={ev => setEvals(p => ({ ...p, [d.key]: { ...p[d.key], justificacion: ev.target.value } }))}
                        placeholder="Fundamentá el nivel asignado..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Nivel global actual: <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${NIVEL_GLOBAL_COLORS[cambio.nivelGlobal] || 'bg-gray-100 text-gray-600'}`}>{cambio.nivelGlobal || '—'}</span></p>
            <button onClick={saveEvaluaciones} disabled={savingEval}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
              {savingEval ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar evaluación y recalcular nivel
            </button>
          </div>
        </div>
      )}

      {tab === 'historial' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Historial y trazabilidad</h3>
          {(cambio.historial || []).length === 0 ? (
            <p className="text-sm text-gray-400">Sin eventos registrados.</p>
          ) : (
            <div className="space-y-3">
              {(cambio.historial || []).map((h: any) => (
                <div key={h.id} className="flex gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-gray-800">{h.accion}</div>
                    {h.detalle && <div className="text-gray-500">{h.detalle}</div>}
                    <div className="text-xs text-gray-400 mt-0.5">
                      {fmtDateTime(h.createdAt)}{h.userName ? ` · ${h.userName}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'planificacion' && (
        <PlanificacionTab cambio={cambio} members={members} id={id} load={load} />
      )}

      {tab === 'riesgos' && (
        <RiesgosTab cambio={cambio} id={id} load={load} />
      )}

      {tab === 'documentos' && (
        <DocumentosTab cambio={cambio} id={id} load={load} />
      )}

      {tab === 'proyecto' && (
        <ProyectoTab cambio={cambio} id={id} load={load} />
      )}

      {tab === 'evidencias' && (
        <EvidenciasTab cambio={cambio} id={id} load={load} />
      )}

      {tab === 'verificacion' && (
        <VerificacionTab cambio={cambio} members={members} id={id} load={load} />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-800 mt-0.5">{value}</div>
    </div>
  );
}

function RecommendationsPanel({ nivelGlobal, recs }: { nivelGlobal?: string; recs: string[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-gray-700">Recomendaciones</h3>
      </div>
      {nivelGlobal && (
        <div className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold mb-3 ${NIVEL_GLOBAL_COLORS[nivelGlobal] || 'bg-gray-100 text-gray-600'}`}>
          Cambio {nivelGlobal}
        </div>
      )}
      {recs.length === 0 ? (
        <p className="text-sm text-gray-400">Completá la evaluación de impacto para ver recomendaciones.</p>
      ) : (
        <ul className="space-y-2">
          {recs.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> {r}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-400 mt-3">Clasificación automática basada en la evaluación multidimensional del impacto.</p>
    </div>
  );
}

function PlanificacionTab({ cambio, members, id, load }: { cambio: any; members: any[]; id: string; load: () => void }) {
  const [saving, setSaving] = useState(false);
  const [procesos, setProcesos] = useState<{ processId?: string; processName: string }[]>(cambio.procesos || []);
  const [partes, setPartes] = useState<{ stakeholderId?: string; stakeholderName: string }[]>(cambio.partes || []);
  const [plan, setPlan] = useState({
    objetivoCambio: cambio.objetivoCambio || '',
    alcance: cambio.alcance || '',
    fechaInicioPrevista: cambio.fechaInicioPrevista ? String(cambio.fechaInicioPrevista).slice(0, 10) : '',
    responsableGeneralId: cambio.responsableGeneralId || '',
    planComunicacion: cambio.planComunicacion || '',
    planCapacitacion: cambio.planCapacitacion || '',
    planContingencia: cambio.planContingencia || '',
    criteriosAceptacion: cambio.criteriosAceptacion || '',
    condicionesPrevias: cambio.condicionesPrevias || '',
  });

  const savePlanificacion = async () => {
    setSaving(true);
    try {
      await apiFetch(`/gestion-cambios/${id}/planificacion`, { method: 'PUT', json: plan });
      await load();
    } catch (e: any) {
      alert('Error al guardar planificación: ' + e.message);
    } finally { setSaving(false); }
  };

  const saveProcesos = async () => {
    setSaving(true);
    try {
      await apiFetch(`/gestion-cambios/${id}/procesos`, { method: 'PUT', json: { procesos } });
      await load();
    } catch (e: any) {
      alert('Error al guardar procesos: ' + e.message);
    } finally { setSaving(false); }
  };

  const savePartes = async () => {
    setSaving(true);
    try {
      await apiFetch(`/gestion-cambios/${id}/partes`, { method: 'PUT', json: { partes } });
      await load();
    } catch (e: any) {
      alert('Error al guardar partes interesadas: ' + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Planificación del cambio</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Objetivo del cambio</label>
            <textarea rows={2} value={plan.objetivoCambio} onChange={e => setPlan(p => ({ ...p, objetivoCambio: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Alcance</label>
            <textarea rows={2} value={plan.alcance} onChange={e => setPlan(p => ({ ...p, alcance: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha inicio prevista</label>
            <input type="date" value={plan.fechaInicioPrevista} onChange={e => setPlan(p => ({ ...p, fechaInicioPrevista: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Responsable general</label>
            <select value={plan.responsableGeneralId} onChange={e => setPlan(p => ({ ...p, responsableGeneralId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">—</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Plan de comunicación</label>
            <textarea rows={2} value={plan.planComunicacion} onChange={e => setPlan(p => ({ ...p, planComunicacion: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Plan de capacitación</label>
            <textarea rows={2} value={plan.planCapacitacion} onChange={e => setPlan(p => ({ ...p, planCapacitacion: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Plan de contingencia</label>
            <textarea rows={2} value={plan.planContingencia} onChange={e => setPlan(p => ({ ...p, planContingencia: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Criterios de aceptación</label>
            <textarea rows={2} value={plan.criteriosAceptacion} onChange={e => setPlan(p => ({ ...p, criteriosAceptacion: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Condiciones previas</label>
            <textarea rows={2} value={plan.condicionesPrevias} onChange={e => setPlan(p => ({ ...p, condicionesPrevias: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={savePlanificacion} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar planificación
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Procesos afectados</h3>
        <div className="space-y-2 mb-4">
          {procesos.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={p.processName} onChange={e => {
                const newProcesos = [...procesos];
                newProcesos[i] = { ...p, processName: e.target.value };
                setProcesos(newProcesos);
              }} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={() => setProcesos(procesos.filter((_, j) => j !== i))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setProcesos([...procesos, { processName: '' }])} className="text-sm text-blue-600 hover:underline">
          + Agregar proceso
        </button>
        <div className="mt-4 flex justify-end">
          <button onClick={saveProcesos} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar procesos
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Partes interesadas</h3>
        <div className="space-y-2 mb-4">
          {partes.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={p.stakeholderName} onChange={e => {
                const newPartes = [...partes];
                newPartes[i] = { ...p, stakeholderName: e.target.value };
                setPartes(newPartes);
              }} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nombre de la parte interesada" />
              <button onClick={() => setPartes(partes.filter((_, j) => j !== i))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setPartes([...partes, { stakeholderName: '' }])} className="text-sm text-blue-600 hover:underline">
          + Agregar parte interesada
        </button>
        <div className="mt-4 flex justify-end">
          <button onClick={savePartes} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar partes interesadas
          </button>
        </div>
      </div>
    </div>
  );
}

function RiesgosTab({ cambio, id, load }: { cambio: any; id: string; load: () => void }) {
  const [saving, setSaving] = useState(false);
  const [riesgos, setRiesgos] = useState<{ riskId?: string; riskType: string }[]>(cambio.riesgos || []);

  const saveRiesgos = async () => {
    setSaving(true);
    try {
      await apiFetch(`/gestion-cambios/${id}/riesgos`, { method: 'PUT', json: { riesgos } });
      await load();
    } catch (e: any) {
      alert('Error al guardar riesgos: ' + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Riesgos vinculados</h3>
      <div className="space-y-2 mb-4">
        {riesgos.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={r.riskType} onChange={e => {
              const newRiesgos = [...riesgos];
              newRiesgos[i] = { ...r, riskType: e.target.value };
              setRiesgos(newRiesgos);
            }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="RISK">Riesgo</option>
              <option value="OPPORTUNITY">Oportunidad</option>
            </select>
            <button onClick={() => setRiesgos(riesgos.filter((_, j) => j !== i))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => setRiesgos([...riesgos, { riskType: 'RISK' }])} className="text-sm text-blue-600 hover:underline mb-4">
        + Agregar riesgo
      </button>
      <div className="mt-4 flex justify-end">
        <button onClick={saveRiesgos} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar riesgos
        </button>
      </div>
    </div>
  );
}

function DocumentosTab({ cambio, id, load }: { cambio: any; id: string; load: () => void }) {
  const [saving, setSaving] = useState(false);
  const [documentos, setDocumentos] = useState<{ documentId?: string; estadoFrente: string }[]>(cambio.documentos || []);

  const saveDocumentos = async () => {
    setSaving(true);
    try {
      await apiFetch(`/gestion-cambios/${id}/documentos`, { method: 'PUT', json: { documentos } });
      await load();
    } catch (e: any) {
      alert('Error al guardar documentos: ' + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Documentos vinculados</h3>
      <div className="space-y-2 mb-4">
        {documentos.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={d.estadoFrente} onChange={e => {
              const newDocumentos = [...documentos];
              newDocumentos[i] = { ...d, estadoFrente: e.target.value };
              setDocumentos(newDocumentos);
            }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_REVISION">En Revisión</option>
              <option value="ACTUALIZADO">Actualizado</option>
              <option value="OBSOLETO">Obsoleto</option>
            </select>
            <button onClick={() => setDocumentos(documentos.filter((_, j) => j !== i))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => setDocumentos([...documentos, { estadoFrente: 'PENDIENTE' }])} className="text-sm text-blue-600 hover:underline mb-4">
        + Agregar documento
      </button>
      <div className="mt-4 flex justify-end">
        <button onClick={saveDocumentos} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar documentos
        </button>
      </div>
    </div>
  );
}

function ProyectoTab({ cambio, id, load }: { cambio: any; id: string; load: () => void }) {
  const [saving, setSaving] = useState(false);
  const [requiereProyecto, setRequiereProyecto] = useState(cambio.requiereProyecto || false);
  const [projectId, setProjectId] = useState(cambio.projectId || '');

  const saveProyecto = async () => {
    setSaving(true);
    try {
      await apiFetch(`/gestion-cambios/${id}/proyecto`, { method: 'PUT', json: { requiereProyecto, projectId } });
      await load();
    } catch (e: any) {
      alert('Error al guardar proyecto: ' + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Proyecto vinculado (Project360)</h3>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={requiereProyecto} onChange={e => setRequiereProyecto(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
          <label className="text-sm text-gray-700">Este cambio requiere un proyecto de implementación</label>
        </div>
        {requiereProyecto && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">ID del proyecto</label>
            <input value={projectId} onChange={e => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <button onClick={saveProyecto} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar proyecto
        </button>
      </div>
    </div>
  );
}

function EvidenciasTab({ cambio, id, load }: { cambio: any; id: string; load: () => void }) {
  const [saving, setSaving] = useState(false);
  const [evidencias, setEvidencias] = useState<{ titulo: string; descripcion?: string; tipo: string; fecha: string; fileUrl?: string; fileName?: string; areaProceso?: string }[]>(cambio.evidencias || []);

  const saveEvidencias = async () => {
    setSaving(true);
    try {
      await apiFetch(`/gestion-cambios/${id}/evidencias`, { method: 'PUT', json: { evidencias } });
      await load();
    } catch (e: any) {
      alert('Error al guardar evidencias: ' + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Evidencias del cambio</h3>
      <div className="space-y-4 mb-4">
        {evidencias.map((e, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input value={e.titulo} onChange={ev => {
                const newEvidencias = [...evidencias];
                newEvidencias[i] = { ...e, titulo: ev.target.value };
                setEvidencias(newEvidencias);
              }} placeholder="Título" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={e.tipo} onChange={ev => {
                const newEvidencias = [...evidencias];
                newEvidencias[i] = { ...e, tipo: ev.target.value };
                setEvidencias(newEvidencias);
              }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="DOCUMENTO">Documento</option>
                <option value="FOTO">Foto</option>
                <option value="VIDEO">Video</option>
                <option value="REGISTRO">Registro</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            <input value={e.fecha} onChange={ev => {
              const newEvidencias = [...evidencias];
              newEvidencias[i] = { ...e, fecha: ev.target.value };
              setEvidencias(newEvidencias);
            }} type="date" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <textarea value={e.descripcion || ''} onChange={ev => {
              const newEvidencias = [...evidencias];
              newEvidencias[i] = { ...e, descripcion: ev.target.value };
              setEvidencias(newEvidencias);
            }} placeholder="Descripción" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input value={e.areaProceso || ''} onChange={ev => {
              const newEvidencias = [...evidencias];
              newEvidencias[i] = { ...e, areaProceso: ev.target.value };
              setEvidencias(newEvidencias);
            }} placeholder="Área/Proceso" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={() => setEvidencias(evidencias.filter((_, j) => j !== i))} className="text-sm text-red-500 hover:underline">
              Eliminar evidencia
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => setEvidencias([...evidencias, { titulo: '', tipo: 'OTRO', fecha: new Date().toISOString().slice(0, 10) }])} className="text-sm text-blue-600 hover:underline mb-4">
        + Agregar evidencia
      </button>
      <div className="mt-4 flex justify-end">
        <button onClick={saveEvidencias} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar evidencias
        </button>
      </div>
    </div>
  );
}

function VerificacionTab({ cambio, members, id, load }: { cambio: any; members: any[]; id: string; load: () => void }) {
  const [saving, setSaving] = useState(false);
  const [verificacion, setVerificacion] = useState(cambio.verificaciones?.[0] || {
    fechaPrevista: '', fechaReal: '', responsableId: '', metodo: '', criteriosEficacia: '', resultado: '', observaciones: '',
  });

  const saveVerificacion = async () => {
    setSaving(true);
    try {
      await apiFetch(`/gestion-cambios/${id}/verificacion`, { method: 'PUT', json: verificacion });
      await load();
    } catch (e: any) {
      alert('Error al guardar verificación: ' + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Verificación de eficacia</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fecha prevista</label>
          <input type="date" value={verificacion.fechaPrevista ? String(verificacion.fechaPrevista).slice(0, 10) : ''} onChange={e => setVerificacion(v => ({ ...v, fechaPrevista: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fecha real</label>
          <input type="date" value={verificacion.fechaReal ? String(verificacion.fechaReal).slice(0, 10) : ''} onChange={e => setVerificacion(v => ({ ...v, fechaReal: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Responsable</label>
          <select value={verificacion.responsableId || ''} onChange={e => setVerificacion(v => ({ ...v, responsableId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">—</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Método de verificación</label>
          <input value={verificacion.metodo || ''} onChange={e => setVerificacion(v => ({ ...v, metodo: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Criterios de eficacia</label>
          <textarea rows={2} value={verificacion.criteriosEficacia || ''} onChange={e => setVerificacion(v => ({ ...v, criteriosEficacia: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Resultado</label>
          <select value={verificacion.resultado || ''} onChange={e => setVerificacion(v => ({ ...v, resultado: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">—</option>
            <option value="EFICAZ">Eficaz</option>
            <option value="PARCIALMENTE_EFICAZ">Parcialmente Eficaz</option>
            <option value="NO_EFICAZ">No Eficaz</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Observaciones</label>
          <textarea rows={2} value={verificacion.observaciones || ''} onChange={e => setVerificacion(v => ({ ...v, observaciones: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button onClick={saveVerificacion} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar verificación
        </button>
      </div>
    </div>
  );
}

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-AR'); } catch { return '—'; }
}
function fmtDateTime(d?: string | null) {
  if (!d) return '';
  try { return new Date(d).toLocaleString('es-AR'); } catch { return ''; }
}
