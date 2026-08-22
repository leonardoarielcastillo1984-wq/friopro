'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList, FileDown, AlertCircle, CheckCircle, Clock, Loader2,
  Search, Building2, User, Calendar, TrendingUp, Filter, ExternalLink,
  Plus, FileWarning, FileText, Sparkles,
} from 'lucide-react';
import { InlineCell, type CellType, type SelectOption } from '@/app/(app)/plan-accion/InlineCell';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

const TYPE_LABELS: Record<string, string> = {
  CORRECTIVE: 'Correctiva', PREVENTIVE: 'Preventiva', IMPPROVEMENT: 'Mejora',
};
const ORIGIN_LABELS: Record<string, string> = {
  AUDIT: 'Auditoría', COMPLAINT: 'Queja', INSPECTION: 'Inspección',
  REVIEW: 'Revisión', EXTERNAL: 'Externa', OTHER: 'Otra',
};
const METHOD_LABELS: Record<string, string> = {
  '5WHY': '5 Porqués', FISHBONE: 'Ishikawa', FTA: 'FTA', BRAINSTORM: 'Brainstorm', OTHER: 'Otra',
};
const EFF_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', EFFECTIVE: 'Eficaz', NOT_EFFECTIVE: 'No eficaz',
};

const STATUS_OPTS: SelectOption[] = [
  { value: 'DRAFT', label: 'Borrador' }, { value: 'OPEN', label: 'Abierto' },
  { value: 'IN_EXECUTION', label: 'En ejecución' }, { value: 'PENDING_EVIDENCE', label: 'Pend. evidencia' },
  { value: 'PENDING_EFFECTIVENESS', label: 'Pend. eficacia' },
  { value: 'EFFECTIVE', label: 'Eficaz' }, { value: 'NOT_EFFECTIVE', label: 'No eficaz' },
  { value: 'CLOSED', label: 'Cerrado' }, { value: 'CANCELLED', label: 'Cancelado' },
];
const METHOD_OPTS: SelectOption[] = [
  { value: '5WHY', label: '5 Porqués' }, { value: 'FISHBONE', label: 'Ishikawa' },
  { value: 'FTA', label: 'FTA' }, { value: 'BRAINSTORM', label: 'Brainstorm' }, { value: 'OTHER', label: 'Otra' },
];
const EFF_OPTS: SelectOption[] = [
  { value: 'PENDING', label: 'Pendiente' }, { value: 'EFFECTIVE', label: 'Eficaz' }, { value: 'NOT_EFFECTIVE', label: 'No eficaz' },
];

const MATRIX_COLUMNS = [
  { key: 'sequenceNumber', label: 'Nro', width: 50 },
  { key: 'ncrCode', label: 'NCR', width: 90 },
  { key: 'code', label: 'Código', width: 90 },
  { key: 'status', label: 'Estado', width: 120, editable: true, cellType: 'select' as CellType, options: STATUS_OPTS, field: 'status' },
  { key: 'type', label: 'Tipo', width: 100 },
  { key: 'origin', label: 'Origen', width: 100 },
  { key: 'severity', label: 'Criticidad', width: 80 },
  { key: 'site', label: 'Sede', width: 70 },
  { key: 'area', label: 'Área', width: 70 },
  { key: 'process', label: 'Proceso', width: 80 },
  { key: 'requirement', label: 'Requisito', width: 90, editable: true, cellType: 'text' as CellType, field: 'requirement' },
  { key: 'findingDescription', label: 'Desc. hallazgo', width: 180, editable: true, cellType: 'textarea' as CellType, field: 'findingDescription' },
  { key: 'observations', label: 'Observaciones', width: 130, editable: true, cellType: 'textarea' as CellType, field: 'observations' },
  { key: 'plannedStartDate', label: 'F. inicio prev.', width: 80, editable: true, cellType: 'date' as CellType, field: 'plannedStartDate' },
  { key: 'plannedEndDate', label: 'F. cierre prev.', width: 80, editable: true, cellType: 'date' as CellType, field: 'plannedEndDate' },
  { key: 'immediateCorrection', label: 'Corrección inmediata', width: 160, editable: true, cellType: 'textarea' as CellType, field: 'immediateCorrection' },
  { key: 'rootCauseAnalysis', label: 'Análisis causa raíz', width: 160, editable: true, cellType: 'textarea' as CellType, field: 'rootCauseAnalysis' },
  { key: 'analysisMethod', label: 'Metodología', width: 90, editable: true, cellType: 'select' as CellType, options: METHOD_OPTS, field: 'analysisMethod' },
  { key: 'validatedRootCause', label: 'Causa raíz validada', width: 130, editable: true, cellType: 'textarea' as CellType, field: 'validatedRootCause' },
  { key: 'plannedAction', label: 'Acción planificada', width: 160, editable: true, cellType: 'textarea' as CellType, field: 'plannedAction' },
  { key: 'expectedResult', label: 'Resultado esperado', width: 130, editable: true, cellType: 'textarea' as CellType, field: 'expectedResult' },
  { key: 'requiredResources', label: 'Recursos', width: 100, editable: true, cellType: 'textarea' as CellType, field: 'requiredResources' },
  { key: 'executorName', label: 'Responsable', width: 120, editable: true, cellType: 'text' as CellType, field: 'executorId', optionsKey: 'users' },
  { key: 'progressPercent', label: 'Avance %', width: 60, editable: true, cellType: 'number' as CellType, field: 'progressPercent', min: 0, max: 100 },
  { key: 'actualEndDate', label: 'F. real fin.', width: 80, editable: true, cellType: 'date' as CellType, field: 'actualEndDate' },
  { key: 'effectivenessCheckDate', label: 'F. verif. efic.', width: 80, editable: true, cellType: 'date' as CellType, field: 'effectivenessCheckDate' },
  { key: 'effectivenessMethod', label: 'Método verif.', width: 110, editable: true, cellType: 'text' as CellType, field: 'effectivenessMethod' },
  { key: 'effectivenessResult', label: 'Resultado verif.', width: 130, editable: true, cellType: 'textarea' as CellType, field: 'effectivenessResult' },
  { key: 'effectiveness', label: 'Eficaz?', width: 80, editable: true, cellType: 'select' as CellType, options: EFF_OPTS, field: 'effectiveness' },
  { key: 'createdAt', label: 'Creado', width: 80 },
  { key: 'updatedAt', label: 'Modificado', width: 80 },
  { key: 'actions', label: '', width: 60 },
];

function fmtDate(v: any) {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('es-AR'); } catch { return '—'; }
}

function toDateInput(d: string|null|undefined): string {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function getCellValue(plan: any, key: string, override?: any) {
  if (override && override[key] !== undefined) return override[key];
  if (key === 'ncrCode') return plan.ncr?.code ?? '—';
  if (key === 'executorName') return plan.executor ? (plan.executor.firstName ? `${plan.executor.firstName} ${plan.executor.lastName ?? ''}`.trim() : plan.executor.email) : '—';
  if (key === 'status') return STATUS_LABELS[plan.status] ?? plan.status ?? '—';
  if (key === 'type') return TYPE_LABELS[plan.type] ?? plan.type ?? '—';
  if (key === 'origin') return ORIGIN_LABELS[plan.origin] ?? plan.origin ?? '—';
  if (key === 'analysisMethod') return plan.analysisMethod ? (METHOD_LABELS[plan.analysisMethod] ?? plan.analysisMethod) : '—';
  if (key === 'effectiveness') return EFF_LABELS[plan.effectiveness] ?? plan.effectiveness ?? '—';
  if (key === 'progressPercent') return `${plan.progressPercent ?? 0}%`;
  if (key === 'createdAt' || key === 'updatedAt' || key === 'plannedStartDate' || key === 'plannedEndDate' || key === 'actualEndDate' || key === 'effectivenessCheckDate') return fmtDate(plan[key]);
  if (key === 'actions') return null;
  if (key === 'code') return plan.code ?? '—';
  return plan[key] ?? '—';
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', PENDING_CODE: 'Pend. código', PENDING_APPROVAL: 'Pend. aprobación',
  OPEN: 'Abierto', IN_EXECUTION: 'En ejecución', PENDING_EVIDENCE: 'Pend. evidencia',
  PENDING_EFFECTIVENESS: 'Pend. eficacia', EFFECTIVE: 'Eficaz', NOT_EFFECTIVE: 'No eficaz',
  OVERDUE: 'Vencido', CLOSED: 'Cerrado', CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_CODE: 'bg-amber-100 text-amber-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  OPEN: 'bg-blue-100 text-blue-700',
  IN_EXECUTION: 'bg-indigo-100 text-indigo-700',
  PENDING_EVIDENCE: 'bg-purple-100 text-purple-700',
  PENDING_EFFECTIVENESS: 'bg-cyan-100 text-cyan-700',
  EFFECTIVE: 'bg-green-100 text-green-700',
  NOT_EFFECTIVE: 'bg-red-100 text-red-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CLOSED: 'bg-gray-200 text-gray-600',
  CANCELLED: 'bg-gray-200 text-gray-500',
};

const NCR_STATUS_LABELS: Record<string, string> = {
  EXTERNAL_DRAFT: 'Borrador', REPORTED: 'Reportada', NEEDS_CORRECTION: 'Requiere corrección',
  OPEN: 'Abierta', IN_ANALYSIS: 'En análisis', ACTION_PLANNED: 'Acción planificada',
  IN_PROGRESS: 'En progreso', VERIFICATION: 'Verificación', CLOSED: 'Cerrada', CANCELLED: 'Cancelada',
};

const NCR_STATUS_COLORS: Record<string, string> = {
  EXTERNAL_DRAFT: 'bg-gray-100 text-gray-700',
  REPORTED: 'bg-blue-100 text-blue-700',
  NEEDS_CORRECTION: 'bg-amber-100 text-amber-700',
  OPEN: 'bg-green-100 text-green-700',
  IN_ANALYSIS: 'bg-indigo-100 text-indigo-700',
  ACTION_PLANNED: 'bg-purple-100 text-purple-700',
  IN_PROGRESS: 'bg-cyan-100 text-cyan-700',
  VERIFICATION: 'bg-teal-100 text-teal-700',
  CLOSED: 'bg-gray-200 text-gray-600',
  CANCELLED: 'bg-gray-200 text-gray-500',
};

const AI_FIELDS = ['immediateCorrection','rootCauseAnalysis','validatedRootCause','plannedAction','expectedResult'];

export default function PortalAccionPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [ncrs, setNcrs] = useState<any[]>([]);
  const [ncrLoading, setNcrLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [view, setView] = useState<'plans' | 'ncrs'>('plans');
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [planData, setPlanData] = useState<Record<string, any>>({});

  useEffect(() => {
    loadPortal();
  }, []);

  async function loadPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Error al cargar el portal');
      }
      const json = await res.json();
      setData(json);
      if (json.access?.canCreateNonConformities || json.access?.canViewNcrOwn || json.access?.canViewNcrScope) {
        loadNcrs();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadNcrs() {
    setNcrLoading(true);
    try {
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/ncr`);
      if (res.ok) {
        const json = await res.json();
        setNcrs(json.ncrs || []);
      }
    } catch {
      // silent
    } finally {
      setNcrLoading(false);
    }
  }

  const handleCellSave = useCallback(async (planId: string, field: string, value: string) => {
    try {
      let payload: any = { [field]: field === 'progressPercent' ? Number(value) : value };
      if (field === 'executorId') {
        const matched = (data.users || []).find((u: any) => u.label.toLowerCase() === value.toLowerCase().trim());
        payload = { executorId: matched ? matched.id : null };
      }
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar');
      }
      setPlanData(prev => ({
        ...prev,
        [planId]: { ...(prev[planId] || {}), [field]: value },
      }));
    } catch (e: any) {
      alert(e.message || 'Error al guardar');
    }
  }, [params.token, data]);

  async function aiFill(planId: string, field: string) {
    const key = `${planId}-${field}`;
    setAiLoading(s => ({ ...s, [key]: true }));
    try {
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/plans/${planId}/ai-fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error en IA');
      }
      const result = await res.json();
      setPlanData(prev => ({
        ...prev,
        [planId]: { ...(prev[planId] || {}), [field]: result.value },
      }));
    } catch (e: any) {
      alert(e.message || 'Error al generar con IA');
    }
    setAiLoading(s => { const ns = { ...s }; delete ns[key]; return ns; });
  }

  const filteredPlans = useMemo(() => {
    if (!data?.plans) return [];
    return data.plans.filter((p: any) => {
      const matchesSearch = !search ||
        (p.code || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.findingDescription || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.area || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.sector || '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  const stats = useMemo(() => {
    if (!data?.plans) return { total: 0, open: 0, inExecution: 0, closed: 0, overdue: 0 };
    const plans = data.plans;
    return {
      total: plans.length,
      open: plans.filter((p: any) => ['OPEN', 'PENDING_CODE', 'PENDING_APPROVAL'].includes(p.status)).length,
      inExecution: plans.filter((p: any) => p.status === 'IN_EXECUTION').length,
      closed: plans.filter((p: any) => ['CLOSED', 'EFFECTIVE'].includes(p.status)).length,
      overdue: plans.filter((p: any) =>
        p.plannedEndDate && !p.closedAt && !['CLOSED', 'CANCELLED', 'EFFECTIVE'].includes(p.status) &&
        new Date(p.plannedEndDate).getTime() < Date.now()
      ).length,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Cargando portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Acceso no disponible</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const { access, branding } = data;
  const docCode = data.docCode;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.name} className="h-8 max-w-[160px] object-contain" />
            ) : (
              <div className="text-lg font-bold" style={{ color: branding?.primaryColor || '#2563eb' }}>
                {branding?.name || 'SGI 360'}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700 font-medium">{access.recipientName}</span>
            {access.sector && (
              <span className="text-gray-400">|</span>
            )}
            {access.sector && (
              <span className="text-gray-500">{access.sector}</span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Title */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Portal de Planes de Acción</h1>
              {docCode && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  {docCode}
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm mt-1">
              Gestión colaborativa de planes de acción y no conformidades
            </p>
          </div>
          {access.canCreateNonConformities && (
            <button
              onClick={() => router.push(`/portal-accion/${params.token}/ncr/new`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Informar No Conformidad
            </button>
          )}
        </div>

        {/* View tabs — only show NCR tab if can create */}
        {access.canCreateNonConformities && (
          <div className="flex gap-1 border-b mb-6">
            <button
              onClick={() => setView('plans')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                view === 'plans' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ClipboardList className="w-4 h-4 inline mr-1.5" /> Planes de Acción ({data.plans?.length || 0})
            </button>
            <button
              onClick={() => setView('ncrs')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                view === 'ncrs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileWarning className="w-4 h-4 inline mr-1.5" /> No Conformidades ({ncrs.length})
            </button>
          </div>
        )}

        {view === 'plans' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total" value={stats.total} icon={ClipboardList} color="bg-blue-50 text-blue-600" />
              <StatCard label="Abiertos" value={stats.open} icon={Clock} color="bg-amber-50 text-amber-600" />
              <StatCard label="En ejecución" value={stats.inExecution} icon={TrendingUp} color="bg-indigo-50 text-indigo-600" />
              <StatCard label="Vencidos" value={stats.overdue} icon={AlertCircle} color="bg-red-50 text-red-600" />
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por código, descripción, área..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Todos los estados</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* Full Matrix Table */}
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="overflow-x-auto" style={{ maxHeight: '70vh' }}>
                <table className="border-collapse text-xs">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-gray-50 border-b">
                      {MATRIX_COLUMNS.map(col => (
                        <th
                          key={col.key}
                          style={{ minWidth: col.width, width: col.width }}
                          className="text-left px-2 py-2 font-semibold text-gray-600 border-r border-gray-200 whitespace-nowrap"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPlans.length === 0 && (
                      <tr>
                        <td colSpan={MATRIX_COLUMNS.length} className="text-center py-12 text-gray-400">
                          No hay planes que coincidan con los filtros
                        </td>
                      </tr>
                    )}
                    {filteredPlans.map((plan: any) => {
                      const override = planData[plan.id];
                      const isReadOnly = ['CLOSED','CANCELLED'].includes(plan.status);
                      const canEditRow = access.canEdit && !isReadOnly;
                      return (
                      <tr
                        key={plan.id}
                        className="hover:bg-blue-50/30 transition-colors"
                      >
                        {MATRIX_COLUMNS.map(col => (
                          <td
                            key={col.key}
                            style={{ minWidth: col.width, width: col.width }}
                            className="px-2 py-1.5 border-r border-gray-100 align-top"
                            onClick={(e) => (col.key === 'actions' || (col as any).editable || AI_FIELDS.includes(col.key)) && e.stopPropagation()}
                          >
                            {col.key === 'actions' ? (
                              <div className="flex items-center gap-1">
                                {access.canDownloadPdf && (
                                  <button
                                    onClick={() => window.open(`${API_BASE}/portal-accion/public/${params.token}/plans/${plan.id}/pdf`, '_blank')}
                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Descargar PDF"
                                  >
                                    <FileDown className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => router.push(`/portal-accion/${params.token}/plan/${plan.id}`)}
                                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Ver detalle"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (col as any).editable && (col as any).field ? (
                              <div className="flex items-start gap-1">
                                <div className="flex-1 min-w-0">
                                  <InlineCell
                                    value={(col as any).field === 'executorId' ? (plan.executor ? (plan.executor.firstName ? `${plan.executor.firstName} ${plan.executor.lastName ?? ''}`.trim() : plan.executor.email) : '') : (col as any).cellType === 'date' ? toDateInput(plan[(col as any).field]) : plan[(col as any).field]}
                                    type={(col as any).cellType}
                                    options={(col as any).optionsKey === 'users' ? (data.users || []) : (col as any).options}
                                    min={(col as any).min}
                                    max={(col as any).max}
                                    editable={canEditRow}
                                    displayValue={getCellValue(plan, col.key, override)}
                                    onSave={(v) => handleCellSave(plan.id, (col as any).field, v)}
                                  />
                                </div>
                                {AI_FIELDS.includes(col.key) && canEditRow && (
                                  <button
                                    onClick={() => aiFill(plan.id, col.key)}
                                    disabled={aiLoading[`${plan.id}-${col.key}`]}
                                    className="shrink-0 p-0.5 rounded text-purple-600 hover:bg-purple-100 disabled:opacity-40"
                                    title="Completar con IA"
                                  >
                                    {aiLoading[`${plan.id}-${col.key}`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            ) : col.key === 'progressPercent' ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${plan.progressPercent || 0}%` }} />
                                </div>
                                <span className="text-xs text-gray-500">{plan.progressPercent || 0}%</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-700 truncate block" title={String(getCellValue(plan, col.key, override))}>
                                {getCellValue(plan, col.key, override)}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {view === 'ncrs' && (
          <>
            {ncrLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : ncrs.length === 0 ? (
              <div className="bg-white rounded-lg border p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No informaste No Conformidades todavía</p>
                {access.canCreateNonConformities && (
                  <button
                    onClick={() => router.push(`/portal-accion/${params.token}/ncr/new`)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" /> Informar primera No Conformidad
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Código</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Título</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Severidad</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {ncrs.map((ncr: any) => (
                        <tr
                          key={ncr.id}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => router.push(`/portal-accion/${params.token}/ncr/${ncr.id}`)}
                        >
                          <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">
                            {ncr.code || <span className="text-gray-400">Pendiente</span>}
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <div className="truncate text-gray-700">{ncr.title}</div>
                            {ncr.reviewNotes && ncr.status === 'NEEDS_CORRECTION' && (
                              <div className="text-xs text-amber-600 mt-0.5">⚠ Requiere corrección</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              ncr.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                              ncr.severity === 'MAJOR' ? 'bg-orange-100 text-orange-700' :
                              ncr.severity === 'MINOR' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {ncr.severity}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${NCR_STATUS_COLORS[ncr.status] || 'bg-gray-100 text-gray-600'}`}>
                              {NCR_STATUS_LABELS[ncr.status] || ncr.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {new Date(ncr.createdAt).toLocaleDateString('es-AR')}
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {access.canDownloadNcrPdf && ncr.status !== 'EXTERNAL_DRAFT' && (
                                <button
                                  onClick={() => window.open(`${API_BASE}/portal-accion/public/${params.token}/ncr/${ncr.id}/pdf`, '_blank')}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Descargar PDF"
                                >
                                  <FileDown className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => router.push(`/portal-accion/${params.token}/ncr/${ncr.id}`)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Ver detalle"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-400">
          Portal externo SGI 360 — {branding?.name || 'Empresa'} —
          {access.expiresAt && ` Vence: ${new Date(access.expiresAt).toLocaleDateString('es-AR')}`}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-lg border p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}
