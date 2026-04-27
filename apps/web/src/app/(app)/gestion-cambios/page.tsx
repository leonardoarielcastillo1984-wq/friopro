'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  RefreshCw, Plus, X, CheckCircle, Clock, AlertTriangle,
  ChevronDown, FileText, User, Calendar, Filter, Search,
  ThumbsUp, ThumbsDown, Play, Check, Eye, Trash2, Edit,
  ArrowRight, Shield, Leaf, Activity, Sparkles, Loader2
} from 'lucide-react';

interface Cambio {
  id: string;
  code: string;
  titulo: string;
  descripcion: string;
  tipo: string;
  origen: string;
  impactoCalidad: string;
  impactoSST: string;
  impactoAmbiental: string;
  status: string;
  responsableId?: string;
  aprobadorId?: string;
  fechaSolicitud: string;
  fechaPrevista?: string;
  fechaAprobacion?: string;
  fechaCierre?: string;
  motivoRechazo?: string;
  recursosNecesarios?: string;
  capacitacionRequerida: boolean;
  documentosAfectados?: string;
  riesgosIdentificados?: string;
  verificacion?: string;
  historial?: any[];
}

interface Stats {
  total: number;
  solicitados: number;
  enRevision: number;
  aprobados: number;
  implementados: number;
  rechazados: number;
  cerrados: number;
}

const TIPOS = ['PROCESO', 'ORGANIZACIONAL', 'PRODUCTO_SERVICIO', 'INFRAESTRUCTURA', 'PROVEEDOR', 'NORMATIVO', 'OTRO'];
const ORIGENES = ['AUDITORIA', 'NO_CONFORMIDAD', 'MEJORA', 'CLIENTE', 'LEGAL', 'INTERNO', 'OTRO'];
const IMPACTOS = ['BAJO', 'MEDIO', 'ALTO'];

const TIPO_LABELS: Record<string, string> = {
  PROCESO: 'Proceso', ORGANIZACIONAL: 'Organizacional', PRODUCTO_SERVICIO: 'Producto/Servicio',
  INFRAESTRUCTURA: 'Infraestructura', PROVEEDOR: 'Proveedor', NORMATIVO: 'Normativo', OTRO: 'Otro',
};
const ORIGEN_LABELS: Record<string, string> = {
  AUDITORIA: 'Auditoría', NO_CONFORMIDAD: 'No Conformidad', MEJORA: 'Mejora Continua',
  CLIENTE: 'Cliente', LEGAL: 'Requisito Legal', INTERNO: 'Interno', OTRO: 'Otro',
};
const STATUS_LABELS: Record<string, string> = {
  SOLICITADO: 'Solicitado', EN_REVISION: 'En Revisión', APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado', IMPLEMENTADO: 'Implementado', VERIFICADO: 'Verificado', CERRADO: 'Cerrado',
};
const STATUS_COLORS: Record<string, string> = {
  SOLICITADO: 'bg-blue-100 text-blue-700',
  EN_REVISION: 'bg-yellow-100 text-yellow-700',
  APROBADO: 'bg-green-100 text-green-700',
  RECHAZADO: 'bg-red-100 text-red-700',
  IMPLEMENTADO: 'bg-purple-100 text-purple-700',
  VERIFICADO: 'bg-teal-100 text-teal-700',
  CERRADO: 'bg-gray-100 text-gray-600',
};
const IMPACTO_COLORS: Record<string, string> = {
  BAJO: 'text-green-600', MEDIO: 'text-yellow-600', ALTO: 'text-red-600',
};

const emptyForm = {
  titulo: '', descripcion: '', tipo: 'PROCESO', origen: 'INTERNO',
  impactoCalidad: 'BAJO', impactoSST: 'BAJO', impactoAmbiental: 'BAJO',
  responsableId: '', aprobadorId: '', fechaPrevista: '',
  recursosNecesarios: '', capacitacionRequerida: false,
  documentosAfectados: '', riesgosIdentificados: '',
};

export default function GestionCambiosPage() {
  const [cambios, setCambios] = useState<Cambio[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, solicitados: 0, enRevision: 0, aprobados: 0, implementados: 0, rechazados: 0, cerrados: 0 });
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTipo, setFilterTipo] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<Cambio | null>(null);
  const [showStatusModal, setShowStatusModal] = useState<{ cambio: Cambio; newStatus: string } | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [verificacion, setVerificacion] = useState('');
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const runAi = async (field: 'riesgosIdentificados' | 'recursosNecesarios') => {
    setAiLoading(field);
    try {
      const prompts: Record<string, string> = {
        riesgosIdentificados: `Eres un consultor ISO experto en gestión del cambio. Para este cambio planificado:\nTítulo: ${form.titulo || '—'}\nDescripción: ${form.descripcion || '—'}\nTipo: ${form.tipo}, Origen: ${form.origen}\nImpacto Calidad: ${form.impactoCalidad}, SST: ${form.impactoSST}, Ambiental: ${form.impactoAmbiental}\n\nIdentificá los 4-5 riesgos más probables asociados a este cambio y para cada uno indicar nivel (Bajo/Medio/Alto). Formato: - [Riesgo]: [Nivel]. Sin introducción.`,
        recursosNecesarios: `Eres un consultor ISO. Para este cambio:\nTítulo: ${form.titulo || '—'}\nDescripción: ${form.descripcion || '—'}\nTipo: ${form.tipo}\nRequiere capacitación: ${form.capacitacionRequerida ? 'Sí' : 'No'}\n\nListá los recursos típicamente necesarios para implementar este tipo de cambio: personas, tiempo, presupuesto estimado, equipamiento, capacitaciones. Una línea por recurso.`,
      };
      const res = await apiFetch<{ response?: string; text?: string }>('/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: prompts[field] }),
      });
      const text = res?.response || res?.text || '';
      if (text) setForm(prev => ({ ...prev, [field]: text }));
    } catch (e: any) {
      alert('Error IA: ' + e.message);
    } finally {
      setAiLoading(null);
    }
  };

  useEffect(() => {
    load();
    apiFetch<{ employees: any[] }>('/hr/employees')
      .then(r => setMembers((r?.employees || []).map((e: any) => {
        const id = e.id || '';
        const name = `${e.firstName || ''} ${e.lastName || ''}`.trim()
          || e.email || `ID: ${id}`;
        return { id, name };
      })))
      .catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        apiFetch<{ cambios: Cambio[] }>('/gestion-cambios'),
        apiFetch<Stats>('/gestion-cambios/stats'),
      ]);
      setCambios(c?.cambios || []);
      setStats(s || stats);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filtered = cambios.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterTipo !== 'all' && c.tipo !== filterTipo) return false;
    if (search && !c.titulo.toLowerCase().includes(search.toLowerCase()) && !c.code.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCreate = async () => {
    setSaving(true);
    try {
      await apiFetch('/gestion-cambios', {
        method: 'POST',
        json: { ...form, fechaPrevista: form.fechaPrevista ? `${form.fechaPrevista}T00:00:00Z` : undefined },
      });
      setShowModal(false);
      setForm({ ...emptyForm });
      await load();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally { setSaving(false); }
  };

  const handleStatusChange = async () => {
    if (!showStatusModal) return;
    setSaving(true);
    try {
      await apiFetch(`/gestion-cambios/${showStatusModal.cambio.id}/status`, {
        method: 'PUT',
        json: { status: showStatusModal.newStatus, motivoRechazo: motivoRechazo || undefined, verificacion: verificacion || undefined },
      });
      setShowStatusModal(null);
      setMotivoRechazo('');
      setVerificacion('');
      await load();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cambio?')) return;
    await apiFetch(`/gestion-cambios/${id}`, { method: 'DELETE' });
    await load();
  };

  const nextStatus = (current: string) => {
    const flow: Record<string, string> = {
      SOLICITADO: 'EN_REVISION', EN_REVISION: 'APROBADO', APROBADO: 'IMPLEMENTADO',
      IMPLEMENTADO: 'VERIFICADO', VERIFICADO: 'CERRADO',
    };
    return flow[current];
  };

  const getMemberName = (id?: string) => members.find(m => m.id === id)?.name || id || '—';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Cambios</h1>
          <p className="text-sm text-gray-500 mt-1">ISO 9001:2015 — Cláusula 6.3 · Planificación y control de cambios</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nuevo Cambio
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'bg-gray-50 border-gray-200', text: 'text-gray-700' },
          { label: 'Solicitados', value: stats.solicitados, color: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
          { label: 'En Revisión', value: stats.enRevision, color: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
          { label: 'Aprobados', value: stats.aprobados, color: 'bg-green-50 border-green-200', text: 'text-green-700' },
          { label: 'Implementados', value: stats.implementados, color: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
          { label: 'Rechazados', value: stats.rechazados, color: 'bg-red-50 border-red-200', text: 'text-red-700' },
          { label: 'Cerrados', value: stats.cerrados, color: 'bg-gray-50 border-gray-200', text: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-3 ${s.color}`}>
            <div className={`text-2xl font-bold ${s.text}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código o título..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">Todos los tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay cambios registrados</p>
          <p className="text-sm mt-1">Hacé clic en "Nuevo Cambio" para comenzar</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Código</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Título</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Impacto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha Prevista</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-blue-600">{c.code}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 max-w-xs truncate">{c.titulo}</div>
                    <div className="text-xs text-gray-400">{ORIGEN_LABELS[c.origen]}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{TIPO_LABELS[c.tipo]}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 text-xs">
                      <span title="Calidad" className={`flex items-center gap-1 ${IMPACTO_COLORS[c.impactoCalidad]}`}>
                        <CheckCircle className="w-3 h-3" />{c.impactoCalidad}
                      </span>
                      <span title="SST" className={`flex items-center gap-1 ${IMPACTO_COLORS[c.impactoSST]}`}>
                        <Shield className="w-3 h-3" />{c.impactoSST}
                      </span>
                      <span title="Ambiental" className={`flex items-center gap-1 ${IMPACTO_COLORS[c.impactoAmbiental]}`}>
                        <Leaf className="w-3 h-3" />{c.impactoAmbiental}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {c.fechaPrevista ? new Date(c.fechaPrevista).toLocaleDateString('es-AR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setShowDetail(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Ver detalle">
                        <Eye className="w-4 h-4" />
                      </button>
                      {nextStatus(c.status) && (
                        <button onClick={() => setShowStatusModal({ cambio: c, newStatus: nextStatus(c.status) })}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded" title={`Avanzar a ${STATUS_LABELS[nextStatus(c.status)]}`}>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                      {c.status === 'EN_REVISION' && (
                        <button onClick={() => setShowStatusModal({ cambio: c, newStatus: 'RECHAZADO' })}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Rechazar">
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Crear */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Nuevo Cambio</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título del cambio *</label>
                <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Ej: Actualización del proceso de compras" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                <textarea rows={3} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Describe el cambio propuesto y su justificación..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de cambio</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origen</label>
                  <select value={form.origen} onChange={e => setForm({ ...form, origen: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    {ORIGENES.map(o => <option key={o} value={o}>{ORIGEN_LABELS[o]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Evaluación de impacto</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'impactoCalidad', label: 'Calidad' },
                    { key: 'impactoSST', label: 'SST' },
                    { key: 'impactoAmbiental', label: 'Ambiental' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <select value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {IMPACTOS.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                  <select value={form.responsableId} onChange={e => setForm({ ...form, responsableId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="">Seleccionar...</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aprobador</label>
                  <select value={form.aprobadorId} onChange={e => setForm({ ...form, aprobadorId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="">Seleccionar...</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha prevista</label>
                  <input type="date" value={form.fechaPrevista} onChange={e => setForm({ ...form, fechaPrevista: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input type="checkbox" id="capReq" checked={form.capacitacionRequerida}
                    onChange={e => setForm({ ...form, capacitacionRequerida: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600" />
                  <label htmlFor="capReq" className="text-sm text-gray-700">Requiere capacitación</label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Documentos afectados</label>
                <input value={form.documentosAfectados} onChange={e => setForm({ ...form, documentosAfectados: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Ej: PG-001 Procedimiento de Compras, IT-005..." />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Riesgos identificados</label>
                  <button type="button" onClick={() => runAi('riesgosIdentificados')} disabled={aiLoading === 'riesgosIdentificados' || !form.titulo}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs bg-white border border-purple-200 text-purple-600 rounded hover:bg-purple-50 disabled:opacity-50">
                    {aiLoading === 'riesgosIdentificados' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Sugerir riesgos
                  </button>
                </div>
                <textarea rows={2} value={form.riesgosIdentificados} onChange={e => setForm({ ...form, riesgosIdentificados: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Describe los riesgos asociados al cambio..." />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Recursos necesarios</label>
                  <button type="button" onClick={() => runAi('recursosNecesarios')} disabled={aiLoading === 'recursosNecesarios' || !form.titulo}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs bg-white border border-purple-200 text-purple-600 rounded hover:bg-purple-50 disabled:opacity-50">
                    {aiLoading === 'recursosNecesarios' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Sugerir recursos
                  </button>
                </div>
                <textarea rows={2} value={form.recursosNecesarios} onChange={e => setForm({ ...form, recursosNecesarios: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Ej: 2 hs capacitación, actualización de software..." />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancelar</button>
              <button onClick={handleCreate} disabled={saving || !form.titulo || !form.descripcion}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                {saving ? 'Guardando...' : 'Crear Cambio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cambio de estado */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Cambiar estado a <span className={`px-2 py-0.5 rounded-full text-sm ${STATUS_COLORS[showStatusModal.newStatus]}`}>{STATUS_LABELS[showStatusModal.newStatus]}</span>
            </h2>
            <p className="text-sm text-gray-500">"{showStatusModal.cambio.titulo}"</p>
            {showStatusModal.newStatus === 'RECHAZADO' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo del rechazo *</label>
                <textarea rows={3} value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                  placeholder="Explica el motivo del rechazo..." />
              </div>
            )}
            {(showStatusModal.newStatus === 'VERIFICADO' || showStatusModal.newStatus === 'CERRADO') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resultado de verificación</label>
                <textarea rows={3} value={verificacion} onChange={e => setVerificacion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Describe el resultado de la implementación y verificación..." />
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setShowStatusModal(null); setMotivoRechazo(''); setVerificacion(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancelar</button>
              <button onClick={handleStatusChange} disabled={saving || (showStatusModal.newStatus === 'RECHAZADO' && !motivoRechazo)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                {saving ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel de detalle */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <span className="font-mono text-sm text-blue-600 font-medium">{showDetail.code}</span>
                <h2 className="text-lg font-semibold text-gray-900 mt-0.5">{showDetail.titulo}</h2>
              </div>
              <button onClick={() => setShowDetail(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5">
              <div className="flex gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[showDetail.status]}`}>{STATUS_LABELS[showDetail.status]}</span>
                <span className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600">{TIPO_LABELS[showDetail.tipo]}</span>
                <span className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600">{ORIGEN_LABELS[showDetail.origen]}</span>
                {showDetail.capacitacionRequerida && <span className="px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-700">Requiere capacitación</span>}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Descripción</h3>
                <p className="text-sm text-gray-600">{showDetail.descripcion}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Impacto Calidad', val: showDetail.impactoCalidad },
                  { label: 'Impacto SST', val: showDetail.impactoSST },
                  { label: 'Impacto Ambiental', val: showDetail.impactoAmbiental },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">{label}</div>
                    <div className={`text-sm font-semibold mt-1 ${IMPACTO_COLORS[val]}`}>{val}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Responsable:</span> <span className="font-medium">{getMemberName(showDetail.responsableId)}</span></div>
                <div><span className="text-gray-500">Aprobador:</span> <span className="font-medium">{getMemberName(showDetail.aprobadorId)}</span></div>
                <div><span className="text-gray-500">Solicitado:</span> <span className="font-medium">{new Date(showDetail.fechaSolicitud).toLocaleDateString('es-AR')}</span></div>
                <div><span className="text-gray-500">Fecha prevista:</span> <span className="font-medium">{showDetail.fechaPrevista ? new Date(showDetail.fechaPrevista).toLocaleDateString('es-AR') : '—'}</span></div>
              </div>
              {showDetail.documentosAfectados && <div><h3 className="text-sm font-semibold text-gray-700 mb-1">Documentos afectados</h3><p className="text-sm text-gray-600">{showDetail.documentosAfectados}</p></div>}
              {showDetail.riesgosIdentificados && <div><h3 className="text-sm font-semibold text-gray-700 mb-1">Riesgos identificados</h3><p className="text-sm text-gray-600">{showDetail.riesgosIdentificados}</p></div>}
              {showDetail.motivoRechazo && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><h3 className="text-sm font-semibold text-red-700 mb-1">Motivo de rechazo</h3><p className="text-sm text-red-600">{showDetail.motivoRechazo}</p></div>}
              {showDetail.verificacion && <div className="bg-green-50 border border-green-200 rounded-lg p-3"><h3 className="text-sm font-semibold text-green-700 mb-1">Verificación</h3><p className="text-sm text-green-600">{showDetail.verificacion}</p></div>}
              {showDetail.historial && showDetail.historial.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Historial</h3>
                  <div className="space-y-2">
                    {showDetail.historial.map((h: any) => (
                      <div key={h.id} className="flex items-start gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-gray-700">{h.accion}</span>
                          {h.detalle && <span className="text-gray-500"> — {h.detalle}</span>}
                          <div className="text-xs text-gray-400">{new Date(h.createdAt).toLocaleString('es-AR')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
