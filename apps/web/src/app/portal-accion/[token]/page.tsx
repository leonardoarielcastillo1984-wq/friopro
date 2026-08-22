'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList, FileDown, AlertCircle, CheckCircle, Clock, Loader2,
  Search, Building2, User, Calendar, TrendingUp, Filter, ExternalLink,
  Plus, FileWarning, FileText,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

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
  const canViewNcrs = access.canCreateNonConformities || access.canViewNcrOwn || access.canViewNcrScope;

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
            <h1 className="text-2xl font-bold text-gray-900">Portal de Planes de Acción</h1>
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

        {/* View tabs */}
        {canViewNcrs && (
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
              <FileWarning className="w-4 h-4 inline mr-1.5" /> Mis No Conformidades ({ncrs.length})
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

            {/* Plans Table */}
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Código</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Descripción</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Área</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Progreso</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Fin prev.</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredPlans.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-gray-400">
                          No hay planes que coincidan con los filtros
                        </td>
                      </tr>
                    )}
                    {filteredPlans.map((plan: any) => (
                      <tr
                        key={plan.id}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/portal-accion/${params.token}/plan/${plan.id}`)}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">
                          {plan.code || <span className="text-gray-400">Sin código</span>}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="truncate text-gray-700">
                            {plan.findingDescription || plan.classification || '—'}
                          </div>
                          {plan.ncr?.code && (
                            <div className="text-xs text-gray-400 mt-0.5">NCR: {plan.ncr.code}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{plan.area || plan.sector || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[plan.status] || 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABELS[plan.status] || plan.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 rounded-full"
                                style={{ width: `${plan.progressPercent || 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{plan.progressPercent || 0}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {plan.plannedEndDate ? new Date(plan.plannedEndDate).toLocaleDateString('es-AR') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {access.canDownloadPdf && (
                              <button
                                onClick={() => window.open(`${API_BASE}/portal-accion/public/${params.token}/plans/${plan.id}/pdf`, '_blank')}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Descargar PDF"
                              >
                                <FileDown className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => router.push(`/portal-accion/${params.token}/plan/${plan.id}`)}
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
